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
  amount: number;
  date: string;
  description: string;
  dueKey?: string;
};

export type PersonalRule = {
  id: string;
  name: string;
  amount: number;
  start: string;
  interval: number;
  count: number;
  end?: string;
};

export type PersonalState = {
  schema: 1;
  account: PersonalAccount | null;
  transactions: PersonalTransaction[];
  rules: PersonalRule[];
};

export const emptyPersonalState = (): PersonalState => ({
  schema: 1,
  account: null,
  transactions: [],
  rules: [],
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
          (t.type === "adjust"
            ? t.amount
            : -t.amount),
        0,
      );

  return (
    p.account.opening +
    incoming +
    privateMovements
  );

}

export function personalProjection(
  p: PersonalState,
  shared: State,
  ownerId: string,
  months: number,
) {

  if (!p.account)
    return [];

  let projected = personalBalance(
    p,
    shared,
    ownerId,
  );

  const points = [
    {
      date: month(),
      balance: projected,
      incoming: 0,
      scheduled: 0,
    },
  ];

  for (let i = 1; i <= months; i++) {

    const m = shiftMonth(
      month(),
      i,
    );

    const envelope =
      personalBudgetEnvelope(
        shared,
        ownerId,
        p.account.category,
        m,
        month(p.account.date),
      );

    // Ce qui devrait être viré depuis le compte commun
    // si le budget mensuel est suivi.
    const incoming =
      envelope.remaining;

    const scheduled = p.rules
      .map((r) => personalRuleDue(r, m))
      .filter(
        (
          d,
        ): d is NonNullable<
          ReturnType<typeof personalRuleDue>
        > => !!d,
      )
      .reduce(
        (sum, d) => sum + d.amount,
        0,
      );

    projected +=
      incoming - scheduled;

    points.push({
      date: m,
      balance: projected,
      incoming,
      scheduled,
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

    if (t.date > today())
      throw Error(
        "Une dépense personnelle ne peut pas être future.",
      );

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

  return p;

}
