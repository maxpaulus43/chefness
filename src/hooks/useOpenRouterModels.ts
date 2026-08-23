import {
  fetchOpenRouterModels,
  isFreeOpenRouterModel,
  supportsTools,
  supportsVision,
} from "@/lib/openrouter-models";
import { useEffect, useMemo, useState } from "react";

interface ModelFilterPreferences {
  freeOnly: boolean;
  visionOnly: boolean;
  toolsOnly: boolean;
}

export function useOpenRouterModels(
  enabled: boolean,
  selectedModelId: string,
  savedFilters?: ModelFilterPreferences,
  onFiltersChange?: (filters: ModelFilterPreferences) => void,
) {
  const [models, setModels] = useState<
    Awaited<ReturnType<typeof fetchOpenRouterModels>>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const savedFreeOnly = savedFilters?.freeOnly;
  const savedVisionOnly = savedFilters?.visionOnly;
  const savedToolsOnly = savedFilters?.toolsOnly;
  const [freeOnly, setFreeOnly] = useState(savedFreeOnly ?? false);
  const [visionOnly, setVisionOnly] = useState(savedVisionOnly ?? false);
  const [toolsOnly, setToolsOnly] = useState(savedToolsOnly ?? false);

  /* eslint-disable react-hooks/set-state-in-effect -- persisted preferences and fetch lifecycle intentionally synchronize local state */
  useEffect(() => {
    if (
      savedFreeOnly === undefined ||
      savedVisionOnly === undefined ||
      savedToolsOnly === undefined
    )
      return;
    setFreeOnly(savedFreeOnly);
    setVisionOnly(savedVisionOnly);
    setToolsOnly(savedToolsOnly);
  }, [savedFreeOnly, savedToolsOnly, savedVisionOnly]);

  useEffect(() => {
    if (!enabled) {
      setModels([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    void fetchOpenRouterModels(controller.signal)
      .then(setModels)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load OpenRouter models.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [enabled, retryCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateFilters = (next: ModelFilterPreferences) => {
    setFreeOnly(next.freeOnly);
    setVisionOnly(next.visionOnly);
    setToolsOnly(next.toolsOnly);
    onFiltersChange?.(next);
  };

  const filteredModels = useMemo(
    () =>
      models.filter(
        (model) =>
          (!freeOnly || isFreeOpenRouterModel(model)) &&
          (!visionOnly || supportsVision(model)) &&
          (!toolsOnly || supportsTools(model)),
      ),
    [freeOnly, models, toolsOnly, visionOnly],
  );

  const selectedModel =
    models.find((model) => model.id === selectedModelId) ?? null;
  const isSelectedModelFilteredOut =
    selectedModel !== null &&
    !filteredModels.some((model) => model.id === selectedModelId);
  const selectedModelSupportsVision =
    selectedModel !== null && supportsVision(selectedModel);

  return {
    models: filteredModels,
    totalModelCount: models.length,
    isLoading,
    error,
    freeOnly,
    visionOnly,
    toolsOnly,
    selectedModel,
    isSelectedModelFilteredOut,
    selectedModelSupportsVision,
    toggleFreeOnly: () =>
      updateFilters({ freeOnly: !freeOnly, visionOnly, toolsOnly }),
    toggleVisionOnly: () =>
      updateFilters({ freeOnly, visionOnly: !visionOnly, toolsOnly }),
    toggleToolsOnly: () =>
      updateFilters({ freeOnly, visionOnly, toolsOnly: !toolsOnly }),
    retry: () => setRetryCount((count) => count + 1),
  } as const;
}
