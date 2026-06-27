/**
 * 妖股候选人扫描器页面
 * 基于动量因子、趋势因子、活跃因子筛选潜在妖股
 */

import { useState, useCallback, useRef, useEffect, useMemo, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearAppliedStrategyParams, parseMomentumParams } from '@/features/picker/strategyParams';
import { usePickerSavedStrategy } from '@/features/picker/usePickerSavedStrategy';
import { SavedStrategyRenameDialog } from '@/features/picker/SavedStrategyRenameDialog';
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
  TrendingUp,
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
  Activity,
  BarChart3,
  Flame,
} from 'lucide-react';
import { useToast } from '@/components/picker/common/Toast';
import '@/components/picker/common/pickerRedesign.css';
import { pickMomentum, type PickerStockResult as CandidateStock } from '@/lib/pickerApi';
import {
  followStock,
  loadWatchlistSymbolSet,
  migrateLocalPickerWatchlistOnce,
  normalizeWatchlistSymbol,
} from '@/lib/watchlistApi';
import styles from './MomentumScanner.module.css';

// ========== 类型定义 ==========

interface ScanConditions {
  // 动量因子：过去20个交易日区间最大涨幅
  momentumThreshold: number; // 默认 50%
  // 趋势因子：当前价格相对60日均线
  trendAboveMA60: boolean; // 默认 true
  // 活跃因子：近5日平均换手率
  avgTurnoverMin: number; // 默认 5%
  // 额外筛选条件
  marketCapMin: number; // 最小市值
  marketCapMax: number; // 最大市值
  excludeST: boolean; // 排除ST股票
  priceMin: number; // 最低价格
  priceMax: number; // 最高价格
}

interface SavedScheme {
  id: string;
  name: string;
  conditions: ScanConditions;
  createdAt: number;
}

interface RecentUsage {
  conditions: ScanConditions;
  usedAt: number;
}

type SortField = 'momentumRatio' | 'ma60Distance' | 'avgTurnover5d' | 'changePercent' | 'circulatingMarketCap';
type SortOrder = 'asc' | 'desc';

// ========== 常量 ==========

const STORAGE_KEY = 'momentum-scanner-settings-v2';
const SCHEMES_STORAGE_KEY = 'momentum-scanner-schemes';
const RECENT_USAGE_STORAGE_KEY = 'momentum-scanner-recent';
const MAX_RECENT_USAGE = 5;

const DEFAULT_CONDITIONS: ScanConditions = {
  momentumThreshold: 15, // 20日区间振幅 > 15%
  trendAboveMA60: true, // 当前价格在60日均线之上
  avgTurnoverMin: 1, // 当日换手率 > 1%
  marketCapMin: 5, // 最小市值5亿
  marketCapMax: 1000, // 最大市值1000亿
  excludeST: true, // 排除ST股票
  priceMin: 2, // 最低价格2元
  priceMax: 200, // 最高价格200元
};

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'momentumRatio', label: '动量强度' },
  { field: 'ma60Distance', label: '趋势强度' },
  { field: 'avgTurnover5d', label: '活跃度' },
  { field: 'changePercent', label: '当日涨幅' },
  { field: 'circulatingMarketCap', label: '流通市值' },
];

// ========== 工具函数 ==========

const loadConditionsFromStorage = (): ScanConditions => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONDITIONS, ...parsed };
    }
  } catch (error) {
    console.warn('读取扫描条件失败:', error);
  }
  return DEFAULT_CONDITIONS;
};

const saveConditionsToStorage = (conditions: ScanConditions): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conditions));
  } catch (error) {
    console.warn('保存扫描条件失败:', error);
  }
};

// 方案存储
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

// 最近使用存储
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

