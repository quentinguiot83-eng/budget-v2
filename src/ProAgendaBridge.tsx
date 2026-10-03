import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { rpc } from "./api";
import "./pro-agenda-bridge.css";

type EventItem = {
  id: string;
  title: string;
  eventType: string;
  startsAt: string;
};

type Suite = {
  events?: EventItem[];
};

export default function ProAgendaBridge() {
  const [target, setTarget] = useState<HTMLFormElement | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const reopenAgenda = () => {
      if (sessionStorage.getItem("wimm-pro-open-agenda") !== "1") return false;

      const agendaButton = Array.from(
        document.querySelectorAll<HTMLButtonElement>(".prosuite-nav button"),
      ).find((button) => button.textContent?.trim() === "Agenda");

      if (!agendaButton) return false;

      sessionStorage.removeItem("wimm-pro-open-agenda");
      agendaButton.click();
      return true;
    };

    if (reopenAgenda()) return;

    const observer = new MutationObserver(() => {
      if (reopenAgenda()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = window.setTimeout(() => observer.disconnect(), 6000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let lookup = 0;

    const sync = () => {
      const forms = Array.from(
        document.querySelectorAll<HTMLFormElement>(".prosuite-modal form.prosuite-form"),
      );

      const form = forms.find(
        (candidate) =>
          candidate.querySelector(".prosuite-formtitle h2")?.textContent?.trim() ===
          "Modifier l’événement",
      );

      if (!form) {
        setTarget(null);
        setEvent(null);
        return;
      }

      setTarget(form);
      const currentLookup = ++lookup;

      const titleInput = form.querySelector<HTMLInputElement>(
        'input[required]:not([type="datetime-local"])',
      );
      const startInput = form.querySelector<HTMLInputElement>(
        'input[type="datetime-local"]',
      );

      if (!titleInput || !startInput) return;

      void (async () => {
        try {
          const suite = (await rpc("budget_pro_suite_load")) as Suite;
          if (cancelled || currentLookup !== lookup) return;

          const match = (suite.events ?? []).find(
            (item) =>
              item.title === titleInput.value &&
              item.startsAt.slice(0, 16) === startInput.value.slice(0, 16),
          );

          setEvent(match ?? null);
        } catch {
          if (!cancelled && currentLookup === lookup) setEvent(null);
        }
      })();
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  async function removeEvent() {
    if (!event || busy) return;
    if (!window.confirm(`Supprimer « ${event.title} » ?`)) return;

    setBusy(true);
    try {
      await rpc("budget_pro_event_delete", { p_id: event.id });
      sessionStorage.setItem("wimm-pro-reopen", "1");
      sessionStorage.setItem("wimm-pro-open-agenda", "1");
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (!target || !event) return null;

  return createPortal(
    <button
      type="button"
      className="prosuite-event-delete"
      disabled={busy}
      onClick={() => void removeEvent()}
    >
      <Trash2 size={16} />
      {busy
        ? "Suppression…"
        : event.eventType === "appointment"
          ? "Supprimer le rendez-vous"
          : "Supprimer l’événement"}
    </button>,
    target,
  );
}
