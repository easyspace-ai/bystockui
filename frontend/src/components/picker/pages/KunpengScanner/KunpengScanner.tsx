/**
 * 鲲鹏战法量化初筛页面
 * 基于三年五倍战法，筛选符合"合成资产"结构的基础标的池
 */

import { useState, useCallback, useRef, useEffect, useMemo, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Target,
  ChevronLeft,
  SearchX,
  SlidersHorizontal,
  Check,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  Plus,
  Save,
  FolderOpen,
  Trash2,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  X,
  DollarSign,
  TrendingUp,
  Shield,
  Layers,
  Fish,
} from 'lucide-react';
import { useToast } from '@/components/picker/common/Toast';
import { clearAppliedStrategyParams, kunpengParamsFromRecord, mapKunpengAIParams, parseKunpengParams } from '@/features/picker/strategyParams';
import { usePickerSavedStrategy } from '@/features/picker/usePickerSavedStrategy';
import { SavedStrategyRenameDialog } from '@/features/picker/SavedStrategyRenameDialog';
import { PickerLoadingOverlay, type PickerLoadingProgress } from '@/components/picker/common/PickerLoadingOverlay';
import '@/components/picker/common/pickerRedesign.css';
import { getAllAShareQuotesWithProgress, type FullQuote } from '@/lib/stockV1Api';
import type { PickerStockResult as KunpengCandidate } from '@/lib/pickerApi';
import {
  followStock,
  loadWatchlistSymbolSet,
  migrateLocalPickerWatchlistOnce,
  normalizeWatchlistSymbol,
} from '@/lib/watchlistApi';
import styles from './KunpengScanner.module.css';

// ========== 类型定义 ==========

interface KunpengCriteria {
  // 市值范围 (亿元)
  marketCapMin: number; // 默认 100亿
  marketCapMax: number; // 默认 300亿
  // 净利润 (亿元)
  netProfitMin: number; // 默认 2亿
  // 市盈率范围
  peMin: number; // 默认 0.1 (避免负数)
  peMax: number; // 默认 40
  // 额外筛选条件
  excludeST: boolean; // 排除ST股票
  excludeNewStock: boolean; // 排除次新股 (上市不足1年)
  minPrice: number; // 最低价格
  maxPrice: number; // 最高价格
}

interface SavedScheme {
  id: string;
  name: string;
  criteria: KunpengCriteria;
  createdAt: number;
}

interface RecentUsage {
  criteria: KunpengCriteria;
  usedAt: number;
}

type SortField = 'totalMarketCap' | 'netProfit' | 'pe' | 'changePercent' | 'safetyScore';
type SortOrder = 'asc' | 'desc';

// ========== 常量 ==========

const STORAGE_KEY = 'kunpeng-scanner-settings';
const SCHEMES_STORAGE_KEY = 'kunpeng-scanner-schemes';
const RECENT_USAGE_STORAGE_KEY = 'kunpeng-scanner-recent';
const MAX_RECENT_USAGE = 5;

const DEFAULT_CRITERIA: KunpengCriteria = {
  marketCapMin: 100, // 100亿
  marketCapMax: 300, // 300亿
  netProfitMin: 2, // 2亿
  peMin: 0.1, // 避免负PE
  peMax: 40, // 40倍PE
  excludeST: true, // 排除ST股票
  excludeNewStock: true, // 排除次新股
  minPrice: 3, // 最低3元
  maxPrice: 100, // 最高100元
};

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'safetyScore', label: '安全评分' },
  { field: 'totalMarketCap', label: '总市值' },
  { field: 'netProfit', label: '净利润' },
  { field: 'pe', label: '市盈率' },
  { field: 'changePercent', label: '当日涨幅' },
];

// ========== 工具函数 ==========

const loadCriteriaFromStorage = (): KunpengCriteria => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CRITERIA, ...parsed };
    }
  } catch (error) {
    console.warn('读取筛选条件失败:', error);
  }
  return DEFAULT_CRITERIA;
};

const saveCriteriaToStorage = (criteria: KunpengCriteria): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(criteria));
  } catch (error) {
    console.warn('保存筛选条件失败:', error);
  }
};

