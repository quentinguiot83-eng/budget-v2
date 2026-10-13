/**
 * Choose the first actually visible selector in the declared priority order.
 * document.querySelector("A, B") follows DOM order, not A-then-B priority.
 * This prevented the old tour from pointing to the described feature.
 */
export function tutorialSelectorPriority(selectors: string): string[] {
  return selectors.split(",").map(s => s.trim()).filter(Boolean);
}
export function findVisibleTourTarget(selectors: string, root: Document = document): HTMLElement | null {
  for (const selector of tutorialSelectorPriority(selectors)) {
    let candidates: NodeListOf<HTMLElement>;
    try { candidates = root.querySelectorAll<HTMLElement>(selector); }
    catch { continue; }
    for (const el of candidates) {
      const bounds = el.getBoundingClientRect();
      if (bounds.width < 8 || bounds.height < 8) continue;
      if (el.hidden || el.closest("[hidden], [aria-hidden='true'], .wimm-tour-v3")) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      return el;
    }
  }
  return null;
}
