import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  SAVED_STRATEGIES_CHANGED,
  getSavedStrategyById,
  renameSavedStrategy,
  type SavedStrategyItem,
} from "@/features/picker/savedStrategies";
import { STRATEGY_LABEL_PARAM } from "@/features/picker/strategyParams";

export interface PickerStrategyDefaults {
  title: string;
  subtitle: string;
  launchTitle: string;
  launchText: string;
  launchPoints: string[];
  /** Label for the conditions panel when viewing the built-in template (e.g. 鲲鹏战法条件) */
  conditionsLabel: string;
}

export interface PickerStrategyDisplayMeta {
  /** Main page title — saved strategy name, or built-in template name */
  title: string;
  /** Eyebrow / template category (e.g. 鲲鹏战法) */
  categoryLabel: string;
  subtitle: string;
  launchTitle: string;
  launchText: string;
  launchPoints: string[];
  conditionsLabel: string;
  isSaved: boolean;
  savedId: string | null;
  savedStrategy: SavedStrategyItem | null;
}

export function usePickerSavedStrategy(defaults: PickerStrategyDefaults) {
  const [searchParams, setSearchParams] = useSearchParams();
  const savedId = searchParams.get("savedId");
  const strategyLabelParam = searchParams.get(STRATEGY_LABEL_PARAM);

  const [storeVersion, setStoreVersion] = useState(0);

  useEffect(() => {
    const handler = () => setStoreVersion((version) => version + 1);
    window.addEventListener(SAVED_STRATEGIES_CHANGED, handler);
    return () => window.removeEventListener(SAVED_STRATEGIES_CHANGED, handler);
  }, []);

  const savedStrategy = useMemo(() => {
    void storeVersion;
    return savedId ? getSavedStrategyById(savedId) : null;
  }, [savedId, storeVersion]);

  const renameSaved = useCallback(
    (label: string, description?: string) => {
      if (!savedId) return null;
      const updated = renameSavedStrategy(savedId, label, description);
      if (updated) {
        setStoreVersion((version) => version + 1);
        const next = new URLSearchParams(searchParams);
        next.set(STRATEGY_LABEL_PARAM, updated.label);
        setSearchParams(next, { replace: true });
      }
      return updated;
    },
    [savedId, searchParams, setSearchParams],
  );

  const refreshSaved = useCallback(() => {
    setStoreVersion((version) => version + 1);
  }, []);

  const canonicalTitle = defaults.title;
  const savedLabel =
    savedStrategy?.label?.trim() || strategyLabelParam?.trim() || null;
  const title = savedLabel ?? canonicalTitle;
  const categoryLabel = canonicalTitle;
  const subtitle = savedStrategy?.description?.trim() || defaults.subtitle;
  const conditionsLabel = savedStrategy ? `${title}条件` : defaults.conditionsLabel;

  const displayMeta: PickerStrategyDisplayMeta = {
    title,
    categoryLabel,
    subtitle,
    launchTitle: savedStrategy?.explanation?.trim() || savedStrategy?.description?.trim() || defaults.launchTitle,
    launchText: savedStrategy?.description?.trim() || defaults.launchText,
    launchPoints:
      savedStrategy?.steps && savedStrategy.steps.length > 0 ? savedStrategy.steps : defaults.launchPoints,
    conditionsLabel,
    isSaved: !!savedStrategy,
    savedId,
    savedStrategy,
  };

  return { displayMeta, renameSaved, refreshSaved };
}