const loadSchemesFromStorage = (): SavedScheme[] => {
  try {
    const stored = localStorage.getItem(SCHEMES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('读取方案失败:', error);
  }
  return [];
};

const saveSchemesToStorage = (schemes: SavedScheme[]): void => {
  try {
    localStorage.setItem(SCHEMES_STORAGE_KEY, JSON.stringify(schemes));
  } catch (error) {
    console.warn('保存方案失败:', error);
  }
};

const loadRecentUsageFromStorage = (): RecentUsage[] => {
  try {
    const stored = localStorage.getItem(RECENT_USAGE_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('读取最近使用失败:', error);
  }
  return [];
};

const saveRecentUsageToStorage = (recentUsage: RecentUsage[]): void => {
  try {
    localStorage.setItem(RECENT_USAGE_STORAGE_KEY, JSON.stringify(recentUsage));
  } catch (error) {
    console.warn('保存最近使用失败:', error);
  }
};

const addRecentUsage = (criteria: KunpengCriteria): void => {
  const recent = loadRecentUsageFromStorage();
  const newEntry: RecentUsage = { criteria, usedAt: Date.now() };
  const isDuplicate = recent.some(
    (r) => JSON.stringify(r.criteria) === JSON.stringify(criteria)
  );
  if (!isDuplicate) {
    const updated = [newEntry, ...recent].slice(0, MAX_RECENT_USAGE);
    saveRecentUsageToStorage(updated);
  }
};

const formatNumber = (num: number | null | undefined, decimals = 2): string => {
  if (num === null || num === undefined) return '-';
  return num.toFixed(decimals);
};

const formatLargeNumber = (num: number): string => {
  if (num >= 100000000) {
    return (num / 100000000).toFixed(2) + '亿';
  } else if (num >= 10000) {
    return (num / 10000).toFixed(2) + '万';
  }
  return num.toFixed(2);
};

// ========== 主组件 ==========

const KUNPENG_SCANNER_DEFAULTS = {
  title: '鲲鹏战法',
  subtitle: '与整体量化平台一致的研究界面，先用估值、安全评分和盈利能力清洗基础标的池。',
  launchTitle: '先把“资产结构健康”的公司筛出来，再谈潜在倍数',
  launchText: '鲲鹏页不再走大按钮和大片留白，入口、说明、条件编辑全部收在同一套工作台语境下。',
  launchPoints: [
    '优先控制总市值、PE 与净利润区间，保证标的池可解释。',
    '结果页统一改为表格，方便与其它两页保持一致的浏览和比较方式。',
    '加载进度弹窗支持关闭和停止，不再出现整页压暗的阻断体验。',
  ],
  conditionsLabel: '鲲鹏战法条件',
};

export function KunpengScanner() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { displayMeta, renameSaved } = usePickerSavedStrategy(KUNPENG_SCANNER_DEFAULTS);

  const [criteria, setCriteria] = useState<KunpengCriteria>(loadCriteriaFromStorage);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<PickerLoadingProgress>({
    completed: 0,
    total: 0,
    stage: '',
  });
  const [candidates, setCandidates] = useState<KunpengCandidate[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const abortRef = useRef(false);
  const [watchlistSet, setWatchlistSet] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await migrateLocalPickerWatchlistOnce();
        const s = await loadWatchlistSymbolSet();
        if (!cancelled) setWatchlistSet(s);
      } catch (e) {
        console.error('加载自选股失败:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [savedSchemes, setSavedSchemes] = useState<SavedScheme[]>(loadSchemesFromStorage);
  const [recentUsage, setRecentUsage] = useState<RecentUsage[]>(loadRecentUsageFromStorage);
  const [showSchemePanel, setShowSchemePanel] = useState(false);
  const [showRecentPanel, setShowRecentPanel] = useState(false);
  const [newSchemeName, setNewSchemeName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const [sortField, setSortField] = useState<SortField>('safetyScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [showSelectMode, setShowSelectMode] = useState(false);

  const convertFullQuoteToCandidate = useCallback((quote: FullQuote): KunpengCandidate => {
    const totalMarketCap = quote.totalMarketCap ?? 0;
    const pe = quote.pe ?? 0;
    const netProfit = totalMarketCap / (pe || 1);
    const marketCapScore = Math.max(0, 30 - Math.abs(totalMarketCap - 200) / 10);
    const profitScore = Math.min(30, (netProfit / 5) * 30);
    const peScore = pe > 0 ? Math.max(0, 25 - (pe - 15) / 2) : 0;
    const priceScore = quote.price >= 5 && quote.price <= 50 ? 15 : quote.price >= 3 && quote.price <= 80 ? 10 : 5;
    const safetyScore = Math.min(100, Math.max(0, marketCapScore + profitScore + peScore + priceScore));
    const potentialMarketCap = netProfit * 50;
    const potentialMultiple = totalMarketCap > 0 ? Math.min(potentialMarketCap, 1000) / totalMarketCap : 0;

    return {
      code: quote.code,
      name: quote.name,
      price: quote.price,
      changePercent: quote.changePercent,
      change: quote.change,
      volume: quote.volume,
      amount: quote.amount,
      turnoverRate: quote.turnoverRate ?? 0,
      volumeRatio: quote.volumeRatio ?? 0,
      circulatingMarketCap: quote.circulatingMarketCap ?? 0,
      totalMarketCap,
      pe,
      pb: quote.pb ?? 0,
      high: quote.high,
      low: quote.low,
      open: quote.open,
      prevClose: quote.prevClose,
      market: quote.code.startsWith('6') || quote.code.startsWith('9') ? 'SH' : quote.code.startsWith('4') || quote.code.startsWith('8') ? 'BJ' : 'SZ',
      netProfit,
      safetyScore,
      potentialMultiple,
    };
  }, []);

  const filterAndTransformStocks = useCallback(
    (quotes: FullQuote[]): KunpengCandidate[] => {
      return quotes
        .filter((quote) => {
          const totalMarketCap = quote.totalMarketCap ?? null;
          const pe = quote.pe ?? null;
          if (criteria.excludeST && (quote.name.includes('ST') || quote.name.includes('*ST'))) return false;
          if (totalMarketCap === null || totalMarketCap < criteria.marketCapMin || totalMarketCap > criteria.marketCapMax) return false;
          if (pe === null || pe <= criteria.peMin || pe > criteria.peMax) return false;
          if (quote.price < criteria.minPrice || quote.price > criteria.maxPrice) return false;
          if ((totalMarketCap / pe) < criteria.netProfitMin) return false;
          return true;
        })
        .map(convertFullQuoteToCandidate)
        .sort((a, b) => (b.safetyScore ?? 0) - (a.safetyScore ?? 0));
    },
    [convertFullQuoteToCandidate, criteria],
  );

  useEffect(() => {
    saveCriteriaToStorage(criteria);
  }, [criteria]);

  // 应用 AI 策略 URL 参数
  useEffect(() => {
    const parsed = parseKunpengParams(searchParams);
    if (!parsed) return;

    const mapped = mapKunpengAIParams(parsed);
    setCriteria((prev) => ({ ...prev, ...mapped } as KunpengCriteria));

    if (searchParams.get('applied') === '1') {
      toast.success('已应用 AI 策略参数');
      setSearchParams(clearAppliedStrategyParams(searchParams), { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  // 从「我的策略」打开时恢复保存的参数（刷新后 URL 可能只剩 savedId）
  useEffect(() => {
    const saved = displayMeta.savedStrategy;
    if (!saved?.params || searchParams.get('applied') === '1') return;
    const mapped = kunpengParamsFromRecord(saved.params);
    if (Object.keys(mapped).length === 0) return;
    setCriteria((prev) => ({ ...prev, ...mapped } as KunpengCriteria));
  }, [displayMeta.savedStrategy?.id, displayMeta.savedStrategy, searchParams]);

  const handleResetCriteria = useCallback(() => {
    setCriteria(DEFAULT_CRITERIA);
  }, []);

  const handleStartScan = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress({ completed: 0, total: 0, stage: '获取行情数据' });
    setCandidates([]);
    abortRef.current = false;

    addRecentUsage(criteria);
    setRecentUsage(loadRecentUsageFromStorage());

    try {
      const quotes = await getAllAShareQuotesWithProgress({
        batchSize: 400,
        concurrency: 5,
        onProgress: (completed, total) => {
          setLoadingProgress({ completed, total, stage: '获取行情数据' });
        },
      });

      if (abortRef.current) return;

      setLoadingProgress({ completed: 0, total: 100, stage: '鲲鹏战法筛选' });
      const filtered = filterAndTransformStocks(quotes);
      setLoadingProgress({ completed: 100, total: 100, stage: '完成' });
      setCandidates(filtered);
      setHasScanned(true);
    } catch (error) {
      console.error('扫描鲲鹏标的失败:', error);
      toast.error('扫描失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [criteria, filterAndTransformStocks, toast]);

  const handleCancelLoading = useCallback(() => {
    abortRef.current = true;
    setIsLoading(false);
    toast.info('已停止本次筛选');
  }, [toast]);

  const handleAddWatchlist = useCallback(
    async (code: string, name: string) => {
      const sym = normalizeWatchlistSymbol(code);
      try {
        await followStock(sym, name);
        setWatchlistSet((prev) => new Set(prev).add(sym));
        toast.success(`已将 ${name} 加入自选`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '加自选失败');
      }
    },
    [toast],
  );

  const handleCriteriaChange = (key: keyof KunpengCriteria, value: number | boolean) => {
    setCriteria((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveScheme = useCallback(() => {
    if (!newSchemeName.trim()) {
      toast.warning('请输入方案名称');
      return;
    }
    const newScheme: SavedScheme = {
      id: Date.now().toString(),
      name: newSchemeName.trim(),
      criteria: { ...criteria },
      createdAt: Date.now(),
    };
    const updated = [...savedSchemes, newScheme];
    setSavedSchemes(updated);
    saveSchemesToStorage(updated);
    setNewSchemeName('');
    setShowSaveInput(false);
    toast.success(`方案「${newScheme.name}」已保存`);
  }, [newSchemeName, criteria, savedSchemes, toast]);

  const handleLoadScheme = useCallback((scheme: SavedScheme) => {
    setCriteria(scheme.criteria);
    setShowSchemePanel(false);
    toast.success(`已加载方案「${scheme.name}」`);
  }, [toast]);

  const handleDeleteScheme = useCallback((schemeId: string) => {
    const updated = savedSchemes.filter((s) => s.id !== schemeId);
    setSavedSchemes(updated);
    saveSchemesToStorage(updated);
    toast.success('方案已删除');
  }, [savedSchemes, toast]);

  const handleLoadRecent = useCallback((recent: RecentUsage) => {
    setCriteria(recent.criteria);
    setShowRecentPanel(false);
    toast.success('已加载历史配置');
  }, [toast]);

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortOrder === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [candidates, sortField, sortOrder]);

  const handleSortChange = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  const handleToggleSelect = useCallback((code: string) => {
    setSelectedStocks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedStocks.size === sortedCandidates.length) {
      setSelectedStocks(new Set());
    } else {
      setSelectedStocks(new Set(sortedCandidates.map((s) => s.code)));
    }
  }, [selectedStocks.size, sortedCandidates]);

  const handleBatchAddWatchlist = useCallback(async () => {
    let addedCount = 0;
    for (const code of selectedStocks) {
      const stock = candidates.find((s) => s.code === code);
      if (!stock) continue;
      const sym = normalizeWatchlistSymbol(code);
      try {
        await followStock(sym, stock.name);
        setWatchlistSet((prev) => new Set(prev).add(sym));
        addedCount++;
      } catch {
        /* ignore single failure */
      }
    }
    if (addedCount > 0) {
      toast.success(`已将 ${addedCount} 只股票加入自选`);
    } else {
      toast.info('所选股票已在自选中或添加失败');
    }
    setSelectedStocks(new Set());
    setShowSelectMode(false);
  }, [selectedStocks, candidates, toast]);

  const CompactStockCard = ({
    candidate,
    index,
    onAddWatchlist,
    inWatchlist,
    isSelected,
    onToggleSelect,
    showSelect,
  }: {
    candidate: KunpengCandidate;
    index: number;
    onAddWatchlist: (code: string, name: string) => void;
    inWatchlist: boolean;
    isSelected?: boolean;
    onToggleSelect?: (code: string) => void;
    showSelect?: boolean;
  }) => {
    const isPositive = candidate.changePercent >= 0;

    const handleCardClick = () => {
      const marketPrefix =
        candidate.code.startsWith('6') || candidate.code.startsWith('9')
          ? 'sh'
          : candidate.code.startsWith('4') || candidate.code.startsWith('8')
            ? 'bj'
            : 'sz';
      navigate(`/backtest?symbol=${marketPrefix}${candidate.code}`);
    };

    const handleSelectClick = (e: MouseEvent) => {
      e.stopPropagation();
      onToggleSelect?.(candidate.code);
    };

    const getSafetyLevel = () => {
      const score = candidate.safetyScore ?? 0;
      if (score >= 80) return { level: '优秀', class: 'safety-excellent' };
      if (score >= 60) return { level: '良好', class: 'safety-good' };
      if (score >= 40) return { level: '一般', class: 'safety-average' };
      return { level: '较差', class: 'safety-poor' };
    };

    const safetyLevel = getSafetyLevel();

    return (
      <motion.div
        className={`${styles.compactCard} ${isPositive ? styles.positive : styles.negative} ${isSelected ? styles.selected : ''}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          delay: index * 0.03,
          ease: 'easeOut',
        }}
        whileHover={{
          scale: 1.02,
          transition: { duration: 0.2 },
        }}
        onClick={handleCardClick}
      >
        <div className={styles.compactLeft}>
          {showSelect && (
            <button type="button" className={styles.compactSelectBtn} onClick={handleSelectClick}>
              {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
          )}
          <div className={styles.compactStockInfo}>
            <div className={styles.compactNameRow}>
              <h4 className={styles.compactStockName}>{candidate.name}</h4>
              <div className={`${styles.compactSafetyBadge} ${styles[safetyLevel.class]}`}>
                <span>{safetyLevel.level}</span>
              </div>
            </div>
            <span className={styles.compactStockCode}>{candidate.code}</span>
          </div>
        </div>

        <div className={styles.compactMiddle}>
          <div className={styles.compactPriceRow}>
            <span className={styles.compactPriceLabel}>现价</span>
            <span className={styles.compactPriceValue}>{formatNumber(candidate.price)}</span>
          </div>
          <div className={`${styles.compactChangeRow} ${isPositive ? styles.positiveChange : styles.negativeChange}`}>
            <span>{isPositive ? '▲' : '▼'}</span>
            <span>{formatNumber(candidate.changePercent)}%</span>
          </div>
        </div>

        <div className={styles.compactRight}>
          <div className={styles.compactMetrics}>
            <div className={styles.compactMetric}>
              <Shield size={12} />
              <span>{Math.round(candidate.safetyScore ?? 0)}分</span>
            </div>
            <div className={styles.compactMetric}>
              <DollarSign size={12} />
              <span>{formatNumber(candidate.netProfit)}亿</span>
            </div>
            <div className={styles.compactMetric}>
              <TrendingUp size={12} />
              <span>{formatNumber(candidate.totalMarketCap)}亿</span>
            </div>
          </div>
          <button
            type="button"
            className={`${styles.compactWatchlistBtn} ${inWatchlist ? styles.added : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!inWatchlist) {
                onAddWatchlist(candidate.code, candidate.name);
              }
            }}
            disabled={inWatchlist}
          >
            {inWatchlist ? <Check size={12} /> : <Plus size={12} />}
          </button>
        </div>
      </motion.div>
    );
  };

  const StockTableView = ({
    candidates,
    onAddWatchlist,
    watchlistSet,
    selectedStocks,
    onToggleSelect,
    showSelectMode,
    sortField,
    sortOrder,
    onSortChange,
  }: {
    candidates: KunpengCandidate[];
    onAddWatchlist: (code: string, name: string) => void;
    watchlistSet: Set<string>;
    selectedStocks: Set<string>;
    onToggleSelect: (code: string) => void;
    showSelectMode: boolean;
    sortField: SortField;
    sortOrder: SortOrder;
    onSortChange: (field: SortField) => void;
  }) => {
    const handleRowClick = (candidate: KunpengCandidate) => {
      const marketPrefix =
        candidate.code.startsWith('6') || candidate.code.startsWith('9')
          ? 'sh'
          : candidate.code.startsWith('4') || candidate.code.startsWith('8')
            ? 'bj'
            : 'sz';
      navigate(`/backtest?symbol=${marketPrefix}${candidate.code}`);
    };

    const getSafetyLevelClass = (score: number) => {
      if (score >= 80) return styles.safetyExcellent;
      if (score >= 60) return styles.safetyGood;
      if (score >= 40) return styles.safetyAverage;
      return styles.safetyPoor;
    };

    const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) return null;
      return sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />;
    };

    return (
      <div className={styles.tableContainer}>
        <div className={styles.tableWrapper}>
          <table className={styles.stockTable}>
            <thead className={styles.tableHeader}>
              <tr>
                {showSelectMode && (
                  <th className={styles.tableColSelect}>
                    <span className={styles.tableHeaderContent}>选择</span>
                  </th>
                )}
                <th className={styles.tableColStock}>
                  <button
                    type="button"
                    className={styles.tableHeaderButton}
                    onClick={() => onSortChange('safetyScore')}
                  >
                    <span className={styles.tableHeaderContent}>
                      股票
                      <SortIcon field="safetyScore" />
                    </span>
                  </button>
                </th>
                <th className={styles.tableColPrice}>
                  <span className={styles.tableHeaderContent}>价格</span>
                </th>
                <th className={styles.tableColChange}>
                  <button
                    type="button"
                    className={styles.tableHeaderButton}
                    onClick={() => onSortChange('changePercent')}
                  >
                    <span className={styles.tableHeaderContent}>
                      涨跌
                      <SortIcon field="changePercent" />
                    </span>
                  </button>
                </th>
                <th className={styles.tableColSafety}>
                  <button
                    type="button"
                    className={styles.tableHeaderButton}
                    onClick={() => onSortChange('safetyScore')}
                  >
                    <span className={styles.tableHeaderContent}>
                      安全评分
                      <SortIcon field="safetyScore" />
                    </span>
                  </button>
                </th>
                <th className={styles.tableColMarketCap}>
                  <button
                    type="button"
                    className={styles.tableHeaderButton}
                    onClick={() => onSortChange('totalMarketCap')}
                  >
                    <span className={styles.tableHeaderContent}>
                      市值
                      <SortIcon field="totalMarketCap" />
                    </span>
                  </button>
                </th>
                <th className={styles.tableColPe}>
                  <button
                    type="button"
                    className={styles.tableHeaderButton}
                    onClick={() => onSortChange('pe')}
                  >
                    <span className={styles.tableHeaderContent}>
                      PE
                      <SortIcon field="pe" />
                    </span>
                  </button>
                </th>
                <th className={styles.tableColProfit}>
                  <button
                    type="button"
                    className={styles.tableHeaderButton}
                    onClick={() => onSortChange('netProfit')}
                  >
                    <span className={styles.tableHeaderContent}>
                      净利润
                      <SortIcon field="netProfit" />
                    </span>
                  </button>
                </th>
                <th className={styles.tableColAction}>
                  <span className={styles.tableHeaderContent}>操作</span>
                </th>
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {candidates.map((candidate, index) => {
                const isPositive = candidate.changePercent >= 0;
                const inWatchlist = watchlistSet.has(normalizeWatchlistSymbol(candidate.code));
                const isSelected = selectedStocks.has(candidate.code);

                return (
                  <motion.tr
                    key={candidate.code}
                    className={`${styles.tableRow} ${isPositive ? styles.positive : styles.negative}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.02 }}
                    onClick={() => handleRowClick(candidate)}
                  >
                    {showSelectMode && (
                      <td className={styles.tableColSelect}>
                        <button
                          type="button"
                          className={styles.tableSelectBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelect(candidate.code);
                          }}
                        >
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </td>
                    )}
                    <td className={styles.tableColStock}>
                      <div className={styles.tableStockInfo}>
                        <div className={styles.tableStockNameRow}>
                          <span className={styles.tableStockName}>{candidate.name}</span>
                          <span className={styles.tableStockCode}>{candidate.code}</span>
                        </div>
                      </div>
                    </td>
                    <td className={styles.tableColPrice}>
                      <span className={styles.tablePrice}>{formatNumber(candidate.price)}</span>
                    </td>
                    <td className={styles.tableColChange}>
                      <span className={`${styles.tableChange} ${isPositive ? styles.positiveChange : styles.negativeChange}`}>
                        {isPositive ? '+' : ''}{formatNumber(candidate.changePercent)}%
                      </span>
                    </td>
                    <td className={styles.tableColSafety}>
                      <span className={`${styles.tableSafetyScore} ${getSafetyLevelClass(candidate.safetyScore ?? 0)}`}>
                        {Math.round(candidate.safetyScore ?? 0)}分
                      </span>
                    </td>
                    <td className={styles.tableColMarketCap}>
                      <span className={styles.tableMarketCap}>{formatNumber(candidate.totalMarketCap)}亿</span>
                    </td>
                    <td className={styles.tableColPe}>
                      <span className={styles.tablePe}>{formatNumber(candidate.pe)}</span>
                    </td>
                    <td className={styles.tableColProfit}>
                      <span className={styles.tableProfit}>{formatNumber(candidate.netProfit)}亿</span>
                    </td>
                    <td className={styles.tableColAction}>
                      <button
                        type="button"
                        className={`${styles.tableActionBtn} ${inWatchlist ? styles.added : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!inWatchlist) {
                            onAddWatchlist(candidate.code, candidate.name);
                          }
                        }}
                        disabled={inWatchlist}
                      >
                        {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const KunpengIndicators = ({ candidate }: { candidate: KunpengCandidate }) => {
    return (
      <div className={styles.kunpengIndicators} role="group" aria-label="鲲鹏核心指标">
        <div className={styles.indicatorItem}>
          <div className={styles.indicatorIcon}>
            <Shield size={16} aria-hidden />
          </div>
          <div className={styles.indicatorContent}>
            <span className={styles.indicatorLabel}>安全评分</span>
            <span className={styles.indicatorValue}>
              {Math.round(candidate.safetyScore ?? 0)}分
            </span>
          </div>
        </div>
        <div className={styles.indicatorItem}>
          <div className={styles.indicatorIcon}>
            <DollarSign size={16} aria-hidden />
          </div>
          <div className={styles.indicatorContent}>
            <span className={styles.indicatorLabel}>净利润</span>
            <span className={styles.indicatorValue}>{formatNumber(candidate.netProfit)}亿</span>
          </div>
        </div>
        <div className={styles.indicatorItem}>
          <div className={styles.indicatorIcon}>
            <TrendingUp size={16} aria-hidden />
          </div>
          <div className={styles.indicatorContent}>
            <span className={styles.indicatorLabel}>潜在倍数</span>
            <span className={styles.indicatorValue}>{formatNumber(candidate.potentialMultiple)}x</span>
          </div>
        </div>
      </div>
    );
  };

  const KunpengCard = ({
    candidate,
    index,
    onAddWatchlist,
    inWatchlist,
    isSelected,
    onToggleSelect,
    showSelect,
  }: {
    candidate: KunpengCandidate;
    index: number;
    onAddWatchlist: (code: string, name: string) => void;
    inWatchlist: boolean;
    isSelected?: boolean;
    onToggleSelect?: (code: string) => void;
    showSelect?: boolean;
  }) => {
    const isPositive = candidate.changePercent >= 0;

    const handleCardClick = () => {
      const marketPrefix =
        candidate.code.startsWith('6') || candidate.code.startsWith('9')
          ? 'sh'
          : candidate.code.startsWith('4') || candidate.code.startsWith('8')
            ? 'bj'
            : 'sz';
      navigate(`/backtest?symbol=${marketPrefix}${candidate.code}`);
    };

    const handleSelectClick = (e: MouseEvent) => {
      e.stopPropagation();
      onToggleSelect?.(candidate.code);
    };

    const getSafetyLevel = () => {
      const score = candidate.safetyScore ?? 0;
      if (score >= 80) return { level: '优秀', class: 'safety-excellent' };
      if (score >= 60) return { level: '良好', class: 'safety-good' };
      if (score >= 40) return { level: '一般', class: 'safety-average' };
      return { level: '较差', class: 'safety-poor' };
    };

    const safetyLevel = getSafetyLevel();

    return (
      <motion.div
        className={`${styles.kunpengCard} ${isPositive ? styles.positive : styles.negative} ${isSelected ? styles.selected : ''}`}
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.4,
          delay: index * 0.05,
          ease: 'easeOut',
        }}
        whileHover={{
          scale: 1.02,
          y: -3,
          transition: { duration: 0.2 },
        }}
        onClick={handleCardClick}
      >
        <div className={styles.cardHeader}>
          <div className={styles.stockInfo}>
            <div className={styles.stockNameRow}>
              {showSelect && (
                <button type="button" className={styles.selectBtn} onClick={handleSelectClick}>
                  {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
              )}
              <h3 className={styles.stockName}>{candidate.name}</h3>
              <div className={`${styles.safetyBadge} ${styles[safetyLevel.class]}`}>
                <span className={styles.safetyLevel}>{safetyLevel.level}</span>
              </div>
            </div>
            <span className={styles.stockCode}>{candidate.code}</span>
          </div>
          <motion.div
            className={styles.changeBadge}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.05 + 0.2, type: 'spring' }}
          >
            <span className={styles.changeIcon}>{isPositive ? '▲' : '▼'}</span>
            <span className={styles.changePercent}>{formatNumber(candidate.changePercent)}%</span>
          </motion.div>
        </div>

        <div className={styles.priceSection}>
          <div className={styles.currentPrice}>
            <span className={styles.priceLabel}>现价</span>
            <span className={styles.priceValue}>{formatNumber(candidate.price)}</span>
          </div>
          <div className={styles.priceChange}>
            <span className={styles.changeValue}>
              {isPositive ? '+' : ''}
              {formatNumber(candidate.change)}
            </span>
          </div>
        </div>

        <KunpengIndicators candidate={candidate} />

        <div className={styles.dataGrid}>
          <div className={styles.dataItem}>
            <span className={styles.dataLabel}>总市值</span>
            <span className={styles.dataValue}>{formatNumber(candidate.totalMarketCap)}亿</span>
          </div>
          <div className={styles.dataItem}>
            <span className={styles.dataLabel}>市盈率</span>
            <span className={styles.dataValue}>{formatNumber(candidate.pe)}</span>
          </div>
          <div className={styles.dataItem}>
            <span className={styles.dataLabel}>市净率</span>
            <span className={styles.dataValue}>{formatNumber(candidate.pb)}</span>
          </div>
          <div className={styles.dataItem}>
            <span className={styles.dataLabel}>成交额</span>
            <span className={styles.dataValue}>{formatLargeNumber(candidate.amount)}</span>
          </div>
        </div>

        <button
          type="button"
          className={`${styles.addWatchlistBtn} ${inWatchlist ? styles.added : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!inWatchlist) {
              onAddWatchlist(candidate.code, candidate.name);
            }
          }}
          disabled={inWatchlist}
        >
          {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
          {inWatchlist ? '已自选' : '加自选'}
        </button>
      </motion.div>
    );
  };

  return (
    <div className={`${styles.container} picker-page`}>
      <motion.header
        className="picker-page__header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="picker-page__headerMain">
          <div className="picker-page__eyebrow">{displayMeta.categoryLabel}</div>
          <div className="picker-page__titleBlock">
            <div className="picker-page__titleRow">
              <span className="picker-page__icon">
                <Fish size={22} aria-hidden />
              </span>
              <h1 className="picker-page__title">{displayMeta.title}</h1>
              {displayMeta.isSaved && (
                <SavedStrategyRenameDialog
                  label={displayMeta.savedStrategy?.label ?? displayMeta.title}
                  description={displayMeta.savedStrategy?.description ?? displayMeta.subtitle}
                  onSave={(label, description) => renameSaved(label, description)}
                />
              )}
            </div>
            <p className="picker-page__subtitle">{displayMeta.subtitle}</p>
          </div>
          <div className="picker-page__metrics">
            <div className="picker-page__metric">
              <span className="picker-page__metricLabel">市值区间</span>
              <span className="picker-page__metricValue">{criteria.marketCapMin} - {criteria.marketCapMax} 亿</span>
            </div>
            <div className="picker-page__metric">
              <span className="picker-page__metricLabel">净利润下限</span>
              <span className="picker-page__metricValue">≥ {criteria.netProfitMin} 亿</span>
            </div>
            <div className="picker-page__metric">
              <span className="picker-page__metricLabel">PE 上限</span>
              <span className="picker-page__metricValue">≤ {criteria.peMax}</span>
            </div>
          </div>
        </div>
        <div className="picker-page__headerAside">
          <div className="picker-page__status">
            <span className={`picker-page__statusDot ${hasScanned ? 'picker-page__statusDotComplete' : 'picker-page__statusDotReady'}`} />
            {hasScanned ? `已筛出 ${candidates.length} 只标的` : '待执行筛选'}
          </div>
          <div className="picker-page__headerButtons">
            {!hasScanned ? (
              <button type="button" className="picker-button--primary" onClick={handleStartScan} disabled={isLoading}>
                <Zap size={16} />
                开始筛选
              </button>
            ) : (
              <button
                type="button"
                className="picker-button--secondary"
                onClick={() => {
                  setHasScanned(false);
                  setCandidates([]);
                  setShowSelectMode(false);
                  setSelectedStocks(new Set());
                }}
              >
                <ChevronLeft size={16} />
                返回条件面板
              </button>
            )}
          </div>
        </div>
      </motion.header>

      <main className={styles.main}>
        <AnimatePresence mode="wait">
          {!hasScanned ? (
            <motion.div
              key="start-screen"
              className={styles.startScreen}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <div className="picker-page__launch">
                <motion.section
                  className="picker-page__launchPanel"
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  <span className="picker-page__launchLabel">策略说明</span>
                  <h2 className="picker-page__launchTitle">{displayMeta.launchTitle}</h2>
                  <p className="picker-page__launchText">{displayMeta.launchText}</p>
                  <div className="picker-page__launchPoints">
                    {displayMeta.launchPoints.map((point, index) => (
                      <div key={index} className="picker-page__launchPoint">
                        <span className="picker-page__launchPointMark">{index + 1}</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                  <div className="picker-page__launchAction">
                    <button type="button" className="picker-button--primary" onClick={handleStartScan} disabled={isLoading}>
                      <Zap size={16} />
                      开始筛选
                    </button>
                  </div>
                </motion.section>

              <motion.div
                className={`${styles.criteriaCard} ${isEditing ? styles.editing : ''}`}
                onClick={() => !isEditing && setIsEditing(true)}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                whileHover={!isEditing ? { scale: 1.01 } : undefined}
              >
                <div className={styles.criteriaHeader}>
                  <div className={styles.criteriaTitle}>
                    <SlidersHorizontal size={20} />
                    <span>{displayMeta.conditionsLabel}</span>
                  </div>
                  <div className={styles.criteriaActions}>
                    <AnimatePresence mode="wait">
                      {isEditing ? (
                        <motion.div
                          key="editing"
                          className={styles.editActions}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                        >
                          <button
                            className={styles.resetBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResetCriteria();
                            }}
                            title="恢复默认"
                          >
                            <RotateCcw size={14} />
                            默认
                          </button>
                          <button
                            className={styles.schemeBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowSchemePanel(!showSchemePanel);
                              setShowRecentPanel(false);
                            }}
                            title="管理方案"
                          >
                            <FolderOpen size={14} />
                            方案
                          </button>
                          <button
                            className={styles.recentBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowRecentPanel(!showRecentPanel);
                              setShowSchemePanel(false);
                            }}
                            title="最近使用"
                          >
                            <Clock size={14} />
                            历史
                          </button>
                          <button
                            className={styles.saveBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsEditing(false);
                              setShowSchemePanel(false);
                              setShowRecentPanel(false);
                            }}
                          >
                            <Check size={14} />
                            完成
                          </button>
                        </motion.div>
                      ) : (
                        <motion.span
                          key="hint"
                          className={styles.editHint}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          点击编辑
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <AnimatePresence>
                  {showSchemePanel && (
                    <motion.div
                      className={styles.schemePanel}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={styles.schemePanelHeader}>
                        <span>保存的方案</span>
                        <button
                          className={styles.addSchemeBtn}
                          onClick={() => setShowSaveInput(!showSaveInput)}
                        >
                          <Plus size={14} />
                          保存当前
                        </button>
                      </div>
                      {showSaveInput && (
                        <div className={styles.saveInputRow}>
                          <input
                            type="text"
                            placeholder="输入方案名称"
                            value={newSchemeName}
                            onChange={(e) => setNewSchemeName(e.target.value)}
                            className={styles.schemeNameInput}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveScheme()}
                          />
                          <button className={styles.confirmSaveBtn} onClick={handleSaveScheme}>
                            <Save size={14} />
                          </button>
                        </div>
                      )}
                      {savedSchemes.length > 0 ? (
                        <div className={styles.schemeList}>
                          {savedSchemes.map((scheme) => (
                            <div key={scheme.id} className={styles.schemeItem}>
                              <button
                                className={styles.schemeLoadBtn}
                                onClick={() => handleLoadScheme(scheme)}
                              >
                                {scheme.name}
                              </button>
                              <button
                                className={styles.schemeDeleteBtn}
                                onClick={() => handleDeleteScheme(scheme.id)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.emptyHint}>暂无保存的方案</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showRecentPanel && (
                    <motion.div
                      className={styles.recentPanel}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={styles.schemePanelHeader}>
                        <span>最近使用</span>
                      </div>
                      {recentUsage.length > 0 ? (
                        <div className={styles.schemeList}>
                          {recentUsage.map((recent, idx) => (
                            <button
                              key={idx}
                              className={styles.recentItem}
                              onClick={() => handleLoadRecent(recent)}
                            >
                              <span className={styles.recentSummary}>
                                市值{recent.criteria.marketCapMin}-{recent.criteria.marketCapMax}亿 ·
                                PE≤{recent.criteria.peMax} · 净利润≥{recent.criteria.netProfitMin}亿
                              </span>
                              <span className={styles.recentTime}>
                                {new Date(recent.usedAt).toLocaleString('zh-CN', {
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.emptyHint}>暂无使用记录</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className={styles.criteriaGrid}>
                  <div className={styles.criteriaItem}>
                    <span className={styles.criteriaLabel}>
                      <Layers size={16} />
                      总市值范围
                    </span>
                    <div className={styles.criteriaValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={criteria.marketCapMin}
                            onChange={(e) =>
                              handleCriteriaChange('marketCapMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.criteriaInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className={styles.criteriaSeparator}>~</span>
                          <input
                            type="number"
                            value={criteria.marketCapMax}
                            onChange={(e) =>
                              handleCriteriaChange('marketCapMax', parseFloat(e.target.value) || 0)
                            }
                            className={styles.criteriaInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className={styles.criteriaUnit}>亿</span>
                        </>
                      ) : (
                        <span className={styles.criteriaDisplay}>
                          {criteria.marketCapMin} ~ {criteria.marketCapMax}
                          <span className={styles.criteriaUnit}>亿</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.criteriaItem}>
                    <span className={styles.criteriaLabel}>
                      <DollarSign size={16} />
                      净利润下限
                    </span>
                    <div className={styles.criteriaValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={criteria.netProfitMin}
                            onChange={(e) =>
                              handleCriteriaChange('netProfitMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.criteriaInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                            min="0"
                          />
                          <span className={styles.criteriaUnit}>亿</span>
                        </>
                      ) : (
                        <span className={styles.criteriaDisplay}>
                          ≥ {criteria.netProfitMin}
                          <span className={styles.criteriaUnit}>亿</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.criteriaItem}>
                    <span className={styles.criteriaLabel}>
                      <TrendingUp size={16} />
                      市盈率范围
                    </span>
                    <div className={styles.criteriaValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={criteria.peMin}
                            onChange={(e) =>
                              handleCriteriaChange('peMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.criteriaInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.1"
                            min="0.1"
                          />
                          <span className={styles.criteriaSeparator}>~</span>
                          <input
                            type="number"
                            value={criteria.peMax}
                            onChange={(e) =>
                              handleCriteriaChange('peMax', parseFloat(e.target.value) || 0)
                            }
                            className={styles.criteriaInput}
                            onClick={(e) => e.stopPropagation()}
                            step="1"
                          />
                        </>
                      ) : (
                        <span className={styles.criteriaDisplay}>
                          {criteria.peMin} ~ {criteria.peMax}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.criteriaItem}>
                    <span className={styles.criteriaLabel}>价格区间</span>
                    <div className={styles.criteriaValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={criteria.minPrice}
                            onChange={(e) =>
                              handleCriteriaChange('minPrice', parseFloat(e.target.value) || 0)
                            }
                            className={styles.criteriaInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.criteriaSeparator}>~</span>
                          <input
                            type="number"
                            value={criteria.maxPrice}
                            onChange={(e) =>
                              handleCriteriaChange('maxPrice', parseFloat(e.target.value) || 0)
                            }
                            className={styles.criteriaInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.criteriaUnit}>元</span>
                        </>
                      ) : (
                        <span className={styles.criteriaDisplay}>
                          {criteria.minPrice} ~ {criteria.maxPrice}
                          <span className={styles.criteriaUnit}>元</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.criteriaItem}>
                    <span className={styles.criteriaLabel}>过滤ST股票</span>
                    <div className={styles.criteriaValue}>
                      {isEditing ? (
                        <button
                          className={`${styles.toggleBtn} ${criteria.excludeST ? styles.active : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCriteriaChange('excludeST', !criteria.excludeST);
                          }}
                        >
                          {criteria.excludeST ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          <span>{criteria.excludeST ? '开启' : '关闭'}</span>
                        </button>
                      ) : (
                        <span className={styles.criteriaDisplay}>
                          {criteria.excludeST ? '开启' : '关闭'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.criteriaItem}>
                    <span className={styles.criteriaLabel}>过滤次新股</span>
                    <div className={styles.criteriaValue}>
                      {isEditing ? (
                        <button
                          className={`${styles.toggleBtn} ${criteria.excludeNewStock ? styles.active : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCriteriaChange('excludeNewStock', !criteria.excludeNewStock);
                          }}
                        >
                          {criteria.excludeNewStock ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          <span>{criteria.excludeNewStock ? '开启' : '关闭'}</span>
                        </button>
                      ) : (
                        <span className={styles.criteriaDisplay}>
                          {criteria.excludeNewStock ? '开启' : '关闭'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results-screen"
              className={styles.resultsScreen}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="picker-page__toolbar">
                <div className="picker-page__summary">
                  <Target size={18} />
                  <div>
                    <div className="picker-page__summaryLead">
                      共筛选出 <span className="picker-page__summaryAccent">{candidates.length}</span> 只鲲鹏标的
                    </div>
                    <div className="picker-page__summaryMeta">固定使用表格结果视图，保证与其它两页一致的读数与操作方式。</div>
                  </div>
                </div>
                <div className="picker-page__toolbarGroup">
                  {candidates.length > 0 && (
                    <button
                      type="button"
                      className={showSelectMode ? 'picker-button--primary' : 'picker-button--secondary'}
                      onClick={() => {
                        setShowSelectMode(!showSelectMode);
                        if (showSelectMode) {
                          setSelectedStocks(new Set());
                        }
                      }}
                    >
                      {showSelectMode ? <X size={16} /> : <CheckSquare size={16} />}
                      {showSelectMode ? '取消批量选择' : '批量选择'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="picker-button--secondary"
                    onClick={() => {
                      setHasScanned(false);
                      setCandidates([]);
                      setShowSelectMode(false);
                      setSelectedStocks(new Set());
                    }}
                  >
                    <ChevronLeft size={16} />
                    重新筛选
                  </button>
                </div>
              </div>

              {candidates.length > 0 && (
                <motion.div
                  className={styles.sortBar}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className={styles.sortSection}>
                    <ArrowUpDown size={14} />
                    <span className={styles.sortLabel}>排序：</span>
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.field}
                        className={`${styles.sortOption} ${sortField === option.field ? styles.active : ''}`}
                        onClick={() => handleSortChange(option.field)}
                      >
                        {option.label}
                        {sortField === option.field && (
                          sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                        )}
                      </button>
                    ))}
                  </div>
                  {showSelectMode && (
                    <div className={styles.batchSection}>
                      <button className={styles.selectAllBtn} onClick={handleSelectAll}>
                        {selectedStocks.size === sortedCandidates.length ? '取消全选' : '全选'}
                      </button>
                      <button
                        className={styles.batchAddBtn}
                        onClick={handleBatchAddWatchlist}
                        disabled={selectedStocks.size === 0}
                      >
                        <Plus size={14} />
                        加入自选 ({selectedStocks.size})
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {sortedCandidates.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <StockTableView
                    candidates={sortedCandidates}
                    onAddWatchlist={handleAddWatchlist}
                    watchlistSet={watchlistSet}
                    selectedStocks={selectedStocks}
                    onToggleSelect={handleToggleSelect}
                    showSelectMode={showSelectMode}
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSortChange={handleSortChange}
                  />
                </motion.div>
              ) : (
                <motion.div
                  className={styles.noResults}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <SearchX size={64} strokeWidth={1} />
                  <p className={styles.noResultsTitle}>没有找到符合鲲鹏战法的标的</p>
                  <p className={styles.noResultsHint}>请尝试调整筛选条件后重新分析</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isLoading && (
          <PickerLoadingOverlay
            progress={loadingProgress}
            defaultStage="正在扫描鲲鹏标的..."
            onClose={handleCancelLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
