import {
  type State,
  dateAt,
  month,
  personalBudgetEnvelope,
  shiftMonth,
  today,
} from "./engine";

export type PersonalAccount = {
  id: string;
  name: string;
  opening: number;
  date: string;
  category: string;
};

export type PersonalTransaction = {
  id: string;
  type: "expense" | "adjust";
  /** Bank/cash transfer is an existing adjustment type; it is neutral to total balance. */
  cashTransfer?: boolean;
  paymentMethod?: "bank" | "cash";
  amount: number;
  date: string;
  description: string;
  dueKey?: string;

  // Catégorie / budget mensuel perso.
  budgetId?: string;
};

export type PersonalRule = {
  id: string;
  name: string;
  amount: number;
  start: string;
  interval: number;
  count: number;
  end?: string;

  // Catégorie / budget mensuel perso.
  budgetId?: string;
};

export type PersonalBudget = {
  id: string;
  name: string;
  amount: number;
  start: string;
  end?: string;
};

export type PersonalDue = {
  key: string;
  date: string;
  rule: PersonalRule;
  paid?: PersonalTransaction;
};

export type PersonalState = {
  schema: 1;
  account: PersonalAccount | null;
  transactions: PersonalTransaction[];
  rules: PersonalRule[];

  // Optionnel pour rester compatible avec les comptes
  // privés créés avant l'ajout des budgets perso.
  budgets?: PersonalBudget[];
};

/**
 * Dépense perso payée en plusieurs fois : crée l'échéancier, sans débit
 * immédiat. Chaque paiement est validé ensuite comme les autres échéances.
 */
