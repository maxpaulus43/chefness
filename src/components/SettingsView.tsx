import { useSettings } from "@/hooks/useSettings";
import {
  getAllProviders,
  getModelsForProvider,
  type ProviderInfo,
  type ModelInfo,
} from "@clinebot/llms";
import { useEffect, useState } from "react";

export function SettingsView() {
  const {
    isLoading,
    llmProvider,
    llmModel,
    llmApiKey,
    updateSettings,
  } = useSettings();

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<Record<string, ModelInfo>>({});
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);

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
    if (!llmProvider) {
      setModels({});
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    void getModelsForProvider(llmProvider).then((result) => {
      if (!cancelled) {
        setModels(result);
        setLoadingModels(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [llmProvider]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ llmProvider: e.target.value, llmModel: "" });
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ llmModel: e.target.value });
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ llmApiKey: e.target.value });
  };

  const handleClearApiKey = () => {
    updateSettings({ llmApiKey: "" });
  };

  const maskedKey =
    llmApiKey.length >= 4
      ? `••••••${llmApiKey.slice(-4)}`
      : llmApiKey.length > 0
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
        {renderProviderField(llmProvider, sortedProviders, loadingProviders, handleProviderChange)}
        {renderModelField(llmProvider, llmModel, modelEntries, loadingModels, handleModelChange)}
        {renderApiKeyField(llmApiKey, maskedKey, handleApiKeyChange, handleClearApiKey)}
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
    fontSize: "0.9375rem",
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
    fontSize: "0.9375rem",
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
};
