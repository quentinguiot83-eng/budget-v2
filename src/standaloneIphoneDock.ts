/** iOS home-screen PWAs may retain a keyboard-sized layout viewport after resuming.
 * Keep the floating dock anchored to the physical screen until WebKit recovers. */
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

  // Correct any residual WebKit fixed-element compositor drift, without
  // changing the dock's X centering transform or the floating + button.
  function anchor(selector: string, offsetVariable: string) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element || !element.getClientRects().length) return;
    const expected = Number.parseFloat(getComputedStyle(element).top);
    if (!Number.isFinite(expected)) return;
    const actual = element.getBoundingClientRect().top;
    const difference = expected - actual;
    if (Math.abs(difference) < 2) return;
    const previous = Number.parseFloat(element.style.getPropertyValue(offsetVariable)) || 0;
    const correction = Math.max(-1600, Math.min(1600, previous + difference));
    element.style.setProperty(offsetVariable, correction.toFixed(2) + "px");
  }

  function refresh() {
    pendingFrame = 0;
    const height = stableIphoneScreenHeight(
      window.screen.width,
      window.screen.height,
      window.matchMedia("(orientation: portrait)").matches,
      window.innerHeight,
    );
    root.style.setProperty("--wimm-standalone-screen-height", height + "px");

    const element = document.activeElement;
    const editing = element instanceof HTMLElement && element.matches(FIELD_SELECTOR);
    const visible = window.visualViewport?.height ?? window.innerHeight;
    root.toggleAttribute("data-wimm-keyboard-open", keyboardIsVisible(editing, visible, height));

    anchor(".app .bottom-nav", "--wimm-nav-recovery-y");
    anchor(".app .floating-add-button", "--wimm-add-recovery-y");
  }

  function schedule() {
    if (!pendingFrame) pendingFrame = requestAnimationFrame(refresh);
  }

  function scheduleAfterTransition() {
    schedule();
    for (const ms of [100, 350]) {
      const timer = setTimeout(() => { delayed.delete(timer); schedule(); }, ms);
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
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("focusin", scheduleAfterTransition);
    document.removeEventListener("focusout", scheduleAfterTransition);
    window.visualViewport?.removeEventListener("resize", scheduleAfterTransition);
    window.visualViewport?.removeEventListener("scroll", schedule);
    root.removeAttribute("data-wimm-standalone-dock");
    root.removeAttribute("data-wimm-keyboard-open");
    root.style.removeProperty("--wimm-standalone-screen-height");
  };
}
