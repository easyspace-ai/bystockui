import { motion } from "framer-motion";
import { X } from "lucide-react";
import styles from "./PickerLoadingOverlay.module.css";

export interface PickerLoadingProgress {
  completed: number;
  total: number;
  stage: string;
}

type Props = {
  progress: PickerLoadingProgress;
  /** `progress.stage` 为空时的文案 */
  defaultStage: string;
  onClose?: () => void;
};

/**
 * 选股分析进行中：居中白底小弹窗 + 环形进度 + 细进度条（三页共用）。
 */
export function PickerLoadingOverlay({ progress, defaultStage, onClose }: Props) {
  const percentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderText}>
            <p className={styles.eyebrow}>正在执行</p>
            <p className={styles.cardTitle}>选股任务进行中</p>
          </div>
          {onClose ? (
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="关闭进度弹窗">
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className={styles.spinnerWrap}>
          <motion.div
            className={styles.spinnerRing}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.35, repeat: Infinity, ease: "linear" }}
          />
          <div className={styles.spinnerCenter}>
            <motion.span
              className={styles.percentage}
              key={percentage}
              initial={{ scale: 1.15, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              {percentage}%
            </motion.span>
          </div>
        </div>

        <div className={styles.progressTrack}>
          <motion.div
            className={styles.progressFill}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
        </div>

        <div className={styles.status}>
          <p className={styles.title}>{progress.stage || defaultStage}</p>
          <p className={styles.detail}>
            {progress.total > 0
              ? `已处理 ${progress.completed} / ${progress.total}`
              : "正在初始化连接..."}
          </p>
        </div>

        {onClose ? (
          <div className={styles.footer}>
            <button type="button" className={styles.stopButton} onClick={onClose}>
              停止任务
            </button>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
