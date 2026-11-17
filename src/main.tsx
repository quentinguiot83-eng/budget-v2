import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installStandaloneIphoneDock } from "./standaloneIphoneDock";
import "./style.css";
import "./soft-tech.css";
import "./analysis-dashboard.css";
import "./navigation-layout.css";
import "./aurora.css";
import "./ios-pwa-layout.css";
import "./wimm-report-fixes.css";
import "./wimm-system.css";

// Position fixed can drift after the iPhone PWA resumes from keyboard/background.
installStandaloneIphoneDock();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
