import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Loader2,
  Copy,
  Check,
  History,
  Plus,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { extractChatSummary, extractHtmlReport, type ReportHeroMeta } from "./htmlReportUtils";
import {
  deleteHotMoneySession,
  formatSessionTime,
  getHotMoneySession,
  listHotMoneySessions,
  saveHotMoneySession,
  type HotMoneyChatMessage,
  type HotMoneySessionSummary,
} from "./hotmoneyApi";

export interface HotMoneyMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface HotMoneyChatPanelProps {
  chatKey: string;
  sessionId: string | null;
  initialMessages?: HotMoneyMessage[];
  onContentUpdate: (fullContent: string) => void;
  onReportMeta?: (meta: ReportHeroMeta | null) => void;
  onPipelineStatus?: (status: string | null) => void;
  onStreamEnd?: () => void;
  onSessionIdChange: (id: string | null) => void;
}

const WELCOME_MESSAGE: HotMoneyMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "欢迎来到游资大佬看盘！\n\n我是融合赵老哥、章盟主、作手新一等顶级游资视角的 AI 助手。输入股票代码或名称，我会生成专业的 HTML 看盘报告。\n\n试试：\n- \"分析 600519 贵州茅台\"\n- \"002217 今天能不能打板？\"\n- \"帮我看看最近龙虎榜上的妖股\"",
};

const CHAT_API = "/api/v1/hotmoney/chat/stream";

type StreamEvent = {
  content?: string;
  stage?: string;
  message?: string;
  meta?: ReportHeroMeta;
};

type PanelTab = "chat" | "history";

