/**
 * Custom hook that encapsulates all settings-related data operations.
 *
 * Components consume this hook for LLM settings data and actions.
 * They never import `trpc` directly or manage cache invalidation —
 * all of that lives here.
 */
import { trpc } from "@/trpc/client";
import type { UpdateSettingsInput } from "@/types/settings";

export function useSettings() {
  const utils = trpc.useUtils();

  const getQuery = trpc.settings.get.useQuery();

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      void utils.settings.get.invalidate();
    },
  });

  const settings = getQuery.data ?? {
    id: "user-settings",
    llmProvider: "",
    llmModel: "",
    llmApiKey: "",
    openRouterOAuthKey: "",
    dietaryRestrictions: [] as string[],
    otherDietaryNotes: "",
    createdAt: "",
    updatedAt: "",
  };

  // Resolve effective LLM credentials — prefer manual config, fall back to OpenRouter OAuth
  const effectiveProvider = settings.llmApiKey
    ? settings.llmProvider
    : settings.openRouterOAuthKey
      ? "openrouter"
      : settings.llmProvider;

  const effectiveModel = settings.llmApiKey
    ? settings.llmModel
    : settings.openRouterOAuthKey
      ? settings.llmModel || "openai/gpt-5.2"
      : settings.llmModel;

  const effectiveApiKey = settings.llmApiKey || settings.openRouterOAuthKey;

  return {
    /** The current settings object (sensible defaults while loading). */
    settings,

    /** `true` while the settings are being fetched. */
    isLoading: getQuery.isLoading,

    /** Non-null when the get query has errored. */
    error: getQuery.error ?? null,

    /** Update the settings singleton. */
    updateSettings: (data: Omit<UpdateSettingsInput, "id">) =>
      updateMutation.mutate({ id: "user-settings", ...data }),

    /** `true` while an update is in flight. */
    isUpdating: updateMutation.isPending,

    /** Convenience getter: the current LLM provider identifier. */
    llmProvider: settings.llmProvider,

    /** Convenience getter: the current LLM model identifier. */
    llmModel: settings.llmModel,

    /** Convenience getter: the current LLM API key. */
    llmApiKey: settings.llmApiKey,

    /** Resolved provider ID — uses OpenRouter when OAuth is active and no manual key. */
    effectiveProvider,

    /** Resolved model ID — uses OpenRouter default when OAuth is active and no model selected. */
    effectiveModel,

    /** Resolved API key — prefers manual key, falls back to OpenRouter OAuth key. */
    effectiveApiKey,

    /** Convenience getter: the current dietary restrictions list. */
    dietaryRestrictions: settings.dietaryRestrictions,

    /** Convenience getter: the current freeform dietary notes. */
    otherDietaryNotes: settings.otherDietaryNotes,

    /** Convenience getter: the OpenRouter OAuth API key. */
    openRouterOAuthKey: settings.openRouterOAuthKey,

    /** `true` when the user has connected via OpenRouter OAuth. */
    isOpenRouterConnected: settings.openRouterOAuthKey !== "",

    /** `true` when the user can chat — either manual config or OAuth key. */
    isConfigured:
      (settings.llmProvider !== "" && settings.llmModel !== "" && settings.llmApiKey !== "") ||
      settings.openRouterOAuthKey !== "",
  } as const;
}
