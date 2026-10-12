import { useState } from "react";
import { Download, FileCheck2, FileJson, FileSpreadsheet, Info, LockKeyhole, ShieldCheck, ArchiveRestore, BriefcaseBusiness } from "lucide-react";
import type { State } from "./engine";
import type { PersonalState } from "./personal";
import { createIntegrityExport, sendFile, verifyIntegrityExport, type VerifiedBackup, MAX_BACKUP_SIZE } from "./secureExport";
import { inspectRestoreCandidate, restorePreviewCounts, type RestoreCandidate } from "./backupRestore";
import { rpc } from "./api";

type Props = {
  household: { id: string; name: string; revision: number; state: State };
  personal: { revision: number; state: PersonalState } | null;
  demo: boolean;
  isOwner: boolean;
  proEnabled: boolean;
  onRestored: () => Promise<void>;
};

function protectedText(value: unknown): string {
  const text = String(value ?? "");
  // Prevent opening user-entered labels/descriptions as spreadsheet formulas.
  return /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
}

function csvField(value: unknown) {
  const v = protectedText(value).replace(/"/g, '""');
  return '"' + v + '"';
}

function csvFieldNumber(value: string) { return '"' + value + '"'; }

function makeCsv(rows: unknown[][]): string {
  return "\ufeff" + rows.map(row => row.map((value, index) =>
    index === 3 && typeof value === "string" && /^-?\d+,\d{2}$/.test(value)
      ? csvFieldNumber(value) : csvField(value)).join(";")).join("\r\n");
}

export default function DataProtectionPanel({ household, personal, demo, isOwner, proEnabled, onRestored }: Props) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verification, setVerification] = useState<VerifiedBackup | null>(null);
  const [candidate, setCandidate] = useState<RestoreCandidate | null>(null);
  const [restoreWarning, setRestoreWarning] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [restoring, setRestoring] = useState(false);
  const date = new Date().toISOString().slice(0, 10);
  // Preview only: reading a backup never calls a database RPC or changes local state.
  const comparable = verification?.householdId === household.id
    ? verification.scope === "household"
      ? { label: "Foyer", current: household.state.transactions.length }
      : verification.scope === "personal" && personal
        ? { label: "Compte privé", current: personal.state.transactions.length }
        : null
    : null;
  const exportFile = async (kind: "household-json" | "household-csv" | "personal-json" | "personal-csv" | "professional-json") => {
    if (busy) return;
    setError("");
    setSuccess("");
    setBusy(kind);
    try {
      if (kind.startsWith("personal") && !personal) throw Error("Le compte personnel n'est pas encore chargé.");
      if (kind === "professional-json") {
        if (demo || !proEnabled) throw Error("La sauvegarde Pro nécessite un espace professionnel activé.");
        // Read-only RPC; do not use budget_pro_suite_load, which may create defaults.
        const data = await rpc("budget_pro_backup_export");
        const output = await createIntegrityExport({ scope: "professional", data });
        if (new TextEncoder().encode(output).length > MAX_BACKUP_SIZE)
          throw Error("Sauvegarde Pro trop volumineuse pour le format JSON actuel (20 Mo).");
        const completed = await sendFile("Wimm-Pro-complet-" + date + ".json", output, "application/json;charset=utf-8");
        if (completed) setSuccess("Export Pro préparé. Conservez ce fichier en lieu sûr.");
        return;
      }
      const prefix = kind.startsWith("personal") ? "Wimm-compte-prive-" : "Wimm-foyer-";
      const revision = kind.startsWith("personal") ? personal!.revision : household.revision;
      let output: string;
      let name: string;
      let mime: string;
      if (kind.endsWith("json")) {
        output = await createIntegrityExport({
          scope: kind.startsWith("personal") ? "personal" : "household",
          householdId: household.id,
          revision,
          state: kind.startsWith("personal") ? personal!.state : household.state,
        });
        name = prefix + date + "-r" + revision + ".json";
        mime = "application/json;charset=utf-8";
      } else {
        const personalExport = kind.startsWith("personal");
        const header = ["Date", "Type", "Libellé", "Montant EUR", "Compte", "Catégorie"];
        const rows: unknown[][] = personalExport
          ? personal!.state.transactions.map(t => [
              t.date, t.type, t.description, (t.amount / 100).toFixed(2).replace(".", ","),
              personal!.state.account?.name || "Compte perso",
              personal!.state.budgets?.find(b => b.id === t.budgetId)?.name || "",
            ])
          : household.state.transactions.map(t => [
              t.date, t.type, t.description, (t.amount / 100).toFixed(2).replace(".", ","),
              household.state.accounts.find(a => a.id === t.account)?.name || "",
              household.state.categories.find(c => c.id === t.category)?.name || "",
            ]);
        output = makeCsv([header, ...rows]);
        name = prefix + date + "-operations.csv";
        mime = "text/csv;charset=utf-8";
      }
      const completed = await sendFile(name, output, mime);
      if (completed) setSuccess("Fichier préparé. Conservez-le dans un emplacement privé et protégé.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "L’export a échoué. Réessayez.");
    } finally {
      setBusy("");
    }
  };

  async function inspectBackup(file?: File) {
    if (!file) return;
    setVerification(null);
    setCandidate(null);
    setRestoreWarning("");
    setConfirmation("");
    setError("");
    setSuccess("");
    if (file.size > MAX_BACKUP_SIZE) {
      setError("Ce fichier dépasse la limite de vérification de 20 Mo.");
      return;
    }
    try {
      const contents = await file.text();
      const result = await verifyIntegrityExport(contents);
      setVerification(result);
      if (!demo) {
        try {
          const prepared = await inspectRestoreCandidate(contents, {
            householdId: household.id,
            isOwner,
            personalRevision: personal?.revision ?? null,
          });
          setCandidate(prepared);
        } catch (e) {
          setRestoreWarning(e instanceof Error ? e.message : "Cette sauvegarde ne peut pas être restaurée.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de vérifier ce fichier.");
    }
  }
  async function restoreFile() {
    if (!candidate || confirmation !== "RESTAURER" || busy || restoring || demo) return;
    setError("");
    setSuccess("");
    setRestoring(true);
    try {
      const expected = candidate.scope === "household" ? household.revision : personal?.revision;
      if (expected === undefined) throw Error("Révision actuelle indisponible. Actualisez Wimm.");
      await rpc("budget_restore_import", {
        p_backup: candidate.backup,
        p_expected_revision: expected,
        p_confirmation: confirmation,
      });
      setCandidate(null);
      setVerification(null);
      setConfirmation("");
      await onRestored();
      setSuccess("Restauration confirmée. La version précédente a été conservée dans l’historique.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restauration impossible.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <section className="card wimm-data-security" data-tour="data-security">
      <div className="wimm-data-security-head">
        <span className="wimm-security-symbol"><ShieldCheck size={24}/></span>
        <div>
          <h2>Protection et sauvegardes</h2>
          <p className="muted">Conservez une copie personnelle de vos finances, sans transférer vos données à un service supplémentaire.</p>
        </div>
      </div>
      <div className="wimm-security-row">
        <div className="wimm-security-row-heading">
          <FileJson size={21}/>
          <div><strong>Données du foyer</strong>
          <small>{household.state.transactions.length} opérations · version {household.revision}</small></div>
        </div>
        <div className="wimm-security-actions">
          <button type="button" className="secondary" disabled={!!busy}
            onClick={() => void exportFile("household-json")}><Download size={15}/> Sauvegarde JSON</button>
          <button type="button" className="secondary" disabled={!!busy}
            onClick={() => void exportFile("household-csv")}><FileSpreadsheet size={15}/> Opérations CSV</button>
        </div>
      </div>
      <div className="wimm-security-row">
        <div className="wimm-security-row-heading">
          <LockKeyhole size={21}/>
          <div><strong>Mon compte personnel privé</strong>
          <small>{personal ? personal.state.transactions.length + " opérations · version " + personal.revision : "Aucun compte privé chargé"}</small></div>
        </div>
        <div className="wimm-security-actions">
          <button type="button" className="secondary" disabled={!!busy || !personal}
            onClick={() => void exportFile("personal-json")}><Download size={15}/> Sauvegarde privée</button>
          <button type="button" className="secondary" disabled={!!busy || !personal}
            onClick={() => void exportFile("personal-csv")}><FileSpreadsheet size={15}/> Opérations CSV</button>
        </div>
      </div>
      <div className="wimm-security-row">
        <div className="wimm-security-row-heading">
          <BriefcaseBusiness size={21}/>
          <div><strong>Mon espace professionnel</strong>
            <small>Toutes les entreprises · clients · devis · factures · paiements</small></div>
        </div>
        <div className="wimm-security-actions">
          <button type="button" className="secondary" disabled={!!busy || restoring || demo || !proEnabled}
            onClick={() => void exportFile("professional-json")}>
            <Download size={15}/> Sauvegarde Pro complète
          </button>
        </div>
        <small className="muted">Export uniquement : la réimportation Pro n’est pas encore disponible. Fichiers externes et jetons de calendrier exclus.</small>
      </div>
      <div className="wimm-security-row">
        <div className="wimm-security-row-heading">
          <FileCheck2 size={21}/>
          <div>
            <strong>Vérifier une sauvegarde</strong>
            <small>Vérifiez l’intégrité et comparez les opérations avant toute restauration</small>
          </div>
        </div>
        <label className="wimm-security-verify-action">
          <FileCheck2 size={16}/> Choisir une sauvegarde JSON
          <input type="file" accept=".json,application/json"
            aria-label="Vérifier un fichier de sauvegarde Wimm"
            onChange={e => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              void inspectBackup(file);
            }}/>
        </label>
        {verification && <div className="wimm-security-validation" role="status">
          <strong>{verification.metadataProtected ? "Intégrité du fichier vérifiée" : "Ancien format : contenu vérifié"}</strong>
          <span>{verification.scope === "household" ? "Données du foyer" :
            verification.scope === "personal" ? "Compte personnel" : "Espace professionnel"}
            {" · "}{new Date(verification.createdAt).toLocaleString("fr-FR")}
            {verification.operationCount !== null ? " · " + verification.operationCount + " opérations" : ""}
          </span>
          {verification.householdId && verification.householdId !== household.id &&
            <span className="wimm-security-foreign">Attention : cette sauvegarde provient d’un autre foyer.</span>}
          {verification.metadataProtected ? null :
            <small>Ancienne sauvegarde : la date et la révision ne sont pas protégées par l’empreinte. Vous pouvez créer une nouvelle sauvegarde au format renforcé.</small>}
          {comparable &&
            <div className="wimm-security-comparison" aria-label="Comparaison sans restauration">
              <strong>Comparaison avec {comparable.label.toLowerCase()}</strong>
              <span>Dans Wimm actuellement : {comparable.current} opération(s)</span>
              <span>Dans ce fichier : {verification.operationCount ?? "?"} opération(s)</span>
              <span>Aucune modification effectuée : cette vérification ne restaure pas le fichier.</span>
            </div>}
          {verification.scope === "professional" &&
            <small>La restauration Pro n’est pas encore disponible. Ce contrôle n’importe aucune facture ou transaction.</small>}
          {restoreWarning && <p className="warning" role="status">{restoreWarning}</p>}
          {candidate && (() => {
            const currentCount = candidate.scope === "household"
              ? household.state.transactions.length : personal?.state.transactions.length ?? 0;
            const comparison = restorePreviewCounts(candidate, currentCount);
            return <div className="wimm-security-restore" aria-label="Restaurer un fichier JSON">
              <strong><ArchiveRestore size={16}/> Restaurer ce fichier</strong>
              <p className="muted">Attention : la restauration remplace entièrement
                {candidate.scope === "household" ? " le budget partagé du foyer" : " votre compte privé"}
                . Elle ramènera les opérations de {comparison.current} à {comparison.file}.
                Les modifications depuis cette sauvegarde seront remplacées.</p>
              <p className="muted">L’état actuel sera conservé automatiquement dans l’historique.
                Les photos, fichiers externes et données Pro ne seront pas restaurés.</p>
              <label htmlFor="wimm-import-confirm">Saisissez <strong>RESTAURER</strong> pour confirmer</label>
              <input id="wimm-import-confirm" type="text" autoComplete="off"
                value={confirmation} disabled={restoring || !!busy}
                placeholder="RESTAURER" onChange={e => setConfirmation(e.target.value)}/>
              <div className="wimm-history-confirm-actions">
                <button type="button" className="secondary" disabled={restoring}
                  onClick={() => {setCandidate(null);setVerification(null);setConfirmation("");}}>Annuler</button>
                <button type="button" className="danger" disabled={restoring || !!busy || confirmation !== "RESTAURER"}
                  onClick={() => void restoreFile()}>
                  <ArchiveRestore size={15}/> {restoring ? "Restauration…" : "Confirmer la restauration"}
                </button>
              </div>
            </div>;
          })()}
          <small>L’empreinte détecte les modifications accidentelles, pas une falsification volontaire. Le fichier n’est jamais envoyé au serveur pour cette vérification.</small>
        </div>}
      </div>
      <div className="wimm-security-explainer">
        <Info size={17}/>
        <p><strong>Important :</strong> les sauvegardes JSON contiennent vos informations financières en clair et doivent être conservées dans un espace protégé. Le CSV sert à consulter les opérations, pas à restaurer Wimm. Les données de l'espace Pro et les fichiers photo ne font pas partie de ces exports. {demo ? "En démonstration, les données téléchargées sont fictives." : "Un export ne modifie jamais vos comptes."}</p>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="wimm-security-success" role="status">{success}</p>}
    </section>
  );
}
