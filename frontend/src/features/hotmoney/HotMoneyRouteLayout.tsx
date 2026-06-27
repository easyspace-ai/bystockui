import { useState, useCallback } from "react";
import { WorkbenchLayout } from "@/components/layout/WorkbenchLayout";
import { HotMoneyChatPanel } from "./HotMoneyChatPanel";
import { HtmlReportPreview } from "./HtmlReportPreview";
import type { ReportHeroMeta } from "./htmlReportUtils";

export function HotMoneyRouteLayout() {
  const [reportContent, setReportContent] = useState("");
  const [reportMeta, setReportMeta] = useState<ReportHeroMeta | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState("new");

  const handleContentUpdate = useCallback((content: string) => {
    setReportContent(content);
    setIsStreaming(true);
  }, []);

  const handlePipelineStatus = useCallback((status: string | null) => {
    setPipelineStatus(status);
    if (status) setIsStreaming(true);
  }, []);

  const handleStreamEnd = useCallback(() => {
    setIsStreaming(false);
  }, []);

  const handleSessionIdChange = useCallback((id: string | null) => {
    setSessionId(id);
    if (!id) {
      setChatKey(`new-${Date.now()}`);
      setReportContent("");
      setReportMeta(null);
      setPipelineStatus(null);
      setIsStreaming(false);
    }
  }, []);

  return (
    <WorkbenchLayout
      className="min-h-0 flex-1 bg-slate-100/80 dark:bg-slate-950/80"
      innerClassName="min-h-0"
      mainClassName="min-h-0 overflow-hidden"
      leftPanelId="hotmoney-chat"
      mainPanelId="hotmoney-preview"
      rightPanelId="hotmoney-unused"
      leftMinPx={320}
      leftMaxPx={480}
      leftSidebarVisible
      rightSidebarVisible={false}
      left={
        <HotMoneyChatPanel
          key={chatKey}
          chatKey={chatKey}
          sessionId={sessionId}
          onContentUpdate={handleContentUpdate}
          onReportMeta={setReportMeta}
          onPipelineStatus={handlePipelineStatus}
          onStreamEnd={handleStreamEnd}
          onSessionIdChange={handleSessionIdChange}
        />
      }
      main={<HtmlReportPreview content={reportContent} heroMeta={reportMeta} isStreaming={isStreaming} pipelineStatus={pipelineStatus} />}
      right={null}
    />
  );
}
