import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ProWorkspace from "./ProWorkspace";
import ProSettingsBridge from "./ProSettingsBridge";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <ProWorkspace />
    <ProSettingsBridge />
  </React.StrictMode>,
);
