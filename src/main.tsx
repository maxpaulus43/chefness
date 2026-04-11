import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TRPCProvider } from "@/trpc/provider";
import App from "./App";
import ReloadPrompt from "./ReloadPrompt";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TRPCProvider>
      <App />
      <ReloadPrompt />
    </TRPCProvider>
  </StrictMode>,
);
