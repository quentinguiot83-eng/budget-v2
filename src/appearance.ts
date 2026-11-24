export type AppearanceMode = "light" | "dark" | "auto";

// L'apparence n'est plus réglable : Wimm reste en mode clair.
export function readAppearanceMode(): AppearanceMode {
  return "light";
}

export function applyAppearance(mode: AppearanceMode) {
  const dark = mode === "dark" || (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  const surface = dark ? "#0c1215" : "#ffffff";
  root.dataset.mode = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
  root.style.setProperty("--status-bar-background", surface);
  localStorage.setItem("wimm-appearance-mode", mode);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", surface);
}

