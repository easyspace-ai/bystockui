import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Flame,
  Globe2,
  Landmark,
  LayoutGrid,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  Sigma,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout'
import { useWorkbenchChrome } from '@/components/layout/WorkbenchChromeContext'
import { MajorIndexChart } from '@/features/market/MajorIndexChart'
import {
  getClsCalendar,
  getGlobalIndexes,
  getHotEvents,
  getHotStocks,
  getHotTopics,
  getIndustryRank,
  getIndustryMoneyRank,
  getIndustryResearchReport,
  getInvestCalendar,
  getLongTiger,
  getNews24h,
  getSinaNews,
  getStockMoneyRank,
  getStockNotice,
  getStockResearchReport,
  searchStocks,
  type GlobalIndex,
  type HotEvent,
  type HotStock,
  type HotTopic,
  type IndustryRank,
  type IndustryMoneyRank,
  type InvestCalendarItem,
  type LongTigerRank,
  type MarketNews,
  type ResearchReport,
  type StockMoneyRank,
  type StockNotice,
  type StockSearchItem,
} from '@/lib/marketApi'
import { extractCnSymbol, normalizeCnSymbol } from '@/lib/symbols'

/** 解析出 6 位 A 股代码；无法用当前输入确定有效代码时返回 null */
function tryResolveResearchStockCode(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const extracted = extractCnSymbol(t)
  if (extracted) {
    const m = extracted.match(/\d{6}/)
    if (m) return m[0]
  }
  const m2 = t.match(/\d{6}/)
  if (m2) return m2[0]
  const norm = normalizeCnSymbol(t.toUpperCase())
  if (norm) {
    const m3 = norm.match(/\d{6}/)
    if (m3) return m3[0]
  }
  return null
}

/** 个股研报首屏预填（茅台，研报覆盖多） */
const DEFAULT_STOCK_RESEARCH_CODE = '600519'
const STOCK_RESEARCH_PAGE_SIZE = 50

function sortResearchReportsByDateDesc(list: ResearchReport[]): ResearchReport[] {
  const ts = (d: string) => {
    const t = Date.parse(d.trim())
    return Number.isFinite(t) ? t : 0
  }
  return [...list].sort((a, b) => ts(b.publishDate) - ts(a.publishDate))
}

type MarketSectionId =
  | 'market-news'
  | 'global-indexes'
  | 'major-indexes'
  | 'industry-rank'
  | 'money-flow'
  | 'long-tiger'
  | 'stock-research'
  | 'stock-notice'
  | 'industry-research'
  | 'hot'
  | 'screeners'
  | 'links'

type MenuItem = {
  id: MarketSectionId
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}

type ResourceState<T> = {
  loading: boolean
  error: string | null
  data: T
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'market-news', label: '市场快讯', description: '24h 新闻与日历', icon: Newspaper },
  { id: 'global-indexes', label: '全球股指', description: '按区域浏览指数', icon: Globe2 },
  { id: 'major-indexes', label: '重大指数', description: '聚焦核心指数', icon: Landmark },
  { id: 'industry-rank', label: '行业排名', description: '行业资金强弱', icon: BarChart3 },
  { id: 'money-flow', label: '个股资金流向', description: '排行与趋势', icon: TrendingUp },
  { id: 'long-tiger', label: '龙虎榜', description: '上榜原因与净买额', icon: Flame },
  { id: 'stock-research', label: '个股研报', description: '券商个股覆盖', icon: BookOpen },
  { id: 'stock-notice', label: '公司公告', description: '公告与事项跟踪', icon: Bell }
  // { id: 'industry-research', label: '行业研究', description: '板块研报聚合', icon: Building2 },
  // { id: 'hot', label: '当前热门', description: '热门股 / 事件 / 话题', icon: Sparkles },
  // { id: 'screeners', label: '指标选股', description: '预留筛选模块', icon: Sigma },
  // { id: 'links', label: '名站优选', description: '预留资讯入口', icon: LayoutGrid },
]

const MAJOR_INDEX_OPTIONS = [
  { id: 'hkHSTECH', label: '恒生科技指数', code: 'hkHSTECH' },
  { id: 'sh000688', label: '科创50', code: 'sh000688' },
  { id: 'sh000685', label: '科创芯片', code: 'sh000685' },
  { id: 'sz399437', label: '证券龙头', code: 'sz399437' },
  { id: 'sz399998', label: '高端装备', code: 'sz399998' },
  { id: 'sz399986', label: '中证银行', code: 'sz399986' },
  { id: 'sh000037', label: '上证医药', code: 'sh000037' },
  { id: 'sh000300', label: '沪深300', code: 'sh000300' },
  { id: 'sh000016', label: '上证50', code: 'sh000016' },
  { id: 'sh000510', label: '中证A500', code: 'sh000510' },
  { id: 'sh000852', label: '中证1000', code: 'sh000852' },
  { id: 'sz399997', label: '中证白酒', code: 'sz399997' },
  { id: 'usYINN.AM', label: '富时中国三倍做多', code: 'usYINN.AM' },
  { id: 'usUVXY.AM', label: 'VIX恐慌指数', code: 'usUVXY.AM' },
] as const

const QUICK_LINKS = [
  { title: '东方财富行情中心', url: 'https://quote.eastmoney.com/center/gridlist.html', note: '适合快速交叉核对实时行情' },
  { title: '新浪财经', url: 'https://finance.sina.com.cn/', note: '新闻流和专题比较全' },
  { title: 'TradingView', url: 'https://www.tradingview.com/markets/', note: '国际市场观察方便' },
  { title: '财联社', url: 'https://www.cls.cn/', note: '盘中快讯密度高' },
]

/** L / M / R column chrome: same min-height so header dividers line up across workbench columns. */
const WORKBENCH_COLUMN_HEADER =
  'flex min-h-10 items-center border-b border-slate-200 bg-white px-3 py-1 dark:border-slate-800 dark:bg-slate-950'

