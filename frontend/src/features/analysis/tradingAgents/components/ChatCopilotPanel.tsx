import { FormEvent, useState, useRef, useEffect, forwardRef, useImperativeHandle, type FC } from 'react'
import {
    Bot, Loader2, Send, Settings2, ChevronDown, ChevronUp, Trash2, Square, FileText, ChevronRight,
    TrendingUp, MessageCircle, Newspaper, Calculator, BarChart2, DollarSign, Swords,
    ArrowBigUp, ArrowBigDown, Brain, Briefcase, Flame, Scale, Shield, CheckCircle2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
    getTradingJobResult,
    getTradingJobStatus,
    getTradingReports,
    streamTradingAnalysis,
    type TradingApiReportSummary,
} from '@/lib/tradingApi'
import { useAnalysisStore } from '../analysisStore'
import type {
    AgentReportEvent,
    AgentSnapshotEvent,
    AgentStatusEvent,
    AgentTokenEvent,
    AnalysisReport,
    ReportChunkEvent,
} from '../types'

export type ChatCopilotPanelHandle = {
    submitPrompt: (text: string) => void
}

interface ChatCopilotPanelProps {
    onSymbolDetected: (symbol: string) => void
    onShowReport?: (section?: string) => void
    initialInput?: string
}

const ANALYST_OPTIONS = [
    { id: 'market', label: '市场分析', description: '技术面' },
    { id: 'social', label: '舆情分析', description: '社交媒体' },
    { id: 'news', label: '新闻分析', description: '财经新闻' },
    { id: 'fundamentals', label: '基本面', description: '财务估值' },
    { id: 'macro', label: '宏观板块', description: '宏观经济' },
    { id: 'smart_money', label: '主力资金', description: '机构动向' },
]

interface StreamEvent {
    event: string
    data: Record<string, unknown>
}

const PRESET_PROMPTS: string[] = []

const REPORT_SECTION_TITLES: Record<string, string> = {
    market_report: '市场分析报告',
    sentiment_report: '舆情分析报告',
    news_report: '新闻分析报告',
    fundamentals_report: '基本面分析报告',
    macro_report: '宏观分析报告',
    smart_money_report: '主力资金分析报告',
    game_theory_report: '博弈判断报告',
    investment_plan: '研究团队投资计划',
    trader_investment_plan: '交易员计划',
    final_trade_decision: '最终交易决策',
}

const SECTION_META: Record<string, { Icon: FC<{ className?: string }>; iconCls: string; bgCls: string }> = {
    market_report:          { Icon: TrendingUp,    iconCls: 'text-blue-500',    bgCls: 'bg-blue-100 dark:bg-blue-500/20' },
    sentiment_report:       { Icon: MessageCircle, iconCls: 'text-fuchsia-500', bgCls: 'bg-fuchsia-100 dark:bg-fuchsia-500/20' },
    news_report:            { Icon: Newspaper,     iconCls: 'text-cyan-500',    bgCls: 'bg-cyan-100 dark:bg-cyan-500/20' },
    fundamentals_report:    { Icon: Calculator,    iconCls: 'text-emerald-500', bgCls: 'bg-emerald-100 dark:bg-emerald-500/20' },
    macro_report:           { Icon: BarChart2,     iconCls: 'text-violet-500',  bgCls: 'bg-violet-100 dark:bg-violet-500/20' },
    smart_money_report:     { Icon: DollarSign,    iconCls: 'text-amber-500',   bgCls: 'bg-amber-100 dark:bg-amber-500/20' },
    game_theory_report:     { Icon: Swords,        iconCls: 'text-rose-500',    bgCls: 'bg-rose-100 dark:bg-rose-500/20' },
    investment_plan:        { Icon: Brain,         iconCls: 'text-indigo-500',  bgCls: 'bg-indigo-100 dark:bg-indigo-500/20' },
    trader_investment_plan: { Icon: Briefcase,     iconCls: 'text-orange-500',  bgCls: 'bg-orange-100 dark:bg-orange-500/20' },
    final_trade_decision:   { Icon: CheckCircle2,  iconCls: 'text-teal-500',    bgCls: 'bg-teal-100 dark:bg-teal-500/20' },
}

