import { useEffect } from "react";

type MenuItemId =
  | "home"
  | "budget"
  | "personal"
  | "add"
  | "wealth"
  | "trips"
  | "pro"
  | "projection"
  | "loans"
  | "settings";

type MenuMeta = {
  id: MenuItemId;
  label: string;
  hideable: boolean;
};

const MENU_ITEMS: MenuMeta[] = [
  { id: "home", label: "Accueil", hideable: false },
  { id: "budget", label: "Budget", hideable: true },
  { id: "personal", label: "Compte perso", hideable: true },
  { id: "add", label: "Ajouter", hideable: true },
  { id: "wealth", label: "Patrimoine", hideable: true },
  { id: "trips", label: "Voyages", hideable: true },
  { id: "pro", label: "Professionnel", hideable: true },
  { id: "projection", label: "Projections", hideable: true },
  { id: "loans", label: "Crédits et prêts", hideable: true },
  { id: "settings", label: "Réglages", hideable: false },
];

const ORDER_KEY = "wimm-menu-order-v1";
const HIDDEN_KEY = "wimm-menu-hidden-v1";
const STYLE_ID = "wimm-menu-enhancer-styles";

function identifyButton(button: HTMLButtonElement): MenuMeta | undefined {
  const text = (button.textContent || "").replace(/\s+/g, " ").trim();
  return MENU_ITEMS.find((item) => text.includes(item.label));
}

function readIds(key: string): MenuItemId[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]") as string[];
    if (!Array.isArray(parsed)) return [];
    const known = new Set(MENU_ITEMS.map((item) => item.id));
    return parsed.filter((id): id is MenuItemId => known.has(id as MenuItemId));
  } catch {
    return [];
  }
}

function readOrder(): MenuItemId[] {
  const saved = readIds(ORDER_KEY);
  const defaults = MENU_ITEMS.filter((item) => item.id !== "settings").map(
    (item) => item.id,
  );

  return [
    ...saved.filter((id) => id !== "settings"),
    ...defaults.filter((id) => !saved.includes(id)),
  ];
}

function readHidden(): Set<MenuItemId> {
  const hideable = new Set(
    MENU_ITEMS.filter((item) => item.hideable).map((item) => item.id),
  );
  return new Set(readIds(HIDDEN_KEY).filter((id) => hideable.has(id)));
}

function writeHidden(hidden: Set<MenuItemId>) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
}

function directMenuButtons(nav: HTMLElement) {
  return Array.from(nav.children).filter(
    (node): node is HTMLButtonElement =>
      node instanceof HTMLButtonElement && !!node.dataset.wimmMenuId,
  );
}

