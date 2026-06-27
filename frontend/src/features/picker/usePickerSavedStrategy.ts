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
}

export interface PickerStrategyDisplayMeta {
  /** Canonical strategy name (e.g. 鲲鹏战法), never overridden by saved custom labels */
  title: string;
  /** Saved custom name when it differs from the canonical title */
  customLabel: string | null;
  subtitle: string;
  launchTitle: string;
  launchText: string;
  launchPoints: string[];
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
  const customLabel =
    savedStrategy && savedLabel && savedLabel !== canonicalTitle ? savedLabel : null;
  const description = savedStrategy?.description ?? defaults.subtitle;
  const subtitle = customLabel
    ? description && description !== customLabel
      ? `${customLabel} · ${description}`
      : customLabel
    : description;

  const displayMeta: PickerStrategyDisplayMeta = {
    title: canonicalTitle,
    customLabel,
    subtitle,
    launchTitle: savedStrategy?.explanation ?? savedStrategy?.description ?? defaults.launchTitle,
    launchText: savedStrategy?.description ?? defaults.launchText,
    launchPoints:
      savedStrategy?.steps && savedStrategy.steps.length > 0 ? savedStrategy.steps : defaults.launchPoints,
    isSaved: !!savedStrategy,
    savedId,
    savedStrategy,
  };

  return { displayMeta, renameSaved, refreshSaved };
}
