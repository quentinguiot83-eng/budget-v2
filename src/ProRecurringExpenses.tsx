import { useEffect, useState, type FormEvent } from "react";
import { CalendarClock, CheckCircle2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { rpc } from "./api";
import ProDateTimeInput from "./ProDateTimeInput";
import { recurringExpenseDueDate, type ProExpenseFrequency } from "./proRecurringExpenseDates";
import "./pro-recurring-expenses.css";

type Rule = {
  id: string;
  label: string;
  category: string;
  amount: number;
  vatAmount: number;
  frequency: ProExpenseFrequency;
  startDate: string;
  endDate: string | null;
  status: "active" | "paused";
};
type Payment = { ruleId: string; periodMonth: string; transactionId: string };
type Result = { rules: Rule[]; payments: Payment[] };
type Draft = {
  id?: string;
  label: string;
  category: string;
  amount: string;
  vatAmount: string;
  frequency: ProExpenseFrequency;
  startDate: string;
  endDate: string;
};
const empty: Result = { rules: [], payments: [] };
const today = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};
const fresh = (): Draft => ({
  label: "",
  category: "Charges professionnelles",
  amount: "",
  vatAmount: "0",
  frequency: "monthly",
  startDate: today(),
  endDate: "",
});
const cents = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const euros = (amount: number) => (amount / 100).toFixed(2);
const euro = (amount: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount / 100);
const frequencyLabel: Record<ProExpenseFrequency, string> = {
  monthly: "Chaque mois",
  quarterly: "Tous les 3 mois",
  yearly: "Chaque année",
};
const prettyDate = (day: string) => new Date(day + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function ProRecurringExpenses({
  businessId, month, onPaid,
}: {
  businessId: string;
  month: string;
  onPaid: () => void;
}) {
  const [result, setResult] = useState<Result>(empty);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setResult(empty);
    setDraft(null);
    setLoading(true);
    setError("");
    void rpc("budget_pro_recurring_expense_list")
      .then(data => { if (!cancelled) setResult(data as Result); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [businessId]);

  async function invoke(name: string, args: Record<string, unknown>, message: string, payment = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await rpc(name, args) as Result;
      setResult(next);
      if (name === "budget_pro_recurring_expense_save") setDraft(null);
      setNotice(message);
      if (payment) onPaid();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    const amount = cents(draft.amount);
    const vatAmount = cents(draft.vatAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0 ||
        !Number.isSafeInteger(vatAmount) || vatAmount < 0 || vatAmount > amount) {
      setError("Indiquez un montant TTC et une TVA valides.");
      return;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      setError("La fin de récurrence doit suivre la date de début.");
      return;
    }
    void invoke("budget_pro_recurring_expense_save", {
      p_rule: {
        id: draft.id,
        label: draft.label.trim(),
        category: draft.category.trim() || "Charges professionnelles",
        amount,
        vatAmount,
        frequency: draft.frequency,
        startDate: draft.startDate,
        endDate: draft.endDate || null,
      },
    }, draft.id ? "Charge mise à jour" : "Charge récurrente enregistrée");
  }

  function edit(rule: Rule) {
    setDraft({
      id: rule.id,
      label: rule.label,
      category: rule.category,
      amount: euros(rule.amount),
      vatAmount: euros(rule.vatAmount),
      frequency: rule.frequency,
      startDate: rule.startDate,
      endDate: rule.endDate || "",
    });
    setError("");
    setNotice("");
  }

  function remove(rule: Rule) {
    if (!window.confirm(`Supprimer « ${rule.label} » et ses échéances futures ? Les dépenses déjà payées resteront dans la trésorerie.`)) return;
    void invoke("budget_pro_recurring_expense_delete", { p_id: rule.id }, "Récurrence supprimée");
  }

  function pay(rule: Rule) {
    if (!window.confirm(`Confirmer le paiement de « ${rule.label} » pour ${month} (${euro(rule.amount)}) ? Cette dépense sera comptabilisée à la date d’aujourd’hui.`)) return;
    void invoke("budget_pro_recurring_expense_pay", {
      p_id: rule.id,
      p_period_month: month + "-01",
      p_paid_date: today(),
    }, "Dépense enregistrée dans la trésorerie", true);
  }

  const thisMonth = today().slice(0, 7);
  const monthName = new Date(month + "-15T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const pendingCount = result.rules.filter(r => r.status === "active" &&
    recurringExpenseDueDate(r.startDate, r.frequency, month, r.endDate) &&
    !result.payments.some(p => p.ruleId === r.id && p.periodMonth === month)).length;

  return <section className="prosuite-card pro-recurring-expenses" aria-label="Charges professionnelles récurrentes">
    <div className="pro-rexp-header">
      <div>
        <span className="pro-rexp-eyebrow"><CalendarClock size={15} /> CHARGES RÉCURRENTES</span>
        <h2>Abonnements et dépenses fixes</h2>
        <p>Assurance professionnelle, logiciel, loyer… Programmez vos échéances, puis confirmez leur paiement avant qu’elles soient déduites du compte.</p>
      </div>
      <button className="prosuite-btn" type="button" onClick={() => { setDraft(fresh()); setError(""); setNotice(""); }}><Plus size={16}/> Ajouter une charge</button>
    </div>
    {error && <p className="prosuite-error" role="alert">{error}</p>}
    {notice && <p className="prosuite-notice" role="status">{notice}</p>}
    {loading ? <p>Chargement des charges récurrentes…</p> : <>
      <div className="pro-rexp-month"><span>Échéances de {monthName}</span><strong>{pendingCount} à confirmer</strong>
        <button title="Actualiser" aria-label="Actualiser les charges" type="button" disabled={busy} onClick={() => void invoke("budget_pro_recurring_expense_list", {}, "Liste actualisée")}><RefreshCw size={16}/></button>
      </div>
      {result.rules.length === 0 ? <div className="pro-rexp-empty">Aucune charge récurrente. Ajoutez par exemple une assurance Pro mensuelle ou annuelle.</div> :
        <div className="pro-rexp-list">
          {result.rules.map(rule => {
            const dueDate = recurringExpenseDueDate(rule.startDate, rule.frequency, month, rule.endDate);
            const paid = result.payments.some(p => p.ruleId === rule.id && p.periodMonth === month);
            return <article className="pro-rexp-item" key={rule.id}>
              <div className="pro-rexp-main">
                <strong>{rule.label}</strong>
                <span>{frequencyLabel[rule.frequency]} · {rule.category}</span>
                <small>{dueDate ? `Échéance le ${prettyDate(dueDate)}` : "Pas d’échéance pour ce mois"}{rule.status === "paused" ? " · En pause" : ""}</small>
              </div>
              <div className="pro-rexp-amount"><strong>−{euro(rule.amount)}</strong><small>{rule.vatAmount ? `dont TVA ${euro(rule.vatAmount)}` : "TTC"}</small></div>
              <div className="pro-rexp-actions">
                {dueDate && paid ? <span className="pro-rexp-paid"><CheckCircle2 size={15}/> Payée</span> :
                  dueDate && rule.status === "active" && month <= thisMonth ?
                    <button className="pro-rexp-pay" type="button" disabled={busy} onClick={() => pay(rule)}>Confirmer le paiement</button> :
                    <span className="pro-rexp-pending">{rule.status === "paused" ? "En pause" : "Non échue"}</span>}
                <button type="button" title="Modifier" aria-label={`Modifier ${rule.label}`} disabled={busy} onClick={() => edit(rule)}><Pencil size={16}/></button>
                <button type="button" disabled={busy} onClick={() => void invoke("budget_pro_recurring_expense_status", { p_id: rule.id, p_status: rule.status === "paused" ? "active" : "paused" }, rule.status === "paused" ? "Charge reprise" : "Charge mise en pause")}>{rule.status === "paused" ? "Reprendre" : "Pause"}</button>
                <button type="button" title="Supprimer" aria-label={`Supprimer ${rule.label}`} disabled={busy} onClick={() => remove(rule)}><Trash2 size={16}/></button>
              </div>
            </article>;
          })}
        </div>}
      <p className="pro-rexp-help">Les échéances ne débitent jamais automatiquement la trésorerie. Vous pouvez consulter un mois précédent pour confirmer une charge oubliée. Les paiements déjà saisis restent dans l’historique après modification ou suppression de la récurrence.</p>
    </>}
    {draft && <form className="prosuite-form pro-rexp-form" onSubmit={save}>
      <div className="pro-rexp-formhead"><h3>{draft.id ? "Modifier la charge récurrente" : "Nouvelle charge récurrente"}</h3><button type="button" aria-label="Fermer" onClick={() => setDraft(null)}><X size={20}/></button></div>
      <label>Nom de la dépense<input required maxLength={160} placeholder="Ex. Assurance professionnelle" value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })}/></label>
      <label>Catégorie<input maxLength={100} placeholder="Assurances" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}/></label>
      <div className="prosuite-form2">
        <label>Montant TTC (€)<input type="number" required min="0.01" step="0.01" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })}/></label>
        <label>Dont TVA déductible (€)<input type="number" required min="0" step="0.01" value={draft.vatAmount} onChange={e => setDraft({ ...draft, vatAmount: e.target.value })}/></label>
      </div>
      <label>Récurrence<select value={draft.frequency} onChange={e => setDraft({ ...draft, frequency: e.target.value as ProExpenseFrequency })}>
        <option value="monthly">Tous les mois</option>
        <option value="quarterly">Tous les 3 mois</option>
        <option value="yearly">Tous les ans</option>
      </select></label>
      <div className="prosuite-form2">
        <label>Première échéance<ProDateTimeInput type="date" required value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })}/></label>
        <label>Fin (facultatif)<ProDateTimeInput type="date" min={draft.startDate} value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })}/></label>
      </div>
      <p>La charge ne sera comptabilisée que lorsque vous confirmerez le paiement.</p>
      <div className="pro-rexp-formbuttons">
        <button className="prosuite-btn secondary" type="button" onClick={() => setDraft(null)}>Annuler</button>
        <button className="prosuite-btn" disabled={busy} type="submit">{busy ? "Enregistrement…" : "Enregistrer la charge"}</button>
      </div>
    </form>}
  </section>;
}
