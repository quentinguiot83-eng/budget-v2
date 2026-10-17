import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import SafeMenuEnhancer from "./SafeMenuEnhancer";
import BudgetCategoryEnhancer from "./BudgetCategoryEnhancer";
import "./style.css";
import "./soft-tech.css";
import "./analysis-dashboard.css";
import "./navigation-layout.css";
import "./aurora-preview.css";
import "./aurora-theme.css";
import "./liquid-charts-preview.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SafeMenuEnhancer />
    <BudgetCategoryEnhancer />
    <App />
  </React.StrictMode>,
);
