import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./theme/ThemeManager";
import App from "./App.tsx";
import { SavedReportsHost } from "./SavedReportsHost";
import "./ui-consistency.css";
import "./process-layout.css";
import "./practical-ui.css";
import { installCalendarPickerFix } from "./calendar-picker-fix";
import { installSelectEnhancer } from "./select-enhancer";

installCalendarPickerFix();
installSelectEnhancer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <SavedReportsHost />
  </StrictMode>,
);