const addRecentUsage = (conditions: ScanConditions): void => {
  const recent = loadRecentUsageFromStorage();
  const newEntry: RecentUsage = { conditions, usedAt: Date.now() };
  // 检查是否已存在相同配置
  const isDuplicate = recent.some(
    (r) => JSON.stringify(r.conditions) === JSON.stringify(conditions)
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

const getMarketSymbol = (code: string): string => {
  const marketPrefix =
    code.startsWith('6') || code.startsWith('9')
      ? 'sh'
      : code.startsWith('4') || code.startsWith('8')
        ? 'bj'
        : 'sz';
  return `${marketPrefix}${code}`;
};
// ========== 子组件 ==========

// 妖股指标卡片组件
function MomentumIndicators({ stock }: { stock: CandidateStock }) {
  return (
    <div className={styles.momentumIndicators}>
      <div className={styles.indicatorItem}>
        <div className={styles.indicatorIcon}>
          <Flame size={16} />
        </div>
        <div className={styles.indicatorContent}>
          <span className={styles.indicatorLabel}>动量强度</span>
          <span className={styles.indicatorValue}>
            {formatNumber(stock.momentumRatio)}%
          </span>
        </div>
      </div>
      <div className={styles.indicatorItem}>
        <div className={styles.indicatorIcon}>
          <TrendingUp size={16} />
        </div>
        <div className={styles.indicatorContent}>
          <span className={styles.indicatorLabel}>趋势强度</span>
          <span className={styles.indicatorValue}>
            +{formatNumber(stock.ma60Distance)}%
          </span>
        </div>
      </div>
      <div className={styles.indicatorItem}>
        <div className={styles.indicatorIcon}>
          <Activity size={16} />
        </div>
        <div className={styles.indicatorContent}>
          <span className={styles.indicatorLabel}>活跃度</span>
          <span className={styles.indicatorValue}>
            {formatNumber(stock.avgTurnover5d)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// 股票卡片组件
function CandidateCard({
  stock,
  index,
  onAddWatchlist,
  inWatchlist,
  isSelected,
  onToggleSelect,
  showSelect,
}: {
  stock: CandidateStock;
  index: number;
  onAddWatchlist: (code: string, name: string) => void;
  inWatchlist: boolean;
  isSelected?: boolean;
  onToggleSelect?: (code: string) => void;
  showSelect?: boolean;
}) {
  const navigate = useNavigate();
  const isPositive = stock.changePercent >= 0;

  const handleCardClick = () => {
    const marketPrefix =
      stock.code.startsWith('6') || stock.code.startsWith('9')
        ? 'sh'
        : stock.code.startsWith('4') || stock.code.startsWith('8')
          ? 'bj'
          : 'sz';
    navigate(`/backtest?symbol=${marketPrefix}${stock.code}`);
  };

  const handleSelectClick = (e: MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(stock.code);
  };

  // 计算妖股潜力评分
  const getPotentialScore = () => {
    const momentumScore = Math.min((stock.momentumRatio ?? 0) / 100, 1) * 40;
    const trendScore = Math.min((stock.ma60Distance ?? 0) / 20, 1) * 30;
    const activityScore = Math.min((stock.avgTurnover5d ?? 0) / 15, 1) * 30;
    return Math.round(momentumScore + trendScore + activityScore);
  };

  const potentialScore = getPotentialScore();

  return (
    <motion.div
      className={`${styles.candidateCard} ${isPositive ? styles.positive : styles.negative} ${isSelected ? styles.selected : ''}`}
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
              <button className={styles.selectBtn} onClick={handleSelectClick}>
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            )}
            <h3 className={styles.stockName}>{stock.name}</h3>
            <div className={styles.potentialBadge}>
              <span className={styles.potentialScore}>{potentialScore}</span>
              <span className={styles.potentialLabel}>分</span>
            </div>
          </div>
          <span className={styles.stockCode}>{stock.code}</span>
        </div>
        <motion.div
          className={styles.changeBadge}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.05 + 0.2, type: 'spring' }}
        >
          <span className={styles.changeIcon}>{isPositive ? '▲' : '▼'}</span>
          <span className={styles.changePercent}>{formatNumber(stock.changePercent)}%</span>
        </motion.div>
      </div>

      <div className={styles.priceSection}>
        <div className={styles.currentPrice}>
          <span className={styles.priceLabel}>现价</span>
          <span className={styles.priceValue}>{formatNumber(stock.price)}</span>
        </div>
        <div className={styles.priceChange}>
          <span className={styles.changeValue}>
            {isPositive ? '+' : ''}
            {formatNumber(stock.change)}
          </span>
        </div>
      </div>

      <MomentumIndicators stock={stock} />

      <div className={styles.dataGrid}>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>流通市值</span>
          <span className={styles.dataValue}>{formatNumber(stock.circulatingMarketCap)}亿</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>20日高低</span>
          <span className={styles.dataValue}>
            {formatNumber(stock.low20d)}-{formatNumber(stock.high20d)}
          </span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>60日均线</span>
          <span className={styles.dataValue}>{formatNumber(stock.ma60)}</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>成交额</span>
          <span className={styles.dataValue}>{formatLargeNumber(stock.amount)}</span>
        </div>
      </div>

      <button
        className={`${styles.addWatchlistBtn} ${inWatchlist ? styles.added : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!inWatchlist) {
            onAddWatchlist(stock.code, stock.name);
          }
        }}
        disabled={inWatchlist}
      >
        {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
        {inWatchlist ? '已自选' : '加自选'}
      </button>
    </motion.div>
  );
}
// ========== 主组件 ==========

const MOMENTUM_SCANNER_DEFAULTS = {
  title: '妖股扫描',
  subtitle: '保持与量化工作台一致的研究视图，用动量、趋势、活跃度三组因子快速筛出高波动候选标的。',
  launchTitle: '从全市场里先筛出最值得盯盘的高波动标的',
  launchText: '这页应该像量化研究面板，不是营销海报。我们把操作入口、条件面板和说明信息都压回同一条视觉体系里。',
  launchPoints: [
    '动量用于识别 20 日区间爆发力，优先找到弹性最强的候选。',
    '趋势要求避免逆势追高，活跃度保证候选具备真实成交基础。',
    '结果页统一切成表格，方便排序、比对和批量加入自选。',
  ],
};

export function MomentumScanner() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { displayMeta, renameSaved } = usePickerSavedStrategy(MOMENTUM_SCANNER_DEFAULTS);
  const [conditions, setConditions] = useState<ScanConditions>(loadConditionsFromStorage);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [candidates, setCandidates] = useState<CandidateStock[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
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

  // 方案管理
  const [savedSchemes, setSavedSchemes] = useState<SavedScheme[]>(loadSchemesFromStorage);
  const [recentUsage, setRecentUsage] = useState<RecentUsage[]>(loadRecentUsageFromStorage);
  const [showSchemePanel, setShowSchemePanel] = useState(false);
  const [showRecentPanel, setShowRecentPanel] = useState(false);
  const [newSchemeName, setNewSchemeName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // 排序
  const [sortField, setSortField] = useState<SortField>('momentumRatio');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // 批量选择
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [showSelectMode, setShowSelectMode] = useState(false);

  const openStockDetail = useCallback(
    (code: string) => {
      navigate(`/backtest?symbol=${getMarketSymbol(code)}`);
    },
    [navigate],
  );

  // 保存扫描条件
  useEffect(() => {
    saveConditionsToStorage(conditions);
  }, [conditions]);

  // 应用 AI 策略 URL 参数
  useEffect(() => {
    const parsed = parseMomentumParams(searchParams);
    if (!parsed) return;

    setConditions((prev) => ({ ...prev, ...parsed } as ScanConditions));

    if (searchParams.get('applied') === '1') {
      toast.success('已应用 AI 策略参数');
      setSearchParams(clearAppliedStrategyParams(searchParams), { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  // 恢复默认设置
  const handleResetConditions = useCallback(() => {
    setConditions(DEFAULT_CONDITIONS);
  }, []);

  // 开始扫描
  const handleStartScan = useCallback(async () => {
    setIsLoading(true);
    setCandidates([]);

    // 记录最近使用
    addRecentUsage(conditions);
    setRecentUsage(loadRecentUsageFromStorage());

    try {
      const result = await pickMomentum({
        momentumThreshold: conditions.momentumThreshold,
        trendAboveMA60: conditions.trendAboveMA60,
        avgTurnoverMin: conditions.avgTurnoverMin,
        marketCapMin: conditions.marketCapMin,
        marketCapMax: conditions.marketCapMax,
        excludeST: conditions.excludeST,
        priceMin: conditions.priceMin,
        priceMax: conditions.priceMax,
      });

      const stockList = result?.list ?? [];
      if (stockList.length === 0) {
        toast.info('没有符合条件的妖股候选人，请尝试调整筛选条件');
      }

      setCandidates(stockList as CandidateStock[]);
      setHasScanned(true);
    } catch (error) {
      console.error('扫描妖股候选人失败:', error);
      toast.error('扫描失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [conditions, toast]);

  // 加入自选
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

  // 更新扫描条件
  const handleConditionChange = (key: keyof ScanConditions, value: number | boolean) => {
    setConditions((prev) => ({ ...prev, [key]: value }));
  };

  // 保存方案
  const handleSaveScheme = useCallback(() => {
    if (!newSchemeName.trim()) {
      toast.warning('请输入方案名称');
      return;
    }
    const newScheme: SavedScheme = {
      id: Date.now().toString(),
      name: newSchemeName.trim(),
      conditions: { ...conditions },
      createdAt: Date.now(),
    };
    const updated = [...savedSchemes, newScheme];
    setSavedSchemes(updated);
    saveSchemesToStorage(updated);
    setNewSchemeName('');
    setShowSaveInput(false);
    toast.success(`方案「${newScheme.name}」已保存`);
  }, [newSchemeName, conditions, savedSchemes, toast]);

  // 加载方案
  const handleLoadScheme = useCallback((scheme: SavedScheme) => {
    setConditions(scheme.conditions);
    setShowSchemePanel(false);
    toast.success(`已加载方案「${scheme.name}」`);
  }, [toast]);

  // 删除方案
  const handleDeleteScheme = useCallback((schemeId: string) => {
    const updated = savedSchemes.filter((s) => s.id !== schemeId);
    setSavedSchemes(updated);
    saveSchemesToStorage(updated);
    toast.success('方案已删除');
  }, [savedSchemes, toast]);

  // 加载最近使用
  const handleLoadRecent = useCallback((recent: RecentUsage) => {
    setConditions(recent.conditions);
    setShowRecentPanel(false);
    toast.success('已加载历史配置');
  }, [toast]);

  // 排序候选股票
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortOrder === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [candidates, sortField, sortOrder]);

  // 切换排序
  const handleSortChange = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  // 切换选择
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

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectedStocks.size === sortedCandidates.length) {
      setSelectedStocks(new Set());
    } else {
      setSelectedStocks(new Set(sortedCandidates.map((s) => s.code)));
    }
  }, [selectedStocks.size, sortedCandidates]);

  // 批量加入自选
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
        /* ignore */
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
  return (
    <div className={`${styles.container} picker-page`}>
      <motion.header
        className="picker-page__header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="picker-page__headerMain">
          <div className="picker-page__eyebrow">妖股扫描</div>
          <div className="picker-page__titleBlock">
            <div className="picker-page__titleRow">
              <span className="picker-page__icon">
                <Flame size={22} />
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
              <span className="picker-page__metricLabel">核心因子</span>
              <span className="picker-page__metricValue">动量 / 趋势 / 活跃</span>
            </div>
            <div className="picker-page__metric">
              <span className="picker-page__metricLabel">默认动量阈值</span>
              <span className="picker-page__metricValue">≥ {conditions.momentumThreshold}%</span>
            </div>
            <div className="picker-page__metric">
              <span className="picker-page__metricLabel">市值区间</span>
              <span className="picker-page__metricValue">
                {conditions.marketCapMin} - {conditions.marketCapMax} 亿
              </span>
            </div>
          </div>
        </div>

        <div className="picker-page__headerAside">
          <div className="picker-page__status">
            <span
              className={`picker-page__statusDot ${
                hasScanned ? 'picker-page__statusDotComplete' : 'picker-page__statusDotReady'
              }`}
            />
            {hasScanned ? `已得到 ${candidates.length} 条候选结果` : '待执行扫描'}
          </div>
          <div className="picker-page__headerButtons">
            {!hasScanned ? (
              <button
                type="button"
                className="picker-button--primary"
                onClick={handleStartScan}
                disabled={isLoading}
              >
                <Zap size={16} />
                开始扫描
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
                    <button
                      type="button"
                      className="picker-button--primary"
                      onClick={handleStartScan}
                      disabled={isLoading}
                    >
                      <Zap size={16} />
                      开始扫描
                    </button>
                  </div>
                </motion.section>

              <motion.div
                className={`${styles.conditionCard} ${isEditing ? styles.editing : ''}`}
                onClick={() => !isEditing && setIsEditing(true)}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                whileHover={!isEditing ? { scale: 1.01 } : undefined}
              >
                <div className={styles.conditionHeader}>
                  <div className={styles.conditionTitle}>
                    <SlidersHorizontal size={20} />
                    <span>扫描条件</span>
                  </div>
                  <div className={styles.conditionActions}>
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
                              handleResetConditions();
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

                {/* 方案管理面板 */}
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

                {/* 最近使用面板 */}
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
                                动量≥{recent.conditions.momentumThreshold}% · 
                                换手≥{recent.conditions.avgTurnoverMin}%
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
                <div className={styles.conditionGrid}>
                  {/* 动量因子 */}
                  <div className={styles.conditionItem}>
                    <span className={styles.conditionLabel}>
                      <Flame size={16} />
                      动量阈值
                    </span>
                    <div className={styles.conditionValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={conditions.momentumThreshold}
                            onChange={(e) =>
                              handleConditionChange('momentumThreshold', parseFloat(e.target.value) || 0)
                            }
                            className={styles.conditionInput}
                            onClick={(e) => e.stopPropagation()}
                            step="5"
                            min="0"
                            max="200"
                          />
                          <span className={styles.conditionUnit}>%</span>
                        </>
                      ) : (
                        <span className={styles.conditionDisplay}>
                          ≥ {conditions.momentumThreshold}
                          <span className={styles.conditionUnit}>%</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 趋势因子 */}
                  <div className={styles.conditionItem}>
                    <span className={styles.conditionLabel}>
                      <TrendingUp size={16} />
                      趋势要求
                    </span>
                    <div className={styles.conditionValue}>
                      {isEditing ? (
                        <button
                          className={`${styles.toggleBtn} ${conditions.trendAboveMA60 ? styles.active : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConditionChange('trendAboveMA60', !conditions.trendAboveMA60);
                          }}
                        >
                          {conditions.trendAboveMA60 ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          <span>{conditions.trendAboveMA60 ? '高于60日均线' : '无要求'}</span>
                        </button>
                      ) : (
                        <span className={styles.conditionDisplay}>
                          {conditions.trendAboveMA60 ? '高于60日均线' : '无要求'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 活跃因子 */}
                  <div className={styles.conditionItem}>
                    <span className={styles.conditionLabel}>
                      <Activity size={16} />
                      活跃度
                    </span>
                    <div className={styles.conditionValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={conditions.avgTurnoverMin}
                            onChange={(e) =>
                              handleConditionChange('avgTurnoverMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.conditionInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                            min="0"
                            max="50"
                          />
                          <span className={styles.conditionUnit}>%</span>
                        </>
                      ) : (
                        <span className={styles.conditionDisplay}>
                          ≥ {conditions.avgTurnoverMin}
                          <span className={styles.conditionUnit}>%</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 流通市值 */}
                  <div className={styles.conditionItem}>
                    <span className={styles.conditionLabel}>
                      <BarChart3 size={16} />
                      流通市值
                    </span>
                    <div className={styles.conditionValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={conditions.marketCapMin}
                            onChange={(e) =>
                              handleConditionChange('marketCapMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.conditionInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className={styles.conditionSeparator}>~</span>
                          <input
                            type="number"
                            value={conditions.marketCapMax}
                            onChange={(e) =>
                              handleConditionChange('marketCapMax', parseFloat(e.target.value) || 0)
                            }
                            className={styles.conditionInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className={styles.conditionUnit}>亿</span>
                        </>
                      ) : (
                        <span className={styles.conditionDisplay}>
                          {conditions.marketCapMin} ~ {conditions.marketCapMax}
                          <span className={styles.conditionUnit}>亿</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 价格区间 */}
                  <div className={styles.conditionItem}>
                    <span className={styles.conditionLabel}>价格区间</span>
                    <div className={styles.conditionValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={conditions.priceMin}
                            onChange={(e) =>
                              handleConditionChange('priceMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.conditionInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.conditionSeparator}>~</span>
                          <input
                            type="number"
                            value={conditions.priceMax}
                            onChange={(e) =>
                              handleConditionChange('priceMax', parseFloat(e.target.value) || 0)
                            }
                            className={styles.conditionInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.conditionUnit}>元</span>
                        </>
                      ) : (
                        <span className={styles.conditionDisplay}>
                          {conditions.priceMin} ~ {conditions.priceMax}
                          <span className={styles.conditionUnit}>元</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 过滤ST */}
                  <div className={styles.conditionItem}>
                    <span className={styles.conditionLabel}>过滤ST股票</span>
                    <div className={styles.conditionValue}>
                      {isEditing ? (
                        <button
                          className={`${styles.toggleBtn} ${conditions.excludeST ? styles.active : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConditionChange('excludeST', !conditions.excludeST);
                          }}
                        >
                          {conditions.excludeST ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          <span>{conditions.excludeST ? '开启' : '关闭'}</span>
                        </button>
                      ) : (
                        <span className={styles.conditionDisplay}>
                          {conditions.excludeST ? '开启' : '关闭'}
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
                      共发现 <span className="picker-page__summaryAccent">{candidates.length}</span> 只妖股候选人
                    </div>
                    <div className="picker-page__summaryMeta">结果页统一使用表格式展示，便于多因子对比和批量操作。</div>
                  </div>
                </div>
                <div className="picker-page__toolbarGroup">
                  {candidates.length > 0 ? (
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
                  ) : null}
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
                    重新扫描
                  </button>
                </div>
              </div>

              {candidates.length > 0 && (
                <div className="picker-page__sortbar">
                  <div className="picker-page__sortGroup">
                    <ArrowUpDown size={14} />
                    <span className="picker-page__sortLabel">排序字段</span>
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.field}
                        type="button"
                        className={`picker-pill ${sortField === option.field ? 'is-active' : ''}`}
                        onClick={() => handleSortChange(option.field)}
                      >
                        {option.label}
                        {sortField === option.field &&
                          (sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                      </button>
                    ))}
                  </div>

                  {showSelectMode ? (
                    <div className="picker-page__toolbarGroup">
                      <button type="button" className="picker-button--ghost" onClick={handleSelectAll}>
                        {selectedStocks.size === sortedCandidates.length ? '取消全选' : '全选当前结果'}
                      </button>
                      <button
                        type="button"
                        className="picker-button--primary"
                        onClick={handleBatchAddWatchlist}
                        disabled={selectedStocks.size === 0}
                      >
                        <Plus size={14} />
                        加入自选（{selectedStocks.size}）
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {sortedCandidates.length > 0 ? (
                <div className="picker-page__tableShell">
                  <div className="picker-page__tableWrap">
                    <table className="picker-page__table">
                      <thead>
                        <tr>
                          {showSelectMode ? <th>选择</th> : null}
                          <th>股票</th>
                          <th>现价</th>
                          <th>涨跌</th>
                          <th>动量强度</th>
                          <th>趋势强度</th>
                          <th>活跃度</th>
                          <th>流通市值</th>
                          <th>20 日区间</th>
                          <th>成交额</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCandidates.map((candidate) => {
                          const inWatchlist = watchlistSet.has(normalizeWatchlistSymbol(candidate.code));
                          const isPositive = candidate.changePercent >= 0;

                          return (
                            <tr key={candidate.code} onClick={() => openStockDetail(candidate.code)}>
                              {showSelectMode ? (
                                <td>
                                  <button
                                    type="button"
                                    className="picker-page__checkbox"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSelect(candidate.code);
                                    }}
                                  >
                                    {selectedStocks.has(candidate.code) ? <CheckSquare size={16} /> : <Square size={16} />}
                                  </button>
                                </td>
                              ) : null}
                              <td>
                                <div className="picker-page__stockCell">
                                  <div className="picker-page__stockMain">
                                    <span className="picker-page__stockName">{candidate.name}</span>
                                    <span className="picker-page__stockCode">{candidate.code}</span>
                                    <div className="picker-page__stockMeta">
                                      <span className="picker-page__badge picker-page__badge--accent">
                                        潜力 {Math.round(
                                          Math.min((candidate.momentumRatio ?? 0) / 100, 1) * 40 +
                                            Math.min((candidate.ma60Distance ?? 0) / 20, 1) * 30 +
                                            Math.min((candidate.avgTurnover5d ?? 0) / 15, 1) * 30,
                                        )} 分
                                      </span>
                                      {candidate.price > (candidate.ma60 ?? 0) ? (
                                        <span className="picker-page__badge picker-page__badge--success">强于 MA60</span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="picker-page__number picker-page__number--strong">
                                {formatNumber(candidate.price)}
                              </td>
                              <td className={`picker-page__number picker-page__number--strong ${isPositive ? 'picker-page__number--up' : 'picker-page__number--down'}`}>
                                {isPositive ? '+' : ''}
                                {formatNumber(candidate.changePercent)}%
                              </td>
                              <td className="picker-page__number">{formatNumber(candidate.momentumRatio)}%</td>
                              <td className="picker-page__number">{formatNumber(candidate.ma60Distance)}%</td>
                              <td className="picker-page__number">{formatNumber(candidate.avgTurnover5d)}%</td>
                              <td className="picker-page__number">{formatNumber(candidate.circulatingMarketCap)} 亿</td>
                              <td className="picker-page__number">
                                {formatNumber(candidate.low20d)} - {formatNumber(candidate.high20d)}
                              </td>
                              <td className="picker-page__number">{formatLargeNumber(candidate.amount)}</td>
                              <td>
                                <div className="picker-page__rowActions">
                                  <button
                                    type="button"
                                    className={inWatchlist ? 'picker-button--ghost picker-page__actionButton' : 'picker-button--secondary picker-page__actionButton'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!inWatchlist) {
                                        void handleAddWatchlist(candidate.code, candidate.name);
                                      }
                                    }}
                                    disabled={inWatchlist}
                                  >
                                    {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
                                    {inWatchlist ? '已自选' : '加自选'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <motion.div
                  className="picker-page__empty"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <SearchX size={56} strokeWidth={1.4} />
                  <p className="picker-page__emptyTitle">没有发现符合条件的妖股候选人</p>
                  <p className="picker-page__emptyText">请回到条件面板，调低动量阈值或扩大价格、市值范围后再次扫描。</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 加载进度 */}
      {isLoading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              padding: '32px 40px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid #e2e8f0',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 12px',
              }}
            />
            <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>正在执行策略分析...</p>
          </div>
        </div>
      )}
    </div>
  );
}