function createState<T>(data: T): ResourceState<T> {
  return { loading: false, error: null, data }
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function formatNumber(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function formatPercent(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return `${Number(value).toFixed(digits)}%`
}

function formatDate(value?: string | null) {
  if (!value) return '--'
  return value.slice(0, 10)
}

function formatDateTime(value?: string | null) {
  if (!value) return '--'
  return value.replace('T', ' ').slice(0, 16)
}

function formatClockTime(value?: string | Date | null) {
  if (!value) return '--'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function noticeTypeTone(value?: string) {
  const text = value || ''
  if (/(风险|减持|质押|冻结|增发|退市|终止|异常|诉讼)/.test(text)) return 'text-rose-500'
  if (/(回购|重组|收购|转让|担保|仲裁)/.test(text)) return 'text-amber-500'
  return 'text-sky-600 dark:text-sky-300'
}

function noticeTitleTone(value?: string) {
  const text = value || ''
  if (/(风险|减持|质押|冻结|增发|退市|终止|异常|诉讼)/.test(text)) return 'text-rose-500 dark:text-rose-300'
  return 'text-sky-600 hover:text-sky-500 dark:text-sky-300'
}

function toneByNumber(value?: number | null) {
  if ((value || 0) > 0) return 'text-rose-500'
  if ((value || 0) < 0) return 'text-emerald-500'
  return 'text-slate-500'
}

function getIndexRegion(item: GlobalIndex) {
  const key = item.region?.toLowerCase().trim()
  if (key === 'america') return '美洲'
  if (key === 'asia') return '亚洲'
  if (key === 'europe') return '欧洲'
  if (key === 'other' || key === 'common') return '其他'

  const text = `${item.name} ${item.code}`.toLowerCase()
  if (/(nasdaq|dow|s&p|russell|tsx|bovespa|mexico|\bdji\b|道琼斯)/.test(text)) return '美洲'
  if (/(hang seng|nikkei|shanghai|szse|sse|kospi|taiex|上证|深证|创业板|恒生|日经)/.test(text)) return '亚洲'
  if (/(dax|cac|ftse|euro|mib|stoxx|德国|法国|英国|欧洲)/.test(text)) return '欧洲'
  return '其他'
}

/** Local calendar YYYY-MM-DD (avoid toISOString UTC shift vs A-share trading day). */
function getDefaultDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDateRange(days = 7) {
  return {
    start: getDefaultDate(-days),
    end: getDefaultDate(7),
  }
}

function shiftDate(value: string, offsetDays: number) {
  const parts = value.split('-').map((p) => Number.parseInt(p, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return value
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  if (Number.isNaN(date.getTime())) return value
  date.setDate(date.getDate() + offsetDays)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/80 p-8 text-center dark:border-slate-800 dark:bg-slate-950/40">
      <div className="max-w-md space-y-2">
        <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</div>
      </div>
    </div>
  )
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white/80 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
      {message}
    </div>
  )
}

function SectionTabBar({
  tabs,
  activeTab,
  onChange,
  compact,
}: {
  tabs: Array<{ id: string; label: string }>
  activeTab: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-wrap', compact ? 'gap-1.5' : 'gap-2')}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'border font-medium transition-colors',
            compact ? 'rounded-lg px-2.5 py-1 text-xs' : 'rounded-xl px-4 py-2 text-sm',
            activeTab === tab.id
              ? 'border-slate-300 bg-slate-900 text-white dark:border-slate-700 dark:bg-slate-100 dark:text-slate-900'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function SectionCard({
  title,
  eyebrow,
  children,
  actions,
  dense,
  sidebar,
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  actions?: ReactNode
  /** Tighter chrome for high-frequency lists (e.g. news wires). */
  dense?: boolean
  /** Right-rail helper cards: smaller type, lighter frame. */
  sidebar?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-950/40',
        sidebar ? 'p-3 shadow-none' : cn('shadow-sm', dense ? 'p-3.5' : 'p-4'),
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-2',
          sidebar ? 'mb-2' : dense ? 'mb-3' : 'mb-3',
        )}
      >
        <div className={cn('space-y-0', !sidebar && 'space-y-0.5')}>
          {eyebrow ? (
            <div
              className={cn(
                'font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400',
                sidebar ? 'text-[9px]' : 'text-[10px]',
              )}
            >
              {eyebrow}
            </div>
          ) : null}
          <h3
            className={cn(
              'font-semibold tracking-tight text-slate-950 dark:text-slate-50',
              sidebar ? 'text-xs' : 'text-sm',
            )}
          >
            {title}
          </h3>
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function MarketRouteLayout() {
  const { leftCollapsed } = useWorkbenchChrome()
  const location = useLocation()
  const navigate = useNavigate()
  const sectionAnchorRef = useRef<HTMLDivElement | null>(null)
  const [activeSection, setActiveSection] = useState<MarketSectionId>('global-indexes')
  const [newsTab, setNewsTab] = useState<'news24h' | 'invest-calendar' | 'cls-calendar'>('news24h')
  const [hotTab, setHotTab] = useState<'stocks' | 'events' | 'topics'>('stocks')
  const [industryRankTab, setIndustryRankTab] = useState<'change' | 'money' | 'csrc-money' | 'concept-money'>('change')
  const [industryRankSort, setIndustryRankSort] = useState<'0' | '1'>('0')
  const [moneyRankTab, setMoneyRankTab] = useState<'netamount' | 'outamount' | 'ratioamount' | 'r0_net' | 'r0_out' | 'r0_ratio' | 'r3_net' | 'r3_out' | 'r3_ratio'>('netamount')
  const [activeMajorIndex, setActiveMajorIndex] = useState<(typeof MAJOR_INDEX_OPTIONS)[number]['id']>('hkHSTECH')
  const [globalRegion, setGlobalRegion] = useState<'全部' | '美洲' | '亚洲' | '欧洲' | '其他'>('全部')
  const [stockCode, setStockCode] = useState(DEFAULT_STOCK_RESEARCH_CODE)
  const [draftStockCode, setDraftStockCode] = useState(DEFAULT_STOCK_RESEARCH_CODE)
  const [stockResearchHint, setStockResearchHint] = useState<string | null>(null)
  const [noticeCode, setNoticeCode] = useState('')
  const [draftNoticeCode, setDraftNoticeCode] = useState('')
  const [noticeSuggestions, setNoticeSuggestions] = useState<StockSearchItem[]>([])
  const [noticeSuggestionLoading, setNoticeSuggestionLoading] = useState(false)
  const [showNoticeSuggestions, setShowNoticeSuggestions] = useState(false)
  const [industryKeyword, setIndustryKeyword] = useState('新能源')
  const [draftIndustryKeyword, setDraftIndustryKeyword] = useState('新能源')
  const [longTigerDate, setLongTigerDate] = useState(getDefaultDate())
  const [longTigerReason, setLongTigerReason] = useState('')
  const [resolvedLongTigerDate, setResolvedLongTigerDate] = useState('')
  const [calendarRange] = useState(getDateRange(7))

  const [globalIndexes, setGlobalIndexes] = useState(createState<GlobalIndex[]>([]))
  const [industryChangeRanks, setIndustryChangeRanks] = useState(createState<IndustryRank[]>([]))
  const [industryMoneyRanks, setIndustryMoneyRanks] = useState(createState<IndustryMoneyRank[]>([]))
  const [csrcIndustryMoneyRanks, setCsrcIndustryMoneyRanks] = useState(createState<IndustryMoneyRank[]>([]))
  const [conceptMoneyRanks, setConceptMoneyRanks] = useState(createState<IndustryMoneyRank[]>([]))
  const [moneyRank, setMoneyRank] = useState(createState<StockMoneyRank[]>([]))
  const [longTiger, setLongTiger] = useState(createState<LongTigerRank[]>([]))
  const [news24h, setNews24h] = useState(createState<MarketNews[]>([]))
  const [sinaNews, setSinaNews] = useState(createState<MarketNews[]>([]))
  const [stockResearch, setStockResearch] = useState(createState<ResearchReport[]>([]))
  /** 与 stockCode 同时变化，用于「同代码再次查询」时强制重新请求 */
  const [stockResearchFetchNonce, setStockResearchFetchNonce] = useState(0)
  const [stockNotice, setStockNoticeState] = useState(createState<StockNotice[]>([]))
  const [industryResearch, setIndustryResearch] = useState(createState<ResearchReport[]>([]))
  const [hotStocks, setHotStocks] = useState(createState<HotStock[]>([]))
  const [hotEvents, setHotEvents] = useState(createState<HotEvent[]>([]))
  const [hotTopics, setHotTopics] = useState(createState<HotTopic[]>([]))
  const [investCalendar, setInvestCalendar] = useState(createState<InvestCalendarItem[]>([]))
  const [clsCalendar, setClsCalendar] = useState(createState<InvestCalendarItem[]>([]))

  const marketSectionSet = useMemo(() => new Set(MENU_ITEMS.map((item) => item.id)), [])

  const deriveSectionFromPath = useCallback(
    (pathname: string): MarketSectionId => {
      const segments = pathname.split('/').filter(Boolean)
      const marketIndex = segments.indexOf('market')
      const section = marketIndex >= 0 ? segments[marketIndex + 1] : ''
      if (section && marketSectionSet.has(section as MarketSectionId)) {
        return section as MarketSectionId
      }
      return 'global-indexes'
    },
    [marketSectionSet],
  )

  const activeItem = MENU_ITEMS.find((item) => item.id === activeSection) || MENU_ITEMS[0]

  const noticeSearchLabel = noticeCode ? `筛选 ${noticeCode}` : '全市场最新公告'
  const longTigerReasons = useMemo(
    () =>
      Array.from(new Set(longTiger.data.map((item) => item.explanation).filter((value): value is string => Boolean(value && value.trim())))),
    [longTiger.data],
  )
  const visibleLongTiger = useMemo(
    () => longTiger.data.filter((item) => !longTigerReason || item.explanation === longTigerReason),
    [longTiger.data, longTigerReason],
  )

  useEffect(() => {
    let cancelled = false
    setGlobalIndexes((prev) => ({ ...prev, loading: true, error: null }))
    getGlobalIndexes()
      .then((data) => {
        if (!cancelled) setGlobalIndexes({ loading: false, error: null, data: asArray(data) })
      })
      .catch((error: Error) => {
        if (!cancelled) setGlobalIndexes({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setIndustryChangeRanks((prev) => ({ ...prev, loading: true, error: null }))
    getIndustryRank(industryRankSort, 150)
      .then((data) => {
        if (!cancelled) setIndustryChangeRanks({ loading: false, error: null, data: asArray(data) })
      })
      .catch((error: Error) => {
        if (!cancelled) setIndustryChangeRanks({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [industryRankSort])

  useEffect(() => {
    let cancelled = false
    setIndustryMoneyRanks((prev) => ({ ...prev, loading: true, error: null }))
    getIndustryMoneyRank('0', 'netamount')
      .then((data) => {
        if (!cancelled) setIndustryMoneyRanks({ loading: false, error: null, data: asArray(data) })
      })
      .catch((error: Error) => {
        if (!cancelled) setIndustryMoneyRanks({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setCsrcIndustryMoneyRanks((prev) => ({ ...prev, loading: true, error: null }))
    getIndustryMoneyRank('2', 'netamount')
      .then((data) => {
        if (!cancelled) setCsrcIndustryMoneyRanks({ loading: false, error: null, data: asArray(data) })
      })
      .catch((error: Error) => {
        if (!cancelled) setCsrcIndustryMoneyRanks({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setConceptMoneyRanks((prev) => ({ ...prev, loading: true, error: null }))
    getIndustryMoneyRank('1', 'netamount')
      .then((data) => {
        if (!cancelled) setConceptMoneyRanks({ loading: false, error: null, data: asArray(data) })
      })
      .catch((error: Error) => {
        if (!cancelled) setConceptMoneyRanks({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadMoneyRank = () => {
      setMoneyRank((prev) => ({ ...prev, loading: true, error: null }))
      getStockMoneyRank(moneyRankTab)
        .then((data) => {
          if (!cancelled) setMoneyRank({ loading: false, error: null, data: asArray(data) })
        })
        .catch((error: Error) => {
          if (!cancelled) setMoneyRank({ loading: false, error: error.message, data: [] })
        })
    }

    loadMoneyRank()
    const intervalId = window.setInterval(loadMoneyRank, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [moneyRankTab])

  useEffect(() => {
    let cancelled = false

    const loadLongTiger = async (targetDate: string, retryCount = 0): Promise<void> => {
      if (cancelled) return
      if (retryCount === 0) {
        setLongTiger((prev) => ({ ...prev, loading: true, error: null }))
      }

      try {
        const data = asArray(await getLongTiger(targetDate))
        if (cancelled) return

        if (data.length > 0) {
          setResolvedLongTigerDate(targetDate)
          setLongTiger({ loading: false, error: null, data })
          return
        }

        if (retryCount >= 7) {
          setResolvedLongTigerDate(targetDate)
          setLongTiger({ loading: false, error: null, data: [] })
          return
        }

        await loadLongTiger(shiftDate(targetDate, -1), retryCount + 1)
      } catch (error) {
        if (cancelled) return
        setResolvedLongTigerDate(targetDate)
        setLongTiger({
          loading: false,
          error: error instanceof Error ? error.message : '加载龙虎榜失败',
          data: [],
        })
      }
    }

    void loadLongTiger(longTigerDate)

    return () => {
      cancelled = true
    }
  }, [longTigerDate])

  useEffect(() => {
    let cancelled = false
    setNews24h((prev) => ({ ...prev, loading: true, error: null }))
    getNews24h()
      .then((data) => {
        if (!cancelled) setNews24h({ loading: false, error: null, data: data.list || [] })
      })
      .catch((error: Error) => {
        if (!cancelled) setNews24h({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setSinaNews((prev) => ({ ...prev, loading: true, error: null }))
    getSinaNews()
      .then((data) => {
        if (!cancelled) setSinaNews({ loading: false, error: null, data: data.list || [] })
      })
      .catch((error: Error) => {
        if (!cancelled) setSinaNews({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!stockCode.trim()) {
      setStockResearch({ loading: false, error: null, data: [] })
      return
    }
    setStockResearch((prev) => ({ ...prev, loading: true, error: null }))
    getStockResearchReport(stockCode.trim(), 1, STOCK_RESEARCH_PAGE_SIZE)
      .then((data) => {
        if (!cancelled) {
          setStockResearch({
            loading: false,
            error: null,
            data: sortResearchReportsByDateDesc(data.list || []),
          })
        }
      })
      .catch((error: Error) => {
        if (!cancelled) setStockResearch({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [stockCode, stockResearchFetchNonce])

  const submitStockResearchQuery = () => {
    const raw = draftStockCode.trim()
    const code = tryResolveResearchStockCode(draftStockCode)
    if (!code) {
      setStockResearchHint(raw ? '请输入有效的 A 股 6 位代码（或带 SH/SZ/BJ 后缀）' : '请输入股票代码')
      return
    }
    setStockResearchHint(null)
    setDraftStockCode(code)
    setStockCode(code)
    setStockResearchFetchNonce((n) => n + 1)
  }

  const loadStockNotice = useCallback(async (code: string) => {
    setStockNoticeState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await getStockNotice(code)
      setStockNoticeState({ loading: false, error: null, data: data.list || [] })
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载公司公告失败'
      setStockNoticeState({ loading: false, error: message, data: [] })
    }
  }, [])

  const resetNoticeToMarket = useCallback(() => {
    setDraftNoticeCode('')
    setShowNoticeSuggestions(false)
    setNoticeSuggestions([])
    if (noticeCode === '') {
      void loadStockNotice('')
      return
    }
    setNoticeCode('')
  }, [loadStockNotice, noticeCode])

  useEffect(() => {
    let cancelled = false
    setStockNoticeState((prev) => ({ ...prev, loading: true, error: null }))
    getStockNotice(noticeCode)
      .then((data) => {
        if (!cancelled) setStockNoticeState({ loading: false, error: null, data: data.list || [] })
      })
      .catch((error: Error) => {
        if (!cancelled) setStockNoticeState({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [noticeCode])

  useEffect(() => {
    const keyword = draftNoticeCode.trim()
    if (!keyword) {
      setNoticeSuggestionLoading(false)
      setNoticeSuggestions([])
      return
    }

    let cancelled = false
    setNoticeSuggestionLoading(true)
    const timer = window.setTimeout(() => {
      searchStocks(keyword)
        .then((data) => {
          if (cancelled) return
          setNoticeSuggestions(asArray(data).slice(0, 8))
        })
        .catch(() => {
          if (cancelled) return
          setNoticeSuggestions([])
        })
        .finally(() => {
          if (!cancelled) {
            setNoticeSuggestionLoading(false)
          }
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [draftNoticeCode])

  useEffect(() => {
    let cancelled = false
    setIndustryResearch((prev) => ({ ...prev, loading: true, error: null }))
    getIndustryResearchReport(industryKeyword, 1, STOCK_RESEARCH_PAGE_SIZE)
      .then((data) => {
        if (!cancelled) {
          setIndustryResearch({
            loading: false,
            error: null,
            data: sortResearchReportsByDateDesc(data.list || []),
          })
        }
      })
      .catch((error: Error) => {
        if (!cancelled) setIndustryResearch({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [industryKeyword])

  useEffect(() => {
    let cancelled = false
    setHotStocks((prev) => ({ ...prev, loading: true, error: null }))
    getHotStocks()
      .then((data) => {
        if (!cancelled) setHotStocks({ loading: false, error: null, data: asArray(data) })
      })
      .catch((error: Error) => {
        if (!cancelled) setHotStocks({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setHotEvents((prev) => ({ ...prev, loading: true, error: null }))
    getHotEvents()
      .then((data) => {
        if (!cancelled) setHotEvents({ loading: false, error: null, data: asArray(data) })
      })
      .catch((error: Error) => {
        if (!cancelled) setHotEvents({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setHotTopics((prev) => ({ ...prev, loading: true, error: null }))
    getHotTopics()
      .then((data) => {
        if (!cancelled) setHotTopics({ loading: false, error: null, data: asArray(data) })
      })
      .catch((error: Error) => {
        if (!cancelled) setHotTopics({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setInvestCalendar((prev) => ({ ...prev, loading: true, error: null }))
    getInvestCalendar(calendarRange.start, calendarRange.end)
      .then((data) => {
        if (!cancelled) setInvestCalendar({ loading: false, error: null, data: asArray(data) })
      })
      .catch((error: Error) => {
        if (!cancelled) setInvestCalendar({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [calendarRange.end, calendarRange.start])

  useEffect(() => {
    let cancelled = false
    setClsCalendar((prev) => ({ ...prev, loading: true, error: null }))
    getClsCalendar(calendarRange.start, calendarRange.end)
      .then((data) => {
        if (!cancelled) setClsCalendar({ loading: false, error: null, data: asArray(data) })
      })
      .catch((error: Error) => {
        if (!cancelled) setClsCalendar({ loading: false, error: error.message, data: [] })
      })
    return () => {
      cancelled = true
    }
  }, [calendarRange.end, calendarRange.start])

  const groupedIndexes = useMemo(() => {
    const map: Record<'美洲' | '亚洲' | '欧洲' | '其他', GlobalIndex[]> = {
      美洲: [],
      亚洲: [],
      欧洲: [],
      其他: [],
    }
    globalIndexes.data.forEach((item) => {
      map[getIndexRegion(item)].push(item)
    })
    return map
  }, [globalIndexes.data])

  const visibleIndexes = useMemo(() => {
    if (globalRegion === '全部') return globalIndexes.data
    return groupedIndexes[globalRegion]
  }, [globalIndexes.data, globalRegion, groupedIndexes])

  const activeMajorIndexMeta = useMemo(
    () => MAJOR_INDEX_OPTIONS.find((item) => item.id === activeMajorIndex) || MAJOR_INDEX_OPTIONS[0],
    [activeMajorIndex],
  )

  const hotStats = useMemo(
    () => [
      { label: '热门股票', value: hotStocks.data.length },
      { label: '热门事件', value: hotEvents.data.length },
      { label: '热门话题', value: hotTopics.data.length },
    ],
    [hotEvents.data.length, hotStocks.data.length, hotTopics.data.length],
  )

  useEffect(() => {
    const nextSection = deriveSectionFromPath(location.pathname)
    setActiveSection((current) => (current === nextSection ? current : nextSection))
  }, [deriveSectionFromPath, location.pathname])

  useEffect(() => {
    if (location.pathname === '/market') {
      navigate('/market/global-indexes', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    sectionAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeSection])

  const renderMarketNews = () => {
    const tabs = [
      { id: 'news24h', label: '24 小时新闻' },
      
    ]

    return (
      <div className="space-y-4">
        <SectionTabBar compact tabs={tabs} activeTab={newsTab} onChange={(value) => setNewsTab(value as typeof newsTab)} />
        {newsTab === 'news24h' ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              dense
              title="财联社电报"
              eyebrow="CLS Telegraph"
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full border border-slate-200 text-sky-600 hover:bg-sky-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  onClick={() => {
                    setNews24h((prev) => ({ ...prev, loading: true, error: null }))
                    getNews24h()
                      .then((data) => setNews24h({ loading: false, error: null, data: data.list || [] }))
                      .catch((error: Error) => setNews24h({ loading: false, error: error.message, data: [] }))
                  }}
                  title="刷新财联社电报"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              }
            >
              {news24h.loading ? <LoadingPanel label="正在加载财联社电报..." /> : null}
              {news24h.error ? <ErrorPanel message={news24h.error} /> : null}
              {!news24h.loading && !news24h.error && !news24h.data.length ? (
                <EmptyState title="暂时没有财联社电报" description="后端接口接通后，这里会显示最新电报流。" />
              ) : null}
              {!news24h.loading && !news24h.error && news24h.data.length ? (
                <div className="max-h-[min(70vh,720px)] divide-y divide-slate-100 overflow-y-auto overscroll-contain rounded-lg border border-slate-200/90 dark:divide-slate-800 dark:border-slate-800">
                  {news24h.data.map((item) => {
                    const sentiment = /利好|看涨|受益|涨停/.test(`${item.title}${item.content}`) ? '看涨' : '中性'
                    const body = item.content || item.title
                    const bodyClass =
                      'text-[13px] leading-[1.55] text-slate-700 decoration-slate-300 underline-offset-2 hover:text-sky-700 hover:decoration-sky-500/60 dark:text-slate-300 dark:hover:text-sky-400'
                    return (
                      <article key={`cls-${item.id}`} className="px-3 py-2.5 sm:px-4">
                        <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                            {formatClockTime(item.publishTime)}
                          </span>
                          <span
                            className={cn(
                              'rounded px-1.5 py-px text-[10px] font-medium',
                              sentiment === '看涨' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                            )}
                          >
                            {sentiment}
                          </span>
                        </div>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noreferrer" className={cn('block', bodyClass)}>
                            {body}
                          </a>
                        ) : (
                          <p className={cn(bodyClass, 'cursor-default no-underline hover:text-slate-700 dark:hover:text-slate-300')}>{body}</p>
                        )}
                      </article>
                    )
                  })}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              dense
              title="新浪财经"
              eyebrow="Sina Finance"
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full border border-slate-200 text-sky-600 hover:bg-sky-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  onClick={() => {
                    setSinaNews((prev) => ({ ...prev, loading: true, error: null }))
                    getSinaNews()
                      .then((data) => setSinaNews({ loading: false, error: null, data: data.list || [] }))
                      .catch((error: Error) => setSinaNews({ loading: false, error: error.message, data: [] }))
                  }}
                  title="刷新新浪财经"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              }
            >
              {sinaNews.loading ? <LoadingPanel label="正在加载新浪财经..." /> : null}
              {sinaNews.error ? <ErrorPanel message={sinaNews.error} /> : null}
              {!sinaNews.loading && !sinaNews.error && !sinaNews.data.length ? (
                <EmptyState title="暂时没有新浪快讯" description="后端接口接通后，这里会显示新浪财经快讯。" />
              ) : null}
              {!sinaNews.loading && !sinaNews.error && sinaNews.data.length ? (
                <div className="max-h-[min(70vh,720px)] divide-y divide-slate-100 overflow-y-auto overscroll-contain rounded-lg border border-slate-200/90 dark:divide-slate-800 dark:border-slate-800">
                  {sinaNews.data.map((item) => {
                    const tags = item.tags
                      ? item.tags
                          .split(',')
                          .map((tag) => tag.trim())
                          .filter(Boolean)
                      : ['财经']
                    const sentiment = tags.includes('焦点') ? '看涨' : '中性'
                    const body = item.content || item.title
                    const bodyClass =
                      'text-[13px] leading-[1.55] text-slate-700 decoration-slate-300 underline-offset-2 hover:text-sky-700 hover:decoration-sky-500/60 dark:text-slate-300 dark:hover:text-sky-400'
                    return (
                      <article key={`sina-${item.id}`} className="px-3 py-2.5 sm:px-4">
                        <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                            {formatClockTime(item.publishTime)}
                          </span>
                          {tags.slice(0, 3).map((tag) => (
                            <span
                              key={`${item.id}-${tag}`}
                              className={cn(
                                'rounded px-1.5 py-px text-[10px] font-medium',
                                tag === '国际' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                              )}
                            >
                              {tag}
                            </span>
                          ))}
                          {!tags.includes('焦点') ? (
                            <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {sentiment}
                            </span>
                          ) : null}
                        </div>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noreferrer" className={cn('block', bodyClass)}>
                            {body}
                          </a>
                        ) : (
                          <p className={cn(bodyClass, 'cursor-default no-underline hover:text-slate-700 dark:hover:text-slate-300')}>{body}</p>
                        )}
                      </article>
                    )
                  })}
                </div>
              ) : null}
            </SectionCard>
          </div>
        ) : null}
        {newsTab === 'invest-calendar' ? (
          <SectionCard title="投资日历" eyebrow="Schedule">
            {investCalendar.loading ? <LoadingPanel label="正在加载投资日历..." /> : null}
            {investCalendar.error ? <ErrorPanel message={investCalendar.error} /> : null}
            {!investCalendar.loading && !investCalendar.error && !investCalendar.data.length ? (
              <EmptyState title="暂无投资日历数据" description="这里会展示 IPO、分红、会议等事件。" />
            ) : null}
            {!investCalendar.loading && !investCalendar.error && investCalendar.data.length ? (
              <div className="space-y-3">
                {investCalendar.data.map((item, index) => (
                  <div
                    key={`${item.date}-${item.title}-${index}`}
                    className="flex gap-4 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800"
                  >
                    <div className="w-28 shrink-0 text-sm font-medium text-emerald-600">{item.date}</div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{item.content || item.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        ) : null}
        {newsTab === 'cls-calendar' ? (
          <SectionCard title="财联社日历" eyebrow="CLS">
            {clsCalendar.loading ? <LoadingPanel label="正在加载财联社日历..." /> : null}
            {clsCalendar.error ? <ErrorPanel message={clsCalendar.error} /> : null}
            {!clsCalendar.loading && !clsCalendar.error && !clsCalendar.data.length ? (
              <EmptyState title="暂无财联社日历数据" description="接口接通后会展示更偏事件驱动的时间线。" />
            ) : null}
            {!clsCalendar.loading && !clsCalendar.error && clsCalendar.data.length ? (
              <div className="space-y-3">
                {clsCalendar.data.map((item, index) => (
                  <div
                    key={`${item.date}-${item.title}-${index}`}
                    className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800"
                  >
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.type || 'Event'}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {item.date} · {item.content || '暂无补充描述'}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        ) : null}
      </div>
    )
  }

  const renderGlobalIndexes = () => {
    const regionTabs = [
      { id: '全部', label: '全部' },
      { id: '美洲', label: '美洲' },
      { id: '亚洲', label: '亚洲' },
      { id: '欧洲', label: '欧洲' },
      { id: '其他', label: '其他' },
    ]
    return (
      <div className="space-y-4">
        <SectionTabBar
          compact
          tabs={regionTabs}
          activeTab={globalRegion}
          onChange={(value) => setGlobalRegion(value as typeof globalRegion)}
        />
        <SectionCard title="全球指数面板" eyebrow="Global Indexes">
          {globalIndexes.loading ? <LoadingPanel label="正在同步全球指数..." /> : null}
          {globalIndexes.error ? <ErrorPanel message={globalIndexes.error} /> : null}
          {!globalIndexes.loading && !globalIndexes.error && !visibleIndexes.length ? (
            <EmptyState title="全球指数暂无数据" description="旧项目这里是多列卡片布局，我已经保留了同样的浏览层级。" />
          ) : null}
          {!globalIndexes.loading && !globalIndexes.error && visibleIndexes.length ? (
            <div key={globalRegion} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {visibleIndexes.map((item) => (
                <div
                  key={`${item.code}-${item.name}`}
                  className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{getIndexRegion(item)}</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</div>
                      <div className="text-[11px] text-slate-400">{item.code || 'INDEX'}</div>
                    </div>
                    <div className={cn('text-right text-xs font-semibold', toneByNumber(item.changePct))}>
                      {formatPercent(item.changePct)}
                    </div>
                  </div>
                  <div className="mt-3 text-xl font-semibold tabular-nums text-slate-950 dark:text-slate-50">{formatNumber(item.price)}</div>
                  <div className={cn('mt-1 text-xs', toneByNumber(item.change))}>
                    {item.change > 0 ? '+' : ''}
                    {formatNumber(item.change)} 点
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">更新 {item.updateTime || '--'}</div>
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>
      </div>
    )
  }

  const renderMajorIndexes = () => (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex min-w-max gap-1.5">
          {MAJOR_INDEX_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveMajorIndex(item.id)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3 sm:text-[13px]',
                item.id === activeMajorIndex
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-900',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <MajorIndexChart
        key={activeMajorIndexMeta.id}
        code={activeMajorIndexMeta.code}
        name={activeMajorIndexMeta.label}
        defaultVisibleBars={96}
      />
    </div>
  )

  const renderIndustryRank = () => {
    const tabs = [
      { id: 'change', label: '行业涨幅排名' },
      { id: 'money', label: '行业资金排名' },
      { id: 'csrc-money', label: '证监会行业资金排名' },
      { id: 'concept-money', label: '概念板块资金排名' },
    ]

    const activeMoneyState =
      industryRankTab === 'money'
        ? industryMoneyRanks
        : industryRankTab === 'csrc-money'
          ? csrcIndustryMoneyRanks
          : conceptMoneyRanks

    return (
      <div className="space-y-4">
        <SectionTabBar compact tabs={tabs} activeTab={industryRankTab} onChange={(value) => setIndustryRankTab(value as typeof industryRankTab)} />

        {industryRankTab === 'change' ? (
          <SectionCard title="行业涨幅排名" eyebrow="Industry Change">
            {industryChangeRanks.loading ? <LoadingPanel label="正在加载行业涨幅排名..." /> : null}
            {industryChangeRanks.error ? <ErrorPanel message={industryChangeRanks.error} /> : null}
            {!industryChangeRanks.loading && !industryChangeRanks.error && !industryChangeRanks.data.length ? (
              <EmptyState title="暂无行业涨幅排名" description="接口接通后会展示行业涨幅、5日涨幅、20日涨幅和领涨股。" />
            ) : null}
            {!industryChangeRanks.loading && !industryChangeRanks.error && industryChangeRanks.data.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
                  <thead className="bg-slate-50 text-slate-800 dark:bg-slate-900/70 dark:text-slate-100">
                    <tr>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">行业名称</th>
                      <th
                        className="cursor-pointer px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400"
                        onClick={() => setIndustryRankSort((prev) => (prev === '0' ? '1' : '0'))}
                      >
                        行业涨幅 {industryRankSort === '0' ? '▼' : '▲'}
                      </th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">行业5日涨幅</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">行业20日涨幅</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">领涨股</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">涨幅</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">最新价</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {industryChangeRanks.data.map((item, index) => (
                      <tr key={`${item.industryCode}-${index}`} className="bg-white/95 dark:bg-transparent">
                        <td className="px-2.5 py-2">
                          <span className="inline-flex rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                            {item.industryName}
                          </span>
                        </td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.changePct))}>{formatPercent(item.changePct)}</td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.changePct5d))}>{formatPercent(item.changePct5d)}</td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.changePct20d))}>{formatPercent(item.changePct20d)}</td>
                        <td className="px-2.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                          {item.leadStock} <span className="text-sky-600 dark:text-sky-400">{item.leadStockCode}</span>
                        </td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.leadChange))}>{formatPercent(item.leadChange)}</td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.leadChange))}>{formatNumber(item.leadPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>
        ) : null}

        {industryRankTab !== 'change' ? (
          <SectionCard
            title={
              industryRankTab === 'money'
                ? '行业资金排名'
                : industryRankTab === 'csrc-money'
                  ? '证监会行业资金排名'
                  : '概念板块资金排名'
            }
            eyebrow="Industry Flow"
          >
            {activeMoneyState.loading ? <LoadingPanel label="正在加载行业资金排名..." /> : null}
            {activeMoneyState.error ? <ErrorPanel message={activeMoneyState.error} /> : null}
            {!activeMoneyState.loading && !activeMoneyState.error && !activeMoneyState.data.length ? (
              <EmptyState title="暂无行业资金排名" description="接口接通后会展示流入、流出、净流入和领涨股资金情况。" />
            ) : null}
            {!activeMoneyState.loading && !activeMoneyState.error && activeMoneyState.data.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
                  <thead className="bg-slate-50 text-slate-800 dark:bg-slate-900/70 dark:text-slate-100">
                    <tr>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">板块名称</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">涨跌幅</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">流入资金/万</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">流出资金/万</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">净流入/万</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">净流入率</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">领涨股</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">涨跌幅</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">最新价</th>
                      <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">净流入率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {activeMoneyState.data.map((item, index) => (
                      <tr key={`${item.industryName}-${index}`} className="bg-white/95 dark:bg-transparent">
                        <td className="px-2.5 py-2">
                          <span className="inline-flex rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                            {item.industryName}
                          </span>
                        </td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.changePct))}>{formatPercent(item.changePct)}</td>
                        <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-sky-600 dark:text-sky-400">{formatNumber(item.inflow / 10000)}</td>
                        <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-sky-600 dark:text-sky-400">{formatNumber(item.outflow / 10000)}</td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.netInflow))}>{formatNumber(item.netInflow / 10000)}</td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.netRatio))}>{formatPercent(item.netRatio)}</td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium', toneByNumber(item.leadChange))}>
                          {item.leadStock} <span className="text-sky-600 dark:text-sky-400">{item.leadStockCode}</span>
                        </td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.leadChange))}>{formatPercent(item.leadChange)}</td>
                        <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-sky-600 dark:text-sky-400">{formatNumber(item.leadPrice)}</td>
                        <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.leadNetRatio))}>{formatPercent(item.leadNetRatio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>
        ) : null}
      </div>
    )
  }

  const renderMoneyFlow = () => {
    const tabs = [
      { id: 'netamount', label: '净流入额排名' },
      { id: 'outamount', label: '流出资金排名' },
      { id: 'ratioamount', label: '净流入率排名' },
      { id: 'r0_net', label: '主力净流入额排名' },
      { id: 'r0_out', label: '主力流出排名' },
      { id: 'r0_ratio', label: '主力净流入率排名' },
      { id: 'r3_net', label: '散户净流入额排名' },
      { id: 'r3_out', label: '散户流出排名' },
      { id: 'r3_ratio', label: '散户净流入率排名' },
    ]

    const showR0Out = moneyRankTab === 'r0_net' || moneyRankTab === 'r0_out'
    const showR0In = moneyRankTab === 'r0_net'
    const showR0Net = moneyRankTab === 'r0_net'
    const showR3Out = moneyRankTab === 'r3_net' || moneyRankTab === 'r3_out'
    const showR3In = moneyRankTab === 'r3_net'
    const showR3Net = moneyRankTab === 'r3_net'

    return (
      <div className="space-y-4">
        <SectionTabBar
          compact
          tabs={tabs}
          activeTab={moneyRankTab}
          onChange={(value) => setMoneyRankTab(value as typeof moneyRankTab)}
        />

        <SectionCard
          title={tabs.find((item) => item.id === moneyRankTab)?.label || '个股资金流向'}
          eyebrow="Money Flow Ranking"
          actions={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full border border-slate-200 text-sky-500 hover:bg-sky-50 hover:text-sky-600 dark:border-slate-800 dark:hover:bg-slate-900"
              onClick={() => {
                setMoneyRank((prev) => ({ ...prev, loading: true, error: null }))
                getStockMoneyRank(moneyRankTab)
                  .then((data) => setMoneyRank({ loading: false, error: null, data: asArray(data) }))
                  .catch((error: Error) => setMoneyRank({ loading: false, error: error.message, data: [] }))
              }}
              title="刷新个股资金流向"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          }
        >
          {moneyRank.loading ? <LoadingPanel label="正在刷新数据..." /> : null}
          {moneyRank.error ? <ErrorPanel message={moneyRank.error} /> : null}
          {!moneyRank.loading && !moneyRank.error && !moneyRank.data.length ? (
            <EmptyState title="暂无个股资金流向数据" description="接口接通后这里会展示和旧版一致的个股资金榜单。" />
          ) : null}
          {!moneyRank.loading && !moneyRank.error && moneyRank.data.length ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="min-w-[1400px] divide-y divide-slate-200 text-xs dark:divide-slate-800">
                <thead className="bg-slate-50 text-slate-800 dark:bg-slate-900/70 dark:text-slate-100">
                  <tr>
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">代码</th>
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">名称</th>
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">最新价</th>
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">涨跌幅</th>
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">换手率</th>
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">成交额/万</th>
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">流出资金/万</th>
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">流入资金/万</th>
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">净流入/万</th>
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">净流入率</th>
                    {showR0Out ? <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">主力流出/万</th> : null}
                    {showR0In ? <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">主力流入/万</th> : null}
                    {showR0Net ? <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">主力净流入/万</th> : null}
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">主力净流入率</th>
                    {showR3Out ? <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">散户流出/万</th> : null}
                    {showR3In ? <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">散户流入/万</th> : null}
                    {showR3Net ? <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">散户净流入/万</th> : null}
                    <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">散户净流入率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {moneyRank.data.map((item) => (
                    <tr key={`${item.code}-${item.name}`} className="bg-white/95 dark:bg-transparent">
                      <td className="px-2.5 py-2">
                        <span className="font-mono text-[11px] font-medium text-sky-600 dark:text-sky-400">{item.code}</span>
                      </td>
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.changePct))}>{item.name}</td>
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.changePct))}>{formatNumber(item.price, 4)}</td>
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.changePct))}>{formatPercent(item.changePct)}</td>
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', item.turnoverRate > 5 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-600 dark:text-slate-400')}>{formatPercent(item.turnoverRate)}</td>
                      <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-sky-600 dark:text-sky-400">{formatNumber(item.amount / 10000)}</td>
                      <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-sky-600 dark:text-sky-400">{formatNumber(item.outAmount / 10000)}</td>
                      <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-sky-600 dark:text-sky-400">{formatNumber(item.inAmount / 10000)}</td>
                      <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-sky-600 dark:text-sky-400">{formatNumber(item.netAmount / 10000)}</td>
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.netRatio))}>{formatPercent(item.netRatio)}</td>
                      {showR0Out ? <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{formatNumber(item.r0Out / 10000)}</td> : null}
                      {showR0In ? <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-rose-600 dark:text-rose-400">{formatNumber(item.r0In / 10000)}</td> : null}
                      {showR0Net ? <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.r0Net))}>{formatNumber(item.r0Net / 10000)}</td> : null}
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.r0Ratio))}>{formatPercent(item.r0Ratio)}</td>
                      {showR3Out ? <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{formatNumber(item.r3Out / 10000)}</td> : null}
                      {showR3In ? <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-rose-600 dark:text-rose-400">{formatNumber(item.r3In / 10000)}</td> : null}
                      {showR3Net ? <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.r3Net))}>{formatNumber(item.r3Net / 10000)}</td> : null}
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums', toneByNumber(item.r3Ratio))}>{formatPercent(item.r3Ratio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>
      </div>
    )
  }

  const renderLongTiger = () => (
    <div className="space-y-4">
      <SectionCard
        title="龙虎榜"
        eyebrow="Long Tiger"
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-slate-200 text-sky-600 hover:bg-sky-50 dark:border-slate-800 dark:hover:bg-slate-900"
            onClick={() => setLongTigerDate(getDefaultDate())}
            title="回到今天"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_minmax(0,1.1fr)]">
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">日期</span>
            <Input
              type="date"
              value={longTigerDate}
              onChange={(event) => setLongTigerDate(event.target.value)}
              className="h-9 max-w-[11rem] rounded-md border-slate-200 text-xs dark:border-slate-700"
            />
          </label>
          <label className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">上榜原因</span>
            <div className="relative min-w-0 flex-1">
              <select
                value={longTigerReason}
                onChange={(event) => setLongTigerReason(event.target.value)}
                className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 pr-9 text-xs text-slate-700 outline-none transition focus:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="">上榜原因过滤</option>
                {longTigerReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </label>
          <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400 md:col-span-2 xl:col-span-1 xl:self-center">
            {resolvedLongTigerDate && resolvedLongTigerDate !== longTigerDate
              ? `当前日期暂无数据，已回退至 ${resolvedLongTigerDate}`
              : '龙虎榜通常在收盘后约 1 小时内更新。'}
          </p>
        </div>

        {longTiger.loading ? <LoadingPanel label="正在加载龙虎榜..." /> : null}
        {longTiger.error ? <ErrorPanel message={longTiger.error} /> : null}
        {!longTiger.loading && !longTiger.error && !visibleLongTiger.length ? (
          <EmptyState title="当前条件暂无龙虎榜" description="可以切换日期，或者清空上榜原因过滤重新查看。" />
        ) : null}
        {!longTiger.loading && !longTiger.error && visibleLongTiger.length ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-[1100px] divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 text-slate-800 dark:bg-slate-900/70 dark:text-slate-100">
                <tr>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">代码</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">名称</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">收盘价</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">涨跌幅</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">龙虎榜净买额(万)</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">龙虎榜买入额(万)</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">龙虎榜卖出额(万)</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">龙虎榜成交额(万)</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">换手率</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">流通市值(亿)</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">上榜原因</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {visibleLongTiger.map((item) => {
                  const displayCode =
                    item.secuCode && item.secuCode.includes('.')
                      ? `${item.secuCode.split('.')[1].toLowerCase()}${item.secuCode.split('.')[0]}`
                      : item.securityCode

                  return (
                    <tr key={`${item.secuCode || item.securityCode}-${item.explanation}`} className="bg-white/95 align-top dark:bg-transparent">
                      <td className="px-2.5 py-2">
                        <span className="inline-flex rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                          {displayCode}
                        </span>
                      </td>
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums text-slate-800 dark:text-slate-200', toneByNumber(item.changeRate))}>{item.securityNameAbbr}</td>
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums text-slate-800 dark:text-slate-200', toneByNumber(item.changeRate))}>{formatNumber(item.closePrice)}</td>
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums text-slate-800 dark:text-slate-200', toneByNumber(item.changeRate))}>{formatPercent(item.changeRate)}</td>
                      <td className={cn('px-2.5 py-2 text-xs font-medium tabular-nums text-slate-800 dark:text-slate-200', toneByNumber(item.billboardNetAmt))}>{formatNumber(item.billboardNetAmt / 10000)}</td>
                      <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-rose-500">{formatNumber(item.billboardBuyAmt / 10000)}</td>
                      <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-emerald-500">{formatNumber(item.billboardSellAmt / 10000)}</td>
                      <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-sky-600 dark:text-sky-400">{formatNumber(item.billboardDealAmt / 10000)}</td>
                      <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-sky-600 dark:text-sky-400">{formatPercent(item.turnoverRate)}</td>
                      <td className="px-2.5 py-2 text-xs font-medium tabular-nums text-sky-600 dark:text-sky-400">{formatNumber(item.freeMarketCap / 100000000)}</td>
                      <td className="max-w-[min(28rem,40vw)] px-2.5 py-2 text-xs font-normal leading-snug text-sky-700 dark:text-sky-400">{item.explanation}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )

  const renderResearchList = (
    title: string,
    eyebrow: string,
    state: ResourceState<ResearchReport[]>,
    actions?: ReactNode,
    beforeQueryEmpty?: { title: string; description: string },
  ) => (
    <SectionCard title={title} eyebrow={eyebrow} actions={actions}>
      {state.loading ? <LoadingPanel label={`正在加载${title}...`} /> : null}
      {state.error ? <ErrorPanel message={state.error} /> : null}
      {!state.loading && !state.error && !state.data.length ? (
        <EmptyState
          title={beforeQueryEmpty ? beforeQueryEmpty.title : `暂无${title}`}
          description={
            beforeQueryEmpty
              ? beforeQueryEmpty.description
              : '如果后端仓储已接通，这里会展示原旧项目中的研报列表。'
          }
        />
      ) : null}
      {!state.loading && !state.error && state.data.length ? (
        <div className="space-y-2">
          {state.data.map((item) => (
            <article key={`${item.id}-${item.title}`} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span>{item.orgName || '研究机构'}</span>
                <span>·</span>
                <span>{item.author || '匿名分析师'}</span>
                <span>·</span>
                <span>{formatDate(item.publishDate)}</span>
              </div>
              <h4 className="mt-1.5 text-sm font-semibold text-slate-950 dark:text-slate-100">{item.title}</h4>
              <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.content || '暂无摘要。'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {item.stockName || item.stockCode ? <span>{item.stockName || item.stockCode}</span> : null}
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                    查看原文
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </SectionCard>
  )

  const submitNoticeSearch = useCallback(() => {
    const rawKeyword = draftNoticeCode.trim()
    const pickedCode =
      noticeSuggestions.length > 0 && !/^\d{6}$/.test(rawKeyword) ? noticeSuggestions[0].code : rawKeyword
    setShowNoticeSuggestions(false)
    if (!pickedCode) {
      resetNoticeToMarket()
      return
    }
    if (pickedCode !== rawKeyword) {
      setDraftNoticeCode(pickedCode)
    }
    if (pickedCode === noticeCode) {
      void loadStockNotice(pickedCode)
      return
    }
    setNoticeCode(pickedCode)
  }, [draftNoticeCode, loadStockNotice, noticeCode, noticeSuggestions, resetNoticeToMarket])

  const selectNoticeSuggestion = useCallback(
    (item: StockSearchItem) => {
      setDraftNoticeCode(item.code)
      setNoticeSuggestions([])
      setShowNoticeSuggestions(false)
      if (item.code === noticeCode) {
        void loadStockNotice(item.code)
        return
      }
      setNoticeCode(item.code)
    },
    [loadStockNotice, noticeCode],
  )

  const renderNotice = () => (
    <div className="space-y-3">
      <form
        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40"
        onSubmit={(event) => {
          event.preventDefault()
          submitNoticeSearch()
        }}
      >
        <div className="relative flex min-h-[2.5rem] items-center gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 dark:border-slate-700 dark:bg-slate-900/50">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <Input
            value={draftNoticeCode}
            onChange={(event) => {
              const value = event.target.value
              setDraftNoticeCode(value)
              setShowNoticeSuggestions(true)
              if (!value.trim()) {
                resetNoticeToMarket()
              }
            }}
            onFocus={() => setShowNoticeSuggestions(true)}
            onBlur={() => {
              window.setTimeout(() => setShowNoticeSuggestions(false), 120)
            }}
            className="h-9 flex-1 border-0 bg-transparent px-0 text-left text-xs text-slate-950 shadow-none placeholder:text-slate-400 focus-visible:ring-0 dark:text-slate-50"
            placeholder="代码或名称，留空为全市场"
          />
          <Button type="submit" size="sm" className="h-8 shrink-0 rounded-md bg-slate-900 px-4 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900">
            查询
          </Button>
          {showNoticeSuggestions && (noticeSuggestionLoading || noticeSuggestions.length) ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-950">
              {noticeSuggestionLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  匹配中…
                </div>
              ) : (
                <div className="py-1">
                  {noticeSuggestions.map((item) => (
                    <button
                      key={`${item.code}-${item.name}`}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectNoticeSuggestion(item)}
                    >
                      <div>
                        <div className="text-xs font-medium text-slate-900 dark:text-slate-100">{item.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.market || 'A股'} · {item.industry || '未分类'}</div>
                      </div>
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">{item.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </form>

      <SectionCard
        title="公司公告"
        eyebrow="Notice"
        actions={
          <div className="flex items-center gap-1.5">
            <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">{noticeSearchLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full border border-slate-200 text-sky-600 hover:bg-sky-50 dark:border-slate-800 dark:hover:bg-slate-900"
              onClick={resetNoticeToMarket}
              title="回到全市场最新公告"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      >
        {stockNotice.loading ? <LoadingPanel label="正在加载公司公告..." /> : null}
        {stockNotice.error ? <ErrorPanel message={stockNotice.error} /> : null}
        {!stockNotice.loading && !stockNotice.error && !stockNotice.data.length ? (
          <EmptyState title="暂无公告" description="当前条件下没有查询到公告数据。" />
        ) : null}
        {!stockNotice.loading && !stockNotice.error && stockNotice.data.length ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                <tr>
                  <th className="w-[7rem] px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">股票代码</th>
                  <th className="w-[6rem] px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">股票名称</th>
                  <th className="px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">公告标题</th>
                  <th className="w-[7rem] px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">公告类型</th>
                  <th className="w-[6rem] px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">公告日期</th>
                  <th className="w-[8rem] px-2.5 py-2 text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <span>更新时间</span>
                      <RefreshCw className="h-3 w-3 text-sky-500" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {stockNotice.data.map((item) => (
                  <tr key={`${item.id}-${item.title}`} className="bg-white/90 align-top dark:bg-transparent">
                    <td className="px-2.5 py-2">
                      <span className="font-mono text-[11px] font-medium text-sky-600 dark:text-sky-400">{item.stockCode || '--'}</span>
                    </td>
                    <td className="px-2.5 py-2">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{item.stockName || '--'}</span>
                    </td>
                    <td className="px-2.5 py-2">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className={cn('line-clamp-2 text-xs font-medium leading-snug hover:underline', noticeTitleTone(item.title))}
                        >
                          {item.title}
                        </a>
                      ) : (
                        <div className={cn('line-clamp-2 text-xs font-medium leading-snug text-slate-800 dark:text-slate-100', noticeTitleTone(item.title))}>
                          {item.title}
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 py-2">
                      <span className={cn('text-[11px] font-medium leading-snug', noticeTypeTone(item.noticeType))}>{item.noticeType || '其他'}</span>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-[11px] tabular-nums text-slate-600 dark:text-slate-400">{formatDate(item.publishDate)}</td>
                    <td className="px-2.5 py-2 text-[11px] tabular-nums leading-snug text-slate-600 dark:text-slate-400">
                      {item.updateTime ? formatDateTime(item.updateTime) : formatDate(item.publishDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )

  const renderHot = () => {
    const tabs = [
      { id: 'stocks', label: '热门股票' },
      { id: 'events', label: '热门事件' },
      { id: 'topics', label: '热门话题' },
    ]

    return (
      <div className="space-y-4">
        <div className="grid gap-2 md:grid-cols-3">
          {hotStats.map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-950 dark:text-slate-50">{item.value}</div>
            </div>
          ))}
        </div>
        <SectionTabBar compact tabs={tabs} activeTab={hotTab} onChange={(value) => setHotTab(value as typeof hotTab)} />
        {hotTab === 'stocks' ? (
          <SectionCard title="热门股票" eyebrow="Hot Stocks">
            {hotStocks.loading ? <LoadingPanel label="正在加载热门股票..." /> : null}
            {hotStocks.error ? <ErrorPanel message={hotStocks.error} /> : null}
            {!hotStocks.loading && !hotStocks.error && !hotStocks.data.length ? (
              <EmptyState title="暂无热门股票" description="这里对应旧项目的当前热门股票榜。" />
            ) : null}
            {!hotStocks.loading && !hotStocks.error && hotStocks.data.length ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {hotStocks.data.slice(0, 12).map((item) => (
                  <div key={item.code} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">{item.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.exchange} · {item.code}
                        </div>
                      </div>
                      <div className={cn('text-xs font-semibold tabular-nums', toneByNumber(item.percent))}>{formatPercent(item.percent)}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <div className="text-slate-400">现价</div>
                        <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{formatNumber(item.current)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">热度</div>
                        <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{formatNumber(item.value, 0)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">排名变化</div>
                        <div className={cn('mt-0.5 font-medium', toneByNumber(item.rankChange))}>{item.rankChange}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        ) : null}
        {hotTab === 'events' ? (
          <SectionCard title="热门事件" eyebrow="Hot Events">
            {hotEvents.loading ? <LoadingPanel label="正在加载热门事件..." /> : null}
            {hotEvents.error ? <ErrorPanel message={hotEvents.error} /> : null}
            {!hotEvents.loading && !hotEvents.error && !hotEvents.data.length ? (
              <EmptyState title="暂无热门事件" description="接口接通后这里会展示事件热度和参与讨论数。" />
            ) : null}
            {!hotEvents.loading && !hotEvents.error && hotEvents.data.length ? (
              <div className="space-y-2">
                {hotEvents.data.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">{item.title}</div>
                      <div className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        热度 {item.hot}
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.content || item.tag || '暂无摘要'}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        ) : null}
        {hotTab === 'topics' ? (
          <SectionCard title="热门话题" eyebrow="Hot Topics">
            {hotTopics.loading ? <LoadingPanel label="正在加载热门话题..." /> : null}
            {hotTopics.error ? <ErrorPanel message={hotTopics.error} /> : null}
            {!hotTopics.loading && !hotTopics.error && !hotTopics.data.length ? (
              <EmptyState title="暂无热门话题" description="这里会承接旧项目的热门话题模块。" />
            ) : null}
            {!hotTopics.loading && !hotTopics.error && hotTopics.data.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {hotTopics.data.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">{item.title}</div>
                      <div className="text-xs font-semibold text-emerald-600">{item.hot}</div>
                    </div>
                    <div className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.content || '暂无摘要'}</div>
                    <div className="mt-2 text-[11px] text-slate-400">关联股票 {item.stockCount}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        ) : null}
      </div>
    )
  }

  const renderPlaceholder = (title: string, description: string) => (
    <SectionCard title={title} eyebrow="Planned">
      <EmptyState title={title} description={description} />
    </SectionCard>
  )

  const content = (() => {
    switch (activeSection) {
      case 'market-news':
        return renderMarketNews()
      case 'global-indexes':
        return renderGlobalIndexes()
      case 'major-indexes':
        return renderMajorIndexes()
      case 'industry-rank':
        return renderIndustryRank()
      case 'money-flow':
        return renderMoneyFlow()
      case 'long-tiger':
        return renderLongTiger()
      case 'stock-research':
        return renderResearchList(
          '个股研报',
          'Research',
          stockResearch,
          <div className="flex min-w-0 flex-col items-end gap-1 sm:min-w-[12rem]">
            <div className="flex w-full items-center justify-end gap-2">
              <Input
                value={draftStockCode}
                onChange={(event) => {
                  setStockResearchHint(null)
                  setDraftStockCode(event.target.value)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitStockResearchQuery()
                  }
                }}
                className="h-8 min-w-0 flex-1 font-mono text-xs sm:max-w-[9rem]"
                placeholder="如 600519"
                autoComplete="off"
              />
              <Button
                type="button"
                size="sm"
                onClick={submitStockResearchQuery}
                className="shrink-0 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                查询
              </Button>
            </div>
            {stockResearchHint ? (
              <p className="w-full text-right text-[11px] leading-snug text-amber-700 dark:text-amber-400">{stockResearchHint}</p>
            ) : null}
          </div>,
          !stockCode.trim()
            ? {
                title: '请先查询',
                description: '输入 6 位 A 股代码后点击「查询」或回车；暂不支持按股票名称搜索。',
              }
            : undefined,
        )
      case 'stock-notice':
        return renderNotice()
      case 'industry-research':
        return renderResearchList(
          '行业研究',
          'Industry Research',
          industryResearch,
          <div className="flex items-center gap-2">
            <Input
              value={draftIndustryKeyword}
              onChange={(event) => setDraftIndustryKeyword(event.target.value)}
              className="h-8 w-36 text-xs"
              placeholder="行业关键词"
            />
            <Button type="button" size="sm" onClick={() => setIndustryKeyword(draftIndustryKeyword.trim() || '新能源')} className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
              查询
            </Button>
          </div>,
        )
      case 'hot':
        return renderHot()
      case 'screeners':
        return renderPlaceholder('指标选股', '旧项目里这里是选股功能入口。当前仓库还没有对应接口，我先把导航和承载区域留出来。')
      case 'links':
        return (
          <SectionCard title="名站优选" eyebrow="Useful Links">
            <div className="grid gap-2 md:grid-cols-2">
              {QUICK_LINKS.map((item) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">{item.title}</div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.note}</p>
                </a>
              ))}
            </div>
          </SectionCard>
        )
      default:
        return null
    }
  })()

  const leftPanel = (
    <div className="flex h-full flex-col bg-[#fbfcfd] dark:bg-slate-950">
      <div className={WORKBENCH_COLUMN_HEADER}>
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">市场</div>
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-1 p-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = item.id === activeSection
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id)
                  navigate(`/market/${item.id}`)
                }}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                  isActive
                    ? 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80'
                    : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-800 dark:hover:bg-slate-900',
                )}
              >
                <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', isActive ? 'text-slate-700 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500')} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-100">{item.label}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-400 dark:text-slate-500">{item.description}</div>
                </div>
              </button>
            )
          })}
        </nav>
      </ScrollArea>
    </div>
  )

  const mainPanel = (
    <div className="flex h-full flex-col bg-[#fbfcfd] dark:bg-slate-950">
      <div className={WORKBENCH_COLUMN_HEADER}>
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5">
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <span>市场路由</span>
            <ChevronRight className="h-2.5 w-2.5 shrink-0" />
            <span>/MARKET</span>
          </div>
          <h1 className="min-w-0 shrink truncate text-sm font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            {activeItem.label}
          </h1>
          <span className="hidden sm:inline-flex shrink-0 rounded-full border border-slate-200 px-1.5 py-px text-[9px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {activeItem.description}
          </span>
        </div>
      </div>

      {/* 内容区域 */}
      <ScrollArea className="flex-1">
        <div ref={sectionAnchorRef} />
        <div className="space-y-3 bg-[#f3f5f7] p-3 dark:bg-slate-950 sm:p-4">
          <div className="xl:hidden">
            <ScrollArea className="w-full whitespace-nowrap pb-2">
              <div className="flex gap-2">
                {MENU_ITEMS.map((item) => {
                  const isActive = item.id === activeSection
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        'rounded-xl border px-4 py-2 text-sm font-medium',
                        isActive
                          ? 'border-slate-300 bg-slate-900 text-white dark:border-slate-700 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-300',
                      )}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          <div key={activeSection}>{content}</div>
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <WorkbenchLayout
      className="bg-[#f3f5f7] dark:bg-slate-950"
      innerClassName="border border-slate-200/90 bg-[#f7f8fa] dark:border-slate-800 dark:bg-slate-950"
      leftPanelId="market-left"
      mainPanelId="market-main"
      leftMinPx={248}
      leftMaxPx={360}
      leftSidebarVisible={!leftCollapsed}
      rightSidebarVisible={false}
      left={leftPanel}
      main={mainPanel}
      right={null}
    />
  )
}
