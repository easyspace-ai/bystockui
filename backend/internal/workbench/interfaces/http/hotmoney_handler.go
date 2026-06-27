package httpapi

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"aistock/backend/internal/hotmoney"
	"aistock/backend/internal/workbench/ports"

	"github.com/gin-gonic/gin"
)

// HotMoneyHandler 游资大佬看盘 AI 接口（UZI-style data pipeline + LLM HTML report）
type HotMoneyHandler struct {
	pipeline *hotmoney.Pipeline
	sessions *hotmoney.SessionStore
}

type HotMoneyHandlerConfig struct {
	DataDir    string
	SessionDB  string
	StockRepo  ports.StockRepository
}

func NewHotMoneyHandler(cfg HotMoneyHandlerConfig) (*HotMoneyHandler, error) {
	searcher := hotmoney.NewRepoSearcher(cfg.StockRepo)
	quoteProv := hotmoney.NewRepoQuoteProvider(cfg.StockRepo)
	p, err := hotmoney.NewPipeline(hotmoney.PipelineConfig{
		DataDir:   cfg.DataDir,
		Searcher:  searcher,
		QuoteProv: quoteProv,
	})
	if err != nil {
		return nil, err
	}
	store, err := hotmoney.OpenSessionStore(cfg.SessionDB)
	if err != nil {
		_ = p.Close()
		return nil, err
	}
	return &HotMoneyHandler{pipeline: p, sessions: store}, nil
}

func (h *HotMoneyHandler) RegisterRoutes(r *gin.RouterGroup) {
	g := r.Group("/hotmoney")
	g.POST("/chat/stream", h.ChatStream)
	g.GET("/sessions", h.ListSessions)
	g.GET("/sessions/:id", h.GetSession)
	g.POST("/sessions", h.SaveSession)
	g.DELETE("/sessions/:id", h.DeleteSession)
}

func hotmoneyUserID(c *gin.Context) string {
	userId := c.GetHeader("X-User-Id")
	if userId == "" {
		userId = "default"
	}
	return userId
}

func (h *HotMoneyHandler) ListSessions(c *gin.Context) {
	summaries, err := h.sessions.ListSessions(c.Request.Context(), hotmoneyUserID(c), 50)
	if err != nil {
		c.JSON(http.StatusOK, Error(err.Error()))
		return
	}
	if summaries == nil {
		summaries = []hotmoney.SessionSummary{}
	}
	c.JSON(http.StatusOK, Success(summaries))
}

func (h *HotMoneyHandler) GetSession(c *gin.Context) {
	sess, err := h.sessions.GetSession(c.Request.Context(), hotmoneyUserID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, Success(sess))
}

