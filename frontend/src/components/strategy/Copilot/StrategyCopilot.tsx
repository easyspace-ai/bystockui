import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Bot,
  Code2,
  Sparkles,
  Target,
  BookOpen,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Lightbulb,
  FileCode2,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const strategyWorkbenchHeaderClass =
  "flex min-h-[52px] shrink-0 items-center border-b border-slate-200 px-4 py-2 dark:border-slate-800";
import {
  modifyStrategy,
  optimizeStrategy,
  explainStrategy,
  type StrategyModifyResponse,
  type StrategyOptimizeResponse,
  type StrategyExplainResponse,
  type StrategySummary,
} from "@/lib/strategyApi";
import type { CopilotMode, CopilotMessage, ModificationResult } from "./types";
import { BUILTIN_TEMPLATES } from "./templates";

interface StrategyCopilotProps {
  currentStrategy: StrategySummary | null;
  currentCode: string;
  onCodeChange: (code: string) => void;
  onSchemaChange?: (schema: Record<string, unknown>) => void;
}

const MODE_CONFIG: Record<
  CopilotMode,
  {
    label: string;
    description: string;
    icon: ReactNode;
    placeholder: string;
  }
> = {
  modify: {
    label: "修改策略",
    description: "基于模板修改策略逻辑",
    icon: <Code2 className="w-4 h-4" />,
    placeholder: "描述你想要的修改，例如：添加RSI过滤，RSI大于70时不买入...",
  },
  optimize: {
    label: "优化策略",
    description: "优化策略性能和风险控制",
    icon: <Target className="w-4 h-4" />,
    placeholder: "描述优化目标，例如：降低最大回撤，提高夏普比率...",
  },
  explain: {
    label: "解释策略",
    description: "解读策略逻辑和参数",
    icon: <BookOpen className="w-4 h-4" />,
    placeholder: "点击发送即可获取策略的详细解释...",
  },
};

