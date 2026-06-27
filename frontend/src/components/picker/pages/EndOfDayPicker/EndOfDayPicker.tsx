/**
 * 尾盘选股法（一日持股法）页面
 * 参考 __refer__ 目录逻辑实现
 */

import { useState, useCallback, useRef, useEffect, useMemo, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearAppliedStrategyParams, parseEndOfDayParams } from '@/features/picker/strategyParams';
import { usePickerSavedStrategy } from '@/features/picker/usePickerSavedStrategy';
import { SavedStrategyRenameDialog } from '@/features/picker/SavedStrategyRenameDialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Target,
  ChevronLeft,
  SearchX,
  SlidersHorizontal,
  Check,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  Zap,
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
} from 'lucide-react';
import { useToast } from '@/components/picker/common/Toast';
import '@/components/picker/common/pickerRedesign.css';
import { pickEndOfDay, type PickerStockResult as StockData, type TimelinePoint } from '@/lib/pickerApi';
import {
  followStock,
  loadWatchlistSymbolSet,
  migrateLocalPickerWatchlistOnce,
  normalizeWatchlistSymbol,
} from '@/lib/watchlistApi';
import styles from './EndOfDayPicker.module.css';

// ========== 类型定义 ==========

interface FilterConditions {
  marketCapMin: number;
  marketCapMax: number;
  volumeRatioMin: number;
  changePercentMin: number;
  changePercentMax: number;
  turnoverRateMin: number;
  turnoverRateMax: number;
  excludeST: boolean;
  timelineAboveAvgRatio: number;
}

interface SavedScheme {
  id: string;
  name: string;
  filters: FilterConditions;
  createdAt: number;
}

interface RecentUsage {
  filters: FilterConditions;
  usedAt: number;
}

type SortField = 'changePercent' | 'timelineAboveAvgRatio' | 'turnoverRate' | 'circulatingMarketCap' | 'volumeRatio';
type SortOrder = 'asc' | 'desc';

// ========== 常量 ==========

const STORAGE_KEY = 'end-of-day-picker-settings-v2';
const SCHEMES_STORAGE_KEY = 'end-of-day-picker-schemes';
const RECENT_USAGE_STORAGE_KEY = 'end-of-day-picker-recent';
const MAX_RECENT_USAGE = 5;

const DEFAULT_FILTERS: FilterConditions = {
  marketCapMin: 10,
  marketCapMax: 500,
  volumeRatioMin: 0.5,
  changePercentMin: 0.5,
  changePercentMax: 8,
  turnoverRateMin: 1,
  turnoverRateMax: 25,
  excludeST: true,
  timelineAboveAvgRatio: 40,
};

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'changePercent', label: '涨幅' },
  { field: 'timelineAboveAvgRatio', label: '分时强度' },
  { field: 'turnoverRate', label: '换手率' },
  { field: 'circulatingMarketCap', label: '流通市值' },
  { field: 'volumeRatio', label: '量比' },
];

// ========== 工具函数 ==========

const loadFiltersFromStorage = (): FilterConditions => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_FILTERS, ...parsed };
    }
  } catch (error) {
    console.warn('读取筛选条件失败:', error);
  }
  return DEFAULT_FILTERS;
};

const saveFiltersToStorage = (filters: FilterConditions): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.warn('保存筛选条件失败:', error);
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

const addRecentUsage = (filters: FilterConditions): void => {
  const recent = loadRecentUsageFromStorage();
  const newEntry: RecentUsage = { filters, usedAt: Date.now() };
  // 检查是否已存在相同配置
  const isDuplicate = recent.some(
    (r) => JSON.stringify(r.filters) === JSON.stringify(filters)
  );
  if (!isDuplicate) {
    const updated = [newEntry, ...recent].slice(0, MAX_RECENT_USAGE);
    saveRecentUsageToStorage(updated);
  }
};