function saveOrder(nav: HTMLElement) {
  const order = directMenuButtons(nav)
    .map((button) => button.dataset.wimmMenuId as MenuItemId)
    .filter((id) => id && id !== "settings");
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

function applySavedOrder(nav: HTMLElement) {
  const order = readOrder();
  const rank = new Map(order.map((id, index) => [id, index]));
  const buttons = directMenuButtons(nav).sort((a, b) => {
    const aId = a.dataset.wimmMenuId as MenuItemId;
    const bId = b.dataset.wimmMenuId as MenuItemId;
    return (rank.get(aId) ?? 999) - (rank.get(bId) ?? 999);
  });
  const hiddenSection = nav.querySelector<HTMLElement>(".wimm-hidden-section");

  for (const button of buttons) {
    nav.insertBefore(button, hiddenSection || null);
  }
}

function ensureControlSpans(button: HTMLButtonElement, meta: MenuMeta) {
  if (!button.querySelector(".wimm-drag-grip")) {
    const grip = document.createElement("span");
    grip.className = "wimm-drag-grip";
    grip.setAttribute("aria-hidden", "true");
    grip.textContent = "⋮⋮";
    button.appendChild(grip);
  }

  if (meta.hideable && !button.querySelector(".wimm-hide-control")) {
    const hide = document.createElement("span");
    hide.className = "wimm-hide-control";
    hide.dataset.wimmAction = "hide";
    hide.setAttribute("role", "button");
    hide.setAttribute("aria-label", `Masquer ${meta.label}`);
    hide.setAttribute("title", `Masquer ${meta.label}`);
    hide.textContent = "−";
    button.appendChild(hide);
  }
}

function ensureEditUi(nav: HTMLElement) {
  if (!nav.querySelector(".wimm-menu-edit-bar")) {
    const bar = document.createElement("div");
    bar.className = "wimm-menu-edit-bar";
    bar.innerHTML = `
      <div class="wimm-menu-edit-copy">
        <strong>Modifier le menu</strong>
        <small>Maintenez un onglet puis faites-le glisser.</small>
      </div>
      <button type="button" class="wimm-menu-edit-done" data-wimm-done="true">Terminé</button>
    `;
    nav.prepend(bar);
  }

  if (!nav.querySelector(".wimm-hidden-section")) {
    const section = document.createElement("div");
    section.className = "wimm-hidden-section";
    nav.appendChild(section);
  }
}

function renderHiddenSection(nav: HTMLElement) {
  const section = nav.querySelector<HTMLElement>(".wimm-hidden-section");
  if (!section) return;

  const hidden = readHidden();
  const available = new Set(
    directMenuButtons(nav).map(
      (button) => button.dataset.wimmMenuId as MenuItemId,
    ),
  );
  const hiddenItems = MENU_ITEMS.filter(
    (item) => item.hideable && hidden.has(item.id) && available.has(item.id),
  );

  section.replaceChildren();

  const title = document.createElement("div");
  title.className = "wimm-hidden-title";
  title.textContent = "Rubriques masquées";
  section.appendChild(title);

  if (!hiddenItems.length) {
    const empty = document.createElement("small");
    empty.className = "wimm-hidden-empty";
    empty.textContent = "Aucune rubrique masquée.";
    section.appendChild(empty);
    return;
  }

  for (const item of hiddenItems) {
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "wimm-restore-item";
    restore.dataset.wimmRestore = item.id;
    restore.innerHTML = `<span>${item.label}</span><small>Afficher</small>`;
    section.appendChild(restore);
  }
}

function enterEditMode(nav: HTMLElement) {
  nav.dataset.wimmEditing = "true";
  renderHiddenSection(nav);
}

function leaveEditMode(nav: HTMLElement) {
  nav.dataset.wimmEditing = "false";
}

function decorateDrawer() {
  const drawer = document.querySelector<HTMLElement>(".mobile-drawer");
  const nav = drawer?.querySelector<HTMLElement>(".mobile-drawer-nav");
  if (!drawer || !nav) return;

  const rawButtons = Array.from(nav.children).filter(
    (node): node is HTMLButtonElement => node instanceof HTMLButtonElement,
  );

  for (const button of rawButtons) {
    if (button.classList.contains("wimm-menu-edit-done")) continue;
    const meta = identifyButton(button);
    if (!meta) continue;
    button.dataset.wimmMenuId = meta.id;
    button.classList.add("wimm-menu-item");
    ensureControlSpans(button, meta);
  }

  const settings = rawButtons.find(
    (button) => button.dataset.wimmMenuId === "settings",
  );
  const footer = drawer.querySelector<HTMLElement>(".mobile-drawer-footer");
  if (settings && footer) {
    settings.classList.add("wimm-footer-settings");
    settings.removeAttribute("data-wimm-menu-id");
    footer.appendChild(settings);
  }

  ensureEditUi(nav);

  const hidden = readHidden();
  for (const button of directMenuButtons(nav)) {
    const id = button.dataset.wimmMenuId as MenuItemId;
    button.classList.toggle("wimm-hidden-item", hidden.has(id));
  }

  applySavedOrder(nav);
  renderHiddenSection(nav);
}

function decorateDesktop() {
  const nav = document.querySelector<HTMLElement>(".sidebar > nav");
  if (nav) {
    const buttons = Array.from(nav.children).filter(
      (node): node is HTMLButtonElement => node instanceof HTMLButtonElement,
    );
    const hidden = readHidden();
    const order = readOrder();
    const rank = new Map(order.map((id, index) => [id, index]));

    for (const button of buttons) {
      const meta = identifyButton(button);
      if (!meta || meta.id === "settings") continue;
      button.dataset.wimmDesktopMenuId = meta.id;
      button.classList.toggle(
        "wimm-desktop-hidden",
        meta.hideable && hidden.has(meta.id),
      );
    }

    buttons
      .filter((button) => !!button.dataset.wimmDesktopMenuId)
      .sort((a, b) => {
        const aId = a.dataset.wimmDesktopMenuId as MenuItemId;
        const bId = b.dataset.wimmDesktopMenuId as MenuItemId;
        return (rank.get(aId) ?? 999) - (rank.get(bId) ?? 999);
      })
      .forEach((button) => nav.appendChild(button));
  }

  const sidebarBottom = document.querySelector<HTMLElement>(".sidebar-bottom");
  const user = sidebarBottom?.querySelector<HTMLElement>(".user-dot");
  const settings = sidebarBottom?.querySelector<HTMLButtonElement>(":scope > button");
  if (sidebarBottom && user && settings) {
    sidebarBottom.appendChild(settings);
  }
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @media (max-width: 780px) {
      .mobile-menu-trigger {
        position: fixed !important;
        top: calc(env(safe-area-inset-top, 0px) + 12px) !important;
        left: 18px !important;
        z-index: 65 !important;
        width: 40px !important;
        height: 40px !important;
        border: 1px solid var(--border) !important;
        background: color-mix(in srgb, var(--surface) 94%, transparent) !important;
        box-shadow: 0 5px 18px rgba(30, 50, 75, 0.10) !important;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .mobile-brand-row {
        padding-left: 52px;
        min-height: 40px;
      }
    }

    .mobile-drawer-nav > button[data-wimm-menu-id] {
      position: relative;
    }

    .mobile-drawer-nav[data-wimm-editing="true"] > button[data-wimm-menu-id] {
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      cursor: grab;
      box-shadow: inset 0 0 0 1px var(--border);
      background: #fff;
    }

    .mobile-drawer-nav[data-wimm-editing="true"] > button[data-wimm-menu-id].wimm-dragging {
      cursor: grabbing;
      z-index: 3;
      background: var(--accent-soft);
      color: var(--accent-deep);
      box-shadow: 0 10px 24px rgba(30, 50, 75, 0.14), inset 0 0 0 1px color-mix(in srgb, var(--accent-deep) 22%, transparent);
      transform: scale(1.015);
    }

    .wimm-drag-grip,
    .wimm-hide-control {
      display: none;
    }

    .mobile-drawer-nav[data-wimm-editing="true"] .wimm-drag-grip {
      display: inline-flex;
      margin-left: auto;
      color: #9aa5b1;
      font-size: 17px;
      letter-spacing: -4px;
      line-height: 1;
      transform: rotate(90deg);
    }

    .mobile-drawer-nav[data-wimm-editing="true"] .wimm-hide-control {
      display: inline-grid;
      place-items: center;
      width: 30px;
      height: 30px;
      flex: 0 0 30px;
      margin-left: 5px;
      border-radius: 10px;
      background: #f7ecee;
      color: #a64b55;
      font-size: 22px;
      font-weight: 500;
      line-height: 1;
    }

    .wimm-menu-edit-bar {
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 8px;
      padding: 10px 8px 12px;
      border-bottom: 1px solid var(--border);
    }

    .mobile-drawer-nav[data-wimm-editing="true"] .wimm-menu-edit-bar {
      display: flex;
    }

    .wimm-menu-edit-copy {
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    .wimm-menu-edit-copy strong {
      font-size: 0.88rem;
      color: var(--ink);
    }

    .wimm-menu-edit-copy small {
      font-size: 0.69rem;
      line-height: 1.25;
    }

    .wimm-menu-edit-done {
      flex: 0 0 auto;
      padding: 8px 11px !important;
      min-height: 34px !important;
      border-radius: 10px !important;
      background: var(--accent-soft) !important;
      color: var(--accent-deep) !important;
      font-size: 0.78rem !important;
      font-weight: 750 !important;
    }

    .wimm-hidden-item,
    .wimm-desktop-hidden {
      display: none !important;
    }

    .wimm-hidden-section {
      display: none;
      margin-top: 10px;
      padding: 15px 8px 4px;
      border-top: 1px solid var(--border);
    }

    .mobile-drawer-nav[data-wimm-editing="true"] .wimm-hidden-section {
      display: grid;
      gap: 7px;
    }

    .wimm-hidden-title {
      margin-bottom: 2px;
      color: var(--muted);
      font-size: 0.69rem;
      font-weight: 750;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .wimm-hidden-empty {
      padding: 5px 0;
    }

    .wimm-restore-item {
      width: 100%;
      min-height: 40px;
      display: flex !important;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 9px 11px !important;
      border-radius: 11px !important;
      background: #f7f9fb !important;
      color: #617083 !important;
      text-align: left;
      font-size: 0.8rem !important;
      font-weight: 650 !important;
    }

    .wimm-restore-item small {
      color: var(--accent-deep);
      font-size: 0.72rem;
      font-weight: 700;
    }

    .mobile-drawer-footer .wimm-footer-settings {
      width: 100%;
      min-height: 46px;
      display: flex;
      align-items: center;
      gap: 13px;
      margin-top: 10px;
      padding: 11px 9px;
      border-radius: 12px;
      color: #536274;
      text-align: left;
      font-weight: 600;
    }

    .mobile-drawer-footer .wimm-footer-settings:hover,
    .mobile-drawer-footer .wimm-footer-settings.active {
      background: var(--accent-soft);
      color: var(--accent-deep);
    }

    .mobile-drawer-footer .wimm-footer-settings svg {
      width: 20px;
      height: 20px;
      stroke-width: 1.8;
    }

    .sidebar-bottom {
      display: flex;
      flex-direction: column;
    }

    .sidebar-bottom > .user-dot {
      order: 1;
    }

    .sidebar-bottom > button {
      order: 2;
      width: 100%;
      margin-top: 8px;
      border-radius: 10px;
    }
  `;
  document.head.appendChild(style);
}

export default function MenuEnhancer() {
  useEffect(() => {
    installStyles();

    let applying = false;
    let pressTimer: number | null = null;
    let pressedButton: HTMLButtonElement | null = null;
    let pressedNav: HTMLElement | null = null;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let suppressClickUntil = 0;

    const apply = () => {
      if (applying) return;
      applying = true;
      try {
        decorateDrawer();
        decorateDesktop();
      } finally {
        applying = false;
      }
    };

    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true });
    apply();

    const clearPress = () => {
      if (pressTimer !== null) {
        window.clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const endDrag = () => {
      clearPress();
      if (dragging && pressedButton && pressedNav) {
        pressedButton.classList.remove("wimm-dragging");
        saveOrder(pressedNav);
        applySavedOrder(pressedNav);
        decorateDesktop();
        suppressClickUntil = Date.now() + 550;
      }
      dragging = false;
      pressedButton = null;
      pressedNav = null;
      pointerId = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType !== "touch") return;
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("[data-wimm-action], [data-wimm-done], [data-wimm-restore]")) {
        return;
      }

      const button = target.closest<HTMLButtonElement>(
        ".mobile-drawer-nav > button[data-wimm-menu-id]",
      );
      const nav = button?.closest<HTMLElement>(".mobile-drawer-nav");
      if (!button || !nav) return;

      clearPress();
      pressedButton = button;
      pressedNav = nav;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      dragging = false;

      pressTimer = window.setTimeout(() => {
        if (!pressedButton || !pressedNav) return;
        enterEditMode(pressedNav);
        pressedButton.classList.add("wimm-dragging");
        dragging = true;
        suppressClickUntil = Date.now() + 900;
      }, 430);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId || !pressedButton || !pressedNav) {
        return;
      }

      if (!dragging) {
        const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
        if (distance > 11) {
          clearPress();
          pressedButton = null;
          pressedNav = null;
          pointerId = null;
        }
        return;
      }

      event.preventDefault();
      const underPointer = document.elementFromPoint(event.clientX, event.clientY);
      const targetButton = underPointer?.closest<HTMLButtonElement>(
        ".mobile-drawer-nav > button[data-wimm-menu-id]",
      );

      if (!targetButton || targetButton === pressedButton) return;
      if (targetButton.closest(".mobile-drawer-nav") !== pressedNav) return;
      if (targetButton.classList.contains("wimm-hidden-item")) return;

      const rect = targetButton.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        pressedNav.insertBefore(pressedButton, targetButton);
      } else {
        pressedNav.insertBefore(pressedButton, targetButton.nextSibling);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId !== null && event.pointerId === pointerId) endDrag();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (pointerId !== null && event.pointerId === pointerId) endDrag();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const hide = target.closest<HTMLElement>("[data-wimm-action='hide']");
      if (hide) {
        event.preventDefault();
        event.stopPropagation();
        const button = hide.closest<HTMLButtonElement>("button[data-wimm-menu-id]");
        const nav = button?.closest<HTMLElement>(".mobile-drawer-nav");
        const id = button?.dataset.wimmMenuId as MenuItemId | undefined;
        if (!button || !nav || !id) return;
        const hidden = readHidden();
        hidden.add(id);
        writeHidden(hidden);
        button.classList.add("wimm-hidden-item");
        renderHiddenSection(nav);
        decorateDesktop();
        return;
      }

      const restore = target.closest<HTMLButtonElement>("[data-wimm-restore]");
      if (restore) {
        event.preventDefault();
        event.stopPropagation();
        const id = restore.dataset.wimmRestore as MenuItemId | undefined;
        const nav = restore.closest<HTMLElement>(".mobile-drawer-nav");
        if (!id || !nav) return;
        const hidden = readHidden();
        hidden.delete(id);
        writeHidden(hidden);
        nav
          .querySelector<HTMLButtonElement>(`button[data-wimm-menu-id="${id}"]`)
          ?.classList.remove("wimm-hidden-item");
        renderHiddenSection(nav);
        applySavedOrder(nav);
        decorateDesktop();
        return;
      }

      const done = target.closest<HTMLElement>("[data-wimm-done]");
      if (done) {
        event.preventDefault();
        event.stopPropagation();
        const nav = done.closest<HTMLElement>(".mobile-drawer-nav");
        if (nav) leaveEditMode(nav);
        return;
      }

      const menuButton = target.closest<HTMLButtonElement>(
        ".mobile-drawer-nav > button[data-wimm-menu-id]",
      );
      const nav = menuButton?.closest<HTMLElement>(".mobile-drawer-nav");
      if (
        menuButton &&
        nav &&
        (nav.dataset.wimmEditing === "true" || Date.now() < suppressClickUntil)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, {
      capture: true,
      passive: false,
    });
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    document.addEventListener("click", onClick, true);

    return () => {
      observer.disconnect();
      clearPress();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("click", onClick, true);
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  return null;
}
