export function applyAppearance(dark: boolean) {
  const root = document.documentElement;
  const surface = dark ? "#202331" : "#ffffff";
  root.dataset.mode = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
  root.style.setProperty("--status-bar-background", surface);
  localStorage.setItem("wimm-night-mode", dark ? "1" : "0");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", surface);
}

export function isInstalledIOS() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
