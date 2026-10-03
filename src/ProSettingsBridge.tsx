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
    const placeProfessionalBeforeProjections = (selector: string) => {
      const nav = document.querySelector<HTMLElement>(selector);
      if (!nav) return;

      const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>("button"));
      const professional = buttons.find(
        (button) => button.textContent?.trim() === "Professionnel",
      );
      const projections = buttons.find(
        (button) => button.textContent?.trim() === "Projections",
      );

      if (
        professional &&
        projections &&
        professional.nextElementSibling !== projections
      ) {
        nav.insertBefore(professional, projections);
      }
    };

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

      placeProfessionalBeforeProjections(".sidebar nav");
      placeProfessionalBeforeProjections(".mobile-drawer-nav");

      const proLabel = document.querySelector<HTMLElement>(
        ".prosuite-topbar small",
      );
      if (proLabel && proLabel.textContent?.trim() === "WIMM PRO") {
        proLabel.textContent = "PROFESSIONNEL";
      }

      const displayCard = Array.from(
        document.querySelectorAll<HTMLElement>(".content section.card"),
      ).find((card) => {
        const title = card.querySelector("h2")?.textContent?.trim();
        return title === "Modules affichés" || title === "Rubriques affichées";
      });

      if (displayCard) {
        const heading = displayCard.querySelector("h2");
        const description = displayCard.querySelector<HTMLElement>("p.muted");

        if (heading && heading.textContent !== "Rubriques affichées") {
          heading.textContent = "Rubriques affichées";
        }

        if (description) {
          description.textContent =
            "Affichez ou masquez les rubriques facultatives. Masquer une rubrique conserve toutes ses données.";
        }
      }

      setTarget((current) =>
        current === displayCard ? current : displayCard ?? null,
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