export function StrategyCopilot({
  currentStrategy,
  currentCode: _currentCode,
  onCodeChange,
  onSchemaChange,
}: StrategyCopilotProps) {
  const [mode, setMode] = useState<CopilotMode>("modify");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("双均线策略");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "welcome",
      role: "system",
      content: "我是策略编程助手。你可以让我：\n1. 基于模板修改策略\n2. 优化现有策略\n3. 解释策略逻辑",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [copied, setCopied] = useState(false);

  const handleSend = useCallback(async () => {
    if (!input.trim() && mode !== "explain") return;
    if (loading) return;

    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input || "请解释当前策略",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      let result: StrategyModifyResponse | StrategyOptimizeResponse | StrategyExplainResponse;
      let assistantContent = "";

      switch (mode) {
        case "modify":
          result = await modifyStrategy({
            template_name: selectedTemplate,
            requirements: input,
            temperature: 0.3,
          });
          assistantContent = `已基于「${selectedTemplate}」生成修改后的策略`;
          break;

        case "optimize":
          if (!currentStrategy?.id) {
            throw new Error("请先选择一个策略进行优化");
          }
          result = await optimizeStrategy(currentStrategy.id, {
            optimization_goal: input || "提高整体表现",
            temperature: 0.3,
          });
          assistantContent = `已生成优化建议和分析报告`;
          break;

        case "explain":
          if (!currentStrategy?.id) {
            throw new Error("请先选择一个策略进行解释");
          }
          result = await explainStrategy(currentStrategy.id);
          assistantContent = result.explanation;
          break;
      }

      const assistantMessage: CopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantContent,
        timestamp: new Date().toISOString(),
        result: result as ModificationResult,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setInput("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "请求失败";

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `❌ ${errorMessage}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, mode, selectedTemplate, currentStrategy, loading]);

  const applyCode = useCallback(() => {
    const result = messages[messages.length - 1]?.result as ModificationResult | undefined;
    if (result?.code) {
      onCodeChange(result.code);
      if (result.parameters_schema && onSchemaChange) {
        onSchemaChange(result.parameters_schema);
      }
    }
  }, [messages, onCodeChange, onSchemaChange]);

  const copyCode = useCallback(async () => {
    const result = messages[messages.length - 1]?.result as ModificationResult | undefined;
    if (result?.code) {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: "welcome",
        role: "system",
        content: "我是策略编程助手。你可以让我：\n1. 基于模板修改策略\n2. 优化现有策略\n3. 解释策略逻辑",
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const lastResultData = useMemo(() => {
    const lastMsg = messages[messages.length - 1];
    const r = lastMsg?.result;
    if (lastMsg?.role === "assistant" && r && typeof r === "object" && "is_valid" in r && "code" in r) {
      return r as ModificationResult;
    }
    return null;
  }, [messages]);

  return (
    <div className="flex h-full flex-col bg-[#fbfcfd] dark:bg-slate-950">
      <div
        className={cn(
          strategyWorkbenchHeaderClass,
          "bg-[#f6f7f9] dark:border-slate-800 dark:bg-slate-950",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Bot className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
                AI 策略助手
                <span className="font-normal text-slate-500 dark:text-slate-400">
                  {" "}
                  · {MODE_CONFIG[mode].description}
                </span>
              </div>
            </div>
          </div>
          <Badge
            variant={loading ? "default" : "secondary"}
            className={cn("shrink-0 px-2 py-0.5 text-[10px] font-medium", loading && "animate-pulse")}
          >
            {loading ? "处理中..." : "就绪"}
          </Badge>
        </div>
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as CopilotMode)}
        className="flex flex-1 flex-col min-h-0 gap-0"
      >
        <TabsList
          className="h-auto w-full grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
        >
          {(Object.keys(MODE_CONFIG) as CopilotMode[]).map((m) => (
            <TabsTrigger
              key={m}
              value={m}
              className="rounded-lg py-2 text-[11px] font-medium data-active:bg-white data-active:text-gray-900 data-active:shadow-sm dark:data-active:bg-gray-950 dark:data-active:text-gray-100"
            >
              <span className="flex items-center justify-center gap-1.5">
                {MODE_CONFIG[m].icon}
                {MODE_CONFIG[m].label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={mode} className="m-0 flex flex-1 flex-col border-0 p-0 min-h-0">
          {mode === "modify" && (
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">选择基础模板</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {BUILTIN_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 p-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {lastResultData ? (
                <ResultCard result={lastResultData} onApply={applyCode} onCopy={copyCode} copied={copied} />
              ) : null}
            </div>
          </ScrollArea>

          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={MODE_CONFIG[mode].placeholder}
                className="min-h-20 resize-none border-0 bg-transparent p-3 text-[13px] shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                <Button variant="ghost" size="sm" onClick={clearMessages} className="h-7 text-[11px] text-slate-500">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  清空
                </Button>
                <Button
                  onClick={() => void handleSend()}
                  disabled={loading || (!input.trim() && mode !== "explain")}
                  size="sm"
                  className="h-8 text-[12px]"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-1.5" />
                  )}
                  {mode === "explain" ? "获取解释" : "发送"}
                </Button>
              </div>
            </div>
            <div className="mt-2 text-center text-[11px] text-slate-400">按 Cmd/Ctrl + Enter 快速发送</div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MessageBubble({ message }: { message: CopilotMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[95%] rounded-lg px-3 py-2.5 text-[13px] leading-relaxed",
          isUser
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : isSystem
              ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              : "border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function ResultCard({
  result,
  onApply,
  onCopy,
  copied,
}: {
  result: ModificationResult;
  onApply: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const changes = "changes" in result && Array.isArray(result.changes) ? result.changes : [];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {result.is_valid ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
          <span
            className={cn(
              "text-[12px] font-medium",
              result.is_valid ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
            )}
          >
            {result.is_valid ? "代码验证通过" : "代码存在验证问题"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onCopy} className="h-7 text-[11px]">
            {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            {copied ? "已复制" : "复制"}
          </Button>
          <Button size="sm" onClick={onApply} className="h-7 bg-slate-900 text-[11px] hover:bg-slate-800">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            应用代码
          </Button>
        </div>
      </div>

      {changes.length > 0 ? (
        <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Lightbulb className="w-3.5 h-3.5" />
            修改内容
          </div>
          <ul className="space-y-1">
            {changes.map((change, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-slate-700 dark:text-slate-300">
                <ChevronRight className="mt-0.5 w-3.5 shrink-0 text-slate-400" />
                {change}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.errors?.length ? (
        <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-rose-500">
            <AlertTriangle className="w-3.5 h-3.5" />
            验证错误
          </div>
          <ul className="space-y-1">
            {result.errors.map((error, i) => (
              <li key={i} className="text-[12px] text-rose-600 dark:text-rose-400">
                • {error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.parameters_schema && Object.keys(result.parameters_schema).length > 0 ? (
        <div className="px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <FileCode2 className="w-3.5 h-3.5" />
            参数配置 ({Object.keys(result.parameters_schema).length} 个)
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(result.parameters_schema)
              .slice(0, 5)
              .map(([key, value]) => {
                const raw = (value as { default?: unknown })?.default;
                const shown = raw === undefined || raw === null ? "N/A" : String(raw);
                return (
                  <Badge key={key} variant="outline" className="text-[10px] font-normal">
                    {key}: {shown}
                  </Badge>
                );
              })}
            {Object.keys(result.parameters_schema).length > 5 ? (
              <Badge variant="outline" className="text-[10px] font-normal">
                +{Object.keys(result.parameters_schema).length - 5}
              </Badge>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