const AGENT_META_MAP: Record<string, { Icon: FC<{ className?: string }>; iconCls: string; bgCls: string; label: string }> = {
    'Market Analyst':       { Icon: TrendingUp,    iconCls: 'text-blue-500',    bgCls: 'bg-blue-100 dark:bg-blue-500/20',    label: '技术面' },
    'Social Analyst':       { Icon: MessageCircle, iconCls: 'text-fuchsia-500', bgCls: 'bg-fuchsia-100 dark:bg-fuchsia-500/20', label: '舆情' },
    'News Analyst':         { Icon: Newspaper,     iconCls: 'text-cyan-500',    bgCls: 'bg-cyan-100 dark:bg-cyan-500/20',    label: '新闻' },
    'Fundamentals Analyst': { Icon: Calculator,    iconCls: 'text-emerald-500', bgCls: 'bg-emerald-100 dark:bg-emerald-500/20', label: '基本面' },
    'Macro Analyst':        { Icon: BarChart2,     iconCls: 'text-violet-500',  bgCls: 'bg-violet-100 dark:bg-violet-500/20', label: '宏观' },
    'Smart Money Analyst':  { Icon: DollarSign,    iconCls: 'text-amber-500',   bgCls: 'bg-amber-100 dark:bg-amber-500/20',  label: '主力资金' },
    'Game Theory Manager':  { Icon: Swords,        iconCls: 'text-rose-500',    bgCls: 'bg-rose-100 dark:bg-rose-500/20',    label: '博弈裁判' },
    'Bull Researcher':      { Icon: ArrowBigUp,    iconCls: 'text-emerald-500', bgCls: 'bg-emerald-100 dark:bg-emerald-500/20', label: '多头' },
    'Bear Researcher':      { Icon: ArrowBigDown,  iconCls: 'text-rose-500',    bgCls: 'bg-rose-100 dark:bg-rose-500/20',    label: '空头' },
    'Research Manager':     { Icon: Brain,         iconCls: 'text-indigo-500',  bgCls: 'bg-indigo-100 dark:bg-indigo-500/20', label: '研究总监' },
    'Trader':               { Icon: Briefcase,     iconCls: 'text-orange-500',  bgCls: 'bg-orange-100 dark:bg-orange-500/20', label: '交易员' },
    'Aggressive Analyst':   { Icon: Flame,         iconCls: 'text-red-500',     bgCls: 'bg-red-100 dark:bg-red-500/20',      label: '激进' },
    'Neutral Analyst':      { Icon: Scale,         iconCls: 'text-slate-500',   bgCls: 'bg-slate-100 dark:bg-slate-500/20',  label: '中性' },
    'Conservative Analyst': { Icon: Shield,        iconCls: 'text-amber-500',   bgCls: 'bg-amber-100 dark:bg-amber-500/20',  label: '稳健' },
    'Portfolio Manager':    { Icon: CheckCircle2,  iconCls: 'text-teal-500',    bgCls: 'bg-teal-100 dark:bg-teal-500/20',    label: '组合经理' },
}

function ReportCard({
    section,
    content,
    streaming,
    onOpen,
}: {
    section: string
    content: string
    streaming: boolean
    onOpen: () => void
}) {
    const title = REPORT_SECTION_TITLES[section] || section
    const meta = SECTION_META[section]
    const preview = content.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').slice(0, 80)
    const IconEl = meta?.Icon || FileText
    const iconCls = meta?.iconCls || 'text-slate-400'
    const bgCls = meta?.bgCls || 'bg-slate-100 dark:bg-slate-700'

    if (streaming) {
        return (
            <div className="flex items-center gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm">
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${bgCls}`}>
                    <IconEl className={`h-4 w-4 ${iconCls}`} />
                </span>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-300">{title}</span>
                <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-blue-400" />
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={onOpen}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-all hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700/50 dark:bg-slate-800/60 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
        >
            <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${bgCls}`}>
                <IconEl className={`h-4 w-4 ${iconCls}`} />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 transition-colors group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-300">{title}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{preview}...</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-blue-400" />
        </button>
    )
}

