import { previousDate, type Rule, type State } from "./engine";

type RuleChanges = Pick<Rule, "name" | "amount" | "account" | "category" | "start" | "interval" | "count" | "kind">;

/**
 * Change an existing payment plan without manufacturing a duplicate.
 * A plan with no confirmed payments is edited in place.
 * If it already has confirmed payments, its historical segment is kept intact,
 * and a new segment is created only for the remaining future payments.
 */
export function revisePaymentPlan(state: State, ruleId: string, changes: RuleChanges, newId: string) {
  const existing = state.rules.find(rule => rule.id === ruleId);
  if (!existing) throw Error("Échéancier introuvable.");
  if (existing.kind !== changes.kind) throw Error("Le type de paiement ne peut pas être changé.");
  if (!Number.isSafeInteger(changes.amount) || changes.amount <= 0)
    throw Error("Le montant doit être supérieur à zéro.");
  if (!Number.isInteger(changes.count) || changes.count < 0 || (changes.kind === "credit" && changes.count < 1))
    throw Error("Nombre de paiements incorrect.");

  const confirmed = state.transactions.filter(tx => tx.dueKey?.startsWith(ruleId + ":"));
  const confirmedDueDates = confirmed.map(tx => tx.dueKey!.slice(ruleId.length + 1)).sort();
  if (confirmedDueDates.some(date => date >= changes.start)) {
    throw Error("La nouvelle première échéance doit suivre les mensualités déjà validées.");
  }

  if (!confirmed.length) {
    Object.assign(existing, changes);
    delete existing.end;
    // Old cancellations no longer correspond to the reconfigured schedule.
    state.cancelled = state.cancelled.filter(key => !key.startsWith(ruleId + ":"));
    return "updated" as const;
  }

  if (state.rules.some(rule => rule.id === newId)) throw Error("Identifiant d’échéancier déjà utilisé.");
  existing.end = previousDate(changes.start);
  state.rules.push({ ...changes, id: newId });
  return "split" as const;
}

/** Delete the schedule only; completed bank transactions are never removed. */
export function removeCreditPlan(state: State, ruleId: string) {
  const matching = state.rules.find(rule => rule.id === ruleId);
  if (!matching || matching.kind !== "credit") throw Error("Crédit introuvable.");
  state.rules = state.rules.filter(rule => rule.id !== ruleId);
  state.cancelled = state.cancelled.filter(key => !key.startsWith(ruleId + ":"));
}
