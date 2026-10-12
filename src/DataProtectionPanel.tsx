import { useState } from "react";
import { Download, FileCheck2, FileJson, FileSpreadsheet, Info, LockKeyhole, ShieldCheck } from "lucide-react";
import type { State } from "./engine";
import type { PersonalState } from "./personal";
import { createIntegrityExport, sendFile, verifyIntegrityExport, type VerifiedBackup } from "./secureExport";

type Props = {
  household: { id: string; name: string; revision: number; state: State };
  personal: { revision: number; state: PersonalState } | null;
  demo: boolean;
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
    index === 3 && typeof value === "string" && /^-?\\d+,\\d{2}$/.test(value)
      ? csvFieldNumber(value) : csvField(value)).join(";")).join("\r\n");
}

export default function DataProtectionPanel({ household, personal, demo }: Props) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verification, setVerification] = useState<VerifiedBackup | null>(null);
  const date = new Date().toISOString().slice(0, 10);
  const exportFile = async (kind: "household-json" | "household-csv" | "personal-json" | "personal-csv") => {
    if (busy) return;
    setError("");
    setSuccess("");
    setBusy(kind);
    try {
      if (kind.startsWith("personal") && !personal) throw Error("Le compte personnel n'est pas encore chargé.");
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
    setError("");
    setSuccess("");
    if (file.size > 20 * 1024 * 1024) {
      setError("Ce fichier dépasse la limite de vérification de 20 Mo.");
      return;
    }
    try {
      const result = await verifyIntegrityExport(await file.text());
      setVerification(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de vérifier ce fichier.");
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
          <FileCheck2 size={21}/>
          <div>
            <strong>Vérifier une sauvegarde</strong>
            <small>Contrôlez un fichier JSON avant de le conserver</small>
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
          <strong>Empreinte SHA-256 vérifiée</strong>
          <span>{verification.scope === "household" ? "Données du foyer" :
            verification.scope === "personal" ? "Compte personnel" : "Espace professionnel"}
            {" · "}{new Date(verification.createdAt).toLocaleString("fr-FR")}
            {verification.operationCount !== null ? " · " + verification.operationCount + " opérations" : ""}
          </span>
          {verification.householdId && verification.householdId !== household.id &&
            <span className="wimm-security-foreign">Attention : cette sauvegarde provient d’un autre foyer.</span>}
          <small>L’empreinte détecte les modifications accidentelles, pas une falsification volontaire. Vérifier un fichier ne restaure aucune donnée.</small>
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
