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
  localStorage.setItem("wimm-appearance-mode", mode);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", surface);
}

export function isInstalledIOS() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