const formatNumber = (num: number | null, decimals = 2): string => {
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

// 分时图组件
function TimelineChart({
  data,
  prevClose,
  compact = false,
}: {
  data: TimelinePoint[];
  prevClose: number;
  compact?: boolean;
}) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const width = 320;
    const height = compact ? 72 : 100;
    const padding = { top: 6, right: 6, bottom: 6, left: 6 };

    const prices = data.map((d) => d.price);
    const avgPrices = data.map((d) => d.avgPrice);
    const allValues = [...prices, ...avgPrices, prevClose];

    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue || 1;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
    const getY = (value: number) => padding.top + ((maxValue - value) / range) * chartHeight;

    const pricePath = data
      .map((d, i) => {
        const x = getX(i);
        const y = getY(d.price);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');

    const avgPath = data
      .map((d, i) => {
        const x = getX(i);
        const y = getY(d.avgPrice);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');

    const fillPath =
      pricePath +
      ` L ${getX(data.length - 1)} ${height - padding.bottom}` +
      ` L ${padding.left} ${height - padding.bottom} Z`;

    const prevCloseY = getY(prevClose);
    const lastPoint = data[data.length - 1];
    const lastX = getX(data.length - 1);
    const lastY = getY(lastPoint.price);

    return {
      width,
      height,
      pricePath,
      avgPath,
      fillPath,
      prevCloseY,
      lastX,
      lastY,
      isPositive: lastPoint.price >= prevClose,
    };
  }, [compact, data, prevClose]);

  if (!chartData) {
    return <div className={styles.chartEmpty}>暂无分时数据</div>;
  }

  return (
    <div className={styles.timelineChart}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="priceGradientEOD" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              stopColor={chartData.isPositive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}
            />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </linearGradient>
        </defs>

        <path d={chartData.fillPath} fill="url(#priceGradientEOD)" />

        <line
          x1={5}
          y1={chartData.prevCloseY}
          x2={chartData.width - 5}
          y2={chartData.prevCloseY}
          stroke="var(--text-tertiary)"
          strokeWidth={1}
          strokeDasharray="4 2"
          opacity={0.5}
        />

        <path
          d={chartData.avgPath}
          fill="none"
          stroke="var(--color-warning)"
          strokeWidth={1.5}
          opacity={0.8}
        />

        <path
          d={chartData.pricePath}
          fill="none"
          stroke={chartData.isPositive ? 'var(--color-rise)' : 'var(--color-fall)'}
          strokeWidth={1.5}
        />

        <circle
          cx={chartData.lastX}
          cy={chartData.lastY}
          r={3}
          fill={chartData.isPositive ? 'var(--color-rise)' : 'var(--color-fall)'}
        />
      </svg>
      {!compact ? (
        <div className={styles.chartLegend}>
          <span className={styles.legendItem}>
            <span
              className={styles.legendLine}
              style={{
                background: chartData.isPositive ? 'var(--color-rise)' : 'var(--color-fall)',
              }}
            />
            价格
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendLine} style={{ background: 'var(--color-warning)' }} />
            均价
          </span>
        </div>
      ) : null}
    </div>
  );
}

// 股票卡片组件
function StockCard({
  stock,
  index,
  onAddWatchlist,
  inWatchlist,
  isSelected,
  onToggleSelect,
  showSelect,
}: {
  stock: StockData;
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

  return (
    <motion.div
      className={`${styles.stockCard} ${isPositive ? styles.positive : styles.negative} ${isSelected ? styles.selected : ''}`}
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
      <div className={styles.stockHeader}>
        <div className={styles.stockInfo}>
          <div className={styles.stockNameRow}>
            {showSelect && (
              <button className={styles.selectBtn} onClick={handleSelectClick}>
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            )}
            <h3 className={styles.stockName}>{stock.name}</h3>
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
          {stock.timelineAboveAvgRatio !== undefined && (
            <span className={styles.timelineRatio}>
              强度 {stock.timelineAboveAvgRatio.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {stock.timeline && stock.timeline.length > 0 && (
        <div className={styles.timelineSection}>
          <TimelineChart data={stock.timeline} prevClose={stock.prevClose} />
        </div>
      )}

      <div className={styles.dataGrid}>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>流通市值</span>
          <span className={styles.dataValue}>{formatNumber(stock.circulatingMarketCap)}亿</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>量比</span>
          <span className={styles.dataValue}>{formatNumber(stock.volumeRatio)}</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.dataLabel}>换手率</span>
          <span className={styles.dataValue}>{formatNumber(stock.turnoverRate)}%</span>
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

const EOD_PICKER_DEFAULTS = {
  title: '尾盘选股',
  subtitle: '面向盘尾强势票的研究入口，维持和整站一致的紧凑工作台风格，重点看分时结构、量比与换手质量。',
  launchTitle: '在收盘前识别“全天强势且尾盘不掉队”的标的',
  launchText: '这页保留策略逻辑，但视觉和交互统一收敛到工作台样式，不再出现孤立大按钮和失衡字号。',
  launchPoints: [
    '先看流通市值、量比、换手率，保证样本质量。',
    '再用分时强度过滤，找到尾盘阶段仍强于均价的股票。',
    '结果统一表格化，支持批量选择、排序和加自选。',
  ],
};

export function EndOfDayPicker() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { displayMeta, renameSaved } = usePickerSavedStrategy(EOD_PICKER_DEFAULTS);
  const [filters, setFilters] = useState<FilterConditions>(loadFiltersFromStorage);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
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
  const [sortField, setSortField] = useState<SortField>('timelineAboveAvgRatio');
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

  // 保存筛选条件
  useEffect(() => {
    saveFiltersToStorage(filters);
  }, [filters]);

  // 应用 AI 策略 URL 参数
  useEffect(() => {
    const parsed = parseEndOfDayParams(searchParams);
    if (!parsed) return;

    setFilters((prev) => ({ ...prev, ...parsed } as FilterConditions));

    if (searchParams.get('applied') === '1') {
      toast.success('已应用 AI 策略参数');
      setSearchParams(clearAppliedStrategyParams(searchParams), { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  // 恢复默认设置
  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // 开始分析
  const handleStartAnalysis = useCallback(async () => {
    setIsLoading(true);
    setStocks([]);

    // 记录最近使用
    addRecentUsage(filters);
    setRecentUsage(loadRecentUsageFromStorage());

    try {
      const result = await pickEndOfDay({
        marketCapMin: filters.marketCapMin,
        marketCapMax: filters.marketCapMax,
        volumeRatioMin: filters.volumeRatioMin,
        changePercentMin: filters.changePercentMin,
        changePercentMax: filters.changePercentMax,
        turnoverRateMin: filters.turnoverRateMin,
        turnoverRateMax: filters.turnoverRateMax,
        excludeST: filters.excludeST,
        timelineAboveAvgRatio: filters.timelineAboveAvgRatio,
      });

      const stockList = result?.list ?? [];
      if (stockList.length === 0) {
        toast.info('没有符合条件的股票，请尝试调整筛选条件');
      }

      setStocks(stockList as StockData[]);
      setHasAnalyzed(true);
    } catch (error) {
      console.error('选股失败:', error);
      toast.error('选股失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [filters, toast]);

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

  // 更新筛选条件
  const handleFilterChange = (key: keyof FilterConditions, value: number | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
      filters: { ...filters },
      createdAt: Date.now(),
    };
    const updated = [...savedSchemes, newScheme];
    setSavedSchemes(updated);
    saveSchemesToStorage(updated);
    setNewSchemeName('');
    setShowSaveInput(false);
    toast.success(`方案「${newScheme.name}」已保存`);
  }, [newSchemeName, filters, savedSchemes, toast]);

  // 加载方案
  const handleLoadScheme = useCallback((scheme: SavedScheme) => {
    setFilters(scheme.filters);
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
    setFilters(recent.filters);
    setShowRecentPanel(false);
    toast.success('已加载历史配置');
  }, [toast]);

  // 排序股票
  const sortedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortOrder === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [stocks, sortField, sortOrder]);

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
    if (selectedStocks.size === sortedStocks.length) {
      setSelectedStocks(new Set());
    } else {
      setSelectedStocks(new Set(sortedStocks.map((s) => s.code)));
    }
  }, [selectedStocks.size, sortedStocks]);

  // 批量加入自选
  const handleBatchAddWatchlist = useCallback(async () => {
    let addedCount = 0;
    for (const code of selectedStocks) {
      const stock = stocks.find((s) => s.code === code);
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
  }, [selectedStocks, stocks, toast]);

  return (
    <div className={`${styles.container} picker-page`}>
      <motion.header
        className="picker-page__header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="picker-page__headerMain">
          <div className="picker-page__eyebrow">尾盘选股</div>
          <div className="picker-page__titleBlock">
            <div className="picker-page__titleRow">
              <span className="picker-page__icon">
                <TrendingUp size={22} />
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
              <span className="picker-page__metricLabel">流通市值</span>
              <span className="picker-page__metricValue">{filters.marketCapMin} - {filters.marketCapMax} 亿</span>
            </div>
            <div className="picker-page__metric">
              <span className="picker-page__metricLabel">涨幅区间</span>
              <span className="picker-page__metricValue">{filters.changePercentMin} - {filters.changePercentMax}%</span>
            </div>
            <div className="picker-page__metric">
              <span className="picker-page__metricLabel">分时强度</span>
              <span className="picker-page__metricValue">≥ {filters.timelineAboveAvgRatio}%</span>
            </div>
          </div>
        </div>
        <div className="picker-page__headerAside">
          <div className="picker-page__status">
            <span className={`picker-page__statusDot ${hasAnalyzed ? 'picker-page__statusDotComplete' : 'picker-page__statusDotReady'}`} />
            {hasAnalyzed ? `已得到 ${stocks.length} 条盘尾结果` : '待执行盘尾分析'}
          </div>
          <div className="picker-page__headerButtons">
            {!hasAnalyzed ? (
              <button type="button" className="picker-button--primary" onClick={handleStartAnalysis} disabled={isLoading}>
                <Zap size={16} />
                开始分析
              </button>
            ) : (
              <button
                type="button"
                className="picker-button--secondary"
                onClick={() => {
                  setHasAnalyzed(false);
                  setStocks([]);
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
          {!hasAnalyzed ? (
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
                    <button type="button" className="picker-button--primary" onClick={handleStartAnalysis} disabled={isLoading}>
                      <Zap size={16} />
                      开始分析
                    </button>
                  </div>
                </motion.section>

              <motion.div
                className={`${styles.filterCard} ${isEditing ? styles.editing : ''}`}
                onClick={() => !isEditing && setIsEditing(true)}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                whileHover={!isEditing ? { scale: 1.01 } : undefined}
              >
                <div className={styles.filterHeader}>
                  <div className={styles.filterTitle}>
                    <SlidersHorizontal size={20} />
                    <span>筛选条件</span>
                  </div>
                  <div className={styles.filterActions}>
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
                              handleResetFilters();
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
                                市值 {recent.filters.marketCapMin}-{recent.filters.marketCapMax}亿 · 
                                涨幅 {recent.filters.changePercentMin}-{recent.filters.changePercentMax}%
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

                <div className={styles.filterGrid}>
                  {/* 流通市值 */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>流通市值</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={filters.marketCapMin}
                            onChange={(e) =>
                              handleFilterChange('marketCapMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className={styles.filterSeparator}>~</span>
                          <input
                            type="number"
                            value={filters.marketCapMax}
                            onChange={(e) =>
                              handleFilterChange('marketCapMax', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className={styles.filterUnit}>亿</span>
                        </>
                      ) : (
                        <span className={styles.filterDisplay}>
                          {filters.marketCapMin} ~ {filters.marketCapMax}
                          <span className={styles.filterUnit}>亿</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 量比 */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>量比</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={filters.volumeRatioMin}
                            onChange={(e) =>
                              handleFilterChange('volumeRatioMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.1"
                          />
                        </>
                      ) : (
                        <span className={styles.filterDisplay}>≥ {filters.volumeRatioMin}</span>
                      )}
                    </div>
                  </div>

                  {/* 当日涨幅 */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>当日涨幅</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={filters.changePercentMin}
                            onChange={(e) =>
                              handleFilterChange('changePercentMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.filterSeparator}>~</span>
                          <input
                            type="number"
                            value={filters.changePercentMax}
                            onChange={(e) =>
                              handleFilterChange('changePercentMax', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.filterUnit}>%</span>
                        </>
                      ) : (
                        <span className={styles.filterDisplay}>
                          {filters.changePercentMin} ~ {filters.changePercentMax}
                          <span className={styles.filterUnit}>%</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 换手率 */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>换手率</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={filters.turnoverRateMin}
                            onChange={(e) =>
                              handleFilterChange('turnoverRateMin', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.filterSeparator}>~</span>
                          <input
                            type="number"
                            value={filters.turnoverRateMax}
                            onChange={(e) =>
                              handleFilterChange('turnoverRateMax', parseFloat(e.target.value) || 0)
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="0.5"
                          />
                          <span className={styles.filterUnit}>%</span>
                        </>
                      ) : (
                        <span className={styles.filterDisplay}>
                          {filters.turnoverRateMin} ~ {filters.turnoverRateMax}
                          <span className={styles.filterUnit}>%</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 过滤ST */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>过滤ST股票</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <button
                          className={`${styles.toggleBtn} ${filters.excludeST ? styles.active : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFilterChange('excludeST', !filters.excludeST);
                          }}
                        >
                          {filters.excludeST ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          <span>{filters.excludeST ? '开启' : '关闭'}</span>
                        </button>
                      ) : (
                        <span className={styles.filterDisplay}>
                          {filters.excludeST ? '开启' : '关闭'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 分时强度 */}
                  <div className={styles.filterItem}>
                    <span className={styles.filterLabel}>分时强度</span>
                    <div className={styles.filterValue}>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={filters.timelineAboveAvgRatio}
                            onChange={(e) =>
                              handleFilterChange(
                                'timelineAboveAvgRatio',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className={styles.filterInput}
                            onClick={(e) => e.stopPropagation()}
                            step="5"
                            min="0"
                            max="100"
                          />
                          <span className={styles.filterUnit}>%</span>
                        </>
                      ) : (
                        <span className={styles.filterDisplay}>
                          ≥ {filters.timelineAboveAvgRatio}
                          <span className={styles.filterUnit}>%</span>
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
                      共筛选出 <span className="picker-page__summaryAccent">{stocks.length}</span> 只符合条件的股票
                    </div>
                    <div className="picker-page__summaryMeta">结果页固定使用表格视图，分时图缩成列内小图，方便横向比较。</div>
                  </div>
                </div>
                <div className="picker-page__toolbarGroup">
                  {stocks.length > 0 && (
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
                      setHasAnalyzed(false);
                      setStocks([]);
                      setShowSelectMode(false);
                      setSelectedStocks(new Set());
                    }}
                  >
                    <ChevronLeft size={16} />
                    重新筛选
                  </button>
                </div>
              </div>

              {stocks.length > 0 && (
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
                  {showSelectMode && (
                    <div className="picker-page__toolbarGroup">
                      <button type="button" className="picker-button--ghost" onClick={handleSelectAll}>
                        {selectedStocks.size === sortedStocks.length ? '取消全选' : '全选当前结果'}
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
                  )}
                </div>
              )}

              {sortedStocks.length > 0 ? (
                <div className="picker-page__tableShell">
                  <div className="picker-page__tableWrap">
                    <table className="picker-page__table">
                      <thead>
                        <tr>
                          {showSelectMode ? <th>选择</th> : null}
                          <th>股票</th>
                          <th>现价</th>
                          <th>涨跌</th>
                          <th>分时结构</th>
                          <th>分时强度</th>
                          <th>量比</th>
                          <th>换手率</th>
                          <th>流通市值</th>
                          <th>成交额</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedStocks.map((stock) => {
                          const inWatchlist = watchlistSet.has(normalizeWatchlistSymbol(stock.code));
                          const isPositive = stock.changePercent >= 0;

                          return (
                            <tr key={stock.code} onClick={() => openStockDetail(stock.code)}>
                              {showSelectMode ? (
                                <td>
                                  <button
                                    type="button"
                                    className="picker-page__checkbox"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSelect(stock.code);
                                    }}
                                  >
                                    {selectedStocks.has(stock.code) ? <CheckSquare size={16} /> : <Square size={16} />}
                                  </button>
                                </td>
                              ) : null}
                              <td>
                                <div className="picker-page__stockCell">
                                  <div className="picker-page__stockMain">
                                    <span className="picker-page__stockName">{stock.name}</span>
                                    <span className="picker-page__stockCode">{stock.code}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="picker-page__number picker-page__number--strong">{formatNumber(stock.price)}</td>
                              <td className={`picker-page__number picker-page__number--strong ${isPositive ? 'picker-page__number--up' : 'picker-page__number--down'}`}>
                                {isPositive ? '+' : ''}
                                {formatNumber(stock.changePercent)}%
                              </td>
                              <td>{stock.timeline && stock.timeline.length > 0 ? <TimelineChart data={stock.timeline} prevClose={stock.prevClose} compact /> : <span className="picker-page__metricStackLabel">暂无分时数据</span>}</td>
                              <td>
                                <span className={`picker-page__badge ${(stock.timelineAboveAvgRatio ?? 0) >= 90 ? 'picker-page__badge--success' : 'picker-page__badge--accent'}`}>
                                  {(stock.timelineAboveAvgRatio ?? 0).toFixed(0)}%
                                </span>
                              </td>
                              <td className="picker-page__number">{formatNumber(stock.volumeRatio)}</td>
                              <td className="picker-page__number">{formatNumber(stock.turnoverRate)}%</td>
                              <td className="picker-page__number">{formatNumber(stock.circulatingMarketCap)} 亿</td>
                              <td className="picker-page__number">{formatLargeNumber(stock.amount)}</td>
                              <td>
                                <div className="picker-page__rowActions">
                                  <button
                                    type="button"
                                    className={inWatchlist ? 'picker-button--ghost picker-page__actionButton' : 'picker-button--secondary picker-page__actionButton'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!inWatchlist) {
                                        void handleAddWatchlist(stock.code, stock.name);
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
                  <p className="picker-page__emptyTitle">没有找到符合条件的股票</p>
                  <p className="picker-page__emptyText">请回到条件面板，调整涨幅、量比或分时强度后重新分析。</p>
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
