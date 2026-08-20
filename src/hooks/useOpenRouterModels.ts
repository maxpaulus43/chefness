import {
  fetchOpenRouterModels,
  isFreeOpenRouterModel,
  supportsTools,
  supportsVision,
} from "@/lib/openrouter-models";
import { useEffect, useMemo, useState } from "react";

export function useOpenRouterModels(enabled: boolean, selectedModelId: string) {
  const [models, setModels] = useState<
    Awaited<ReturnType<typeof fetchOpenRouterModels>>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [freeOnly, setFreeOnly] = useState(false);
  const [visionOnly, setVisionOnly] = useState(false);
  const [toolsOnly, setToolsOnly] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- fetch lifecycle intentionally resets catalog state */
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
    toggleFreeOnly: () => setFreeOnly((enabled) => !enabled),
    toggleVisionOnly: () => setVisionOnly((enabled) => !enabled),
    toggleToolsOnly: () => setToolsOnly((enabled) => !enabled),
    retry: () => setRetryCount((count) => count + 1),
  } as const;
}
