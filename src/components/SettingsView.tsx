import { useSettings } from "@/hooks/useSettings";
import { useAiPreferences } from "@/hooks/useAiPreferences";
import {
  getAllProviders,
  getModelsForProvider,
  type ProviderInfo,
  type ModelInfo,
} from "@clinebot/llms";
import { useEffect, useState } from "react";

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
  const {
    isLoading,
    llmProvider,
    llmModel,
    llmApiKey,
    dietaryRestrictions,
    otherDietaryNotes,
    updateSettings,
  } = useSettings();

  const {
    preferences: aiPreferences,
    isCreating: isCreatingPreference,
    isDeleting: isDeletingPreference,
    createPreferenceAsync,
    deletePreference,
  } = useAiPreferences();

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<Record<string, ModelInfo>>({});
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);

  // AI Memory: inline "add preference" form state.
  const [showAddPreference, setShowAddPreference] = useState(false);
  const [newPreferenceText, setNewPreferenceText] = useState("");

  // Local state so the UI reacts synchronously to user selection instead
  // of waiting for the async tRPC mutation round-trip.
  const [selectedProvider, setSelectedProvider] = useState(llmProvider);
  const [selectedModel, setSelectedModel] = useState(llmModel);
  const [selectedApiKey, setSelectedApiKey] = useState(llmApiKey);
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>(dietaryRestrictions);
  const [selectedOtherNotes, setSelectedOtherNotes] = useState(otherDietaryNotes);

  // Keep local state in sync when the hook value changes (initial load,
  // external updates, page refresh).
  useEffect(() => {
    setSelectedProvider(llmProvider);
  }, [llmProvider]);

  useEffect(() => {
    setSelectedModel(llmModel);
  }, [llmModel]);

  useEffect(() => {
    setSelectedApiKey(llmApiKey);
  }, [llmApiKey]);

  useEffect(() => {
    setSelectedRestrictions(dietaryRestrictions);
  }, [dietaryRestrictions]);

  useEffect(() => {
    setSelectedOtherNotes(otherDietaryNotes);
  }, [otherDietaryNotes]);

  // Fetch provider list on mount.
  useEffect(() => {
    let cancelled = false;
    setLoadingProviders(true);
    void getAllProviders().then((list) => {
      if (!cancelled) {
        setProviders(list);
        setLoadingProviders(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch models whenever the selected provider changes.
  useEffect(() => {
    if (!selectedProvider) {
      setModels({});
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    void getModelsForProvider(selectedProvider).then((result) => {
      if (!cancelled) {
        setModels(result);
        setLoadingModels(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProvider]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setSelectedProvider(newProvider);
    setSelectedModel("");
    updateSettings({ llmProvider: newProvider, llmModel: "" });
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
    updateSettings({ llmModel: newModel });
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setSelectedApiKey(newKey);
    updateSettings({ llmApiKey: newKey });
  };

  const handleClearApiKey = () => {
    setSelectedApiKey("");
    updateSettings({ llmApiKey: "" });
  };

  const handleToggleRestriction = (restriction: string) => {
    const updated = selectedRestrictions.includes(restriction)
      ? selectedRestrictions.filter((r) => r !== restriction)
      : [...selectedRestrictions, restriction];
    setSelectedRestrictions(updated);
    updateSettings({ dietaryRestrictions: updated, otherDietaryNotes: selectedOtherNotes });
  };

  const handleOtherNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSelectedOtherNotes(value);
    updateSettings({ dietaryRestrictions: selectedRestrictions, otherDietaryNotes: value });
  };

  const handleDeletePreference = (id: string, text: string) => {
    if (window.confirm(`Remove preference: "${text}"?`)) {
      deletePreference(id);
    }
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

  const maskedKey =
    selectedApiKey.length >= 4
      ? `••••••${selectedApiKey.slice(-4)}`
      : selectedApiKey.length > 0
        ? "••••••"
        : "";

  if (isLoading) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Loading settings…</p>
      </div>
    );
  }

  const sortedProviders = [...providers].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const modelEntries = Object.entries(models).sort(([, a], [, b]) =>
    (a.name ?? a.id).localeCompare(b.name ?? b.id),
  );

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Settings</h1>
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>AI Configuration</h2>
        {renderProviderField(selectedProvider, sortedProviders, loadingProviders, handleProviderChange)}
        {renderModelField(selectedProvider, selectedModel, modelEntries, loadingModels, handleModelChange)}
        {renderApiKeyField(selectedApiKey, maskedKey, handleApiKeyChange, handleClearApiKey)}
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
          Things Chefness remembers about you. These are automatically included in every conversation.
        </p>

        {aiPreferences.length === 0 ? (
          <p style={styles.emptyText}>
            No saved preferences yet. As you chat, Chefness may ask to remember things about you.
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
                  ×
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
            + Add preference
          </button>
        )}
      </section>
    </div>
  );
}

function renderProviderField(
  value: string,
  providers: ProviderInfo[],
  loading: boolean,
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void,
) {
  return (
    <div style={styles.field}>
      <label htmlFor="llm-provider" style={styles.label}>Provider</label>
      <select id="llm-provider" value={value} onChange={onChange} disabled={loading} style={styles.select}>
        <option value="">{loading ? "Loading providers…" : "Select a provider"}</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}

function renderModelField(
  provider: string,
  value: string,
  entries: [string, ModelInfo][],
  loading: boolean,
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void,
) {
  return (
    <div style={styles.field}>
      <label htmlFor="llm-model" style={styles.label}>Model</label>
      <select id="llm-model" value={value} onChange={onChange} disabled={!provider || loading} style={styles.select}>
        <option value="">
          {!provider ? "Select a provider first" : loading ? "Loading models…" : "Select a model"}
        </option>
        {entries.map(([id, info]) => (
          <option key={id} value={id}>{info.name ?? id}</option>
        ))}
      </select>
    </div>
  );
}

function renderApiKeyField(
  value: string,
  maskedKey: string,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onClear: () => void,
) {
  return (
    <div style={styles.field}>
      <label htmlFor="llm-api-key" style={styles.label}>API Key</label>
      <div style={styles.apiKeyRow}>
        <input
          id="llm-api-key"
          type="password"
          value={value}
          onChange={onChange}
          placeholder="Enter your API key"
          style={styles.input}
          autoComplete="off"
        />
        {value && (
          <button type="button" onClick={onClear} style={styles.clearButton}>
            Clear
          </button>
        )}
      </div>
      {maskedKey && <p style={styles.maskedKey}>API key: {maskedKey}</p>}
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
    fontSize: "1.5rem",
    fontWeight: 700,
    margin: "0 0 1.5rem",
    color: "#111827",
  },
  section: { marginBottom: "2rem" },
  sectionTitle: {
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#374151",
    margin: "0 0 1rem",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid #e5e7eb",
  },
  field: { marginBottom: "1.25rem" },
  label: {
    display: "block",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "0.375rem",
  },
  select: {
    width: "100%",
    padding: "0.625rem 0.75rem",
    fontSize: "1rem",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111827",
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
    border: "1px solid #d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111827",
    boxSizing: "border-box" as const,
    minWidth: 0,
  },
  apiKeyRow: { display: "flex", gap: "0.5rem", alignItems: "center" },
  clearButton: {
    padding: "0.625rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#dc2626",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  maskedKey: {
    marginTop: "0.375rem",
    fontSize: "0.8125rem",
    color: "#6b7280",
  },
  loadingText: {
    textAlign: "center" as const,
    color: "#6b7280",
    padding: "2rem 1rem",
  },
  chipsContainer: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.5rem",
    marginBottom: "1.25rem",
  },
  chip: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "#374151",
    backgroundColor: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 9999,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  chipActive: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "#fff",
    backgroundColor: "#f97316",
    border: "1px solid #f97316",
    borderRadius: 9999,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  sectionDescription: {
    fontSize: "0.8125rem",
    color: "#6b7280",
    margin: "0 0 1rem",
    lineHeight: 1.5,
  },
  emptyText: {
    fontSize: "0.875rem",
    color: "#9ca3af",
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
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    marginBottom: "0.5rem",
  },
  preferenceText: {
    fontSize: "0.875rem",
    color: "#111827",
    flex: 1,
    minWidth: 0,
  },
  deleteButton: {
    background: "none",
    border: "none",
    fontSize: "1.25rem",
    lineHeight: 1,
    color: "#9ca3af",
    cursor: "pointer",
    padding: "0.25rem 0.5rem",
    borderRadius: 4,
    flexShrink: 0,
  },
  addPreferenceButton: {
    background: "none",
    border: "none",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#f97316",
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
    color: "#fff",
    backgroundColor: "#f97316",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  cancelButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#6b7280",
    backgroundColor: "transparent",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    cursor: "pointer",
  },
};
