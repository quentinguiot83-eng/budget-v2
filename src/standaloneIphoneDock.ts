/** WebKit may keep a stale compositing layer for position:fixed after scrolling
 * or resuming a standalone PWA. Repaint, but NEVER modify the dock's position. */
export function stableIphoneScreenHeight(
  screenWidth: number,
  screenHeight: number,
  portrait: boolean,
  fallbackHeight: number,
): number {
  const valid = [screenWidth, screenHeight].every(v => Number.isFinite(v) && v >= 300 && v <= 4000);
  if (!valid) return Math.max(1, Math.round(fallbackHeight));
  return Math.round(portrait
    ? Math.max(screenWidth, screenHeight)
    : Math.min(screenWidth, screenHeight));
}

export function keyboardIsVisible(
  focusedInField: boolean,
  visualViewportHeight: number,
  fullHeight: number,
): boolean {
  return focusedInField && Number.isFinite(visualViewportHeight) &&
    fullHeight - visualViewportHeight > 130;
}

const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

export function installStandaloneIphoneDock(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  const iPhone = /iPhone|iPod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!iPhone || !standalone) return () => {};
  const root = document.documentElement;
  root.dataset.wimmStandaloneDock = "1";
  let pendingFrame = 0;
  const delayed = new Set<ReturnType<typeof setTimeout>>();

  /** Recreate the WebKit compositor layer without moving the dock.
   * display:none is removed synchronously before the browser paints. */
  function repaintDock() {
    if (document.visibilityState !== "visible") return;
    for (const selector of [".app .bottom-nav", ".app .floating-add-button"]) {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) continue;
      element.style.setProperty("display", "none", "important");
      void element.offsetHeight;
      element.style.removeProperty("display");
    }
  }

  function refresh() {
    pendingFrame = 0;
    const height = stableIphoneScreenHeight(
      window.screen.width,
      window.screen.height,
      window.matchMedia("(orientation: portrait)").matches,
      window.innerHeight,
    );

    const element = document.activeElement;
    const editing = element instanceof HTMLElement && element.matches(FIELD_SELECTOR);
    const visible = window.visualViewport?.height ?? window.innerHeight;
    root.toggleAttribute("data-wimm-keyboard-open", keyboardIsVisible(editing, visible, height));


  }

  function schedule() {
    if (!pendingFrame) pendingFrame = requestAnimationFrame(refresh);
  }

  function scheduleAfterTransition() {
    schedule();
    for (const ms of [120, 380]) {
      const timer = setTimeout(() => {
        delayed.delete(timer);
        schedule();
        if (!document.documentElement.hasAttribute("data-wimm-keyboard-open")) repaintDock();
      }, ms);
      delayed.add(timer);
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") scheduleAfterTransition();
  }

  for (const event of ["resize", "orientationchange", "pageshow", "focus"]) {
    window.addEventListener(event, scheduleAfterTransition);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  // Rebuild the dock layer only when scrolling ends, not on every scroll frame.
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  function onScrollEnd() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrollTimer = undefined;
      if (!root.hasAttribute("data-wimm-keyboard-open")) repaintDock();
    }, 240);
  }
  window.addEventListener("scroll", onScrollEnd, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("focusin", scheduleAfterTransition);
  document.addEventListener("focusout", scheduleAfterTransition);
  window.visualViewport?.addEventListener("resize", scheduleAfterTransition);
  window.visualViewport?.addEventListener("scroll", schedule);

  scheduleAfterTransition();
  return () => {
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    for (const timer of delayed) clearTimeout(timer);
    for (const event of ["resize", "orientationchange", "pageshow", "focus"]) {
      window.removeEventListener(event, scheduleAfterTransition);
    }
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("scroll", onScrollEnd);
    if (scrollTimer) clearTimeout(scrollTimer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("focusin", scheduleAfterTransition);
    document.removeEventListener("focusout", scheduleAfterTransition);
    window.visualViewport?.removeEventListener("resize", scheduleAfterTransition);
    window.visualViewport?.removeEventListener("scroll", schedule);
    root.removeAttribute("data-wimm-standalone-dock");
    root.removeAttribute("data-wimm-keyboard-open");

  };
}
