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
        // La rubrique Professionnel peut ne pas être disponible sur un ancien environnement.
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
    const syncTarget = () => {
      const displayCard = Array.from(
        document.querySelectorAll<HTMLElement>(".content section.card"),
      ).find((card) => {
        const title = card.querySelector("h2")?.textContent?.trim();
        return title === "Modules affichés" || title === "Rubriques affichées";
      });

      setTarget((current) =>
        current === displayCard ? current : displayCard ?? null,
      );
    };

    syncTarget();

    const observer = new MutationObserver(syncTarget);
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
