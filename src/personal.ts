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
      "Transaction personnelle en double.",
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
      "Cette mensualité personnelle a déjà été validée.",
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
