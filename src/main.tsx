import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import SafeMenuEnhancer from "./SafeMenuEnhancer";
import BudgetCategoryEnhancer from "./BudgetCategoryEnhancer";
import "./style.css";
import "./soft-tech.css";
import "./analysis-dashboard.css";
import "./navigation-layout.css";
/* Aurora is intentionally loaded ONLY on the preview branch. */
import "./aurora-preview.css";
/* Theme-aware, more pronounced Liquid Glass — preview only. */
import "./aurora-theme.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SafeMenuEnhancer />
    <BudgetCategoryEnhancer />
    <App />
  </React.StrictMode>,
);
