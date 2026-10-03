import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ProShell from "./ProShell";
import ProSettingsBridge from "./ProSettingsBridge";
import ProContributionsBridge from "./ProContributionsBridge";
import ProClientsBridge from "./ProClientsBridge";
import "./style.css";
import "./pro-v2.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <ProShell />
    <ProSettingsBridge />
    <ProContributionsBridge />
    <ProClientsBridge />
  </React.StrictMode>,
);
