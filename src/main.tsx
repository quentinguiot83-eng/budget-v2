import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ProShell from "./ProShell";
import ProSettingsBridge from "./ProSettingsBridge";
import "./style.css";
import "./pro-v2.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <ProShell />
    <ProSettingsBridge />
  </React.StrictMode>,
);
