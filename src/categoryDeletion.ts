import type { State } from "./engine";
export function categoryUsage(state: State, id: string) {
  return {
    transactions: state.transactions.filter(t => t.category === id).length,
    rules: state.rules.filter(r => r.category === id).length,
    linkedPersonal: !!state.categories.find(c => c.id === id)?.personalOwner || state.accounts.some(a => a.personalCategory === id),
  };
}
export function categoryReplacements(state: State, id: string) {
  const owners = new Set(state.transactions.filter(t => t.category === id && t.type === "personal_transfer" && t.personalOwner).map(t => t.personalOwner));
  return state.categories.filter(c => c.id !== id && !c.archived && (owners.size === 0 || (owners.size === 1 && owners.has(c.personalOwner))));
}
export function deleteArchivedCategory(state: State, id: string, replacementId?: string) {
  const source = state.categories.find(c => c.id === id);
  if (!source?.archived) throw Error("Seule une catégorie archivée peut être supprimée définitivement.");
  const usage = categoryUsage(state, id);
  if (usage.linkedPersonal) throw Error("Cette catégorie est liée à un compte personnel. Réaffectez d’abord ce compte à une autre catégorie depuis ses réglages.");
  const used = usage.transactions + usage.rules > 0;
  if (used && !replacementId) throw Error("Choisissez une catégorie pour conserver les dépenses et échéances.");
  const target = replacementId ? categoryReplacements(state, id).find(c => c.id === replacementId) : undefined;
  if (replacementId && !target) throw Error("La catégorie de destination n’est pas compatible ou n’est plus disponible.");
  if (target) {
    for (const transaction of state.transactions) if (transaction.category === id) transaction.category = target.id;
    for (const rule of state.rules) if (rule.category === id) rule.category = target.id;
    // Preserve frozen monthly totals while combining the category labels.
    for (const forecast of Object.values(state.monthlyForecasts || {})) {
      const old = forecast.categories.find(c => c.id === id);
      const oldFixed = forecast.fixedCategories?.find(c => c.id === id);
      if (oldFixed && forecast.fixedCategories) {
        const existingFixed = forecast.fixedCategories.find(c => c.id === target.id);
        if (existingFixed) existingFixed.planned += oldFixed.planned;
        else forecast.fixedCategories.push({ ...oldFixed, id: target.id });
        forecast.fixedCategories = forecast.fixedCategories.filter(c => c.id !== id);
      }
      if (!old) continue;
      const existing = forecast.categories.find(c => c.id === target.id);
      if (existing) existing.planned += old.planned;
      else forecast.categories.push({ ...old, id: target.id, name: target.name });
      forecast.categories = forecast.categories.filter(c => c.id !== id);
    }
  }
  state.categories = state.categories.filter(c => c.id !== id);
}
