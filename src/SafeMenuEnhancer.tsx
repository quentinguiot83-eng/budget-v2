import { useEffect } from "react";

type MenuId = "home" | "budget" | "personal" | "add" | "wealth" | "trips" | "pro" | "projection" | "loans";

const ITEMS: { id: MenuId; label: string; hideable: boolean }[] = [
  { id: "home", label: "Accueil", hideable: false },
  { id: "budget", label: "Budget", hideable: true },
  { id: "personal", label: "Compte perso", hideable: true },
  { id: "add", label: "Ajouter", hideable: true },
  { id: "wealth", label: "Patrimoine", hideable: true },
  { id: "trips", label: "Voyages", hideable: true },
  { id: "pro", label: "Professionnel", hideable: true },
  { id: "projection", label: "Projections", hideable: true },
  { id: "loans", label: "Crédits et prêts", hideable: true },
];
const ORDER = "wimm-menu-order-v2";
const HIDDEN = "wimm-menu-hidden-v2";
const STYLE = "wimm-safe-menu-style";

function readList(key: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function identify(button: HTMLButtonElement) {
  const text = (button.textContent || "").replace(/\s+/g, " ").trim();
  return ITEMS.find(i => text.includes(i.label));
}
function hiddenSet() { return new Set(readList(HIDDEN)); }
function saveOrder(nav: HTMLElement) {
  const ids = Array.from(nav.querySelectorAll<HTMLButtonElement>(":scope > button[data-wimm-id]"))
    .map(b => b.dataset.wimmId).filter(Boolean);
  localStorage.setItem(ORDER, JSON.stringify(ids));
}
function renderHidden(nav: HTMLElement) {
  const box = nav.querySelector<HTMLElement>(".wimm-hidden-box");
  if (!box) return;
  const hidden = hiddenSet();
  const available = new Set(Array.from(nav.querySelectorAll<HTMLButtonElement>(":scope > button[data-wimm-id]")).map(b => b.dataset.wimmId));
  box.replaceChildren();
  const title = document.createElement("div"); title.className = "wimm-hidden-title"; title.textContent = "Rubriques masquées"; box.appendChild(title);
  const rows = ITEMS.filter(i => i.hideable && hidden.has(i.id) && available.has(i.id));
  if (!rows.length) { const e = document.createElement("small"); e.textContent = "Aucune rubrique masquée"; box.appendChild(e); return; }
  rows.forEach(i => { const b = document.createElement("button"); b.type = "button"; b.className = "wimm-restore"; b.dataset.restore = i.id; b.innerHTML = `<span>${i.label}</span><small>Afficher</small>`; box.appendChild(b); });
}
function decorate() {
  try {
    const drawer = document.querySelector<HTMLElement>(".mobile-drawer");
    const nav = drawer?.querySelector<HTMLElement>(".mobile-drawer-nav");
    if (!drawer || !nav || nav.dataset.wimmReady === "1") return;
    nav.dataset.wimmReady = "1";
    const buttons = Array.from(nav.children).filter((x): x is HTMLButtonElement => x instanceof HTMLButtonElement);
    const footer = drawer.querySelector<HTMLElement>(".mobile-drawer-footer");
    buttons.forEach(b => {
      const meta = identify(b); if (!meta) return;
      if (meta.label === "Réglages") return;
      b.dataset.wimmId = meta.id;
      const grip = document.createElement("span"); grip.className = "wimm-grip"; grip.textContent = "☰"; b.appendChild(grip);
      if (meta.hideable) { const hide = document.createElement("span"); hide.className = "wimm-hide"; hide.dataset.hide = meta.id; hide.textContent = "−"; b.appendChild(hide); }
    });
    const settings = buttons.find(b => (b.textContent || "").includes("Réglages"));
    if (settings && footer) { settings.classList.add("wimm-settings-bottom"); footer.appendChild(settings); }
    const edit = document.createElement("div"); edit.className = "wimm-edit-head"; edit.innerHTML = `<strong>Modifier le menu</strong><button type="button" data-done="1">Terminé</button>`; nav.prepend(edit);
    const hiddenBox = document.createElement("div"); hiddenBox.className = "wimm-hidden-box"; nav.appendChild(hiddenBox);
    const saved = readList(ORDER); const rank = new Map(saved.map((id, n) => [id, n]));
    const menuButtons = Array.from(nav.querySelectorAll<HTMLButtonElement>(":scope > button[data-wimm-id]"));
    menuButtons.sort((a,b) => (rank.get(a.dataset.wimmId || "") ?? 999) - (rank.get(b.dataset.wimmId || "") ?? 999)).forEach(b => nav.insertBefore(b, hiddenBox));
    const hidden = hiddenSet(); menuButtons.forEach(b => b.classList.toggle("wimm-is-hidden", hidden.has(b.dataset.wimmId || "")));
    renderHidden(nav);
  } catch (e) { console.warn("Wimm menu enhancement skipped", e); }
}

export default function SafeMenuEnhancer() {
  useEffect(() => {
    if (!document.getElementById(STYLE)) {
      const s = document.createElement("style"); s.id = STYLE; s.textContent = `
      @media(max-width:850px){.topbar{position:sticky;top:0;z-index:45;background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}.mobile-menu-trigger{position:relative;z-index:46}}
      .wimm-edit-head,.wimm-hidden-box,.wimm-grip,.wimm-hide{display:none}.mobile-drawer-nav[data-edit="1"] .wimm-edit-head{display:flex;align-items:center;justify-content:space-between;padding:8px 6px 12px;border-bottom:1px solid var(--border);margin-bottom:5px}.wimm-edit-head button{padding:8px 10px;border-radius:10px;background:var(--accent-soft);color:var(--accent-deep);font-weight:700}.mobile-drawer-nav[data-edit="1"]>button[data-wimm-id]{touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:inset 0 0 0 1px var(--border)}.mobile-drawer-nav[data-edit="1"] .wimm-grip{display:inline-flex;margin-left:auto;color:#98a3af}.mobile-drawer-nav[data-edit="1"] .wimm-hide{display:inline-grid;place-items:center;width:29px;height:29px;margin-left:7px;border-radius:9px;background:#f8ecee;color:#a64b55;font-size:20px}.wimm-is-hidden{display:none!important}.mobile-drawer-nav[data-edit="1"] .wimm-hidden-box{display:grid;gap:6px;margin-top:10px;padding:13px 6px 0;border-top:1px solid var(--border)}.wimm-hidden-title{font-size:.68rem;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.wimm-restore{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:10px 11px!important;border-radius:10px!important;background:#f7f9fb!important;color:#617083!important}.wimm-settings-bottom{width:100%;display:flex;align-items:center;gap:13px;padding:13px 9px;margin-top:10px;border-radius:11px;color:#536274;font-weight:600}.mobile-drawer-footer{display:flex;flex-direction:column}.mobile-drawer-footer .user-dot{order:1}.mobile-drawer-footer .wimm-settings-bottom{order:2}.sidebar-bottom{display:flex;flex-direction:column}.sidebar-bottom .user-dot{order:1}.sidebar-bottom>button{order:2}
      `; document.head.appendChild(s);
    }
    let hold: number | undefined; let dragging: HTMLButtonElement | null = null;
    const down = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const item = target.closest<HTMLButtonElement>(".mobile-drawer-nav > button[data-wimm-id]");
      const nav = item?.parentElement as HTMLElement | null;
      if (!item || !nav) return;
      if (nav.dataset.edit === "1") { dragging = item; item.setPointerCapture?.(e.pointerId); return; }
      hold = window.setTimeout(() => { nav.dataset.edit = "1"; renderHidden(nav); if (navigator.vibrate) navigator.vibrate(25); }, 520);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return; e.preventDefault();
      const nav = dragging.parentElement as HTMLElement; const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLButtonElement>("button[data-wimm-id]");
      if (el && el !== dragging && el.parentElement === nav) { const r = el.getBoundingClientRect(); nav.insertBefore(dragging, e.clientY < r.top + r.height/2 ? el : el.nextSibling); }
    };
    const up = () => { if (hold) clearTimeout(hold); hold = undefined; if (dragging) { const nav = dragging.parentElement as HTMLElement; saveOrder(nav); dragging = null; } };
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".mobile-menu-trigger")) { window.setTimeout(decorate, 40); return; }
      const nav = t.closest<HTMLElement>(".mobile-drawer-nav"); if (!nav) return;
      const done = t.closest<HTMLElement>("[data-done]"); if (done) { e.preventDefault(); e.stopPropagation(); nav.dataset.edit = "0"; return; }
      const hide = t.closest<HTMLElement>("[data-hide]"); if (hide) { e.preventDefault(); e.stopPropagation(); const id = hide.dataset.hide!; const set = hiddenSet(); set.add(id); localStorage.setItem(HIDDEN, JSON.stringify([...set])); nav.querySelector<HTMLButtonElement>(`button[data-wimm-id="${id}"]`)?.classList.add("wimm-is-hidden"); renderHidden(nav); return; }
      const restore = t.closest<HTMLElement>("[data-restore]"); if (restore) { e.preventDefault(); e.stopPropagation(); const id = restore.dataset.restore!; const set = hiddenSet(); set.delete(id); localStorage.setItem(HIDDEN, JSON.stringify([...set])); nav.querySelector<HTMLButtonElement>(`button[data-wimm-id="${id}"]`)?.classList.remove("wimm-is-hidden"); renderHidden(nav); return; }
      if (nav.dataset.edit === "1" && t.closest("button[data-wimm-id]")) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener("pointerdown", down); document.addEventListener("pointermove", move, { passive:false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up); document.addEventListener("click", click, true);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); document.removeEventListener("click", click, true); if (hold) clearTimeout(hold); };
  }, []);
  return null;
}
