import { useState, type FormEvent } from "react";
import { microLiberatoireRate, microSuggestedRate } from "./proMicro";
import { proSetupProfile, type ProSetupActivity } from "./proSetup";

type Billing = { address: string; postalCode: string; city: string; email: string; iban: string };

const activities = [
  ["service", "Prestations de services"],
  ["commerce", "Vente de marchandises"],
  ["liberal", "Profession libérale"],
] as const;

/**
 * Premier démarrage de Wimm Pro, en trois étapes courtes. Chaque étape est
 * enregistrée immédiatement avec les fonctions Pro existantes.
 */
export default function ProSetup({
  initialName, busy, onActivity, onAccount, onBilling, onDone,
}: {
  initialName: string;
  busy: boolean;
  onActivity: (result: ReturnType<typeof proSetupProfile>) => Promise<boolean>;
  onAccount: (balanceCents: number) => Promise<boolean>;
  onBilling: (billing: Billing) => Promise<boolean>;
  onDone: () => void;
}) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<ProSetupActivity>({
    businessName: initialName === "Mon entreprise" ? "" : initialName,
    legalStatus: "micro", activityType: "service", liberatoire: false, frequency: "monthly",
    contributionRate: 0, taxRate: 0,
  });
  const [balance, setBalance] = useState("");
  const [billing, setBilling] = useState<Billing>({ address: "", postalCode: "", city: "", email: "", iban: "" });

  const set = <K extends keyof ProSetupActivity>(key: K, value: ProSetupActivity[K]) =>
    setActivity((a) => ({ ...a, [key]: value }));
  const micro = activity.legalStatus === "micro";
  const suggested = microSuggestedRate(activity.activityType);
  const liberatoire = microLiberatoireRate(activity.activityType);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    try {
      if (step === 1) {
        if (await onActivity(proSetupProfile(activity))) setStep(2);
      } else if (step === 2) {
        const cents = Math.round(Number(balance.replace(",", ".")) * 100);
        if (balance.trim() === "" || !Number.isSafeInteger(cents) || Math.abs(cents) > 1000000000000)
          throw Error("Indique le solde actuel de ton compte professionnel (0 si tu viens de l’ouvrir).");
        if (await onAccount(cents)) setStep(3);
      } else if (await onBilling(billing)) onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return <div className="pro-v4-subpage pro-setup">
    <div className="pro-v4-subpage-header">
      <span>DÉMARRER WIMM PRO · ÉTAPE {step} SUR 3</span>
      <h1>{step === 1 ? "Ton activité" : step === 2 ? "Ton compte professionnel" : "Tes factures"}</h1>
      <p>{step === 1
        ? "Wimm en déduit les sommes à mettre de côté pour l’Urssaf et les impôts."
        : step === 2
          ? "Le point de départ de ta trésorerie Pro dans Wimm."
          : "Ces informations apparaîtront sur tes devis et factures. Tu pourras les compléter plus tard dans les Réglages Pro."}</p>
    </div>
    <form className="prosuite-form" onSubmit={(e) => void submit(e)}>
      {step === 1 && <>
        <label>Nom de ton activité
          <input required maxLength={160} value={activity.businessName} placeholder="Ex. Quentin Photo"
            onChange={(e) => set("businessName", e.target.value)} />
        </label>
        <label>Statut
          <select value={activity.legalStatus} onChange={(e) => set("legalStatus", e.target.value as ProSetupActivity["legalStatus"])}>
            <option value="micro">Micro-entreprise</option>
            <option value="other">Autre statut (EI au réel, société…)</option>
          </select>
        </label>
        <label>Type d’activité
          <select value={activity.activityType} onChange={(e) => set("activityType", e.target.value as ProSetupActivity["activityType"])}>
            {activities.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        {micro ? <>
          <p className="pro-v4-form-note">Cotisations Urssaf estimées : <strong>{suggested?.toLocaleString("fr-FR")} %</strong> du chiffre d’affaires encaissé. Tu pourras ajuster ce taux (ACRE, Cipav…) dans les Réglages Pro.</p>
          <label>Déclaration Urssaf
            <select value={activity.frequency} onChange={(e) => set("frequency", e.target.value === "quarterly" ? "quarterly" : "monthly")}>
              <option value="monthly">Mensuelle</option>
              <option value="quarterly">Trimestrielle</option>
            </select>
          </label>
          <label className="prosuite-check">
            <input type="checkbox" checked={activity.liberatoire} onChange={(e) => set("liberatoire", e.target.checked)} />
            J’ai choisi le versement libératoire de l’impôt ({liberatoire?.toLocaleString("fr-FR")} %)
          </label>
        </> : <div className="prosuite-form2">
          <label>Cotisations estimées (%)
            <input type="number" min="0" max="100" step="0.01" value={activity.contributionRate || ""}
              onChange={(e) => set("contributionRate", Number(e.target.value))} />
          </label>
          <label>Impôt estimé (%)
            <input type="number" min="0" max="100" step="0.01" value={activity.taxRate || ""}
              onChange={(e) => set("taxRate", Number(e.target.value))} />
          </label>
        </div>}
      </>}
      {step === 2 && <>
        <label>Solde actuel du compte bancaire professionnel (€)
          <input type="number" inputMode="decimal" step="0.01" required autoFocus value={balance} placeholder="0,00"
            onChange={(e) => setBalance(e.target.value)} />
        </label>
        <p className="pro-v4-form-note">Les encaissements et dépenses que tu enregistreras ensuite partiront de ce solde.</p>
      </>}
      {step === 3 && <>
        <label>Adresse<input value={billing.address} onChange={(e) => setBilling({ ...billing, address: e.target.value })} /></label>
        <div className="prosuite-form2">
          <label>Code postal<input inputMode="numeric" value={billing.postalCode} onChange={(e) => setBilling({ ...billing, postalCode: e.target.value })} /></label>
          <label>Ville<input value={billing.city} onChange={(e) => setBilling({ ...billing, city: e.target.value })} /></label>
        </div>
        <label>E-mail<input type="email" value={billing.email} onChange={(e) => setBilling({ ...billing, email: e.target.value })} /></label>
        <label>IBAN<input value={billing.iban} onChange={(e) => setBilling({ ...billing, iban: e.target.value })} /></label>
      </>}
      {error && <p role="alert" className="prosuite-error">{error}</p>}
      <button type="submit" className="prosuite-btn" disabled={busy}>
        {busy ? "Enregistrement…" : step === 3 ? "Terminer" : "Continuer"}
      </button>
      {step === 3 && <button type="button" className="prosuite-btn secondary" disabled={busy} onClick={onDone}>Plus tard</button>}
    </form>
  </div>;
}