function toApiMessages(msgs: HotMoneyMessage[]): HotMoneyChatMessage[] {
  return msgs
    .filter((m) => m.id !== "welcome" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
}

export function HotMoneyChatPanel({
  chatKey,
  sessionId,
  initialMessages,
  onContentUpdate,
  onReportMeta,
  onPipelineStatus,
  onStreamEnd,
  onSessionIdChange,
}: HotMoneyChatPanelProps) {
  const [tab, setTab] = useState<PanelTab>("chat");
  const [messages, setMessages] = useState<HotMoneyMessage[]>(
    initialMessages?.length ? initialMessages : [WELCOME_MESSAGE],
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [history, setHistory] = useState<HotMoneySessionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (tab === "chat") scrollToBottom();
  }, [messages, tab, scrollToBottom]);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await listHotMoneySessions();
      setHistory(rows);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "加载历史失败");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "history") return;
    void refreshHistory();
  }, [tab, refreshHistory]);

  const persistSession = useCallback(
    async (msgs: HotMoneyMessage[], htmlReport: string) => {
      const apiMessages = toApiMessages(msgs);
      if (apiMessages.length === 0) return;
      try {
        const saved = await saveHotMoneySession({
          id: sessionId ?? undefined,
          messages: apiMessages,
          htmlReport,
        });
        onSessionIdChange(saved.id);
      } catch {
        // save failure should not block chat UX
      }
    },
    [sessionId, onSessionIdChange],
  );

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: HotMoneyMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setIsLoading(true);
    setPipelineStatus("准备分析…");
    onPipelineStatus?.("准备分析…");
    onReportMeta?.(null);
    onContentUpdate("");

    let fullContent = "";
    let sseBuffer = "";

    try {
      const history = [...messages.filter((m) => m.id !== "welcome"), userMessage];
      const response = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          report_mode: "uzi",
        }),
      });

      if (!response.ok) throw new Error(`请求失败 (${response.status})`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();

      const handleSSELine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        let parsed: StreamEvent;
        try {
          parsed = JSON.parse(data) as StreamEvent;
        } catch {
          return;
        }
        if (parsed.stage === "error" && parsed.message) {
          throw new Error(parsed.message);
        }
        if (parsed.stage === "meta" && parsed.meta) {
          onReportMeta?.(parsed.meta);
          return;
        }
        if (parsed.stage && parsed.message) {
          setPipelineStatus(parsed.message);
          onPipelineStatus?.(parsed.message);
          return;
        }
        if (parsed.content) {
          fullContent += parsed.content;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m)),
          );
          onContentUpdate(fullContent);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";

        for (const line of lines) {
          handleSSELine(line);
        }
      }
      if (sseBuffer.trim()) {
        handleSSELine(sseBuffer.trim());
      }

      const finalMessages = [...messages.filter((m) => m.id !== "welcome"), userMessage, { id: assistantId, role: "assistant" as const, content: fullContent }];
      const htmlReport = extractHtmlReport(fullContent) ?? "";
      await persistSession(finalMessages, htmlReport);
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `抱歉，生成报告时出现了错误: ${error instanceof Error ? error.message : "未知错误"}`,
              }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
      setPipelineStatus(null);
      onPipelineStatus?.(null);
      onStreamEnd?.();
    }
  };

  const handleNewChat = () => {
    onSessionIdChange(null);
    setMessages([WELCOME_MESSAGE]);
    onContentUpdate("");
    setTab("chat");
  };

  const handleOpenSession = async (id: string) => {
    setOpeningSessionId(id);
    setHistoryError(null);
    try {
      const session = await getHotMoneySession(id);
      const restored: HotMoneyMessage[] = session.messages.map((m, i) => ({
        id: `${m.role}-${i}`,
        role: m.role,
        content: m.content,
      }));
      onSessionIdChange(session.id);
      setMessages(restored.length ? restored : [WELCOME_MESSAGE]);
      const lastAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
      onContentUpdate(lastAssistant?.content ?? session.htmlReport ?? "");
      setTab("chat");
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "打开会话失败");
    } finally {
      setOpeningSessionId(null);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteHotMoneySession(id);
      setHistory((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) handleNewChat();
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(content.slice(0, 20));
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const displayContent = (content: string) => {
    const summary = extractChatSummary(content);
    return summary || content;
  };

  const tabs = [
    { id: "chat" as const, label: "对话", Icon: MessageSquare },
    { id: "history" as const, label: "历史", Icon: History },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      <div className="shrink-0 border-b border-slate-200/50 px-4 py-3 dark:border-slate-800/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">游资大佬看盘</h2>
              <p className="text-[10px] text-slate-500">UZI-Skill 完整 HTML · 66 视角</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200/60 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-white dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <Plus className="h-3 w-3" />
            新对话
          </button>
        </div>
        <div className="mt-2 flex gap-0.5 rounded-lg bg-slate-200/50 p-0.5 dark:bg-slate-800/60">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-all",
                tab === id
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "history" ? (
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 px-4 py-3">
            {historyError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                {historyError}
              </p>
            ) : null}
            {historyLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载历史…
              </div>
            ) : null}
            {!historyLoading && history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
                暂无历史会话。完成一次看盘分析后会自动保存。
              </div>
            ) : null}
            {history.map((session) => {
              const opening = openingSessionId === session.id;
              return (
                <div
                  key={session.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") void handleOpenSession(session.id);
                  }}
                  onClick={() => void handleOpenSession(session.id)}
                  className={cn(
                    "group w-full cursor-pointer rounded-xl border border-slate-200/60 bg-white p-3 text-left transition-colors hover:border-amber-300 dark:border-slate-700/60 dark:bg-slate-900 dark:hover:border-amber-700/50",
                    sessionId === session.id && "border-amber-400/60 ring-1 ring-amber-400/20",
                    openingSessionId != null && !opening && "opacity-50 pointer-events-none",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                        {session.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{formatSessionTime(session.updatedAt)}</p>
                      {session.preview ? (
                        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-500">{session.preview}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => void handleDeleteSession(session.id, e)}
                      className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                      aria-label="删除会话"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {opening ? (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      加载中…
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4 px-4 py-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      msg.role === "user"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-amber-500 text-white"
                        : "border border-slate-200/60 bg-white text-slate-700 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    {!msg.content && isLoading && msg.id === messages[messages.length - 1]?.id ? (
                      <div className="flex flex-col gap-1 text-slate-400">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-xs">{pipelineStatus ?? "大佬们正在看盘…"}</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="whitespace-pre-wrap break-words">
                          {msg.role === "assistant" ? displayContent(msg.content) : msg.content}
                        </div>
                        {msg.role === "assistant" && msg.content && msg.id !== "welcome" && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => void handleCopy(msg.content)}
                              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                              {copiedId === msg.content.slice(0, 20) ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  已复制
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  复制
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t border-slate-200/50 px-4 py-3 dark:border-slate-800/50">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入股票代码或看盘问题…"
                className="min-h-[40px] max-h-[100px] w-full resize-none rounded-lg border border-slate-200/60 bg-white px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={() => void handleSubmit()}
                disabled={!input.trim() || isLoading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white transition-all hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">Enter 发送 · Shift+Enter 换行</p>
          </div>
        </>
      )}
    </div>
  );
}
