import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ReloadPrompt from "./ReloadPrompt";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <ReloadPrompt />
  </StrictMode>,
);
