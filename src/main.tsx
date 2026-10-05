import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import SafeMenuEnhancer from "./SafeMenuEnhancer";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SafeMenuEnhancer />
    <App />
  </React.StrictMode>,
);
