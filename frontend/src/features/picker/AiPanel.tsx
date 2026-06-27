import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, Bot, User, Loader2, Copy, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { findSavedStrategyMatch } from "@/features/picker/savedStrategies";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatStreamEvent {
  content?: string;
  strategy?: unknown;
}

interface AiPanelProps {
  onApplyStrategy?: (strategy: StrategyConfig, savedId?: string) => void;
  onSaveStrategy?: (strategy: StrategyConfig) => { id: string } | void;
  onSaved?: () => void;
}

export interface StrategyConfig {
  strategy_type: "end_of_day" | "momentum" | "kunpeng";
  name: string;
  description: string;
  params: Record<string, unknown>;
  explanation?: string;
  steps?: string[];
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "你好！我是 AI 选股助手。你可以用自然语言描述你的选股需求，我会帮你推荐合适的策略和参数。\n\n例如：\n- \"我想找低估值高分红的蓝筹股\"\n- \"帮我筛选近期放量突破的中小盘股\"\n- \"我想做尾盘强势股，流通市值50-200亿\"",
};

function parseStrategyJson(text: string): StrategyConfig | null {
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/;
  const match = text.match(jsonBlockRegex);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as StrategyConfig;
  } catch {
    return null;
  }
}

export function AiPanel({ onApplyStrategy, onSaveStrategy, onSaved }: AiPanelProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/picker/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error(`请求失败 (${response.status})`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as ChatStreamEvent;
            if (parsed.content) {
              fullContent += parsed.content;
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m)));
            }
          } catch {
            // skip invalid JSON lines
          }
        }
      }

      // Strategy parsed; user can apply or save via action buttons on the message.
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `抱歉，生成策略时出现了错误: ${error instanceof Error ? error.message : "未知错误"}` } : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
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

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      <div className="shrink-0 border-b border-slate-200/50 px-4 py-3 dark:border-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">AI 策略助手</h2>
            <p className="text-[10px] text-slate-500">用自然语言描述你的选股需求</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 px-4 py-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                }`}
              >
                {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white"
                    : "border border-slate-200/60 bg-white text-slate-700 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {!msg.content && isLoading && msg.id === messages[messages.length - 1]?.id ? (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">思考中...</span>
                  </div>
                ) : (
                  <div>
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    {msg.role === "assistant" && msg.content && (
                      <>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(msg.content)}
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
                        {parseStrategyJson(msg.content) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {onApplyStrategy && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-6 text-[10px] px-2"
                                onClick={() => {
                                  const s = parseStrategyJson(msg.content);
                                  if (s) {
                                    const existing = findSavedStrategyMatch(s);
                                    onApplyStrategy(s, existing?.id);
                                  }
                                }}
                              >
                                应用策略
                              </Button>
                            )}
                            {onSaveStrategy && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2"
                                onClick={() => {
                                  const s = parseStrategyJson(msg.content);
                                  if (s) {
                                    onSaveStrategy(s);
                                    onSaved?.();
                                  }
                                }}
                              >
                                保存到策略库
                              </Button>
                            )}
                            {onApplyStrategy && onSaveStrategy && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-6 text-[10px] px-2"
                                onClick={() => {
                                  const s = parseStrategyJson(msg.content);
                                  if (s) {
                                    const saved = onSaveStrategy(s);
                                    onSaved?.();
                                    onApplyStrategy(s, saved && "id" in saved ? saved.id : undefined);
                                  }
                                }}
                              >
                                保存并应用
                              </Button>
                            )}
                          </div>
                        )}
                      </>
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
            placeholder="描述你的选股需求..."
            className="min-h-[40px] max-h-[100px] w-full resize-none rounded-lg border border-slate-200/60 bg-white px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white transition-all hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </div>
  );
}
