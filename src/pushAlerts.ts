import { budgetOverruns, month, overdue, today, type State } from "./engine.ts";

export type PushAlert = { key: string; kind: "budgets" | "dues"; title: string; body: string; url: string };
export type DueInvoice = { id: string; number: string; dueDate: string | null; status: string; businessName: string };
const money = (v: number) => (v / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function pushAlerts(state: State, invoices: DueInvoice[] = []): PushAlert[] {
  const alerts: PushAlert[] = budgetOverruns(state, month()).map(b => ({
    key: `budget:${month()}:${b.id}`, kind: "budgets", title: "Budget dépassé",
    body: `${b.name} : dépassement de ${money(b.excess)}.`, url: "/?screen=home",
  }));
  for (const d of overdue(state)) {
    if (state.accounts.find(a => a.id === d.rule.account)?.group === "personal") continue;
    alerts.push({ key: `due:${d.key}`, kind: "dues", title: "Paiement à confirmer",
      body: `${d.rule.name} : ${money(d.rule.amount)} ${d.date < today() ? "en attente" : "à payer aujourd’hui"}.`, url: "/?screen=calendar" });
  }
  for (const i of invoices) {
    if (!i.dueDate || i.dueDate > today() || !["sent", "partially_paid"].includes(i.status)) continue;
    alerts.push({ key: `invoice:${i.id}:${i.dueDate}`, kind: "dues", title: "Facture Pro à échéance",
      body: `${i.businessName} · ${i.number} : paiement attendu.`, url: "/?screen=pro" });
  }
  return alerts;
}

// Only send to known push services, never to arbitrary URLs submitted by a client.
export function validPushEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.username && !u.password && !u.port &&
      (u.hostname === "fcm.googleapis.com" || u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname === "web.push.apple.com" || u.hostname.endsWith(".push.apple.com"));
  } catch { return false; }
}
