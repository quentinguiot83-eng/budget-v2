export type AppearanceMode = "light" | "dark" | "auto";

export function readAppearanceMode(): AppearanceMode {
  const saved = localStorage.getItem("wimm-appearance-mode");
  if (saved === "light" || saved === "dark" || saved === "auto") return saved;
  const legacy = localStorage.getItem("wimm-night-mode");
  return legacy === "1" ? "dark" : legacy === "0" ? "light" : "auto";
}

export function applyAppearance(mode: AppearanceMode) {
  const dark = mode === "dark" || (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  const surface = dark ? "#202331" : "#ffffff";

  root.dataset.mode = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
  root.style.setProperty("--status-bar-background", surface);

  // iOS installed web apps may cache the status-bar tint independently of the
  // CSS theme. Explicitly repaint each visible background on every change:
  // not just the theme-color meta, which iOS may ignore until app relaunch.
  root.style.setProperty("background-color", surface, "important");
  document.body?.style.setProperty("background-color", surface, "important");
  document.getElementById("app-status-bar")?.style.setProperty("background-color", surface, "important");
  document.querySelector<HTMLElement>(".soft-topbar")?.style.setProperty("background-color", surface, "important");

  localStorage.setItem("wimm-appearance-mode", mode);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", surface);
}