function sanitizeErrorMessage(raw: string): string {
    const msg = raw.trim()
    if (!msg) return '分析失败，请稍后重试'
    if (
        msg.includes('github.com/') ||
        msg.includes('node path:') ||
        msg.includes('stack trace') ||
        msg.includes('ToolNode') ||
        msg.length > 280
    ) {
        return '分析过程出错，请稍后重试或更换网络环境。'
    }
    return msg
}

const ChatCopilotPanel = forwardRef<ChatCopilotPanelHandle, ChatCopilotPanelProps>(function ChatCopilotPanel(
    { onSymbolDetected, onShowReport, initialInput },
    ref,
) {
    const [input, setInput] = useState(initialInput || '')
    const [streaming, setStreaming] = useState(false)
    const [showConfig, setShowConfig] = useState(false)
    const pendingAgentMsgIdsRef = useRef<Set<string>>(new Set())
    const [, forceUpdate] = useState(0)
    const [expandedAgentMsgId, setExpandedAgentMsgId] = useState<string | null>(null)
    const streamingReportIds = useRef<Map<string, boolean>>(new Map())
    const agentMessageMapRef = useRef<Record<string, string>>({})
    const firstTokenMapRef = useRef<Record<string, boolean>>({})
    const sectionToMsgIdsRef = useRef<Record<string, string[]>>({})
    const [selectedAnalysts, setSelectedAnalysts] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('tradingagents-settings')
            if (!stored) return ['market', 'social', 'news', 'fundamentals', 'macro', 'smart_money']
            const parsed = JSON.parse(stored) as { defaultAnalysts?: string[] }
            if (Array.isArray(parsed.defaultAnalysts) && parsed.defaultAnalysts.length > 0) {
                return parsed.defaultAnalysts
            }
        } catch {}
        return ['market', 'social', 'news', 'fundamentals', 'macro', 'smart_money']
    })
    const typingIndicatorIdRef = useRef<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)

    const {
        chatMessages,
        isAnalyzing,
        setCurrentJobId,
        setCurrentSymbol,
        setIsAnalyzing,
        setIsConnected,
        setCurrentHorizon,
        updateAgentStatus,
        updateAgentSnapshot,
        addAgentReport,
        addReportChunk,
        addAgentToken,
        addChatMessage,
        appendToChatMessage,
        setMessageContent,
        setReport,
        setStructuredData,
        markAgentMessagesComplete,
        clearSession,
        reset,
    } = useAnalysisStore()

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    const recoverInterruptedJob = async () => {
        const { currentJobId } = useAnalysisStore.getState()
        if (!currentJobId) return false

        pushSystem(`分析流中断，正在回查任务状态：${currentJobId}`)

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const status = await getTradingJobStatus(currentJobId)

            if (status.status === 'completed') {
                const result = await getTradingJobResult(currentJobId)
                const reportBody = (result.result ?? null) as unknown as AnalysisReport | null
                setReport(reportBody)

                const symbol = reportBody?.symbol
                const tradeDate = reportBody?.trade_date
                if (symbol) {
                    setCurrentSymbol(symbol)
                    onSymbolDetected(symbol)
                }

                try {
                    const history = await getTradingReports(symbol, 0, 10)
                    const matched =
                        history.reports.find((item: TradingApiReportSummary) => item.trade_date === tradeDate) ??
                        history.reports[0]
                    if (matched) {
                        setStructuredData({
                            riskItems: matched.risk_items as never,
                            keyMetrics: matched.key_metrics as never,
                            confidence: matched.confidence ?? null,
                            targetPrice: matched.target_price ?? null,
                            stopLoss: matched.stop_loss_price ?? null,
                        })
                    }
                } catch {
                    // 历史报告回填失败时，至少保留主报告正文
                }

                pushAssistant(
                    `**分析完成（已从中断连接恢复）**\n\n方向倾向：**${String(reportBody?.direction || '未知')}**\n\n执行动作：**${String(reportBody?.decision || 'HOLD')}**\n\n> 免责声明：以上内容由模型基于公开数据与规则生成，仅供研究参考，不构成任何投资建议或收益承诺。`
                )
                return true
            }

            if (status.status === 'failed') {
                pushAssistant(`分析失败：${status.error || 'unknown error'}`)
                return true
            }

            await sleep(1500)
        }

        return false
    }

    useEffect(() => {
        const container = messagesContainerRef.current
        if (!container) return
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
        })
    }, [chatMessages])

    const toggleAnalyst = (id: string) => {
        setSelectedAnalysts((prev) =>
            prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
        )
    }

    const pushAssistant = (content: string) => {
        addChatMessage({
            id: `${Date.now()}-${Math.random()}`,
            role: 'assistant',
            content,
            timestamp: new Date().toISOString(),
        })
    }

    const pushSystem = (content: string) => {
        addChatMessage({
            id: `${Date.now()}-${Math.random()}`,
            role: 'system',
            content,
            timestamp: new Date().toISOString(),
        })
    }

    const parseAndDispatch = (event: StreamEvent) => {
        const { event: eventName, data } = event
        switch (eventName) {
            case 'job.ready':
                setIsConnected(true)
                // 把 typing indicator 换成"解析中"提示，告知用户正在识别标的
                if (typingIndicatorIdRef.current) {
                    setMessageContent(typingIndicatorIdRef.current, '__parsing__')
                }
                break
            case 'job.created': {
                const jobId = String(data.job_id || '')
                const symbol = String(data.symbol || '')
                if (jobId) setCurrentJobId(jobId)
                if (symbol) {
                    setCurrentSymbol(symbol)
                    onSymbolDetected(symbol)
                }
                if (typingIndicatorIdRef.current) {
                    setMessageContent(typingIndicatorIdRef.current, `__status:collecting:${symbol}__`)
                }
                streamingReportIds.current.clear()
                agentMessageMapRef.current = {}
                firstTokenMapRef.current = {}
                sectionToMsgIdsRef.current = {}
                pendingAgentMsgIdsRef.current = new Set()
                forceUpdate(n => n + 1)
                break
            }
            case 'job.running':
                setIsAnalyzing(true)
                // 切换 indicator 到"分析启动"阶段
                if (typingIndicatorIdRef.current) {
                    setMessageContent(typingIndicatorIdRef.current, '__status:analyzing__')
                }
                break
            case 'agent.horizon_start': {
                const h = String(data.horizon || '')
                setCurrentHorizon(h || null)
                break
            }
            case 'agent.horizon_done':
                // keep currentHorizon until job completes so badge stays visible
                break
            case 'job.completed': {
                setCurrentHorizon(null)
                setIsAnalyzing(false)
                pendingAgentMsgIdsRef.current = new Set()
                forceUpdate(n => n + 1)
                markAgentMessagesComplete()
                if (typeof data.result === 'object' && data.result && 'symbol' in data.result) {
                    const symbol = String((data.result as Record<string, unknown>).symbol || '')
                    if (symbol) {
                        setCurrentSymbol(symbol)
                        onSymbolDetected(symbol)
                    }
                }
                setReport((data.result || null) as AnalysisReport | null)
                setStructuredData({
                    riskItems: data.risk_items as never,
                    keyMetrics: data.key_metrics as never,
                    confidence: data.confidence as number | null,
                    targetPrice: data.target_price as number | null,
                    stopLoss: data.stop_loss_price as number | null,
                })
                pushAssistant(
                    `**分析完成**\n\n方向倾向：**${String(data.direction || '未知')}**\n\n执行动作：**${String(data.decision || 'HOLD')}**\n\n> 免责声明：以上内容由模型基于公开数据与规则生成，仅供研究参考，不构成任何投资建议或收益承诺。`
                )
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('TradingAgents 分析完成', {
                        body: data.direction ? `方向：${String(data.direction)} · 动作：${String(data.decision || 'HOLD')}` : '点击查看完整报告',
                        icon: '/favicon.ico',
                    })
                }
                break
            }
            case 'job.failed':
                setCurrentHorizon(null)
                setIsAnalyzing(false)
                pushAssistant(`分析失败：${sanitizeErrorMessage(String(data.error || 'unknown error'))}`)
                break
            case 'agent.status': {
                const statusData = data as unknown as { agent: string; status: string; horizon?: string }
                const agentKey = `${statusData.agent}-${statusData.horizon || 'main'}`

                if (statusData.status === 'in_progress') {
                    if (typingIndicatorIdRef.current) {
                        useAnalysisStore.setState(state => ({
                            chatMessages: state.chatMessages.filter(m => m.id !== typingIndicatorIdRef.current)
                        }))
                        typingIndicatorIdRef.current = null
                    }

                    const agentName = statusData.agent
                    const horizon = statusData.horizon ? `(${statusData.horizon === 'short' ? '短线' : '中线'})` : ''
                    const msgId = `chat-agent-msg-${agentName}-${statusData.horizon || 'main'}-${Date.now()}`

                    agentMessageMapRef.current[agentKey] = msgId
                    firstTokenMapRef.current[msgId] = true

                    addChatMessage({
                        id: msgId,
                        role: 'assistant',
                        agent: agentName,
                        content: `**${agentName}** ${horizon} 正在思考并撰写报告中...`,
                        timestamp: new Date().toISOString(),
                    })
                    pendingAgentMsgIdsRef.current.add(msgId)
                    forceUpdate(n => n + 1)
                } else if (statusData.status === 'completed' || statusData.status === 'skipped') {
                    const existingMsgId = agentMessageMapRef.current[agentKey]
                    if (existingMsgId) {
                        pendingAgentMsgIdsRef.current.delete(existingMsgId)
                        forceUpdate(n => n + 1)
                        markAgentMessagesComplete([existingMsgId])
                    }
                }
                updateAgentStatus(statusData as unknown as AgentStatusEvent)
                break
            }
            case 'agent.token': {
                const tokenData = data as unknown as AgentTokenEvent
                addAgentToken(tokenData)

                if (typingIndicatorIdRef.current) {
                    useAnalysisStore.setState(state => ({
                        chatMessages: state.chatMessages.filter(m => m.id !== typingIndicatorIdRef.current)
                    }))
                    typingIndicatorIdRef.current = null
                }

                const agentKey = `${tokenData.agent}-${tokenData.horizon || 'main'}`
                let targetMsgId = agentMessageMapRef.current[agentKey]

                if (!targetMsgId) {
                    const horizonSuffix = tokenData.horizon ? `(${tokenData.horizon === 'short' ? '短线' : '中线'})` : ''
                    targetMsgId = `chat-agent-msg-${tokenData.agent}-${tokenData.horizon || 'main'}-${Date.now()}`
                    agentMessageMapRef.current[agentKey] = targetMsgId
                    firstTokenMapRef.current[targetMsgId] = true
                    addChatMessage({
                        id: targetMsgId,
                        role: 'assistant',
                        agent: tokenData.agent,
                        content: `**${tokenData.agent}** ${horizonSuffix} 正在思考并撰写报告中...`,
                        timestamp: new Date().toISOString(),
                    })
                    pendingAgentMsgIdsRef.current.add(targetMsgId)
                    forceUpdate(n => n + 1)
                }

                if (tokenData.report) {
                    const ids = sectionToMsgIdsRef.current[tokenData.report] ||= []
                    if (!ids.includes(targetMsgId)) ids.push(targetMsgId)
                }

                if (firstTokenMapRef.current[targetMsgId]) {
                    const horizonText = tokenData.horizon ? `(${tokenData.horizon === 'short' ? '短线' : '中线'})` : ''
                    setMessageContent(targetMsgId, `### ${tokenData.agent} ${horizonText}\n\n${tokenData.token}`)
                    firstTokenMapRef.current[targetMsgId] = false
                    pendingAgentMsgIdsRef.current.delete(targetMsgId)
                    forceUpdate(n => n + 1)
                } else {
                    appendToChatMessage(targetMsgId, tokenData.token)
                }
                break
            }
            case 'agent.snapshot':
                updateAgentSnapshot(data as unknown as AgentSnapshotEvent)
                break
            case 'agent.report':
                addAgentReport(data as unknown as AgentReportEvent)
                break
            case 'agent.report.chunk': {
                const chunkData = data as unknown as ReportChunkEvent
                addReportChunk(chunkData)

                const { section, is_complete } = chunkData
                if (is_complete && !streamingReportIds.current.get(section)) {
                    streamingReportIds.current.set(section, true)
                    const msgIds = sectionToMsgIdsRef.current[section] || []
                    const lastMsgId = msgIds[msgIds.length - 1]
                    const earlierMsgIds = msgIds.slice(0, -1)

                    if (lastMsgId) {
                        useAnalysisStore.setState(state => ({
                            chatMessages: state.chatMessages.map(m =>
                                m.id === lastMsgId
                                    ? { ...m, role: 'report' as const, section, complete: true }
                                    : m
                            )
                        }))
                        if (earlierMsgIds.length > 0) {
                            markAgentMessagesComplete(earlierMsgIds)
                        }
                    } else {
                        const buffer = useAnalysisStore.getState().streamingSections[section]?.buffer || ''
                        addChatMessage({
                            id: `stream:${section}`,
                            role: 'report',
                            section,
                            content: buffer,
                            complete: true,
                            timestamp: new Date().toISOString(),
                        })
                    }
                }
                break
            }
            case 'agent.tool_call':
                // 工具调用信息不再在对话框显示，减少噪音
                break
            case 'agent.writing':
                // 气泡已经表示 agent 正在撰写，不再额外发系统消息
                break
            case 'agent.milestone': {
                const { stage, title, summary } = data as { stage: string; title: string; summary: string }
                if (stage === 'final_decision') {
                    pushAssistant(`**${title}**\n\n${summary}`)
                }
                break
            }
            default:
                break
        }
    }

    const streamChat = async (prompt: string, signal: AbortSignal) => {
        await streamTradingAnalysis({
            messages: [{ role: 'user', content: prompt }],
            selectedAnalysts,
            signal,
            onEvent: (ev) => {
                if (ev.event === 'ping') return
                if (ev.event === 'done' || ev.data === '[DONE]') {
                    setIsConnected(false)
                    setIsAnalyzing(false)
                    return
                }
                let data: Record<string, unknown> = {}
                if (ev.data != null && typeof ev.data === 'object' && !Array.isArray(ev.data)) {
                    data = ev.data as Record<string, unknown>
                }
                parseAndDispatch({ event: ev.event, data })
            },
        })
        setIsConnected(false)
        setIsAnalyzing(false)
    }

    const runAnalysisPrompt = async (prompt: string) => {
        const trimmed = prompt.trim()
        if (!trimmed || streaming) return

        const customPrompt = localStorage.getItem('ta-custom-prompt')?.trim() || ''
        const fullPrompt = customPrompt ? `${trimmed}\n\n[分析要求] ${customPrompt}` : trimmed

        setInput('')
        addChatMessage({
            id: `${Date.now()}-${Math.random()}`,
            role: 'user',
            content: trimmed,
            timestamp: new Date().toISOString(),
        })

        reset()
        streamingReportIds.current.clear()
        pendingAgentMsgIdsRef.current = new Set()
        forceUpdate(n => n + 1)

        const typingId = `typing-${Date.now()}`
        typingIndicatorIdRef.current = typingId
        addChatMessage({
            id: typingId,
            role: 'assistant',
            content: '__typing__',
            timestamp: new Date().toISOString(),
        })

        setStreaming(true)
        setIsAnalyzing(true)
        setIsConnected(false)

        abortControllerRef.current?.abort()
        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
            await streamChat(fullPrompt, controller.signal)
        } catch (error) {
            if (controller.signal.aborted) {
                pushSystem('分析已停止。已完成的部分可在主面板查看。')
                setIsAnalyzing(false)
                setIsConnected(false)
                return
            }
            if (typingIndicatorIdRef.current) {
                useAnalysisStore.setState((state) => ({
                    chatMessages: state.chatMessages.filter((m) => m.id !== typingIndicatorIdRef.current),
                }))
                typingIndicatorIdRef.current = null
            }
            const errorMessage = error instanceof Error ? error.message : 'unknown error'
            const shouldRecover = /network|fetch|stream|sse|body/i.test(errorMessage)
            if (shouldRecover) {
                const recovered = await recoverInterruptedJob()
                if (!recovered) {
                    pushAssistant(`请求中断：${errorMessage}\n\n后端任务可能仍在执行，请稍后到历史报告中查看结果。`)
                }
            } else {
                pushAssistant(`请求失败：${sanitizeErrorMessage(errorMessage)}`)
            }
            setIsAnalyzing(false)
            setIsConnected(false)
        } finally {
            setStreaming(false)
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null
            }
        }
    }

    const stopAnalysis = () => {
        abortControllerRef.current?.abort()
        abortControllerRef.current = null
        if (typingIndicatorIdRef.current) {
            useAnalysisStore.setState((state) => ({
                chatMessages: state.chatMessages.filter((m) => m.id !== typingIndicatorIdRef.current),
            }))
            typingIndicatorIdRef.current = null
        }
        setStreaming(false)
        setIsAnalyzing(false)
        setIsConnected(false)
    }

    const runAnalysisPromptRef = useRef(runAnalysisPrompt)
    runAnalysisPromptRef.current = runAnalysisPrompt

    useImperativeHandle(ref, () => ({
        submitPrompt: (text: string) => {
            void runAnalysisPromptRef.current(text)
        },
    }))

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        await runAnalysisPrompt(input)
    }

    const hasAnyReport = chatMessages.some(m => m.role === 'report')

    return (
        <aside className="card flex h-full min-h-0 flex-col overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-cyan-500" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">智能分析</h2>
                </div>
                <div className="flex items-center gap-2">
                    {onShowReport && hasAnyReport && (
                        <button
                            type="button"
                            onClick={() => onShowReport()}
                            className="flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30"
                        >
                            <FileText className="h-3 w-3" />
                            查看报告
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            if (window.confirm('确定清空对话？主面板报告也会重置。')) {
                                clearSession()
                            }
                        }}
                        disabled={streaming || isAnalyzing}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/10"
                        title="清空对话"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                    {(streaming || isAnalyzing) && (
                        <span className="badge-blue inline-flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            分析中
                        </span>
                    )}
                </div>
            </div>

            <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                    type="button"
                    onClick={() => setShowConfig(!showConfig)}
                    className="flex w-full items-center justify-between bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                    <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            分析维度 ({selectedAnalysts.length}/6)
                        </span>
                    </div>
                    {showConfig ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {showConfig && (
                    <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/30">
                        {ANALYST_OPTIONS.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => toggleAnalyst(option.id)}
                                className={`rounded-md border px-3 py-1.5 text-xs transition-all ${
                                    selectedAnalysts.includes(option.id)
                                        ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                                        : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div ref={messagesContainerRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {chatMessages.length === 0 && !streaming && !isAnalyzing ? (
                    <div className="flex h-full min-h-[120px] flex-col items-center justify-center px-4 text-center text-sm text-slate-400">
                        <p>输入分析需求，例如：</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">分析 688584.SH 今日走势</p>
                    </div>
                ) : null}

                {chatMessages.map((msg) => {
                    if (msg.role === 'report' && msg.section) {
                        return (
                            <ReportCard
                                key={msg.id}
                                section={msg.section}
                                content={msg.content}
                                streaming={!msg.complete}
                                onOpen={() => onShowReport?.(msg.section)}
                            />
                        )
                    }

                    if (msg.content.startsWith('__')) {
                        const c = msg.content
                        let label = '准备中…'
                        let icon: 'spin' | 'dots' = 'spin'
                        let colorCls = 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                        if (c === '__parsing__') {
                            label = '正在识别标的与意图...'
                            colorCls = 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-500'
                        } else if (c.startsWith('__status:collecting:')) {
                            const sym = c.replace('__status:collecting:', '').replace('__', '')
                            label = `已识别 ${sym}，正在采集行情数据...`
                            colorCls = 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30 text-cyan-600'
                        } else if (c === '__status:analyzing__') {
                            label = '数据就绪，多智能体协作分析启动中...'
                            colorCls = 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600'
                        } else if (c === '__typing__') {
                            label = ''
                            icon = 'dots'
                        }
                        return (
                            <div key={msg.id} className="flex justify-start">
                                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${colorCls}`}>
                                    {icon === 'spin' ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                                            <span className="animate-pulse">{label}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '0ms' }} />
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '150ms' }} />
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '300ms' }} />
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    const agentMeta = msg.agent ? AGENT_META_MAP[msg.agent] : null
                    const isPending = pendingAgentMsgIdsRef.current.has(msg.id)
                    const isCompleted = !!msg.complete
                    const isExpanded = expandedAgentMsgId === msg.id

                    if (msg.agent && agentMeta && msg.role === 'assistant') {
                        const textOnly = msg.content
                            .replace(/^#{1,4}\s+.*$/gm, '')
                            .replace(/\*\*/g, '')
                            .replace(/\n{2,}/g, ' ')
                            .trim()
                        const preview = textOnly.slice(0, 80)

                        if (isCompleted) {
                            return (
                                <div key={msg.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all dark:border-slate-700/50 dark:bg-slate-800/60">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedAgentMsgId(prev => prev === msg.id ? null : msg.id)}
                                        className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:border-blue-400 dark:hover:bg-slate-800"
                                    >
                                        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${agentMeta.bgCls}`}>
                                            <agentMeta.Icon className={`h-4 w-4 ${agentMeta.iconCls}`} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-slate-700 transition-colors group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-300">{agentMeta.label}</p>
                                            <p className="mt-0.5 truncate text-xs text-slate-500">{preview}...</p>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90 text-blue-400' : 'text-slate-500 group-hover:text-blue-400'}`} />
                                    </button>
                                    {isExpanded && (
                                        <div className="max-h-60 overflow-y-auto border-t border-slate-200 px-3 pb-2 dark:border-slate-700/50">
                                            <div className="prose prose-xs mt-2 max-w-none text-[12px] leading-relaxed dark:prose-invert">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        return (
                            <div key={msg.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all dark:border-slate-700/50 dark:bg-slate-800/60">
                                <button
                                    type="button"
                                    onClick={() => !isPending && setExpandedAgentMsgId(prev => prev === msg.id ? null : msg.id)}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/30"
                                >
                                    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${agentMeta.bgCls}`}>
                                        <agentMeta.Icon className={`h-4 w-4 ${agentMeta.iconCls}`} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{agentMeta.label}</p>
                                        {isPending ? (
                                            <p className="animate-pulse text-[11px] text-slate-400 dark:text-slate-500">正在推理分析中...</p>
                                        ) : (
                                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400" dir="rtl">
                                                <bdi>{textOnly.slice(-120) || '撰写中...'}</bdi>
                                            </p>
                                        )}
                                    </div>
                                    {isPending ? (
                                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-400" />
                                    ) : (
                                        <span className="shrink-0 animate-pulse text-[10px] font-medium text-emerald-500 dark:text-emerald-400">撰写中</span>
                                    )}
                                </button>
                                {isExpanded && !isPending && (
                                    <div className="max-h-60 overflow-y-auto border-t border-slate-200 px-3 pb-2 dark:border-slate-700/50">
                                        <div className="prose prose-xs mt-2 max-w-none text-[12px] leading-relaxed dark:prose-invert">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    }

                    if (msg.agent) return null

                    return (
                        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div
                                className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                                    msg.role === 'user'
                                        ? 'border border-blue-300 bg-blue-100 text-slate-900 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-slate-100'
                                        : msg.role === 'system'
                                          ? 'border border-slate-200 bg-slate-50 text-xs italic text-slate-500 dark:border-slate-700 dark:bg-slate-800/50'
                                          : 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                            >
                                {msg.role === 'user' ? (
                                    msg.content
                                ) : (
                                    <div className="prose prose-sm max-w-none dark:prose-invert">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="mt-3 shrink-0">
                <div className="flex items-center gap-2">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="描述你的分析需求…"
                        className="input flex-1"
                        disabled={streaming}
                    />
                    {(streaming || isAnalyzing) ? (
                        <button
                            type="button"
                            onClick={stopAnalysis}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                        >
                            <Square className="h-3.5 w-3.5 fill-current" />
                            停止
                        </button>
                    ) : (
                        <button type="submit" disabled={!input.trim()} className="btn-primary inline-flex items-center gap-1 px-3 py-2">
                            <Send className="h-4 w-4" />
                            发送
                        </button>
                    )}
                </div>
            </form>
        </aside>
    )
})

export default ChatCopilotPanel
