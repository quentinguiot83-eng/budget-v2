export type Account = {

  id: string;

  name: string;

  opening: number;

  date: string;

  group: "current" | "wealth" | "travel" | "personal";

  rate: number;

  cap: number;

  capType: "balance" | "deposits";

  contributed: number;

  relay: string;

  allocation: number;

  // Fiscalité estimée sur les gains.
  // Exemples :
  // 0 % = Livret A / LDDS / LEP
  // 18,6 % à la sortie = PEA > 5 ans
  // 31,4 % sur les intérêts = livret fiscalisé type Bourso+
  taxRate?: number;

  taxMode?: "none" | "yield" | "exit";

  personalCategory?: string;

  archived?: boolean;

};

export type Category = {

  id: string;

  name: string;

  icon: string;

  budgets: Record<string, number>;

  archived?: string;

  personalOwner?: string;

  personalSince?: string;

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

  type:
    | "expense"
    | "income"
    | "transfer"
    | "personal_transfer"
    | "loan"
    | "repay"
    | "adjust";

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

  budgetMonth?: string;

  personalOwner?: string;

  personalKind?: "budget" | "advance";

  personalMonths?: number;

  personalStartMonth?: string;

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

  closedAt?: string;

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

export type MonthlyForecast = {
  capturedAt: string;
  income: number;
  fixed: number;
  variable: number;
  savings: number;
  categories: { id: string; name: string; planned: number }[];
};

export type State = {

  schema: 1;

  monthlyForecasts?: Record<string, MonthlyForecast>;

  accounts: Account[];

  categories: Category[];

  rules: Rule[];

  transactions: Tx[];

  trips: Trip[];

  projects: Project[];

  loans: Loan[];

  income: number;

  salaryDay?: number;

  salaryBudget?: "current" | "next";

  salaryReminder?: boolean;

  salaryReceivedMonths?: string[];

  savingDoneMonths?: string[];

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

  salaryDay: 27,

  salaryBudget: "next",

  salaryReminder: true,

  salaryReceivedMonths: [],

  savingDoneMonths: [],

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

// Mois utilisé pour le budget d'un revenu.
// Un salaire reçu à partir du 27 finance le mois suivant.
// Les autres revenus restent rattachés à leur mois réel de réception.
export function incomeBudgetMonth(t: Tx) {

  const actualMonth = month(t.date);

  if (t.type !== "income" || t.incomeType !== "Salaire") {
    return actualMonth;
  }

  // Les nouveaux salaires mémorisent explicitement le mois budgétaire
  // afin qu'un changement futur de réglage ne modifie pas l'historique.
  if (t.budgetMonth) {
    return t.budgetMonth;
  }

  // Compatibilité avec les anciens salaires déjà enregistrés.
  if (Number(t.date.slice(8, 10)) >= 27) {
    return shiftMonth(actualMonth, 1);
  }

  return actualMonth;

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


export function personalAccountForCategory(
  s: State,
  categoryId: string,
) {

  // Compatibilité temporaire avec la première V1.
  return s.accounts.find(
    (a) =>
      !a.archived &&
      a.group === "personal" &&
      a.personalCategory === categoryId,
  );

}

function monthDistance(from: string, to: string) {

  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);

  return (ty - fy) * 12 + tm - fm;

}

export function personalTransferBudgetAmount(
  t: Tx,
  m: string,
) {

  if (t.type !== "personal_transfer")
    return 0;

  const start = t.personalStartMonth || month(t.date);

  const count =
    t.personalKind === "advance"
      ? Math.max(1, t.personalMonths || 1)
      : 1;

  const index = monthDistance(start, m);

  if (index < 0 || index >= count)
    return 0;

  const regular = Math.floor(t.amount / count);

  // Le dernier mois absorbe les éventuels centimes restants.
  return index === count - 1
    ? t.amount - regular * (count - 1)
    : regular;

}

function personalCommittedForMonth(
  s: State,
  ownerId: string,
  categoryId: string,
  m: string,
  legacyAccountId?: string,
) {

  // Paiements / mensualités directement débités d'un compte partagé.
  const scheduled = dues(s, m)
    .filter(
      (d) =>
        !d.cancelled &&
        d.rule.kind !== "repay" &&
        d.rule.category === categoryId &&
        s.accounts.find((a) => a.id === d.rule.account)?.group !==
          "personal",
    )
    .reduce(
      (sum, d) =>
        sum + (d.paid?.amount ?? d.rule.amount),
      0,
    );

  // Dépense ponctuelle directement payée depuis le foyer et
  // imputée sur l'enveloppe personnelle.
  const directExpenses = s.transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        !t.fixed &&
        !t.trip &&
        t.category === categoryId &&
        month(t.date) === m &&
        t.date <= today() &&
        s.accounts.find((a) => a.id === t.account)?.group !==
          "personal",
    )
    .reduce((sum, t) => sum + t.amount, 0);

  // Nouveau système :
  // - virement mensuel = 100 % sur un mois
  // - avance = montant réparti sur N mois
  const personalTransfers = s.transactions
    .filter(
      (t) =>
        t.type === "personal_transfer" &&
        t.personalOwner === ownerId &&
        t.category === categoryId,
    )
    .reduce(
      (sum, t) =>
        sum + personalTransferBudgetAmount(t, m),
      0,
    );

  // Compatibilité avec les anciens virements de la V1.
  const legacyTransfers = legacyAccountId
    ? s.transactions
        .filter(
          (t) =>
            t.type === "transfer" &&
            t.to === legacyAccountId &&
            month(t.date) === m &&
            t.date <= today(),
        )
        .reduce((sum, t) => sum + t.amount, 0)
    : 0;

  return (
    scheduled +
    directExpenses +
    personalTransfers +
    legacyTransfers
  );

}

type PersonalEnvelopeResult = {
  base: number;
  carryIn: number;
  available: number;
  committed: number;
  remaining: number;
  carryOut: number;
};

type PersonalEnvelopeCache =
  Map<string, PersonalEnvelopeResult>;

export function personalBudgetEnvelope(
  s: State,
  ownerId: string,
  categoryId: string,
  m: string,
  startOverride?: string,
  cache?: PersonalEnvelopeCache,
) {

  const category = s.categories.find(
    (c) => c.id === categoryId,
  );

  if (!category) {
    return {
      base: 0,
      carryIn: 0,
      available: 0,
      committed: 0,
      remaining: 0,
      carryOut: 0,
    };
  }

  const budgetKeys = Object.keys(category.budgets).sort();

  const start =
    startOverride ||
    category.personalSince ||
    budgetKeys[0] ||
    m;

  const cachePrefix =
    `personal:${ownerId}:${categoryId}:${start}`;

  const requestedKey =
    `${cachePrefix}:${m}`;

  const alreadyCalculated =
    cache?.get(requestedKey);

  if (alreadyCalculated)
    return alreadyCalculated;

  if (m < start) {
    const emptyResult = {
      base: 0,
      carryIn: 0,
      available: 0,
      committed: 0,
      remaining: 0,
      carryOut: 0,
    };

    cache?.set(
      requestedKey,
      emptyResult,
    );

    return emptyResult;
  }

  /*
   * En projection, les mois sont demandés dans l'ordre.
   * Si le mois précédent existe déjà dans le cache,
   * inutile de repartir du début du budget personnel.
   */
  const previousMonth =
    shiftMonth(m, -1);

  const previousResult =
    m > start
      ? cache?.get(
          `${cachePrefix}:${previousMonth}`,
        )
      : undefined;

  let currentMonth =
    previousResult ? m : start;

  let carry =
    previousResult
      ? previousResult.carryOut
      : 0;

  let guard = 0;

  while (currentMonth <= m && guard++ < 1200) {

    const base = budget(category, currentMonth);

    const available = Math.max(
      0,
      base - carry,
    );

    const committed = personalCommittedForMonth(
      s,
      ownerId,
      categoryId,
      currentMonth,
    );

    const remaining = Math.max(
      0,
      available - committed,
    );

    const carryOut = Math.max(
      0,
      committed - available,
    );

    const result = {
      base,
      carryIn: carry,
      available,
      committed,
      remaining,
      carryOut,
    };

    cache?.set(
      `${cachePrefix}:${currentMonth}`,
      result,
    );

    if (currentMonth === m) {
      return result;
    }

    carry = carryOut;

    currentMonth = shiftMonth(
      currentMonth,
      1,
    );

  }

  return {
    base: 0,
    carryIn: carry,
    available: 0,
    committed: 0,
    remaining: 0,
    carryOut: 0,
  };

}

// Compatibilité temporaire avec les comptes perso V1 encore
// présents dans le document partagé.
export function personalEnvelope(
  s: State,
  accountId: string,
  m: string,
) {

  const account = s.accounts.find(
    (a) =>
      a.id === accountId &&
      !a.archived &&
      a.group === "personal",
  );

  const category = account?.personalCategory
    ? s.categories.find(
        (c) => c.id === account.personalCategory,
      )
    : undefined;

  if (!account || !category) {
    return {
      base: 0,
      carryIn: 0,
      available: 0,
      committed: 0,
      remaining: 0,
      carryOut: 0,
    };
  }

  const owner =
    category.personalOwner ||
    account.id;

  const start =
    category.personalSince ||
    month(account.date);

  let currentMonth = start;
  let carry = 0;
  let guard = 0;

  while (currentMonth <= m && guard++ < 1200) {

    const base = budget(
      category,
      currentMonth,
    );

    const available = Math.max(
      0,
      base - carry,
    );

    const committed =
      personalCommittedForMonth(
        s,
        owner,
        category.id,
        currentMonth,
        account.id,
      );

    const remaining = Math.max(
      0,
      available - committed,
    );

    const carryOut = Math.max(
      0,
      committed - available,
    );

    if (currentMonth === m) {
      return {
        base,
        carryIn: carry,
        available,
        committed,
        remaining,
        carryOut,
      };
    }

    carry = carryOut;
    currentMonth = shiftMonth(
      currentMonth,
      1,
    );

  }

  return {
    base: 0,
    carryIn: carry,
    available: 0,
    committed: 0,
    remaining: 0,
    carryOut: 0,
  };

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

// Trésorerie réellement utilisable pour les dépenses variables du mois courant.
// Les réserves ne créent aucun mouvement bancaire.
export function monthEndAvailable(s: State) {
  const now = today();
  const m = month(now);
  const end = dateAt(m, 31);
  const accounts = s.accounts.filter(
    (a) => a.group === "current" && !a.archived && a.date <= now,
  );
  const ids = new Set(accounts.map((a) => a.id));
  const cash = accounts.reduce((sum, a) => sum + balance(s, a.id, now), 0);

  const pending: Due[] = [];
  let cursor = s.rules.map((r) => month(r.start)).sort()[0] || m;
  while (cursor <= m) {
    pending.push(...dues(s, cursor).filter(
      (d) => ids.has(d.rule.account) && d.rule.kind !== "repay" &&
        !d.cancelled && (!d.paid || d.paid.date > end),
    ));
    cursor = shiftMonth(cursor, 1);
  }
  const fixed = pending.reduce((sum, d) => sum + d.rule.amount, 0);

  // Un paiement enregistré avec une date future n'est pas encore dans le solde.
  // Réserver sa sortie nette ; un virement entre comptes courants est neutre.
  const future = s.transactions.filter((t) => t.date > now && t.date <= end);
  const committed = future.reduce((sum, t) => {
    if (!ids.has(t.account) || ids.has(t.to || "")) return sum;
    if (t.type === "income" || t.type === "repay") return sum;
    return sum + (t.type === "adjust" ? Math.max(0, -t.amount) : t.amount);
  }, 0);

  const reservedIncome = s.transactions.filter((t) => {
    const a = accounts.find((a) => a.id === t.account);
    return a && t.type === "income" && t.date >= a.date && t.date <= now &&
      incomeBudgetMonth(t) > m;
  }).reduce((sum, t) => sum + t.amount, 0);

  // Une épargne ou échéance du mois suivant prépayée consomme déjà sa réserve.
  const prepaid = s.transactions.filter((t) => {
    const a = accounts.find((a) => a.id === t.account);
    if (!a || t.date < a.date || t.date > end || ids.has(t.to || "")) return false;
    return (t.type === "transfer" && !!t.savingMonth && t.savingMonth > m) ||
      (t.type === "expense" && !!t.dueKey && month(t.dueKey.slice(-10)) > m);
  }).reduce((sum, t) => sum + t.amount, 0);
  const futureIncome = Math.max(0, reservedIncome - prepaid);

  const monthly = stats(s, m);
  const target = monthly.income > 0
    ? Object.values(monthlyPlan(s, m).amounts).reduce((sum, n) => sum + n, 0)
    : 0;
  const plannedSavings = future.filter((t) => t.type === "transfer" &&
    t.savingMonth === m && ids.has(t.account) && !ids.has(t.to || ""),
  ).reduce((sum, t) => sum + t.amount, 0);
  const savings = (s.savingDoneMonths ?? []).includes(m)
    ? 0 : Math.max(0, target - monthly.saved - plannedSavings);

  const projects = s.projects.filter((p) => {
    const trip = s.trips.find((t) => t.projectId === p.id);
    return p.active && !p.settled && ids.has(p.account) && month(p.date) === m && !trip?.closedAt;
  }).map((p) => {
    const trip = s.trips.find((t) => t.projectId === p.id);
    const fundingAlreadyReserved = trip ? future.filter(
      (t) => t.type === "transfer" && t.trip === trip.id && ids.has(t.account),
    ).reduce((sum, t) => sum + t.amount, 0) : 0;
    return { project: p, amount: Math.max(0, projectRemaining(s, p) - fundingAlreadyReserved) };
  });
  const projectReserve = projects.reduce((sum, p) => sum + p.amount, 0);

  const available = cash - fixed - committed - futureIncome - savings - projectReserve;
  return { cash, fixed, pending, committed, futureIncome, savings,
    projects, projectReserve, available, end, hasRealIncome: monthly.income > 0 };
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

export function stats(
  s: State,
  m: string,
  personalCache?: PersonalEnvelopeCache,
) {

  // Les opérations du compte personnel restent dans son historique,
  // mais ne sont pas mélangées aux dépenses du foyer.
  const tx = s.transactions.filter(
    (t) =>
      month(t.date) === m &&
      t.date <= today() &&
      s.accounts.find((a) => a.id === t.account)?.group !== "personal",
  );

  const scheduled = dues(s, m).filter(
    (d) =>
      !d.cancelled &&
      d.rule.kind !== "repay" &&
      s.accounts.find((a) => a.id === d.rule.account)?.group !== "personal",
  );

  const fixed = scheduled.reduce((n, d) => n + d.rule.amount, 0);

  // Pour une catégorie liée à un compte personnel :
  // budget perso total - mensualités déjà comptées en charges fixes.
  // Ainsi 150 € de budget avec une mensualité de 40 € donne bien
  // 40 € de fixe + 110 € d'enveloppe restante = 150 €.
  const variable = s.categories.reduce((n, c) => {

    const legacyPersonal =
      personalAccountForCategory(s, c.id);

    if (!c.personalOwner && !legacyPersonal)
      return n + budget(c, m);

    const envelope = c.personalOwner
      ? personalBudgetEnvelope(
          s,
          c.personalOwner,
          c.id,
          m,
          undefined,
          personalCache,
        )
      : personalEnvelope(
          s,
          legacyPersonal!.id,
          m,
        );

    const fixedInsideEnvelope = scheduled
      .filter((d) => d.rule.category === c.id)
      .reduce(
        (sum, d) => sum + d.rule.amount,
        0,
      );

    // Les avances ne s'ajoutent pas au budget :
    // elles consomment une partie de l'enveloppe existante.
    return (
      n +
      Math.max(
        0,
        envelope.available -
          fixedInsideEnvelope,
      )
    );

  }, 0);

  const income = s.transactions
    .filter(
      (t) =>
        t.type === "income" &&
        t.date <= today() &&
        incomeBudgetMonth(t) === m &&
        s.accounts.find((a) => a.id === t.account)?.group !== "personal",
    )
    .reduce((n, t) => n + t.amount, 0);

  const fixedPaid = tx
    .filter((t) => t.type === "expense" && t.fixed && !t.trip)
    .reduce((n, t) => n + t.amount, 0);

  const spending = tx
    .filter((t) => t.type === "expense" && !t.trip)
    .reduce((n, t) => n + t.amount, 0);

  const saved = s.transactions
    .filter(
      (t) =>
        t.type === "transfer" &&
        t.savingMonth === m &&
        t.date <= today(),
    )
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

export function budgetOverruns(s: State, m: string) {
  const monthly = stats(s, m);
  return s.categories.flatMap((c) => {
    if (c.archived && c.archived <= m) return [];
    const legacy = personalAccountForCategory(s, c.id);
    const envelope = c.personalOwner
      ? personalBudgetEnvelope(s, c.personalOwner, c.id, m, c.personalSince)
      : legacy ? personalEnvelope(s, legacy.id, m) : null;
    const limit = envelope ? envelope.available : budget(c, m);
    const spent = envelope ? envelope.committed : monthly.tx.filter(
      (t) => t.type === "expense" && t.category === c.id && !t.fixed && !t.trip,
    ).reduce((sum, t) => sum + t.amount, 0);
    return spent > limit ? [{ id: c.id, name: c.name, limit, spent, excess: spent - limit }] : [];
  });
}

export function monthlyReview(s: State, m: string) {
  const now = today();
  const currentMonth = month(now);
  const previousMonth = shiftMonth(m, -1);
  const inProgress = m === currentMonth;
  const cutoff = inProgress ? now : dateAt(m, 31);
  const previousCutoff = dateAt(previousMonth, inProgress ? Number(now.slice(8)) : 31);
  const household = (t: Tx) => s.accounts.find((a) => a.id === t.account)?.group !== "personal";
  const expenses = (period: string, until: string) => s.transactions.filter(
    (t) => t.type === "expense" && month(t.date) === period &&
      t.date <= until && t.date <= now && household(t),
  );
  const all = expenses(m, cutoff);
  const ordinary = all.filter((t) => !t.trip);
  const previous = expenses(previousMonth, previousCutoff).filter((t) => !t.trip);
  const spending = ordinary.reduce((sum, t) => sum + t.amount, 0);
  const previousSpending = previous.reduce((sum, t) => sum + t.amount, 0);
  const grouped = new Map<string, number>();
  for (const t of ordinary) {
    const id = t.category || "";
    grouped.set(id, (grouped.get(id) || 0) + t.amount);
  }
  const categories = Array.from(grouped, ([id, amount]) => ({
    id, name: s.categories.find((c) => c.id === id)?.name || "Sans catégorie", amount,
  })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const savings = s.transactions.filter((t) => t.type === "transfer" &&
    month(t.date) === m && t.date <= cutoff && t.date <= now &&
    s.accounts.find((a) => a.id === t.account)?.group === "current" &&
    ["wealth", "travel"].includes(s.accounts.find((a) => a.id === t.to)?.group || ""),
  ).reduce((sum, t) => sum + t.amount, 0);
  return { spending, previousSpending, difference: spending - previousSpending,
    hasPreviousExpenses: previous.length > 0, categories, savings,
    travelSpending: all.filter((t) => t.trip).reduce((sum, t) => sum + t.amount, 0),
    previousMonth, previousCutoff, cutoff, inProgress };
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

    .filter((a) => !a.archived && ["wealth", "travel"].includes(a.group))

    .reduce((n, a) => n + a.allocation, 0);

  if (total > 100.0001) throw Error("La répartition dépasse 100 %.");

  function place(id: string, n: number, seen: string[] = []) {

    if (!n || seen.includes(id)) return;

    const a = s.accounts.find((a) => a.id === id && !a.archived);

    if (!a || !["wealth", "travel"].includes(a.group)) return;

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

    (a) => ["wealth", "travel"].includes(a.group) && !a.archived,

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

  /*
   * Solde parallèle utilisé uniquement pour afficher
   * la valeur après fiscalité.
   *
   * Pour un livret fiscalisé, les intérêts sont capitalisés
   * après prélèvement.
   *
   * Pour un PEA, la fiscalité reste latente jusqu'à la sortie.
   */
  const netB: Record<string, number> =
    Object.fromEntries(
      s.accounts.map(
        (a) => [
          a.id,
          balance(s, a.id),
        ],
      ),
    );

  /*
   * Pour les comptes dont les intérêts sont fiscalisés au versement
   * (ex. livret fiscalisé type Bourso+), les intérêts ne sont pas
   * capitalisés chaque mois.
   *
   * On les accumule pendant l'année puis on les crédite en une fois.
   */
  const pendingGrossInterest: Record<string, number> =
    Object.fromEntries(
      s.accounts.map((a) => [a.id, 0]),
    );

  const pendingNetGrossInterest: Record<string, number> =
    Object.fromEntries(
      s.accounts.map((a) => [a.id, 0]),
    );

  /*
   * Rendement brut généré par année civile.
   *
   * Exemple :
   * janvier 2028 affichera les gains réellement
   * générés entre janvier et décembre 2027.
   */
  const interestByYear: Record<string, number> = {};

  const projectionStartYear =
    Number(month().slice(0, 4));

  let deficit = 0;

  let deficitSince = "";

  const points: {

    date: string;

    wealth: number;

    travel: number;

    current: number;

    total: number;

    wealthNet: number;

    taxEstimate: number;

    interest: number;

    savedTotal: number;

    deficit: number;

    deficitSince?: string;

  }[] = [];

  const activeAccounts = () => s.accounts.filter((a) => !a.archived);

  const sumGroup = (group: Account["group"]) =>

    activeAccounts()

      .filter((a) => a.group === group)

      .reduce((n, a) => n + (b[a.id] || 0), 0);

  const push = (date: string) => {

    const current = sumGroup("current");

    /*
     * Une ligne de janvier affiche les gains
     * de l'année civile précédente.
     *
     * La première année éventuellement incomplète
     * depuis aujourd'hui n'est pas affichée.
     */
    const pointYear =
      Number(date.slice(0, 4));

    const pointMonth =
      date.slice(5, 7);

    const previousYear =
      pointYear - 1;

    const annualInterest =
      pointMonth === "01" &&
      previousYear > projectionStartYear
        ? interestByYear[
            String(previousYear)
          ] || 0
        : 0;

    const wealth = sumGroup("wealth");

    const travel = sumGroup("travel");

    const wealthNet =
      activeAccounts()
        .filter(
          (a) =>
            a.group === "wealth",
        )
        .reduce(
          (sum, a) => {

            const gross =
              Math.max(
                0,
                b[a.id] || 0,
              );

            const rate =
              Math.max(
                0,
                a.taxRate ?? 0,
              );

            if (
              !rate ||
              a.taxMode === "none" ||
              !a.taxMode
            )
              return sum + gross;

            /*
             * Livret fiscalisé :
             * netB a déjà capitalisé les intérêts
             * après fiscalité chaque mois.
             */
            if (
              a.taxMode === "yield"
            )
              return (
                sum +
                Math.max(
                  0,
                  netB[a.id] || 0,
                )
              );

            /*
             * PEA / fiscalité à la sortie :
             * la performance brute continue à capitaliser.
             * On estime seulement ici la taxation
             * de la plus-value.
             */
            const contributed =
              Math.max(
                0,
                d[a.id] || 0,
              );

            const gain =
              Math.max(
                0,
                gross - contributed,
              );

            return (
              sum +
              Math.max(
                0,
                gross -
                  Math.round(
                    gain *
                      rate /
                      100,
                  ),
              )
            );

          },
          0,
        );

    const taxEstimate =
      Math.max(
        0,
        wealth - wealthNet,
      );

    /*
     * Versements cumulés sur les comptes patrimoine.
     * Les intérêts ne sont pas inclus.
     * L'épargne voyage reste affichée séparément.
     */
    const savedTotal =
      activeAccounts()
        .filter(
          (a) =>
            a.group === "wealth",
        )
        .reduce(
          (sum, a) =>
            sum +
            Math.max(
              0,
              d[a.id] || 0,
            ),
          0,
        );

    points.push({

      date,

      current,

      wealth,

      wealthNet,

      taxEstimate,

      interest:
        annualInterest,

      savedTotal,

      travel,

      total:
        current +
        wealth +
        travel,

      deficit,

      deficitSince:
        deficitSince ||
        undefined,

    });

  };

  const addDeficit = (amount: number, date: string) => {

    if (amount <= 0) return;

    deficit += amount;

    if (!deficitSince) deficitSince = date;

  };

  // Situation réelle aujourd'hui.

  push(month());

  /*
   * Cache valable uniquement pendant cette simulation.
   * Il évite de recalculer l'historique du budget perso
   * depuis son origine pour chacun des 360 mois.
   */
  const projectionPersonalCache:
    PersonalEnvelopeCache =
      new Map();

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

      addDeficit(s.income, m);

    }

    /*

     * 2. Dépenses prévues du mois

     *

     * Les dépenses fixes sont prises uniquement aux mois où elles sont dues.

     * Les budgets variables sont comptés chaque mois.

     */

    const monthStats =
      stats(
        s,
        m,
        projectionPersonalCache,
      );

    const fixed = monthStats.fixed;

    const variable = monthStats.variable;

    const expenses = fixed + variable;

    if (mainCurrent) {

      const available = Math.max(0, b[mainCurrent.id] || 0);

      const paid = Math.min(available, expenses);

      b[mainCurrent.id] = available - paid;

      if (expenses > paid) {

        addDeficit(expenses - paid, m);

      }

    } else if (expenses > 0) {

      addDeficit(expenses, m);

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

      b[id] =
        (b[id] || 0) + amount;

      netB[id] =
        (netB[id] || 0) +
        amount;

      d[id] =
        (d[id] || 0) + amount;

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

          netB[id] =
            Math.max(
              0,
              (netB[id] || 0) -
                amount,
            );

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

      b[p.account] =
        available - paid;

      netB[p.account] =
        Math.max(
          0,
          (netB[p.account] || 0) -
            paid,
        );

      addDeficit(
        Math.max(
          0,
          amount - paid,
        ),
        m,
      );

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

      /*
       * Livret fiscalisé type Bourso+ :
       *
       * - le taux annuel est approximé mois par mois ;
       * - les intérêts restent en attente pendant l'année ;
       * - ils ne produisent donc pas eux-mêmes d'intérêts avant
       *   leur versement annuel ;
       * - la fiscalité est appliquée une seule fois sur le total
       *   annuel avant crédit.
       *
       * Le crédit en décembre représente ici le versement effectué
       * au passage à la nouvelle année.
       */
      if (a.taxMode === "yield") {

        const monthlySimpleRate =
          a.rate / 100 / 12;

        const grossInterest =
          Math.round(
            (b[a.id] || 0) *
              monthlySimpleRate,
          );

        pendingGrossInterest[a.id] =
          (pendingGrossInterest[a.id] || 0) +
          grossInterest;

        if (a.group === "wealth") {
          const interestYear =
            m.slice(0, 4);

          interestByYear[interestYear] =
            (interestByYear[interestYear] || 0) +
            grossInterest;
        }

        pendingNetGrossInterest[a.id] =
          (pendingNetGrossInterest[a.id] || 0) +
          Math.round(
            (netB[a.id] || 0) *
              monthlySimpleRate,
          );

        if (m.endsWith("-12")) {

          b[a.id] =
            (b[a.id] || 0) +
            pendingGrossInterest[a.id];

          const tax =
            Math.max(
              0,
              Math.min(
                100,
                a.taxRate ?? 0,
              ),
            );

          const annualNetInterest =
            Math.round(
              pendingNetGrossInterest[a.id] *
                (1 - tax / 100),
            );

          netB[a.id] =
            (netB[a.id] || 0) +
            annualNetInterest;

          pendingGrossInterest[a.id] = 0;
          pendingNetGrossInterest[a.id] = 0;

        }

        continue;

      }


      /*
       * Autres placements :
       * rendement annuel converti en rendement mensuel composé.
       *
       * - exit : aucune retenue pendant la capitalisation ;
       *   la fiscalité est seulement estimée dans push().
       *
       * - none : rendement brut.
       */
      const monthlyRate =
        Math.pow(
          1 + a.rate / 100,
          1 / 12,
        ) - 1;

      const interest =
        Math.round(
          (b[a.id] || 0) *
            monthlyRate,
        );

      if (a.group === "wealth") {
        const interestYear =
          m.slice(0, 4);

        interestByYear[interestYear] =
          (interestByYear[interestYear] || 0) +
          interest;
      }

      b[a.id] =
        (b[a.id] || 0) +
        interest;

      netB[a.id] =
        (netB[a.id] || 0) +
        Math.round(
          (netB[a.id] || 0) *
            monthlyRate,
        );

    }

    /*

     * Un point par année pour garder le graphique lisible.

     */

    /*
     * Points annuels au mois de janvier.
     *
     * On conserve également le dernier mois exact de l'horizon
     * pour que le graphique et le résumé "À X ans" restent exacts.
     */
    const januaryPoint =
      m.endsWith("-01");

    const finalPoint =
      i === years * 12;

    if (
      januaryPoint ||
      finalPoint
    ) {
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

      !Number.isFinite(
        a.taxRate ?? 0,
      ) ||

      (a.taxRate ?? 0) < 0 ||

      (a.taxRate ?? 0) > 100 ||

      (
        a.taxMode &&
        ![
          "none",
          "yield",
          "exit",
        ].includes(
          a.taxMode,
        )
      ) ||

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

      if (!target || !["wealth", "travel"].includes(target.group))

        throw Error("Compte de relais invalide.");

      next = target.relay;

    }

  }

  if (

    s.accounts

      .filter((a) => !a.archived && ["wealth", "travel"].includes(a.group))

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

    if (!a)

      throw Error("Compte inconnu.");

    // Une dépense ou un revenu antérieur au solde de départ peut être
    // conservé dans l'historique, mais balance() ne le comptabilise pas.
    if (
      t.date < a.date &&
      !["expense", "income"].includes(t.type)
    )

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
