import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, Info, LockKeyhole, ShieldCheck } from "lucide-react";
import type { State } from "./engine";
import type { PersonalState } from "./personal";

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

function makeCsv(rows: unknown[][]): string {
  return "\ufeff" + rows.map(row => row.map(csvField).join(";")).join("\r\n");
}

async function createIntegrityExport(payload: Record<string, unknown>) {
  const material = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(material);
  const sha = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(sha), x => x.toString(16).padStart(2, "0")).join("");
  return JSON.stringify({
    format: "wimm-manual-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    integrity: { algorithm: "SHA-256", contentHash: hash },
    ...payload,
  }, null, 2);
}

async function sendFile(name: string, content: string, mime: string) {
  const file = new File([content], name, { type: mime });
  const navigatorWithShare = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[] }) => Promise<void>;
  };
  // iOS installed web apps support saving files through the native share sheet.
  if (navigatorWithShare.share && navigatorWithShare.canShare?.({ files: [file] })) {
    try {
      await navigatorWithShare.share({ files: [file], title: "Sauvegarde Wimm" });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Fallback: regular download.
    }
  }
  const href = URL.createObjectURL(file);
  try {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(href), 60000);
  }
}

export default function DataProtectionPanel({ household, personal, demo }: Props) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
      await sendFile(name, output, mime);
      setSuccess("Le fichier a été préparé. Enregistrez-le dans un emplacement privé et sécurisé.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "L’export a échoué. Réessayez.");
    } finally {
      setBusy("");
    }
  };

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
      <div className="wimm-security-explainer">
        <Info size={17}/>
        <p><strong>Important :</strong> les sauvegardes JSON contiennent vos informations financières en clair et doivent être conservées dans un espace protégé. Le CSV sert à consulter les opérations, pas à restaurer Wimm. Les données de l'espace Pro et les fichiers photo ne font pas partie de ces exports. {demo ? "En démonstration, les données téléchargées sont fictives." : "Un export ne modifie jamais vos comptes."}</p>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="wimm-security-success" role="status">{success}</p>}
    </section>
  );
}
