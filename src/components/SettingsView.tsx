import { colors, fonts, shadows, radii } from "@/theme";
import { Icon } from "@/components/Icon";
import { useSettings } from "@/hooks/useSettings";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import { useOpenRouterOAuth } from "@/hooks/useOpenRouterOAuth";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";
import { useToast } from "@/hooks/useToast";
import { OPENROUTER_DEFAULT_MODEL } from "@/lib/openrouter-models";
import { useEffect, useRef, useState } from "react";

/** Predefined dietary restriction labels shown as toggleable chips. */
const PREDEFINED_RESTRICTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "halal",
  "kosher",
  "pescatarian",
  "low-carb",
  "keto",
] as const;

export function SettingsView() {
  const toast = useToast();
  const {
    settings: savedSettings,
    isLoading,
    llmModel,
    dietaryRestrictions,
    otherDietaryNotes,
    openRouterOAuthKey,
    isOpenRouterConnected,
    updateSettings,
  } = useSettings();

  const { startOAuth, isStartingOAuth, isProcessingCallback, oauthError } =
    useOpenRouterOAuth();

  const {
    preferences: aiPreferences,
    isCreating: isCreatingPreference,
    isDeleting: isDeletingPreference,
    createPreferenceAsync,
    deletePreference,
  } = useAiPreferences();

  // AI Memory: inline "add preference" form state.
  const [showAddPreference, setShowAddPreference] = useState(false);
  const [newPreferenceText, setNewPreferenceText] = useState("");

  // Local state for the OpenRouter model picker.
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] =
    useState(llmModel);
  const hasAppliedOpenRouterDefault = useRef(false);
  const {
    models: openRouterModels,
    totalModelCount,
    isLoading: loadingOpenRouterModels,
    error: openRouterModelsError,
    freeOnly,
    visionOnly,
    toolsOnly,
    selectedModel,
    isSelectedModelFilteredOut,
    toggleFreeOnly,
    toggleVisionOnly,
    toggleToolsOnly,
    retry: retryOpenRouterModels,
  } = useOpenRouterModels(
    isOpenRouterConnected,
    selectedOpenRouterModel,
    {
      freeOnly: savedSettings.modelFilterFreeOnly,
      visionOnly: savedSettings.modelFilterVisionOnly,
      toolsOnly: savedSettings.modelFilterToolsOnly,
    },
    (filters) =>
      updateSettings({
        modelFilterFreeOnly: filters.freeOnly,
        modelFilterVisionOnly: filters.visionOnly,
        modelFilterToolsOnly: filters.toolsOnly,
      }),
  );

  // Local state so the UI reacts synchronously to user selection instead
  // of waiting for the async tRPC mutation round-trip.
  const [selectedRestrictions, setSelectedRestrictions] =
    useState<string[]>(dietaryRestrictions);
  const [selectedOtherNotes, setSelectedOtherNotes] =
    useState(otherDietaryNotes);

  // Keep local state in sync when the hook value changes (initial load,
  // external updates, page refresh).
  useEffect(() => {
    setSelectedRestrictions(dietaryRestrictions);
  }, [dietaryRestrictions]);

  useEffect(() => {
    setSelectedOtherNotes(otherDietaryNotes);
  }, [otherDietaryNotes]);

  // Default newly connected OpenRouter accounts to OpenRouter's free-model router.
  useEffect(() => {
    if (!isOpenRouterConnected) {
      hasAppliedOpenRouterDefault.current = false;
      return;
    }

    if (llmModel || hasAppliedOpenRouterDefault.current) return;

    hasAppliedOpenRouterDefault.current = true;
    setSelectedOpenRouterModel(OPENROUTER_DEFAULT_MODEL);
    updateSettings({ llmModel: OPENROUTER_DEFAULT_MODEL });
  }, [isOpenRouterConnected, llmModel, updateSettings]);

  // Sync OpenRouter model picker with persisted llmModel.
  useEffect(() => {
    setSelectedOpenRouterModel(
      llmModel || (isOpenRouterConnected ? OPENROUTER_DEFAULT_MODEL : ""),
    );
  }, [isOpenRouterConnected, llmModel]);

  const handleOpenRouterModelChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newModel = e.target.value;
    setSelectedOpenRouterModel(newModel);
    updateSettings({ llmModel: newModel });
  };

  const handleDisconnectOpenRouter = () => {
    updateSettings({ openRouterOAuthKey: "" });
  };

  const maskedOAuthKey =
    openRouterOAuthKey.length >= 4
      ? `••••••${openRouterOAuthKey.slice(-4)}`
      : openRouterOAuthKey.length > 0
        ? "••••••"
        : "";

  const handleToggleRestriction = (restriction: string) => {
    const updated = selectedRestrictions.includes(restriction)
      ? selectedRestrictions.filter((r) => r !== restriction)
      : [...selectedRestrictions, restriction];
    setSelectedRestrictions(updated);
    updateSettings({
      dietaryRestrictions: updated,
      otherDietaryNotes: selectedOtherNotes,
    });
  };

  const handleOtherNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSelectedOtherNotes(value);
    updateSettings({
      dietaryRestrictions: selectedRestrictions,
      otherDietaryNotes: value,
    });
  };

  const handleDeletePreference = (id: string, text: string) => {
    void toast
      .ask({
        title: "Remove preference?",
        message: `"${text}"`,
        confirmLabel: "Remove",
        tone: "danger",
      })
      .then((confirmed) => {
        if (confirmed) deletePreference(id);
      });
  };

  const handleSavePreference = async () => {
    const trimmed = newPreferenceText.trim();
    if (!trimmed) return;
    await createPreferenceAsync({ text: trimmed });
    setNewPreferenceText("");
    setShowAddPreference(false);
  };

  const handleCancelAddPreference = () => {
    setNewPreferenceText("");
    setShowAddPreference(false);
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Loading settings…</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Settings</h1>

      {/* ── OpenRouter Quick Setup ── */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>OpenRouter</h2>

        {isOpenRouterConnected ? (
          <>
            <p style={styles.openRouterConnected}>
              <Icon name="check" size={16} strokeWidth={3} />
              Connected to OpenRouter
            </p>
            <p style={styles.maskedKey}>OpenRouter key: {maskedOAuthKey}</p>

            {/* Model picker */}
            <div style={styles.field}>
              <span style={styles.label}>Filter models</span>
              <div style={styles.modelFilters}>
                <button
                  type="button"
                  aria-pressed={freeOnly}
                  onClick={toggleFreeOnly}
                  style={freeOnly ? styles.chipActive : styles.chip}
                >
                  Free
                </button>
                <button
                  type="button"
                  aria-pressed={visionOnly}
                  onClick={toggleVisionOnly}
                  style={visionOnly ? styles.chipActive : styles.chip}
                >
                  Vision
                </button>
                <button
                  type="button"
                  aria-pressed={toolsOnly}
                  onClick={toggleToolsOnly}
                  style={toolsOnly ? styles.chipActive : styles.chip}
                >
                  Tools
                </button>
              </div>

              <label htmlFor="openrouter-model" style={styles.label}>
                Model
              </label>
              <select
                id="openrouter-model"
                value={selectedOpenRouterModel}
                onChange={handleOpenRouterModelChange}
                disabled={
                  loadingOpenRouterModels || openRouterModelsError !== null
                }
                style={styles.select}
              >
                <option value="">
                  {loadingOpenRouterModels
                    ? "Loading models…"
                    : openRouterModels.length === 0
                      ? "No models match these filters"
                      : "Select a model"}
                </option>
                {isSelectedModelFilteredOut && selectedModel && (
                  <option value={selectedModel.id}>
                    {selectedModel.name} (selected; hidden by filters)
                  </option>
                )}
                {openRouterModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>

              {!loadingOpenRouterModels && !openRouterModelsError && (
                <p style={styles.modelCount}>
                  Showing {openRouterModels.length} of {totalModelCount} models
                </p>
              )}
              {openRouterModelsError && (
                <div style={styles.modelErrorRow}>
                  <p style={styles.openRouterError}>{openRouterModelsError}</p>
                  <button
                    type="button"
                    onClick={retryOpenRouterModels}
                    style={styles.retryButton}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleDisconnectOpenRouter}
              style={styles.disconnectButton}
            >
              Disconnect
            </button>
          </>
        ) : (
          <>
            <p style={styles.sectionDescription}>
              Sign in with your OpenRouter account to choose from its available
              AI models without manually entering an API key.
            </p>

            {isProcessingCallback ? (
              <p style={styles.openRouterProcessing}>
                Connecting to OpenRouter…
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void startOAuth()}
                disabled={isStartingOAuth}
                style={styles.openRouterSignInButton}
              >
                {isStartingOAuth
                  ? "Opening OpenRouter…"
                  : "Sign in with OpenRouter"}
              </button>
            )}

            {oauthError && <p style={styles.openRouterError}>{oauthError}</p>}
          </>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Dietary Restrictions</h2>
        <div style={styles.chipsContainer}>
          {PREDEFINED_RESTRICTIONS.map((restriction) => {
            const isActive = selectedRestrictions.includes(restriction);
            return (
              <button
                key={restriction}
                type="button"
                onClick={() => handleToggleRestriction(restriction)}
                style={isActive ? styles.chipActive : styles.chip}
              >
                {restriction}
              </button>
            );
          })}
        </div>
        <div style={styles.field}>
          <label htmlFor="other-dietary-notes" style={styles.label}>
            Other restrictions / notes
          </label>
          <input
            id="other-dietary-notes"
            type="text"
            value={selectedOtherNotes}
            onChange={handleOtherNotesChange}
            placeholder="e.g., Low sodium, no shellfish"
            style={{ ...styles.input, width: "100%" }}
          />
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>AI Memory</h2>
        <p style={styles.sectionDescription}>
          Things Chefness remembers about you. These are automatically included
          in every conversation.
        </p>

        {aiPreferences.length === 0 ? (
          <p style={styles.emptyText}>
            No saved preferences yet. As you chat, Chefness may ask to remember
            things about you.
          </p>
        ) : (
          <ul style={styles.preferenceList}>
            {aiPreferences.map((pref) => (
              <li key={pref.id} style={styles.preferenceRow}>
                <span style={styles.preferenceText}>{pref.text}</span>
                <button
                  type="button"
                  onClick={() => handleDeletePreference(pref.id, pref.text)}
                  disabled={isDeletingPreference}
                  style={styles.deleteButton}
                  aria-label={`Delete preference: ${pref.text}`}
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {showAddPreference ? (
          <div style={styles.addPreferenceForm}>
            <input
              type="text"
              value={newPreferenceText}
              onChange={(e) => setNewPreferenceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSavePreference();
                if (e.key === "Escape") handleCancelAddPreference();
              }}
              placeholder="e.g., I have a small kitchen"
              style={{ ...styles.input, width: "100%" }}
              autoFocus
            />
            <div style={styles.addPreferenceActions}>
              <button
                type="button"
                onClick={() => void handleSavePreference()}
                disabled={isCreatingPreference || !newPreferenceText.trim()}
                style={styles.saveButton}
              >
                {isCreatingPreference ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCancelAddPreference}
                style={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddPreference(true)}
            style={styles.addPreferenceButton}
          >
            <Icon name="plus" size={15} strokeWidth={2.5} />
            Add preference
          </button>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Help & Feedback</h2>
        <div style={styles.supportLinks}>
          <a
            href="mailto:support@chefness.org?subject=Chefness%20support"
            style={styles.supportLink}
          >
            Email Support
          </a>
          <a href="https://chefness.org/support" style={styles.supportLink}>
            Support Website
          </a>
          <a href="https://chefness.org/privacy" style={styles.supportLink}>
            Privacy Policy
          </a>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "1.5rem 1rem",
    maxWidth: 600,
    margin: "0 auto",
    minWidth: 0,
  },
  header: {
    fontFamily: fonts.serif,
    fontSize: "2rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    margin: "0 0 1.5rem",
    color: colors.espresso,
  },
  section: { marginBottom: "2rem" },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: "1.125rem",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: colors.espresso,
    margin: "0 0 1rem",
    paddingBottom: "0.5rem",
    borderBottom: `1px solid ${colors.glassBorder}`,
  },
  field: { marginBottom: "1.25rem" },
  label: {
    display: "block",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.stone700,
    marginBottom: "0.375rem",
  },
  select: {
    width: "100%",
    padding: "0.625rem 0.75rem",
    fontSize: "1rem",
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    color: colors.espresso,
    appearance: "none" as const,
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.75rem center",
    backgroundSize: "12px",
    boxSizing: "border-box" as const,
  },
  input: {
    flex: 1,
    padding: "0.625rem 0.75rem",
    fontSize: "1rem",
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    color: colors.espresso,
    boxSizing: "border-box" as const,
    minWidth: 0,
  },
  maskedKey: {
    marginTop: "0.375rem",
    fontSize: "0.8125rem",
    color: colors.stone600,
  },
  loadingText: {
    textAlign: "center" as const,
    color: colors.stone600,
    padding: "2rem 1rem",
  },
  chipsContainer: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.5rem",
    marginBottom: "1.25rem",
  },
  modelFilters: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.5rem",
    marginBottom: "1rem",
  },
  modelCount: {
    margin: "0.375rem 0 0",
    fontSize: "0.75rem",
    color: colors.stone600,
  },
  modelErrorRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
  retryButton: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: colors.saffron,
    backgroundColor: colors.glass,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    flexShrink: 0,
  },
  chip: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: colors.stone600,
    backgroundColor: colors.glass,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.pill,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  chipActive: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: colors.white,
    backgroundColor: colors.saffron,
    border: `1px solid ${colors.saffron}`,
    borderRadius: radii.pill,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  sectionDescription: {
    fontSize: "0.8125rem",
    color: colors.stone600,
    margin: "0 0 1rem",
    lineHeight: 1.5,
  },
  emptyText: {
    fontSize: "0.875rem",
    color: colors.stone400,
    fontStyle: "italic" as const,
    margin: "0 0 1rem",
  },
  preferenceList: {
    listStyle: "none",
    margin: "0 0 1rem",
    padding: 0,
  },
  preferenceRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
    padding: "0.625rem 0.75rem",
    backgroundColor: colors.glass,
    border: `1px solid ${colors.glassBorder}`,
    boxShadow: shadows.glass,
    borderRadius: radii.md,
    marginBottom: "0.5rem",
  },
  preferenceText: {
    fontSize: "0.875rem",
    color: colors.espresso,
    flex: 1,
    minWidth: 0,
  },
  deleteButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    fontSize: "1.25rem",
    lineHeight: 1,
    color: colors.roseText,
    cursor: "pointer",
    padding: "0.25rem 0.5rem",
    borderRadius: radii.sm,
    flexShrink: 0,
  },
  addPreferenceButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    background: "none",
    border: "none",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.saffron,
    cursor: "pointer",
    padding: "0.375rem 0",
  },
  addPreferenceForm: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  addPreferenceActions: {
    display: "flex",
    gap: "0.5rem",
  },
  saveButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.white,
    backgroundColor: colors.saffron,
    border: "none",
    borderRadius: radii.md,
    boxShadow: shadows.glassLg,
    cursor: "pointer",
  },
  cancelButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.stone700,
    backgroundColor: colors.glass,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: radii.md,
    boxShadow: shadows.glass,
    cursor: "pointer",
  },
  openRouterSignInButton: {
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: colors.white,
    backgroundColor: colors.saffron,
    border: "none",
    borderRadius: radii.md,
    boxShadow: shadows.glassLg,
    cursor: "pointer",
    width: "100%",
  },
  openRouterConnected: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: colors.success,
    margin: "0 0 0.25rem",
  },
  openRouterProcessing: {
    fontSize: "0.875rem",
    color: colors.saffron,
    fontWeight: 500,
    margin: "0 0 0.5rem",
  },
  openRouterError: {
    fontSize: "0.8125rem",
    color: colors.danger,
    margin: "0.5rem 0 0",
    lineHeight: 1.5,
  },
  supportLinks: {
    display: "flex",
    flexDirection: "column" as const,
  },
  supportLink: {
    display: "flex",
    alignItems: "center",
    minHeight: 44,
    color: colors.saffron,
    fontWeight: 500,
  },
  disconnectButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: colors.danger,
    backgroundColor: colors.dangerTint,
    border: `1px solid ${colors.dangerTintBorder}`,
    borderRadius: radii.md,
    cursor: "pointer",
  },
};
