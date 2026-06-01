import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "@/components/ToastProvider";
import { TRPCProvider } from "@/trpc/provider";
import { migrateFromLocalStorage } from "@/storage/migrate-from-localstorage";
import App from "./App";
import ReloadPrompt from "./ReloadPrompt";
import "./index.css";

// Migrate existing localStorage data to IndexedDB before rendering.
// This is idempotent — a no-op when there's nothing to migrate.
await migrateFromLocalStorage();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing root element.");
}

createRoot(rootElement).render(
  <StrictMode>
    <TRPCProvider>
      <ToastProvider>
        <App />
        <ReloadPrompt />
      </ToastProvider>
    </TRPCProvider>
  </StrictMode>,
);