func (h *HotMoneyHandler) SaveSession(c *gin.Context) {
	var req struct {
		ID         string               `json:"id"`
		Title      string               `json:"title"`
		Messages   []hotmoney.ChatMessage `json:"messages"`
		HTMLReport string               `json:"htmlReport"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, Error(err.Error()))
		return
	}
	sess, err := h.sessions.SaveSession(c.Request.Context(), hotmoneyUserID(c), hotmoney.SaveSessionInput{
		ID:         req.ID,
		Title:      req.Title,
		Messages:   req.Messages,
		HTMLReport: req.HTMLReport,
	})
	if err != nil {
		c.JSON(http.StatusOK, Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, Success(sess))
}

func (h *HotMoneyHandler) DeleteSession(c *gin.Context) {
	if err := h.sessions.DeleteSession(c.Request.Context(), hotmoneyUserID(c), c.Param("id")); err != nil {
		c.JSON(http.StatusOK, Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, Success(nil))
}

type hotMoneyChatRequest struct {
	Messages   []aiMessage `json:"messages"`
	ReportMode string      `json:"report_mode"`
}

func resolveReportMode(req hotMoneyChatRequest) string {
	mode := strings.ToLower(strings.TrimSpace(req.ReportMode))
	if mode == "uzi" || mode == "llm" {
		return mode
	}
	return hotmoney.DefaultReportMode()
}

func (h *HotMoneyHandler) ChatStream(c *gin.Context) {
	var req hotMoneyChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "messages required"})
		return
	}

	reportMode := resolveReportMode(req)
	lastUser := lastUserMessage(req.Messages)

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)

	w := c.Writer
	flusher, ok := w.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming not supported"})
		return
	}
	flusher.Flush()

	var sseMu sync.Mutex
	writeSSE := func(payload any) {
		b, err := json.Marshal(payload)
		if err != nil {
			return
		}
		sseMu.Lock()
		defer sseMu.Unlock()
		_, _ = io.WriteString(w, "data: "+string(b)+"\n\n")
		flusher.Flush()
	}
	writeDone := func() {
		sseMu.Lock()
		defer sseMu.Unlock()
		_, _ = io.WriteString(w, "data: [DONE]\n\n")
		flusher.Flush()
	}

	writeSSE(hotmoney.ProgressEvent{Stage: "start", Message: "收到请求，准备分析…"})

	if reportMode == "uzi" {
		h.chatStreamUZI(c, lastUser, writeSSE, writeDone)
		return
	}

	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("DEEPSEEK_API_KEY")
	}
	baseURL := os.Getenv("OPENAI_BASE_URL")
	if baseURL == "" {
		baseURL = "https://api.deepseek.com"
	}
	model := os.Getenv("OPENAI_MODEL")
	if model == "" {
		model = "deepseek-chat"
	}

	if apiKey == "" {
		writeSSE(hotmoney.ProgressEvent{Stage: "error", Message: "未配置 API Key，请在 backend/.env 设置 OPENAI_API_KEY 或 DEEPSEEK_API_KEY"})
		writeDone()
		return
	}

	systemPrompt := hotmoney.BuildSystemPrompt()
	userMessages := req.Messages

	if h.pipeline != nil && lastUser != "" {
		tsCode, dataContext, meta, err := h.pipeline.PrepareContext(c.Request.Context(), lastUser, func(ev hotmoney.ProgressEvent) {
			writeSSE(ev)
		})
		if err != nil {
			writeSSE(hotmoney.ProgressEvent{Stage: "error", Message: err.Error()})
			writeDone()
			return
		}
		if tsCode != "" && dataContext != "" {
			writeSSE(gin.H{"stage": "meta", "meta": meta})
			writeSSE(hotmoney.ProgressEvent{Stage: "analyze", Message: "数据就绪，启动 66 视角 LLM 分析…"})
			systemPrompt += "\n\n## 系统预抓取的真实市场数据\n\n" + dataContext
		} else if tsCode != "" {
			writeSSE(gin.H{"stage": "meta", "meta": meta})
		}
	}

	chatReq := map[string]interface{}{
		"model": model,
		"messages": append([]aiMessage{
			{Role: "system", Content: systemPrompt},
		}, userMessages...),
		"stream":      true,
		"temperature": 0.75,
		"max_tokens":  8192,
	}

	body, _ := json.Marshal(chatReq)
	apiURL := fmt.Sprintf("%s/chat/completions", strings.TrimRight(baseURL, "/"))
	httpReq, err := http.NewRequestWithContext(c.Request.Context(), "POST", apiURL, bytes.NewReader(body))
	if err != nil {
		writeSSE(hotmoney.ProgressEvent{Stage: "error", Message: err.Error()})
		writeDone()
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	llmResp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		writeSSE(hotmoney.ProgressEvent{Stage: "error", Message: err.Error()})
		writeDone()
		return
	}
	defer llmResp.Body.Close()

	if llmResp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(llmResp.Body, 4096))
		msg := strings.TrimSpace(string(errBody))
		if msg == "" {
			msg = llmResp.Status
		}
		writeSSE(hotmoney.ProgressEvent{Stage: "error", Message: "LLM 请求失败: " + msg})
		writeDone()
		return
	}

	scanner := bufio.NewScanner(llmResp.Body)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			writeSSE(gin.H{"content": chunk.Choices[0].Delta.Content})
		}
	}

	writeDone()
}

func (h *HotMoneyHandler) chatStreamUZI(
	c *gin.Context,
	lastUser string,
	writeSSE func(any),
	writeDone func(),
) {
	uziDir := ""
	if h.pipeline != nil {
		uziDir = h.pipeline.UZIDir()
	}
	if strings.TrimSpace(uziDir) == "" {
		uziDir = hotmoney.ResolveUZIDir()
	}
	if strings.TrimSpace(uziDir) == "" {
		writeSSE(hotmoney.ProgressEvent{Stage: "error", Message: "未找到 UZI-Skill 目录（请设置 HOTMONEY_UZI_DIR 或将 UZI-Skill 放在仓库根目录）"})
		writeDone()
		return
	}
	if strings.TrimSpace(lastUser) == "" {
		writeSSE(hotmoney.ProgressEvent{Stage: "error", Message: "请输入股票代码或名称"})
		writeDone()
		return
	}

	tsCode := hotmoney.ResolveTSCode(lastUser)
	if h.pipeline != nil {
		tsCode = h.pipeline.ResolveUserText(lastUser)
	}
	if tsCode == "" {
		writeSSE(hotmoney.ProgressEvent{Stage: "error", Message: "无法识别股票代码，请使用如 600519.SH 或「贵州茅台」"})
		writeDone()
		return
	}

	writeSSE(hotmoney.ProgressEvent{Stage: "resolve", Message: fmt.Sprintf("识别标的 %s", tsCode)})
	writeSSE(hotmoney.ProgressEvent{Stage: "uzi", Message: "启动 UZI-Skill 完整报告管道（可能需要数分钟）…"})

	ctx, cancel := context.WithTimeout(c.Request.Context(), hotmoney.UZIReportTimeout())
	defer cancel()

	heartbeatCtx, stopHeartbeat := context.WithCancel(ctx)
	defer stopHeartbeat()
	go func() {
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-heartbeatCtx.Done():
				return
			case <-ticker.C:
				writeSSE(hotmoney.ProgressEvent{Stage: "uzi", Message: "UZI 报告生成中，请稍候…"})
			}
		}
	}()

	result, err := hotmoney.TryUZIReport(ctx, uziDir, tsCode,
		func(line string) {
			if msg := hotmoney.UZIStdoutToProgress(line); msg != "" {
				writeSSE(hotmoney.ProgressEvent{Stage: "uzi", Message: msg})
			}
		},
		func(line string) {
			if msg := hotmoney.UZIStderrToProgress(line); msg != "" {
				writeSSE(hotmoney.ProgressEvent{Stage: "uzi_progress", Message: msg})
			}
		},
	)
	if err != nil {
		userMsg := hotmoney.UserFacingUZIError(err)
		if hotmoney.UZIExposeDebugErrors() {
			userMsg = hotmoney.UZIErrorDetail(err)
		}
		log.Printf("hotmoney uzi stream error ts=%s: %s", tsCode, hotmoney.UZIErrorDetail(err))
		writeSSE(hotmoney.ProgressEvent{Stage: "error", Message: userMsg})
		writeDone()
		return
	}
	defer os.RemoveAll(result.OutDir)

	meta := hotmoney.ReportMeta{TSCode: tsCode}
	if raw := hotmoney.ParseUZIReportMeta(result.MetaPath); raw != nil {
		if v, ok := raw["one_liner"].(string); ok && v != "" {
			meta.Name = v
		}
	}
	writeSSE(gin.H{"stage": "meta", "meta": meta})
	writeSSE(hotmoney.ProgressEvent{Stage: "report", Message: "UZI 报告生成完成，正在推送到预览…"})

	hotmoney.StreamHTMLAsSSE(result.HTML, 48*1024, func(content string) {
		writeSSE(gin.H{"content": content})
	})
	writeDone()
}

func lastUserMessage(msgs []aiMessage) string {
	for i := len(msgs) - 1; i >= 0; i-- {
		if msgs[i].Role == "user" {
			return msgs[i].Content
		}
	}
	return ""
}