export function personalInstallmentRule(input: {
  id: string; description: string; amount: number; start: string;
  interval: number; count: number; budgetId?: string;
}): PersonalRule {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw Error("Le montant doit être supérieur à zéro.");
  if (![1, 3, 12].includes(input.interval))
    throw Error("Fréquence invalide.");
  if (!Number.isInteger(input.count) || input.count < 2 || input.count > 1200)
    throw Error("Le nombre de paiements doit être compris entre 2 et 1200.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start))
    throw Error("Date de première échéance invalide.");
  return {
    id: input.id,
    name: input.description.trim() || "Paiement en plusieurs fois",
    amount: input.amount,
    start: input.start,
    interval: input.interval,
    count: input.count,
    budgetId: input.budgetId,
  };
}

export const emptyPersonalState = (): PersonalState => ({
  schema: 1,
  account: null,
  transactions: [],
  rules: [],
  budgets: [],
});

export function personalRuleDue(
  rule: PersonalRule,
  m: string,
) {

  const [y, k] = m.split("-").map(Number);
  const [sy, sk] = month(rule.start)
    .split("-")
    .map(Number);

  const diff =
    (y - sy) * 12 + k - sk;

  if (
    diff < 0 ||
    diff % rule.interval !== 0
  )
    return null;

  const occurrence =
    diff / rule.interval;

  if (
    rule.count &&
    occurrence >= rule.count
  )
    return null;

  const date = dateAt(
    m,
    Number(rule.start.slice(8)),
  );

  if (rule.end && date > rule.end)
    return null;

  return {
    key: `${rule.id}:${date}`,
    date,
    amount: rule.amount,
    occurrence,
  };

}

export function personalDues(
  p: PersonalState,
  m: string,
): PersonalDue[] {

  return p.rules.flatMap((rule) => {

    const due = personalRuleDue(
      rule,
      m,
    );

    if (!due)
      return [];

    return [
      {
        key: due.key,
        date: due.date,
        rule,
        paid: p.transactions.find(
          (t) =>
            t.dueKey === due.key,
        ),
      },
    ];

  });

}

export function personalBalance(
  p: PersonalState,
  shared: State,
  ownerId: string,
  until = today(),
) {

  if (!p.account)
    return 0;

  const incoming = shared.transactions
    .filter(
      (t) =>
        t.type === "personal_transfer" &&
        t.personalOwner === ownerId &&
        t.category === p.account!.category &&
        t.date >= p.account!.date &&
        t.date <= until,
    )
    .reduce(
      (sum, t) => sum + t.amount,
      0,
    );

  const privateMovements =
    p.transactions
      .filter(
        (t) =>
          t.date >= p.account!.date &&
          t.date <= until,
      )
      .reduce(
        (sum, t) =>
          sum +
          (t.cashTransfer ? 0 : t.type === "adjust" ? t.amount : -t.amount),
        0,
      );

  return (
    p.account.opening +
    incoming +
    privateMovements
  );

}

/** Cash ledger kept distinct from the private bank account. */
export function personalCashBalance(p:PersonalState, until=today()){
  return p.transactions.filter(t=>t.date<=until).reduce((sum,t)=>{
    if(t.cashTransfer)return sum+t.amount;
    if(t.paymentMethod!=="cash")return sum;
    return sum+(t.type==="adjust"?t.amount:t.type==="expense"?-t.amount:0);
  },0);
}

/**
 * Remaining private expenses for a month. An already planned expense is
 * covered by its monthly budget; only overages and off-budget expenses
 * need extra reservation, to avoid deducting the same purchase twice.
 */
export function personalMonthOutgoings(p: PersonalState, m: string, asOf = today()) {
  const activeBudgets = (p.budgets ?? []).filter(
    b => m >= b.start && (!b.end || m <= b.end),
  );
  const expenses = p.transactions.filter(t => t.type === "expense" && month(t.date) === m);
  const paid = expenses.filter(t => t.date <= asOf);
  const planned = expenses.filter(t => t.date > asOf);
  const unpaidDues = personalDues(p, m).filter(d => !d.paid && d.date >= asOf);
  const covered = (id?: string) => activeBudgets.some(b => b.id === id);
  const total = <T,>(rows: T[], amount: (row: T) => number) =>
    rows.reduce((sum, row) => sum + amount(row), 0);

  let budgetRemaining = 0;
  let uncovered = total(planned.filter(t => !covered(t.budgetId)), t => t.amount)
    + total(unpaidDues.filter(d => !covered(d.rule.budgetId)), d => d.rule.amount);

  for (const b of activeBudgets) {
    const alreadySpent = total(paid.filter(t => t.budgetId === b.id), t => t.amount);
    const remaining = Math.max(0, b.amount - alreadySpent);
    const committed = total(planned.filter(t => t.budgetId === b.id), t => t.amount)
      + total(unpaidDues.filter(d => d.rule.budgetId === b.id), d => d.rule.amount);
    budgetRemaining += remaining;
    uncovered += Math.max(0, committed - remaining);
  }

  return {
    budgetRemaining,
    uncovered,
    scheduled: total(unpaidDues, d => d.rule.amount),
    budgeted: total(activeBudgets, b => b.amount),
  };
}

/**
 * Disponible estimé du compte perso jusqu'à la fin du mois, sur le même
 * principe que le disponible du foyer : solde actuel, plus ce qui reste à
 * virer depuis le budget commun, moins les budgets personnels restants, les
 * dépenses déjà prévues hors budget et les paiements en plusieurs fois non
 * réglés — y compris ceux oubliés un mois précédent, que le suivi du mois
 * en cours ne voit pas.
 */
export function personalMonthEndAvailable(
  p: PersonalState, s: State, ownerId: string, m: string,
) {
  if (!p.account)
    return { cash: 0, expected: 0, budgetRemaining: 0, uncovered: 0, overdueCharges: 0, available: 0 };

  const asOf = today();
  const cash = personalBalance(p, s, ownerId, asOf);
  const envelope = personalBudgetEnvelope(s, ownerId, p.account.category, m, month(p.account.date));
  const expected = Math.max(0, envelope.remaining);
  const outgoings = personalMonthOutgoings(p, m, asOf);

  // Échéances en retard jamais validées — d'un mois précédent, ou de ce
  // mois-ci mais déjà passées : le suivi du mois en cours ne regarde que
  // celles encore à venir (personalMonthOutgoings), pas celles-là.
  let cursor = p.rules.map(r => month(r.start)).sort()[0] || m;
  let overdueCharges = 0;
  while (cursor <= m) {
    for (const d of personalDues(p, cursor)) if (!d.paid && d.date < asOf) overdueCharges += d.rule.amount;
    cursor = shiftMonth(cursor, 1);
  }

  const available = cash + expected - outgoings.budgetRemaining - outgoings.uncovered - overdueCharges;
  return { cash, expected, budgetRemaining: outgoings.budgetRemaining,
    uncovered: outgoings.uncovered, overdueCharges, available };
}

export function personalProjection(
  p: PersonalState,
  shared: State,
  ownerId: string,
  months: number,
) {
  if (!p.account) return [];

  let projected = personalBalance(p, shared, ownerId);
  const currentMonth = month();
  const points = [{ date: currentMonth, balance: projected, incoming: 0, scheduled: 0, budgeted: 0 }];

  // Start the first future month from this month's estimated closing balance,
  // while retaining today's real balance as the first chart point.
  const currentEnvelope = personalBudgetEnvelope(
    shared, ownerId, p.account.category, currentMonth, month(p.account.date),
  );
  const currentOutgoings = personalMonthOutgoings(p, currentMonth);
  projected += currentEnvelope.remaining - currentOutgoings.budgetRemaining - currentOutgoings.uncovered;

  for (let i = 1; i <= months; i++) {
    const m = shiftMonth(currentMonth, i);
    const envelope = personalBudgetEnvelope(
      shared, ownerId, p.account.category, m, month(p.account.date),
    );
    const incoming = envelope.remaining;
    const outgoings = personalMonthOutgoings(p, m);
    projected += incoming - outgoings.budgetRemaining - outgoings.uncovered;
    points.push({
      date: m,
      balance: projected,
      incoming,
      scheduled: outgoings.scheduled,
      budgeted: outgoings.budgeted,
    });
  }
  return points;
}

export function validatePersonal(
  p: PersonalState,
) {

  if (p.schema !== 1)
    throw Error(
      "Version du compte personnel incompatible.",
    );

  if (p.account) {

    if (
      !p.account.id ||
      !p.account.name ||
      !p.account.category
    )
      throw Error(
        "Paramètres du compte personnel invalides.",
      );

    if (
      !Number.isSafeInteger(
        p.account.opening,
      )
    )
      throw Error(
        "Solde personnel invalide.",
      );

  }

  if (
    new Set(
      p.transactions.map((t) => t.id),
    ).size !== p.transactions.length
  )
    throw Error(
      "Opération personnelle en double.",
    );

  if (
    new Set(
      p.rules.map((r) => r.id),
    ).size !== p.rules.length
  )
    throw Error(
      "Échéancier personnel en double.",
    );

  const dueKeys = p.transactions
    .map((t) => t.dueKey)
    .filter(Boolean);

  if (
    new Set(dueKeys).size !==
    dueKeys.length
  )
    throw Error(
      "Ce paiement a déjà été validé.",
    );

  for (const t of p.transactions) {

    if (
      !Number.isSafeInteger(t.amount) ||
      (
        t.type === "expense" &&
        t.amount <= 0
      )
    )
      throw Error(
        "Montant personnel invalide.",
      );

    if (t.date > today() && t.type !== "expense")
      throw Error("Un ajustement personnel ne peut pas être futur.");

  }

  let cash = 0;
  for(const t of [...p.transactions].sort((a,b)=>a.date.localeCompare(b.date))){
    if(t.cashTransfer)cash+=t.amount;
    else if(t.paymentMethod==="cash")cash+=t.type==="adjust"?t.amount:t.type==="expense"?-t.amount:0;
    if(cash<0)throw Error("Le solde des espèces personnelles ne peut pas être négatif.");
  }

  for (const r of p.rules) {

    if (
      !Number.isSafeInteger(r.amount) ||
      r.amount <= 0 ||
      ![1, 3, 12].includes(
        r.interval,
      ) ||
      !Number.isInteger(r.count) ||
      r.count <= 0 ||
      r.count > 1200
    )
      throw Error(
        "Échéancier personnel invalide.",
      );

  }

  for (const b of p.budgets ?? []) {

    if (
      !b.id ||
      !b.name ||
      !Number.isSafeInteger(b.amount) ||
      b.amount < 0
    )
      throw Error(
        "Budget personnel invalide.",
      );

    if (
      !/^\d{4}-\d{2}$/.test(
        b.start,
      )
    )
      throw Error(
        "Mois de début du budget personnel invalide.",
      );

    if (
      b.end &&
      (
        !/^\d{4}-\d{2}$/.test(
          b.end,
        ) ||
        b.end < b.start
      )
    )
      throw Error(
        "Mois de fin du budget personnel invalide.",
      );

  }

  return p;

}
