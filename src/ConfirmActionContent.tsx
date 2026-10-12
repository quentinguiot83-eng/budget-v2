import { useState } from "react";

export default function ConfirmActionContent({ text, run, close }: {
  text: string;
  run: () => Promise<void>;
  close: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="confirm-action-content">
      <p><strong>Êtes-vous sûr ?</strong></p>
      <p>{text}</p>
      <div className="confirm-action-buttons">
        <button type="button" className="secondary" onClick={close} disabled={busy}>Annuler</button>
        <button type="button" className="danger" disabled={busy} onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try { await run(); close(); }
          catch (reason) {
            setError(reason instanceof Error ? reason.message : "L'opération n'a pas abouti.");
            setBusy(false);
          }
        }}>{busy ? "Traitement…" : "Oui, confirmer"}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
