import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import NativeFaceIdGate from "./NativeFaceIdGate";
import SafeMenuEnhancer from "./SafeMenuEnhancer";
import BudgetCategoryEnhancer from "./BudgetCategoryEnhancer";
import "./style.css";
import "./soft-tech.css";
import "./analysis-dashboard.css";
import "./navigation-layout.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NativeFaceIdGate>
      <SafeMenuEnhancer />
      <BudgetCategoryEnhancer />
      <App />
    </NativeFaceIdGate>
  </React.StrictMode>,
);
