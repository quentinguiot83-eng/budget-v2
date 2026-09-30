export type Account = {
  id: string;
  name: string;
  opening: number;
  date: string;
  group: "current" | "wealth" | "travel";
  rate: number;
  cap: number;
  capType: "balance" | "deposits";
  contributed: number;
  relay: string;
  allocation: number;
  archived?: boolean;
};
export type Category = {
  id: string;
  name: string;
  icon: string;
  budgets: Record<string, number>;
  archived?: string;
};
export type Rule = {
  id: string;
  name: string;
  category: string;
  account: string;
  amount: number;
  start: string;
  interval: number;
  count: number;
  end?: string;
  kind: "fixed" | "credit" | "repay";
  loanId?: string;
};
export type Tx = {
  id: string;
  type: "expense" | "income" | "transfer" | "loan" | "repay" | "adjust";
  amount: number;
  date: string;
  description: string;
  account: string;
  to?: string;
  category?: string;
  trip?: string;
  tripCategory?: string;
  dueKey?: string;
  fixed?: boolean;
  incomeType?: string;
  loanId?: string;
  savingMonth?: string;
};
export type Trip = {
  id: string;
  name: string;
  start: string;
  end: string;
  budget: number;
  categories: {
    id: string;
    name: string;
    budget: number;
    archived?: boolean;
  }[];
  projectId?: string;
};
export type Project = {
  id: string;
  name: string;
  type: string;
  date: string;
  amount: number;
  account: string;
  active: boolean;
  settled: boolean;
};
export type Loan = {
  id: string;
  name: string;
  amount: number;
  date: string;
  account: string;
};
export type State = {
  schema: 1;
  accounts: Account[];
  categories: Category[];
  rules: Rule[];
  transactions: Tx[];
  trips: Trip[];
  projects: Project[];
  loans: Loan[];
  income: number;
  hidden: string[];
  cancelled: string[];
};
export const emptyState = (): State => ({
  schema: 1,
  accounts: [],
  categories: [],
  rules: [],
  transactions: [],
  trips: [],
  projects: [],
  loans: [],
  income: 0,
  hidden: [],
  cancelled: [],
});
export const uid = () => crypto.randomUUID();
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(
    new Date(),
  );
