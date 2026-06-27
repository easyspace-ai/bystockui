import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import AgentCollaboration from './components/AgentCollaboration'
import DecisionCard from './components/DecisionCard'
import RiskRadar from './components/RiskRadar'
import KeyMetrics from './components/KeyMetrics'
import { pickFirstSectionWithContent } from '@/features/analysis/config/reportSections'
import { sanitizeReportMarkdown } from './reportText'
import KlinePanel from './components/KlinePanel'
import { normalizeCnSymbol } from '@/lib/symbols'
import { useAnalysisStore } from './analysisStore'
import type { AnalysisViewMode } from '@/features/analysis/components/AnalysisToolbar'
import { StockBasicDataPanel } from '@/features/analysis/components/StockBasicDataPanel'
import { ReportSectionSheet } from '@/features/analysis/components/ReportSectionSheet'
import { downloadAnalysisHtmlReport } from '@/features/analysis/exportAnalysisHtmlReport'

function mapDecision(decision?: string): 'buy' | 'sell' | 'hold' | 'add' | 'reduce' | 'watch' | undefined {
  if (!decision) return undefined
  const d = decision.toUpperCase()
  if (d.includes('SELL') || d.includes('卖出')) return 'sell'
  if (d.includes('REDUCE') || d.includes('减持')) return 'reduce'
  if (d.includes('WATCH') || d.includes('观望')) return 'watch'
  if (d.includes('HOLD') || d.includes('持有')) return 'hold'
  if (d.includes('ADD') || d.includes('增持')) return 'add'
  if (d.includes('BUY') || d.includes('买入')) return 'buy'
  return undefined
}

function extractConfidence(text?: string): number | undefined {
  if (!text) return undefined
  const m = text.match(/置信度[:：]\s*(\d+)%/i) ?? text.match(/confidence[:：]\s*(\d+)%/i)
  if (m) {
    const v = parseInt(m[1], 10)
    return v >= 0 && v <= 100 ? v : undefined
  }
  return undefined
}

function extractPrice(text: string | undefined, type: 'target' | 'stop'): number | undefined {
  if (!text) return undefined
  const patterns =
    type === 'target'
      ? [/目标价[:：]\s*[¥$]?\s*([\d.]+)/, /目标价格[:：]\s*[¥$]?\s*([\d.]+)/, /target[:：]\s*[¥$]?\s*([\d.]+)/i]
      : [/止损价[:：]\s*[¥$]?\s*([\d.]+)/, /止损价格[:：]\s*[¥$]?\s*([\d.]+)/, /stop[-\s_]?loss[:：]\s*[¥$]?\s*([\d.]+)/i]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return parseFloat(m[1])
  }
  return undefined
}

export type TradingAgentsAnalysisCenterProps = {
  selectedSymbol: string
  stockName?: string
  viewMode: AnalysisViewMode
  activeSection: string | undefined
  onSelectSection: (section?: string) => void
  onWorkbenchSymbolChange?: (symbol: string) => void
}

export function TradingAgentsAnalysisCenter({
  selectedSymbol,
  stockName,
  viewMode,
  activeSection,
  onSelectSection,
  onWorkbenchSymbolChange,
}: TradingAgentsAnalysisCenterProps) {
  const [activeSymbol, setActiveSymbol] = useState(
    () => selectedSymbol || useAnalysisStore.getState().currentSymbol || '000001.SH',
  )
  const {
    report,
    streamingSections,
    currentSymbol,
    setCurrentSymbol,
    setReport,
    setStructuredData,
    jobConfidence,
    isAnalyzing,
    riskItems,
    keyMetrics,
    jobTargetPrice,
    jobStopLoss,
  } = useAnalysisStore()

  const sectionHighlight = useMemo(() => {
    const getContent = (key: string) => {
      const stream = streamingSections[key]
      const stored = report?.[key as keyof typeof report] as string | undefined
      return sanitizeReportMarkdown(stream?.displayed || stored || '')
    }
    return pickFirstSectionWithContent(getContent)
  }, [report, streamingSections])

  const collaborationSelected = activeSection ?? sectionHighlight

  useEffect(() => {
    setActiveSymbol(selectedSymbol)
  }, [selectedSymbol])

  useEffect(() => {
    if (currentSymbol) setActiveSymbol(currentSymbol)
  }, [currentSymbol])

  useEffect(() => {
    setCurrentSymbol(selectedSymbol)
  }, [selectedSymbol, setCurrentSymbol])

  // Drop persisted/history report when user switches to a different symbol (not mid-run).
  useEffect(() => {
    if (isAnalyzing || !report?.symbol) return
    const reportSym = normalizeCnSymbol(report.symbol)
    const sym = normalizeCnSymbol(selectedSymbol)
    if (reportSym && sym && reportSym !== sym) {
      setReport(null)
      setStructuredData({})
    }
  }, [selectedSymbol, report?.symbol, isAnalyzing, setReport, setStructuredData])

  const finalDecision = report?.final_trade_decision
  const confidence = jobConfidence ?? extractConfidence(finalDecision)
  const targetPrice = jobTargetPrice ?? extractPrice(finalDecision, 'target')
  const stopLoss = jobStopLoss ?? extractPrice(finalDecision, 'stop')

  const hasReport = Boolean(
    report && Object.values(report).some((v) => typeof v === 'string' && v.trim().length > 0),
  )

  const reportSymbol = report?.symbol ? normalizeCnSymbol(report.symbol) : null
  const activeSym = normalizeCnSymbol(activeSymbol)
  const reportMatchesSymbol = !reportSymbol || !activeSym || reportSymbol === activeSym

  const handleExportHtml = () => {
    if (!report) return
    downloadAnalysisHtmlReport(report, {
      symbol: activeSymbol,
      stockName,
      confidence: confidence ?? null,
    })
  }

  return (
    <div className="min-h-0 min-w-0 space-y-4">
      <div className="h-[340px] min-h-[260px]">
        <KlinePanel
          symbol={activeSymbol}
          onSymbolChange={(symbol) => {
            const n = normalizeCnSymbol(symbol) || symbol.trim().toUpperCase()
            setActiveSymbol(n)
            onWorkbenchSymbolChange?.(n)
          }}
        />
      </div>

      {viewMode === 'basic' ? (
        <StockBasicDataPanel symbol={selectedSymbol} stockName={stockName} />
      ) : (
        <>
          <AgentCollaboration
            onSelectSection={(section) => onSelectSection(section)}
            onOpenDebate={(debate) => {
              onSelectSection(debate === 'research' ? 'investment_plan' : 'final_trade_decision')
            }}
            selectedSection={collaborationSelected}
          />

          <div className="space-y-3">
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
              <DecisionCard
                symbol={activeSymbol}
                name={stockName}
                report={reportMatchesSymbol ? report || undefined : undefined}
                decision={mapDecision(report?.decision)}
                direction={report?.direction}
                confidence={confidence ?? undefined}
                targetPrice={targetPrice}
                stopLoss={stopLoss}
                reasoning={finalDecision?.slice(0, 600)}
              />
              <RiskRadar items={riskItems} />
              <KeyMetrics items={keyMetrics} />
            </div>

            {hasReport && !isAnalyzing ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleExportHtml}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                  导出 HTML 报告
                </button>
              </div>
            ) : null}
          </div>

          <ReportSectionSheet sectionKey={activeSection} onClose={() => onSelectSection(undefined)} />
        </>
      )}
    </div>
  )
}
