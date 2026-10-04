import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ProBusinessBridge from "./ProBusinessBridge";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <ProBusinessBridge />
  </React.StrictMode>,
);