export const month = (s = today()) => s.slice(0, 7);
export function shiftMonth(m: string, n: number) {
  const [y, k] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, k - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export function dateAt(m: string, day: number) {
  const [y, k] = m.split("-").map(Number);
  const last = new Date(Date.UTC(y, k, 0)).getUTCDate();
  return `${m}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
export function addMonths(d: string, n: number) {
  return dateAt(shiftMonth(month(d), n), Number(d.slice(8)));
}
export function previousDate(d: string) {
  return new Date(Date.parse(d + "T12:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
}
export const money = (c: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(c / 100);
export const euro = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || Math.abs(n) > 1e10)
    throw Error("Montant invalide.");
  return Math.round(n * 100);
};
export const dateLabel = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d + "T12:00:00"));
export const monthLabel = (m: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(m + "-15T12:00:00"),
  );
export function budget(c: Category, m: string) {
  if (c.archived && m >= c.archived) return 0;
  const keys = Object.keys(c.budgets)
    .filter((k) => k <= m)
    .sort();
  return c.budgets[keys.at(-1) || ""] || 0;
}
export function balance(s: State, id: string, until = today()) {
  const a = s.accounts.find((a) => a.id === id);
  if (!a) return 0;
  return (
    a.opening +
    s.transactions
      .filter((t) => t.date >= a.date && t.date <= until)
      .reduce(
        (n, t) =>
          n +
          (t.to === id ? t.amount : 0) +
          (t.account === id
            ? ["income", "repay", "adjust"].includes(t.type)
              ? t.amount
              : -t.amount
            : 0),
        0,
      )
  );
}
export function deposits(s: State, id: string) {
  const a = s.accounts.find((a) => a.id === id)!;
  return (
    a.contributed +
    s.transactions
      .filter((t) => t.date >= a.date && t.date <= today() && t.to === id)
      .reduce((n, t) => n + t.amount, 0)
  );
}
export type Due = {
  key: string;
  rule: Rule;
  date: string;
  paid?: Tx;
  cancelled: boolean;
};
export function dues(s: State, m: string): Due[] {
  return s.rules.flatMap((rule) => {
    const start = month(rule.start);
    const [y, k] = m.split("-").map(Number);
    const [sy, sk] = start.split("-").map(Number);
    const diff = (y - sy) * 12 + k - sk;
    if (
      diff < 0 ||
      diff % rule.interval ||
      (rule.count && diff / rule.interval >= rule.count)
    )
      return [];
    const date = dateAt(m, Number(rule.start.slice(8)));
    if (rule.end && date > rule.end) return [];
    const key = rule.id + ":" + date;
    return [
      {
        key,
        rule,
        date,
        paid: s.transactions.find((t) => t.dueKey === key),
        cancelled: s.cancelled.includes(key),
      },
    ];
  });
}
export function overdue(s: State) {
  const starts = s.rules.map((r) => month(r.start)).sort();
  let m = starts[0] || month();
  const out: Due[] = [];
  let guard = 0;
  while (m <= month() && guard++ < 1200) {
    out.push(
      ...dues(s, m).filter((d) => d.date <= today() && !d.paid && !d.cancelled),
    );
    m = shiftMonth(m, 1);
  }
  return out;
}
export function stats(s: State, m: string) {
  const tx = s.transactions.filter(
    (t) => month(t.date) === m && t.date <= today(),
  );
  const scheduled = dues(s, m).filter(
    (d) => !d.cancelled && d.rule.kind !== "repay",
  );
  const fixed = scheduled.reduce((n, d) => n + d.rule.amount, 0);
  const variable = s.categories.reduce((n, c) => n + budget(c, m), 0);
  const income = tx
    .filter((t) => t.type === "income")
    .reduce((n, t) => n + t.amount, 0);
  const fixedPaid = tx
    .filter((t) => t.type === "expense" && t.fixed && !t.trip)
    .reduce((n, t) => n + t.amount, 0);
  const spending = tx
    .filter((t) => t.type === "expense" && !t.trip)
    .reduce((n, t) => n + t.amount, 0);
  const saved = tx
    .filter((t) => t.type === "transfer" && t.savingMonth === m)
    .reduce((n, t) => n + t.amount, 0);
  return {
    tx,
    scheduled,
    fixed,
    variable,
    income,
    fixedPaid,
    spending,
    saved,
    capacity: s.income - fixed - variable,
    actualCapacity: income - fixed - variable,
  };
}
export function loanRemaining(s: State, id: string) {
  const l = s.loans.find((l) => l.id === id);
  return l
    ? l.amount -
        s.transactions
          .filter((t) => t.loanId === id && t.type === "repay")
          .reduce((n, t) => n + t.amount, 0)
    : 0;
}
export function allocation(
  s: State,
  capacity: number,
  bal: Record<string, number>,
  dep: Record<string, number>,
) {
  const amounts: Record<string, number> = {};
  let unused = Math.max(0, capacity);
  const total = s.accounts
    .filter((a) => !a.archived && a.group !== "current")
    .reduce((n, a) => n + a.allocation, 0);
  if (total > 100.0001) throw Error("La répartition dépasse 100 %.");
  function place(id: string, n: number, seen: string[] = []) {
    if (!n || seen.includes(id)) return;
    const a = s.accounts.find((a) => a.id === id && !a.archived);
    if (!a || a.group === "current") return;
    const space =
      a.cap > 0
        ? Math.max(
            0,
            a.cap -
              (a.capType === "balance" ? bal[id] : dep[id]) -
              (amounts[id] || 0),
          )
        : n;
    const put = Math.min(n, space);
    amounts[id] = (amounts[id] || 0) + put;
    unused -= put;
    if (n > put && a.relay) place(a.relay, n - put, [...seen, id]);
  }
  let roundingBudget = Math.max(0, capacity);
  for (const a of s.accounts.filter(
    (a) => a.group !== "current" && !a.archived,
  )) {
    const target = Math.min(
      roundingBudget,
      Math.round((Math.max(0, capacity) * a.allocation) / 100),
    );
    roundingBudget -= target;
    place(a.id, target);
  }
  return { amounts, unused };
}
export function monthlyPlan(s: State, m: string) {
  const { capacity, actualCapacity, income } = stats(s, m);

  const hasRealIncome = income > 0;

  // Pour un mois où des revenus réels ont déjà été saisis,
  // le plan d'épargne se base sur ces revenus réels.
  // Sinon, il utilise l'estimation mensuelle.
  const planCapacity = hasRealIncome
    ? actualCapacity
    : capacity;

  const bs = Object.fromEntries(
    s.accounts.map((a) => [a.id, balance(s, a.id)]),
  );

  const ds = Object.fromEntries(
    s.accounts.map((a) => [a.id, deposits(s, a.id)]),
  );

  for (const t of s.transactions.filter(
    (t) =>
      t.type === "transfer" &&
      t.savingMonth === m &&
      t.date <= today(),
  )) {
    if (t.to) {
      bs[t.to] -= t.amount;
      ds[t.to] -= t.amount;
    }
  }

  return allocation(s, planCapacity, bs, ds);
}
export function projectRemaining(s: State, p: Project) {
  const trip = s.trips.find((t) => t.projectId === p.id);
  if (!trip) return p.amount;
  return Math.max(
    0,
    p.amount -
      s.transactions
        .filter(
          (t) =>
            t.type === "transfer" && t.trip === trip.id && t.date <= today(),
        )
        .reduce((n, t) => n + t.amount, 0),
  );
}
export function project(s: State, years: number) {
  // Soldes de départ = situation réelle actuelle.
  const b: Record<string, number> = Object.fromEntries(
    s.accounts.map((a) => [a.id, balance(s, a.id)]),
  );

  // Versements cumulés utilisés notamment pour les plafonds
  // de type "deposits" (ex. PEA).
  const d: Record<string, number> = Object.fromEntries(
    s.accounts.map((a) => [a.id, deposits(s, a.id)]),
  );

  let deficit = 0;

  const points: {
    date: string;
    wealth: number;
    travel: number;
    current: number;
    total: number;
    deficit: number;
  }[] = [];

  const activeAccounts = () => s.accounts.filter((a) => !a.archived);

  const sumGroup = (group: Account["group"]) =>
    activeAccounts()
      .filter((a) => a.group === group)
      .reduce((n, a) => n + (b[a.id] || 0), 0);

  const push = (date: string) => {
    const current = sumGroup("current");
    const wealth = sumGroup("wealth");
    const travel = sumGroup("travel");

    points.push({
      date,
      current,
      wealth,
      travel,
      total: current + wealth + travel,
      deficit,
    });
  };

  // Situation réelle aujourd'hui.
  push(month());

  for (let i = 1; i <= years * 12; i++) {
    const m = shiftMonth(month(), i);

    /*
     * 1. Revenus estimés
     *
     * s.income est l'estimation mensuelle configurée par l'utilisateur.
     * Les revenus réellement saisis pendant le mois courant ne remplacent
     * donc pas cette valeur dans les projections.
     */
    const currentAccounts = activeAccounts().filter(
      (a) => a.group === "current",
    );

    const mainCurrent = currentAccounts[0];

    if (mainCurrent) {
      b[mainCurrent.id] = (b[mainCurrent.id] || 0) + s.income;
    } else if (s.income > 0) {
      deficit += s.income;
    }

    /*
     * 2. Dépenses prévues du mois
     *
     * Les dépenses fixes sont prises uniquement aux mois où elles sont dues.
     * Les budgets variables sont comptés chaque mois.
     */
    const monthStats = stats(s, m);

    const fixed = monthStats.fixed;
    const variable = monthStats.variable;
    const expenses = fixed + variable;

    if (mainCurrent) {
      const available = Math.max(0, b[mainCurrent.id] || 0);
      const paid = Math.min(available, expenses);

      b[mainCurrent.id] = available - paid;

      if (expenses > paid) {
        deficit += expenses - paid;
      }
    } else if (expenses > 0) {
      deficit += expenses;
    }

    /*
     * 3. Capacité d'épargne prévue.
     *
     * Elle reste fondée sur :
     * revenus estimés - charges dues - budgets variables.
     */
    const cap = Math.max(0, monthStats.capacity);

    /*
     * 4. Répartition de l'épargne.
     *
     * allocation() respecte les pourcentages, plafonds et relais.
     */
    const plan = allocation(s, cap, b, d);

    let actuallySaved = 0;

    for (const id of Object.keys(plan.amounts)) {
      const amount = plan.amounts[id] || 0;

      if (amount <= 0) continue;

      b[id] = (b[id] || 0) + amount;
      d[id] = (d[id] || 0) + amount;

      actuallySaved += amount;
    }

    /*
     * Le placement est un virement :
     * ce qui entre dans les comptes d'épargne doit sortir du compte courant.
     *
     * Si la répartition ne peut pas placer toute la capacité (plafond,
     * pourcentage total < 100 %, etc.), le reliquat reste sur le compte courant.
     */
    if (mainCurrent && actuallySaved > 0) {
      const available = Math.max(0, b[mainCurrent.id] || 0);
      const transferred = Math.min(available, actuallySaved);

      b[mainCurrent.id] = available - transferred;

      if (actuallySaved > transferred) {
        /*
         * La projection ne crée jamais artificiellement de l'argent.
         * On retire des placements la partie impossible à financer.
         */
        let excess = actuallySaved - transferred;

        for (const id of Object.keys(plan.amounts).reverse()) {
          if (excess <= 0) break;

          const amount = Math.min(excess, plan.amounts[id] || 0);

          b[id] -= amount;
          d[id] -= amount;

          excess -= amount;
        }
      }
    }

    /*
     * 5. Projets.
     *
     * Ils sont débités du compte choisi à leur date.
     * Une insuffisance alimente le financement manquant.
     */
    for (const p of s.projects.filter(
      (p) =>
        p.active &&
        !p.settled &&
        (month(p.date) === m ||
          (i === 1 && month(p.date) <= month())),
    )) {
      const amount = projectRemaining(s, p);

      const available = Math.max(0, b[p.account] || 0);
      const paid = Math.min(available, amount);

      b[p.account] = available - paid;

      deficit += Math.max(0, amount - paid);
    }

    /*
     * 6. Rendements.
     *
     * Application du taux annuel sous forme d'un taux mensuel composé.
     * Le compte courant est volontairement exclu.
     */
    for (const a of activeAccounts().filter(
      (a) => a.group !== "current",
    )) {
      const monthlyRate =
        Math.pow(1 + a.rate / 100, 1 / 12) - 1;

      b[a.id] += Math.round((b[a.id] || 0) * monthlyRate);
    }

    /*
     * Un point par année pour garder le graphique lisible.
     */
    if (i % 12 === 0 || i === years * 12) {
      push(m);
    }
  }

  return points;
}
export function validate(s: State) {
  if (s.schema !== 1) throw Error("Version de données incompatible.");
  if(!Number.isSafeInteger(s.income)||s.income<0)throw Error('Revenus estimés invalides.');
  for(const c of s.categories)for(const v of Object.values(c.budgets))if(!Number.isSafeInteger(v)||v<0)throw Error('Budget invalide.');
  for(const r of s.rules)if(!Number.isSafeInteger(r.amount)||r.amount<=0||![1,3,12].includes(r.interval)||!Number.isInteger(r.count)||r.count<0||r.count>1200)throw Error('Échéancier invalide.');
  for(const a of s.accounts)if(!Number.isSafeInteger(a.opening)||!Number.isSafeInteger(a.cap)||!Number.isSafeInteger(a.contributed)||!Number.isFinite(a.allocation))throw Error('Montants du compte invalides.');
  const ids = s.accounts.map((a) => a.id);
  if (new Set(ids).size !== ids.length) throw Error("Compte en double.");
  if (new Set(s.transactions.map((t) => t.id)).size !== s.transactions.length)
    throw Error("Opération déjà enregistrée.");
  const due = s.transactions.map((t) => t.dueKey).filter(Boolean);
  if (new Set(due).size !== due.length)
    throw Error("Cette échéance a déjà été payée.");
  for (const a of s.accounts) {
    if (
      a.rate <= -100 ||
      !Number.isFinite(a.rate) ||
      a.cap < 0 ||
      a.allocation < 0
    )
      throw Error("Paramètres du compte invalides.");
    let next = a.relay;
    const seen = [a.id];
    while (next) {
      if (seen.includes(next))
        throw Error("Les comptes de relais forment une boucle.");
      seen.push(next);
      const target = s.accounts.find((x) => x.id === next);
      if (!target || target.group === "current")
        throw Error("Compte de relais invalide.");
      next = target.relay;
    }
  }
  if (
    s.accounts
      .filter((a) => !a.archived && a.group !== "current")
      .reduce((n, a) => n + a.allocation, 0) > 100.0001
  )
    throw Error("Les pourcentages dépassent 100 %.");
  for (const t of s.transactions) {
    if (
      !Number.isSafeInteger(t.amount) ||
      (t.type !== "adjust" && t.amount <= 0)
    )
      throw Error("Le montant doit être positif.");
    const a = s.accounts.find((a) => a.id === t.account);
    if (!a || t.date < a.date)
      throw Error("La date précède le solde de départ du compte.");
    if (t.type === "transfer") {
      const to = s.accounts.find((a) => a.id === t.to);
      if (!to || to.id === a.id || t.date < to.date)
        throw Error("Virement invalide.");
    }
    if (t.date > today() && !t.dueKey)
  throw Error("Pour une opération future, créez une échéance.");
    if (t.category && !s.categories.some((c) => c.id === t.category))
      throw Error("Catégorie inconnue.");
    if (t.trip && !s.trips.some((v) => v.id === t.trip))
      throw Error("Voyage inconnu.");
  }
  for (const l of s.loans)
    if (loanRemaining(s, l.id) < 0)
      throw Error("Le remboursement dépasse le montant restant.");
  return s;
}
