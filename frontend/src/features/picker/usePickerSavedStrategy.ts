import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  SAVED_STRATEGIES_CHANGED,
  getSavedStrategyById,
  renameSavedStrategy,
  type SavedStrategyItem,
} from "@/features/picker/savedStrategies";

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
  const [searchParams] = useSearchParams();
  const savedId = searchParams.get("savedId");

  const [savedStrategy, setSavedStrategy] = useState<SavedStrategyItem | null>(() =>
    savedId ? getSavedStrategyById(savedId) : null,
  );

  const refreshSaved = useCallback(() => {
    if (!savedId) {
      setSavedStrategy(null);
      return;
    }
    setSavedStrategy(getSavedStrategyById(savedId));
  }, [savedId]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    const handler = () => refreshSaved();
    window.addEventListener(SAVED_STRATEGIES_CHANGED, handler);
    return () => window.removeEventListener(SAVED_STRATEGIES_CHANGED, handler);
  }, [refreshSaved]);

  const renameSaved = useCallback(
    (label: string, description?: string) => {
      if (!savedId) return null;
      const updated = renameSavedStrategy(savedId, label, description);
      if (updated) setSavedStrategy(updated);
      return updated;
    },
    [savedId],
  );

  const canonicalTitle = defaults.title;
  const savedLabel = savedStrategy?.label?.trim() || null;
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
