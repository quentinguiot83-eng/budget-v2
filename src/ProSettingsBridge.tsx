import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, rpc } from "./api";

type ProStatus = {
  enabled: boolean;
  profileConfigured: boolean;
};

export default function ProSettingsBridge() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const { data } = await api.auth.getSession();
      if (!data.session || cancelled) return;

      try {
        const status = (await rpc("budget_pro_status")) as ProStatus;
        if (!cancelled) setEnabled(status.enabled);
      } catch {
        // Le module Pro peut ne pas être installé sur un ancien environnement.
      }
    }

    void refresh();

    const { data: listener } = api.auth.onAuthStateChange((_event, session) => {
      if (session) void refresh();
      else setEnabled(false);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const syncDom = () => {
      document
        .querySelectorAll<HTMLButtonElement>(
          ".sidebar nav button, .mobile-drawer-nav button",
        )
        .forEach((button) => {
          if (button.textContent?.trim() === "Modules") {
            button.style.display = "none";
            button.setAttribute("aria-hidden", "true");
            button.tabIndex = -1;
          }
        });

      const modulesCard = Array.from(
        document.querySelectorAll<HTMLElement>(".content section.card"),
      ).find(
        (card) =>
          card.querySelector("h2")?.textContent?.trim() === "Modules affichés",
      );

      setTarget((current) =>
        current === modulesCard ? current : modulesCard ?? null,
      );
    };

    syncDom();
    const observer = new MutationObserver(syncDom);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      await rpc("budget_pro_toggle", { p_enabled: next });
      setEnabled(next);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (!target) return null;

  return createPortal(
    <label className="toggle">
      <input
        type="checkbox"
        checked={enabled}
        disabled={busy}
        onChange={(event) => void toggle(event.target.checked)}
      />
      Professionnel
    </label>,
    target,
  );
}
