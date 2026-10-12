import { useState } from "react";
import { ArchiveRestore, ChevronRight, History, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { rpc } from "./api";

type Scope = "household" | "personal";
type Version = {
  revision: number;
  savedAt: string;
  transactions: number;
  accounts: number;
  trips?: number;
  current: boolean;
};
type Choice = { scope: Scope; version: Version };
type Props = {
  householdRevision: number;
  personalRevision: number | null;
  isOwner: boolean;
  demo: boolean;
  onRestored: () => Promise<void>;
};

export default function VersionHistoryPanel({
  householdRevision, personalRevision, isOwner, demo, onRestored,
}: Props) {
  const [versions, setVersions] = useState<Record<Scope, Version[]>>({ household: [], personal: [] });
  const [loaded, setLoaded] = useState<Record<Scope, boolean>>({ household: false, personal: false });
  const [loading, setLoading] = useState<Scope | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function fetchVersions(scope: Scope) {
    if (demo) return;
    setLoading(scope);
    setError("");
    try {
      const incoming = await rpc("budget_history_list", { p_scope: scope }) as Version[];
      if (!Array.isArray(incoming)) throw Error("L’historique reçu est invalide.");
      setVersions(before => ({ ...before, [scope]: incoming }));
      setLoaded(before => ({ ...before, [scope]: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger l’historique.");
    } finally {
      setLoading(null);
    }
  }

  async function restore() {
    if (!choice || restoring || confirmation !== "RESTAURER") return;
    if (choice.scope === "household" && !isOwner) {
      setError("Seul le propriétaire du foyer peut restaurer ces données.");
      return;
    }
    if (demo) return;
    setRestoring(true);
    setError("");
    try {
      await rpc("budget_history_restore", {
        p_scope: choice.scope,
        p_revision: choice.version.revision,
        p_expected_revision: choice.scope === "household" ? householdRevision : personalRevision,
        p_confirmation: confirmation,
      });
      setChoice(null);
      setConfirmation("");
      await onRestored();
      await fetchVersions(choice.scope);
      setNotice("La version a été restaurée. L’état précédent a été conservé dans l’historique.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "La restauration a échoué.");
    } finally {
      setRestoring(false);
    }
  }

  const blocks: { scope: Scope; name: string; explanation: string }[] = [
    { scope: "household", name: "Historique du foyer", explanation: "Versions communes · restauration réservée au propriétaire" },
    { scope: "personal", name: "Historique privé", explanation: "Vos données personnelles uniquement" },
  ];

  return (
    <section className="wimm-history" aria-label="Historique et restauration">
      <div className="wimm-history-title">
        <span className="wimm-security-symbol"><History size={22}/></span>
        <div>
          <h3>Historique et restauration</h3>
          <p>Les versions sont enregistrées automatiquement après chaque modification, sans action de votre part.</p>
        </div>
      </div>
      {blocks.map(({ scope, name, explanation }) => {
        const available = scope === "household" || personalRevision !== null;
        const currentRevision = scope === "household" ? householdRevision : personalRevision;
        const canRestore = available && (scope === "personal" || isOwner);
        return (
          <details className="wimm-history-group" key={scope} onToggle={e => {
            if (e.currentTarget.open && available && !loaded[scope]) void fetchVersions(scope);
          }}>
            <summary>
              <span className="wimm-history-icon">{scope === "household" ? <ShieldCheck size={20}/> : <LockKeyhole size={20}/>}</span>
              <span className="wimm-history-caption"><strong>{name}</strong><small>{explanation}</small></span>
              <ChevronRight size={18}/>
            </summary>
            <div className="wimm-history-items">
              {demo ? <p className="muted">Les sauvegardes automatiques ne sont pas disponibles en mode démonstration.</p> :
                !available ? <p className="muted">Le compte privé n’est pas encore disponible.</p> :
                <>
                  <button type="button" className="wimm-history-refresh" disabled={loading === scope || restoring}
                    onClick={() => void fetchVersions(scope)}><RefreshCw size={14}/> Actualiser l’historique</button>
                  {loading === scope && <p className="muted">Chargement des versions…</p>}
                  {!loading && loaded[scope] && !versions[scope].length && <p className="muted">Aucune version enregistrée.</p>}
                  {versions[scope].map(v => (
                    <div className="wimm-history-version" key={v.revision}>
                      <div className="wimm-history-version-copy">
                        <strong>Version {v.revision}{v.revision === currentRevision ? " · Actuelle" : ""}</strong>
                        <small>{new Date(v.savedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</small>
                        <small>{v.transactions} opération{v.transactions > 1 ? "s" : ""}
                          {scope === "household" ? " · " + v.accounts + " comptes · " + (v.trips || 0) + " voyages" : ""}
                        </small>
                      </div>
                      {v.revision !== currentRevision && (
                        <button type="button" className="wimm-history-pick"
                          disabled={!canRestore || restoring}
                          onClick={() => { setChoice({ scope, version: v }); setConfirmation(""); setError(""); setNotice(""); }}>
                          <ArchiveRestore size={15}/> Restaurer
                        </button>
                      )}
                    </div>
                  ))}
                  {!canRestore && scope === "household" && <p className="wimm-history-note">Seul le propriétaire peut restaurer une ancienne version commune.</p>}
                </>}
            </div>
          </details>
        );
      })}
      {choice && (
        <div className="wimm-history-confirm" role="group" aria-label="Confirmation de restauration">
          <strong>Restaurer la version {choice.version.revision} ?</strong>
          <p>
            {choice.scope === "household" ? "Tout le budget partagé du foyer" : "Votre compte personnel"}
            {" "}sera remplacé par son état du {new Date(choice.version.savedAt).toLocaleString("fr-FR")}.
            Les modifications effectuées depuis seront annulées dans cet espace.
            L’état actuel restera récupérable depuis l’historique.
          </p>
          <p>Cette restauration concerne <strong>{choice.version.transactions} opération(s)</strong>.
            {choice.scope === "household" ? " Elle peut modifier des virements liés à l’espace professionnel." : ""}
          </p>
          <label htmlFor="wimm-history-confirmation">Saisissez <strong>RESTAURER</strong> pour confirmer</label>
          <input id="wimm-history-confirmation" type="text" autoComplete="off"
            value={confirmation} onChange={e => setConfirmation(e.target.value)}
            placeholder="RESTAURER" disabled={restoring}/>
          <div className="wimm-history-confirm-actions">
            <button type="button" className="secondary" disabled={restoring}
              onClick={() => { setChoice(null); setConfirmation(""); }}>Annuler</button>
            <button type="button" className="danger" disabled={restoring || confirmation !== "RESTAURER"}
              onClick={() => void restore()}>
              {restoring ? "Restauration…" : "Confirmer la restauration"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="wimm-security-success" role="status">{notice}</p>}
      <p className="wimm-history-note">Une restauration ne réimporte pas les photos ni les fichiers externes. L’historique Pro et les factures ne sont pas encore couverts par ce mécanisme.</p>
    </section>
  );
}
