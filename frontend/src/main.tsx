import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { installCalendarPickerFix } from "./calendar-picker-fix";
import { installSelectEnhancer } from "./select-enhancer";

installCalendarPickerFix();
installSelectEnhancer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
