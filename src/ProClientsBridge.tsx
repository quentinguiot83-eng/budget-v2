import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, UserRound, X } from "lucide-react";
import { api, rpc } from "./api";

type ProClient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
};

type ProData = {
  enabled: boolean;
  clients?: ProClient[];
};

export default function ProClientsBridge() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<ProData | null>(null);
  const [editing, setEditing] = useState<ProClient | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const fingerprint = useRef("");

  useEffect(() => {
    const sync = () => {
      const card = Array.from(document.querySelectorAll<HTMLElement>(".pro-card")).find(
        (item) => item.querySelector("h2")?.textContent?.trim() === "Clients",
      );

      if (card) {
        card.querySelectorAll<HTMLElement>(".pro-list-row").forEach((row) => {
          row.style.display = "none";
        });
      }

      setTarget((current) => (current === card ? current : card ?? null));

      const nextFingerprint = card
        ? Array.from(card.querySelectorAll<HTMLElement>(".pro-list-row"))
            .map((row) => row.textContent?.replace(/\s+/g, " ").trim() ?? "")
            .join("||")
        : "";

      if (fingerprint.current && fingerprint.current !== nextFingerprint) {
        setRefreshVersion((version) => version + 1);
      }
      fingerprint.current = nextFingerprint;
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;

    async function load() {
      const { data: session } = await api.auth.getSession();
      if (!session.session || cancelled) return;
      try {
        const next = (await rpc("budget_pro_load")) as ProData;
        if (!cancelled) {
          setData(next);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [target, refreshVersion]);

  if (!target || !data?.enabled) return null;

  const clients = data.clients ?? [];

  return createPortal(
    <>
      <div className="pro-client-manager">
        {error && <div className="pro-error">{error}</div>}
        {clients.length ? (
          clients.map((client) => (
            <div className="pro-client-manager-row" key={client.id}>
              <span className="pro-avatar"><UserRound size={17} /></span>
              <div className="pro-client-manager-main">
                <strong>{client.name}</strong>
                <small>{client.email || client.phone || "Aucune coordonnée"}</small>
              </div>
              <button
                type="button"
                className="pro-client-action"
                aria-label={`Modifier ${client.name}`}
                disabled={busy}
                onClick={() => setEditing(client)}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                className="pro-delete"
                aria-label={`Supprimer ${client.name}`}
                disabled={busy}
                onClick={() => void removeClient(client)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        ) : (
          <p className="pro-muted">Aucun client enregistré.</p>
        )}
      </div>

      {editing && (
        <ClientEditModal
          client={editing}
          busy={busy}
          close={() => setEditing(null)}
          submit={saveClient}
        />
      )}
    </>,
    target,
  );

  async function saveClient(client: ProClient) {
    setBusy(true);
    setError("");
    try {
      const next = (await rpc("budget_pro_client_save", { p_client: client })) as ProData;
      setData(next);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeClient(client: ProClient) {
    if (!confirm(`Supprimer le client « ${client.name} » ?`)) return;
    setBusy(true);
    setError("");
    try {
      const next = (await rpc("budget_pro_client_delete", { p_id: client.id })) as ProData;
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
}

function ClientEditModal({
  client,
  busy,
  close,
  submit,
}: {
  client: ProClient;
  busy: boolean;
  close: () => void;
  submit: (client: ProClient) => Promise<void>;
}) {
  const [value, setValue] = useState<ProClient>(client);

  return (
    <div className="pro-modal-layer">
      <button type="button" className="pro-modal-backdrop" aria-label="Fermer" onClick={close} />
      <section className="pro-modal">
        <button type="button" className="pro-modal-close" onClick={close} aria-label="Fermer">
          <X size={20} />
        </button>
        <form
          className="pro-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(value);
          }}
        >
          <div>
            <p className="pro-eyebrow">CLIENT</p>
            <h2>Modifier le client</h2>
          </div>
          <label>
            Nom
            <input required value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} />
          </label>
          <div className="pro-form-two">
            <label>
              E-mail
              <input type="email" value={value.email} onChange={(e) => setValue({ ...value, email: e.target.value })} />
            </label>
            <label>
              Téléphone
              <input value={value.phone} onChange={(e) => setValue({ ...value, phone: e.target.value })} />
            </label>
          </div>
          <label>
            Notes
            <textarea rows={3} value={value.notes} onChange={(e) => setValue({ ...value, notes: e.target.value })} />
          </label>
          <button className="pro-primary" type="submit" disabled={busy}>Enregistrer les modifications</button>
        </form>
      </section>
    </div>
  );
}
