import { useMemo } from "react";
import { Eye, Download, Loader2, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { extractHtmlReport, prepareHtmlForIframePreview, prepareHtmlForDownload, type ReportHeroMeta } from "./htmlReportUtils";

interface HtmlReportPreviewProps {
  content: string;
  heroMeta?: ReportHeroMeta | null;
  isStreaming: boolean;
  pipelineStatus?: string | null;
}

export function HtmlReportPreview({ content, heroMeta, isStreaming, pipelineStatus }: HtmlReportPreviewProps) {
  const rawHtml = useMemo(() => extractHtmlReport(content), [content]);
  const html = useMemo(() => {
    return rawHtml ? prepareHtmlForIframePreview(rawHtml, heroMeta) : null;
  }, [rawHtml, heroMeta]);
  const downloadHtml = useMemo(() => {
    return rawHtml ? prepareHtmlForDownload(rawHtml, heroMeta) : null;
  }, [rawHtml, heroMeta]);

  const handleDownload = () => {
    if (!downloadHtml) return;
    const blob = new Blob([downloadHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `游资看盘报告-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100 dark:bg-slate-900">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 px-4 py-3 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">报告预览</h2>
            <p className="text-[10px] text-slate-500">
              {isStreaming
                ? pipelineStatus ?? (html ? "报告生成中…" : "正在生成 HTML 看盘报告…")
                : html
                  ? "HTML 报告已就绪"
                  : "等待 AI 生成报告"}
            </p>
          </div>
        </div>
        {html && !isStreaming && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" />
            下载 HTML
          </Button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {isStreaming && !html && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-100/80 dark:bg-slate-900/80">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="text-sm text-slate-500">{pipelineStatus ?? "正在生成 HTML 看盘报告…"}</p>
          </div>
        )}

        {!html && !isStreaming ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200/60 dark:bg-slate-800/60">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">暂无报告</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                在左侧输入股票代码或看盘问题，AI 将生成 Bloomberg 风格的 HTML 看盘报告并在此预览
              </p>
            </div>
          </div>
        ) : html ? (
          <ScrollArea className="h-full">
            <iframe
              title="游资看盘报告"
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin"
              className="h-full min-h-[calc(100vh-120px)] w-full border-0 bg-[#0f141b]"
            />
          </ScrollArea>
        ) : null}
      </div>
    </div>
  );
}
