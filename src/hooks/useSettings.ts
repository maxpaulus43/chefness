/**
 * Custom hook that encapsulates all settings-related data operations.
 *
 * Components consume this hook for LLM settings data and actions.
 * They never import `trpc` directly or manage cache invalidation —
 * all of that lives here.
 */
import { OPENROUTER_DEFAULT_MODEL } from "@/lib/openrouter-models";
import { trpc } from "@/trpc/client";
import type { Settings, UpdateSettingsInput } from "@/types/settings";

/**
 * Stable fallback used while the settings singleton hasn't been fetched yet.
 *
 * Defined at module scope so every render sees the **same object reference**.
 * This prevents infinite-loop re-renders caused by `useEffect` deps that
 * compare by reference (e.g. the `dietaryRestrictions` array in SettingsView).
 *
 * Typed as `Settings` so the compiler will error if a new field is added to
 * the schema without being given a default here.
 */
const EMPTY_RESTRICTIONS: string[] = [];

const DEFAULT_SETTINGS: Settings = {
  id: "user-settings",
  llmProvider: "",
  llmModel: "",
  llmApiKey: "",
  openRouterOAuthKey: "",
  dietaryRestrictions: EMPTY_RESTRICTIONS,
  otherDietaryNotes: "",
  createdAt: "",
  updatedAt: "",
};

export function useSettings() {
  const utils = trpc.useUtils();

  const getQuery = trpc.settings.get.useQuery();

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      void utils.settings.get.invalidate();
    },
  });

  const settings = getQuery.data ?? DEFAULT_SETTINGS;

  // OpenRouter is the sole LLM provider. Legacy manual-provider fields remain
  // in storage for backward-compatible parsing but are intentionally ignored.
  const effectiveProvider = "openrouter";
  const effectiveModel = settings.llmModel || OPENROUTER_DEFAULT_MODEL;
  const effectiveApiKey = settings.openRouterOAuthKey;

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

    /** Update settings and resolve only after on-device persistence succeeds. */
    updateSettingsAsync: (data: Omit<UpdateSettingsInput, "id">) =>
      updateMutation.mutateAsync({ id: "user-settings", ...data }),

    /** `true` while an update is in flight. */
    isUpdating: updateMutation.isPending,

    /** Convenience getter: the current OpenRouter model identifier. */
    llmModel: settings.llmModel,

    /** Resolved provider ID — always OpenRouter. */
    effectiveProvider,

    /** Resolved OpenRouter model ID, with the default applied. */
    effectiveModel,

    /** Resolved API key returned by OpenRouter OAuth. */
    effectiveApiKey,

    /** Convenience getter: the current dietary restrictions list. */
    dietaryRestrictions: settings.dietaryRestrictions,

    /** Convenience getter: the current freeform dietary notes. */
    otherDietaryNotes: settings.otherDietaryNotes,

    /** Convenience getter: the OpenRouter OAuth API key. */
    openRouterOAuthKey: settings.openRouterOAuthKey,

    /** `true` when the user has connected via OpenRouter OAuth. */
    isOpenRouterConnected: settings.openRouterOAuthKey !== "",

    /** `true` when the user has connected an OpenRouter account. */
    isConfigured: settings.openRouterOAuthKey !== "",
  } as const;
}
