import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import MenuEnhancer from "./MenuEnhancer";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MenuEnhancer />
    <App />
  </React.StrictMode>,
);
