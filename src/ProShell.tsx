import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  Plus,
  Settings2,
  Store,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { api, rpc } from "./api";
import "./pro.css";

type ProProfile = {
  businessName: string;
  legalStatus: string;
  activityType: string;
  siret: string;
  contributionRate: number;
  taxRate: number;
  vatEnabled: boolean;
  vatRate: number;
};

type ProClient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
};

type ProAccount = {
  id: string;
  name: string;
  openingBalance: number;
};

type ProTransaction = {
  id: string;
  kind: "income" | "expense" | "transfer_personal";
  label: string;
  amount: number;
  date: string;
  category: string;
  clientId: string | null;
  accountId: string;
  vatAmount: number;
  paid: boolean;
  notes: string;
  personalTransactionId?: string | null;
};

type ProData = {
  enabled: boolean;
  profile?: ProProfile;
  account?: ProAccount;
  clients?: ProClient[];
  transactions?: ProTransaction[];
};

type ProStatus = {
  enabled: boolean;
  profileConfigured: boolean;
};

type HouseholdAccount = {
  id: string;
  name: string;
  archived?: boolean;
};

type HouseholdLoad = {
  state?: {
    accounts?: HouseholdAccount[];
  };
};

type Page = "closed" | "pro";
type PeriodMode = "month" | "year";
type FormKind =
  | "none"
  | "income"
  | "expense"
  | "client"
  | "profile"
  | "account"
  | "transfer";

const euro = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

const toCents = (value: string) => {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};

const fromCents = (value: number) => (value / 100).toFixed(2);
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);
const thisYear = () => today().slice(0, 4);

const monthLabel = (month: string) => {
  const date = new Date(`${month}-01T12:00:00`);
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

export default function ProShell() {
  const [status, setStatus] = useState<ProStatus>({
    enabled: false,
    profileConfigured: false,
  });
  const [data, setData] = useState<ProData | null>(null);
  const [householdAccounts, setHouseholdAccounts] = useState<HouseholdAccount[]>([]);
  const [page, setPage] = useState<Page>("closed");
  const [form, setForm] = useState<FormKind>("none");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(thisMonth());
  const [selectedYear, setSelectedYear] = useState(thisYear());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [, setTargetsVersion] = useState(0);

  const sidebarNav = document.querySelector(".sidebar nav");
  const drawerNav = document.querySelector(".mobile-drawer-nav");

  useEffect(() => {
    const observer = new MutationObserver(() => setTargetsVersion((v) => v + 1));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshStatus() {
      const { data: session } = await api.auth.getSession();
      if (!session.session || cancelled) return;
      try {
        const next = (await rpc("budget_pro_status")) as ProStatus;
        if (!cancelled) setStatus(next);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled && !message.includes("initialisée")) setError(message);
      }
    }

    void refreshStatus();
    const { data: listener } = api.auth.onAuthStateChange((_event, session) => {
      if (session) void refreshStatus();
      else {
        setStatus({ enabled: false, profileConfigured: false });
        setPage("closed");
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function openPro() {
    setError("");
    setNotice("");
    setPage("pro");
    if (!status.enabled) return;
    setBusy(true);
    try {
      const next = (await rpc("budget_pro_load")) as ProData;
      setData(next);
      try {
        const personal = (await rpc("budget_load")) as HouseholdLoad;
        setHouseholdAccounts((personal.state?.accounts ?? []).filter((a) => !a.archived));
      } catch {
        setHouseholdAccounts([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const transactions = data?.transactions ?? [];
  const clients = data?.clients ?? [];
  const profile = data?.profile;
  const account = data?.account;

  const accountBalance = useMemo(() => {
    let balance = account?.openingBalance ?? 0;
    for (const tx of transactions) {
      if (!tx.paid) continue;
      if (tx.kind === "income") balance += tx.amount;
      else balance -= tx.amount;
    }
    return balance;
  }, [transactions, account]);

  const periodTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        if (!tx.paid) return false;
        return periodMode === "month"
          ? tx.date.slice(0, 7) === selectedMonth
          : tx.date.slice(0, 4) === selectedYear;
      }),
    [transactions, periodMode, selectedMonth, selectedYear],
  );

  const metrics = useMemo(() => {
    const income = periodTransactions
      .filter((t) => t.kind === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = periodTransactions
      .filter((t) => t.kind === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const transfer = periodTransactions
      .filter((t) => t.kind === "transfer_personal")
      .reduce((sum, t) => sum + t.amount, 0);
    const vatCollected = periodTransactions
      .filter((t) => t.kind === "income")
      .reduce((sum, t) => sum + t.vatAmount, 0);
    const vatDeductible = periodTransactions
      .filter((t) => t.kind === "expense")
      .reduce((sum, t) => sum + t.vatAmount, 0);
    const vatNet = Math.max(0, vatCollected - vatDeductible);
    const vatCredit = Math.max(0, vatDeductible - vatCollected);
    const contribution = Math.round(income * ((profile?.contributionRate ?? 0) / 100));
    const tax = Math.round(income * ((profile?.taxRate ?? 0) / 100));
    const reserves = contribution + tax + vatNet;
    return {
      income,
      expense,
      transfer,
      vatCollected,
      vatDeductible,
      vatNet,
      vatCredit,
      contribution,
      tax,
      reserves,
      operatingNet: income - expense,
      cashMovement: income - expense - transfer,
    };
  }, [periodTransactions, profile]);

  const receivables = useMemo(
    () =>
      transactions
        .filter((t) => t.kind === "income" && !t.paid)
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  const availableYears = useMemo(() => {
    const years = new Set<string>([thisYear(), selectedYear]);
    transactions.forEach((tx) => years.add(tx.date.slice(0, 4)));
    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [transactions, selectedYear]);

  const monthlyHistory = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const month = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
      const paid = transactions.filter((tx) => tx.paid && tx.date.slice(0, 7) === month);
      const income = paid
        .filter((tx) => tx.kind === "income")
        .reduce((sum, tx) => sum + tx.amount, 0);
      const expense = paid
        .filter((tx) => tx.kind === "expense")
        .reduce((sum, tx) => sum + tx.amount, 0);
      const transfer = paid
        .filter((tx) => tx.kind === "transfer_personal")
        .reduce((sum, tx) => sum + tx.amount, 0);
      return { month, income, expense, transfer, net: income - expense - transfer };
    });
  }, [transactions, selectedYear]);

  const periodTitle =
    periodMode === "month" ? monthLabel(selectedMonth) : `année ${selectedYear}`;

  const navButton = (mobile = false) =>
    status.enabled ? (
      <button
        type="button"
        className={page === "pro" ? "active" : ""}
        onClick={() => void openPro()}
      >
        <Briefcase size={mobile ? 20 : 24} />
        <span>Professionnel</span>
      </button>
    ) : null;

  return (
    <>
      {sidebarNav && createPortal(navButton(false), sidebarNav)}
      {drawerNav && createPortal(navButton(true), drawerNav)}

      {page === "pro" && status.enabled && (
        <div className="pro-layer">
          <header className="pro-topbar">
            <button
              className="pro-icon-button"
              type="button"
              onClick={() => setPage("closed")}
              aria-label="Retour au budget"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <small>Wimm</small>
              <strong>Espace professionnel</strong>
            </div>
            <button
              className="pro-icon-button"
              type="button"
              onClick={() => setPage("closed")}
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </header>

          <main className="pro-content">
            {error && <div className="pro-error">{error}</div>}
            {notice && <div className="pro-notice">{notice}</div>}

            <div className="pro-heading pro-heading-actions">
              <div>
                <p className="pro-eyebrow">ACTIVITÉ PROFESSIONNELLE</p>
                <h1>{profile?.businessName || "Mon activité"}</h1>
                <p>
                  Trésorerie, activité et virements vers votre budget personnel restent clairement séparés.
                </p>
              </div>
              <div className="pro-actions">
                <button className="pro-secondary" onClick={() => setForm("profile")}>
                  <Settings2 size={17} /> Activité
                </button>
                <button className="pro-secondary" onClick={() => setForm("account")}>
                  <Wallet size={17} /> Compte Pro
                </button>
                <button className="pro-secondary" onClick={() => setForm("transfer")}>
                  <ArrowRight size={17} /> Vers le perso
                </button>
                <button className="pro-primary" onClick={() => setForm("income")}>
                  <Plus size={17} /> Encaissement
                </button>
              </div>
            </div>

            {busy && !data ? (
              <div className="pro-loading">Chargement de l’espace professionnel…</div>
            ) : (
              <>
                <section className="pro-period-toolbar">
                  <div className="pro-period-toggle" role="group" aria-label="Période d’analyse">
                    <button
                      className={periodMode === "month" ? "active" : ""}
                      onClick={() => setPeriodMode("month")}
                    >
                      <CalendarDays size={16} /> Mois
                    </button>
                    <button
                      className={periodMode === "year" ? "active" : ""}
                      onClick={() => setPeriodMode("year")}
                    >
                      <BarChart3 size={16} /> Année
                    </button>
                  </div>
                  {periodMode === "month" ? (
                    <input
                      aria-label="Mois affiché"
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        if (e.target.value) setSelectedYear(e.target.value.slice(0, 4));
                      }}
                    />
                  ) : (
                    <select
                      aria-label="Année affichée"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  )}
                  <span>Résultats pour {periodTitle}</span>
                </section>

                <section className="pro-metrics">
                  <article>
                    <span>CA encaissé</span>
                    <strong>{euro(metrics.income)}</strong>
                    <CircleDollarSign size={22} />
                  </article>
                  <article>
                    <span>Dépenses pro</span>
                    <strong>{euro(metrics.expense)}</strong>
                    <Store size={22} />
                  </article>
                  <article>
                    <span>Viré vers le perso</span>
                    <strong>{euro(metrics.transfer)}</strong>
                    <ArrowRight size={22} />
                  </article>
                  <article className="pro-highlight">
                    <span>Mouvement de trésorerie</span>
                    <strong>{euro(metrics.cashMovement)}</strong>
                    <Wallet size={22} />
                  </article>
                </section>

                <div className="pro-grid-two">
                  <section className="pro-card pro-account-card">
                    <div className="pro-section-head">
                      <div>
                        <h2>{account?.name || "Compte professionnel"}</h2>
                        <p>Solde calculé à partir du solde de départ et des opérations payées.</p>
                      </div>
                      <button className="pro-text-button" onClick={() => setForm("account")}>
                        Modifier
                      </button>
                    </div>
                    <div className="pro-account-balance">
                      <span>Trésorerie actuelle</span>
                      <strong>{euro(accountBalance)}</strong>
                    </div>
                    <div className="pro-account-details">
                      <span>Solde de départ <strong>{euro(account?.openingBalance ?? 0)}</strong></span>
                      <span>À encaisser <strong>{euro(receivables)}</strong></span>
                      <span>Après réserves de la période <strong>{euro(accountBalance - metrics.reserves)}</strong></span>
                    </div>
                  </section>

                  <section className="pro-card">
                    <div className="pro-section-head">
                      <div>
                        <h2>Réserves estimées</h2>
                        <p>Calculées avec vos taux personnalisés sur {periodTitle}.</p>
                      </div>
                    </div>
                    <ProRow label="Cotisations" value={euro(metrics.contribution)} />
                    <ProRow label="Impôt" value={euro(metrics.tax)} />
                    {profile?.vatEnabled && (
                      <>
                        <ProRow label="TVA collectée" value={euro(metrics.vatCollected)} />
                        <ProRow label="TVA déductible saisie" value={euro(metrics.vatDeductible)} />
                        <ProRow label="TVA nette à réserver" value={euro(metrics.vatNet)} />
                        {metrics.vatCredit > 0 && <ProRow label="Crédit de TVA estimé" value={euro(metrics.vatCredit)} />}
                      </>
                    )}
                    <ProRow label="Total à ne pas dépenser" value={euro(metrics.reserves)} strong />
                  </section>
                </div>

                <section className="pro-card pro-history-card">
                  <div className="pro-section-head">
                    <div>
                      <h2>Suivi mensuel {selectedYear}</h2>
                      <p>CA encaissé, dépenses et argent transféré vers le perso mois par mois.</p>
                    </div>
                    <div className="pro-history-total">
                      <span>Résultat d’exploitation de la période</span>
                      <strong>{euro(metrics.operatingNet)}</strong>
                    </div>
                  </div>
                  <div className="pro-history-scroll">
                    <table className="pro-history-table">
                      <thead>
                        <tr>
                          <th>Mois</th>
                          <th>CA</th>
                          <th>Dépenses</th>
                          <th>Vers perso</th>
                          <th>Trésorerie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyHistory.map((item) => (
                          <tr key={item.month} className={item.month === thisMonth() ? "current" : ""}>
                            <td>{new Date(`${item.month}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long" })}</td>
                            <td className="positive">{euro(item.income)}</td>
                            <td>{euro(item.expense)}</td>
                            <td>{euro(item.transfer)}</td>
                            <td className={item.net >= 0 ? "positive" : "negative"}>{euro(item.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="pro-grid-two">
                  <section className="pro-card">
                    <div className="pro-section-head">
                      <div>
                        <h2>Clients</h2>
                        <p>{clients.length} client{clients.length > 1 ? "s" : ""} enregistré{clients.length > 1 ? "s" : ""}</p>
                      </div>
                      <button className="pro-text-button" onClick={() => setForm("client")}>
                        <Plus size={16} /> Ajouter
                      </button>
                    </div>
                    {clients.length ? clients.slice(0, 5).map((client) => (
                      <div className="pro-list-row" key={client.id}>
                        <span className="pro-avatar"><UserRound size={17} /></span>
                        <div>
                          <strong>{client.name}</strong>
                          <small>{client.email || client.phone || "Aucune coordonnée"}</small>
                        </div>
                      </div>
                    )) : <p className="pro-muted">Aucun client enregistré.</p>}
                  </section>

                  <section className="pro-card pro-transfer-card">
                    <div className="pro-transfer-icon"><ArrowRight size={22} /></div>
                    <div>
                      <h2>Du Pro vers le perso</h2>
                      <p>
                        Un virement réduit la trésorerie Pro sans être compté comme une dépense professionnelle.
                        Vous pouvez aussi l’ajouter automatiquement comme revenu dans votre budget personnel.
                      </p>
                    </div>
                    <button className="pro-primary" onClick={() => setForm("transfer")}>
                      Faire un virement
                    </button>
                  </section>
                </div>

                <section className="pro-card">
                  <div className="pro-section-head">
                    <div>
                      <h2>Dernières opérations</h2>
                      <p>Encaissements, dépenses et virements personnels sont distingués.</p>
                    </div>
                    <button className="pro-secondary" onClick={() => setForm("expense")}>
                      <Plus size={16} /> Dépense
                    </button>
                  </div>
                  {transactions.length ? transactions.slice(0, 18).map((tx) => {
                    const isIncome = tx.kind === "income";
                    const isTransfer = tx.kind === "transfer_personal";
                    return (
                      <div className="pro-operation" key={tx.id}>
                        <span className={`pro-operation-icon ${tx.kind}`}>
                          {isIncome ? "+" : isTransfer ? "→" : "−"}
                        </span>
                        <div className="pro-operation-main">
                          <strong>{tx.label}</strong>
                          <small>
                            {new Date(tx.date + "T12:00:00").toLocaleDateString("fr-FR")}
                            {isTransfer ? " · Vers le perso" : ` · ${tx.category || "Sans catégorie"}`}
                            {!tx.paid ? " · En attente" : ""}
                            {tx.personalTransactionId ? " · Ajouté au budget perso" : ""}
                          </small>
                        </div>
                        <strong className={isIncome ? "pro-positive" : ""}>
                          {isIncome ? "+" : "−"}{euro(tx.amount)}
                        </strong>
                        <button
                          type="button"
                          className="pro-delete"
                          aria-label="Supprimer l’opération"
                          onClick={() => void deleteTransaction(tx.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  }) : <p className="pro-muted">Aucune opération professionnelle pour le moment.</p>}
                </section>
              </>
            )}
          </main>

          {form !== "none" && (
            <ProModal close={() => setForm("none")}>
              {form === "profile" && <ProfileForm profile={profile} submit={saveProfile} />}
              {form === "account" && (
                <AccountForm account={account} submit={saveAccount} />
              )}
              {(form === "income" || form === "expense") && (
                <TransactionForm
                  kind={form}
                  clients={clients}
                  vatEnabled={Boolean(profile?.vatEnabled)}
                  vatRate={profile?.vatRate ?? 20}
                  submit={saveTransaction}
                />
              )}
              {form === "client" && <ClientForm submit={saveClient} />}
              {form === "transfer" && (
                <TransferForm
                  balance={accountBalance}
                  personalAccounts={householdAccounts}
                  submit={saveTransfer}
                />
              )}
            </ProModal>
          )}
        </div>
      )}
    </>
  );

  async function saveProfile(values: ProProfile) {
    setBusy(true);
    setError("");
    try {
      setData((await rpc("budget_pro_profile_save", { p_profile: values })) as ProData);
      setStatus((s) => ({ ...s, profileConfigured: Boolean(values.businessName.trim()) }));
      setForm("none");
      setNotice("Informations professionnelles enregistrées");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveAccount(values: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      setData((await rpc("budget_pro_account_save", { p_account: values })) as ProData);
      setForm("none");
      setNotice("Compte professionnel mis à jour");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveTransaction(values: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      setData((await rpc("budget_pro_transaction_save", { p_transaction: values })) as ProData);
      setForm("none");
      setNotice("Opération enregistrée");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveTransfer(values: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const next = (await rpc("budget_pro_transfer_personal", { p_transfer: values })) as ProData;
      setData(next);
      setForm("none");
      setNotice("Virement vers le perso enregistré");
      if (values.syncToHousehold) window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveClient(values: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      setData((await rpc("budget_pro_client_save", { p_client: values })) as ProData);
      setForm("none");
      setNotice("Client enregistré");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTransaction(id: string) {
    const tx = transactions.find((item) => item.id === id);
    if (!confirm("Supprimer cette opération professionnelle ?")) return;
    setBusy(true);
    setError("");
    try {
      setData((await rpc("budget_pro_transaction_delete", { p_id: id })) as ProData);
      if (tx?.personalTransactionId) window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
}

function ProRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`pro-row ${strong ? "strong" : ""}`}>
      <span>{label}</span><strong>{value}</strong>
    </div>
  );
}

function ProModal({ children, close }: { children: ReactNode; close: () => void }) {
  return (
    <div className="pro-modal-layer">
      <button type="button" className="pro-modal-backdrop" aria-label="Fermer" onClick={close} />
      <section className="pro-modal">
        <button type="button" className="pro-modal-close" onClick={close}><X size={20} /></button>
        {children}
      </section>
    </div>
  );
}

function ProfileForm({ profile, submit }: { profile?: ProProfile; submit: (values: ProProfile) => Promise<void> }) {
  const [value, setValue] = useState<ProProfile>(profile ?? {
    businessName: "",
    legalStatus: "micro",
    activityType: "service",
    siret: "",
    contributionRate: 0,
    taxRate: 0,
    vatEnabled: false,
    vatRate: 20,
  });

  return (
    <form className="pro-form" onSubmit={(e) => { e.preventDefault(); void submit(value); }}>
      <div><p className="pro-eyebrow">PARAMÈTRES</p><h2>Mon activité</h2><p>Les taux servent uniquement à vos estimations de réserves et restent modifiables.</p></div>
      <label>Nom de l’activité<input value={value.businessName} onChange={(e) => setValue({ ...value, businessName: e.target.value })} placeholder="Ex. Studio photo" /></label>
      <div className="pro-form-two">
        <label>Statut<select value={value.legalStatus} onChange={(e) => setValue({ ...value, legalStatus: e.target.value })}><option value="micro">Micro-entreprise</option><option value="ei">EI</option><option value="eurl">EURL</option><option value="sasu">SASU</option><option value="sarl">SARL</option><option value="sas">SAS</option><option value="other">Autre</option></select></label>
        <label>Activité<select value={value.activityType} onChange={(e) => setValue({ ...value, activityType: e.target.value })}><option value="service">Prestations de services</option><option value="commerce">Commerce</option><option value="mixed">Mixte</option><option value="liberal">Libérale</option><option value="other">Autre</option></select></label>
      </div>
      <label>SIRET<input value={value.siret} onChange={(e) => setValue({ ...value, siret: e.target.value })} inputMode="numeric" placeholder="14 chiffres" /></label>
      <div className="pro-form-two">
        <label>Cotisations à réserver (%)<input type="number" min="0" max="100" step="0.01" value={value.contributionRate} onChange={(e) => setValue({ ...value, contributionRate: Number(e.target.value) })} /></label>
        <label>Impôt à réserver (%)<input type="number" min="0" max="100" step="0.01" value={value.taxRate} onChange={(e) => setValue({ ...value, taxRate: Number(e.target.value) })} /></label>
      </div>
      <label className="pro-check"><input type="checkbox" checked={value.vatEnabled} onChange={(e) => setValue({ ...value, vatEnabled: e.target.checked })} /> Je collecte la TVA</label>
      {value.vatEnabled && <label>Taux de TVA (%)<input type="number" min="0" max="100" step="0.01" value={value.vatRate} onChange={(e) => setValue({ ...value, vatRate: Number(e.target.value) })} /></label>}
      <button className="pro-primary" type="submit">Enregistrer</button>
    </form>
  );
}

function AccountForm({ account, submit }: { account?: ProAccount; submit: (values: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(account?.name ?? "Compte professionnel");
  const [opening, setOpening] = useState(fromCents(account?.openingBalance ?? 0));
  return (
    <form className="pro-form" onSubmit={(e) => { e.preventDefault(); void submit({ name, openingBalance: toCents(opening) }); }}>
      <div>
        <p className="pro-eyebrow">TRÉSORERIE</p>
        <h2>Compte professionnel</h2>
        <p>Le solde de départ correspond au montant présent sur le compte avant les opérations saisies dans Wimm.</p>
      </div>
      <label>Nom du compte<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Compte Pro Bourso" /></label>
      <label>Solde de départ (€)<input required type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} /></label>
      <button className="pro-primary" type="submit">Enregistrer le compte</button>
    </form>
  );
}

function TransactionForm({ kind, clients, vatEnabled, vatRate, submit }: { kind: "income" | "expense"; clients: ProClient[]; vatEnabled: boolean; vatRate: number; submit: (values: Record<string, unknown>) => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState("");
  const [clientId, setClientId] = useState("");
  const [paid, setPaid] = useState(true);
  const [includeVat, setIncludeVat] = useState(vatEnabled);
  const amountCents = toCents(amount);
  const vatAmount = includeVat && amountCents > 0
    ? Math.round(amountCents - amountCents / (1 + vatRate / 100))
    : 0;

  return (
    <form className="pro-form" onSubmit={(e) => { e.preventDefault(); void submit({ kind, label, amount: amountCents, date, category, clientId: clientId || null, vatAmount, paid, notes: "" }); }}>
      <div><p className="pro-eyebrow">NOUVELLE OPÉRATION</p><h2>{kind === "income" ? "Ajouter un encaissement" : "Ajouter une dépense"}</h2></div>
      <label>Libellé<input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === "income" ? "Ex. Shooting mariage" : "Ex. Impression albums"} /></label>
      <div className="pro-form-two"><label>Montant TTC (€)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><label>Date<input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label></div>
      <label>Catégorie<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={kind === "income" ? "Prestations" : "Matériel, logiciel…"} /></label>
      {kind === "income" && clients.length > 0 && <label>Client<select value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Aucun client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      {vatEnabled && <label className="pro-check"><input type="checkbox" checked={includeVat} onChange={(e) => setIncludeVat(e.target.checked)} /> Montant avec TVA ({vatRate} %){includeVat && amountCents > 0 ? ` · ${euro(vatAmount)} de TVA` : ""}</label>}
      <label className="pro-check"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> {kind === "income" ? "Paiement encaissé" : "Dépense payée"}</label>
      <button className="pro-primary" type="submit">Enregistrer</button>
    </form>
  );
}

function TransferForm({ balance, personalAccounts, submit }: { balance: number; personalAccounts: HouseholdAccount[]; submit: (values: Record<string, unknown>) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [label, setLabel] = useState("Virement activité pro");
  const [sync, setSync] = useState(personalAccounts.length > 0);
  const [targetAccountId, setTargetAccountId] = useState(personalAccounts[0]?.id ?? "");
  const amountCents = toCents(amount);

  return (
    <form className="pro-form" onSubmit={(e) => {
      e.preventDefault();
      void submit({ amount: amountCents, date, label, syncToHousehold: sync, targetAccountId: sync ? targetAccountId : null });
    }}>
      <div>
        <p className="pro-eyebrow">PRO → PERSO</p>
        <h2>Faire un virement</h2>
        <p>Trésorerie Pro actuelle : <strong>{euro(balance)}</strong>. Ce mouvement n’est ni une charge Pro ni du chiffre d’affaires.</p>
      </div>
      <label>Montant (€)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      {amountCents > balance && <div className="pro-warning">Le montant dépasse la trésorerie actuelle du compte Pro.</div>}
      <div className="pro-form-two">
        <label>Date<input required type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Libellé<input required value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      </div>
      {personalAccounts.length > 0 ? (
        <>
          <label className="pro-check"><input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} /> Ajouter aussi ce montant comme revenu dans mon budget personnel</label>
          {sync && (
            <label>Compte personnel destinataire<select required value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)}>{personalAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          )}
        </>
      ) : (
        <div className="pro-info">Aucun compte personnel n’a été trouvé. Le virement sera enregistré uniquement côté Pro.</div>
      )}
      <button className="pro-primary" type="submit">Enregistrer le virement</button>
    </form>
  );
}

function ClientForm({ submit }: { submit: (values: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <form className="pro-form" onSubmit={(e) => { e.preventDefault(); void submit({ name, email, phone, notes }); }}>
      <div><p className="pro-eyebrow">CLIENT</p><h2>Ajouter un client</h2></div>
      <label>Nom<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="pro-form-two"><label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Téléphone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label></div>
      <label>Notes<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <button className="pro-primary" type="submit">Ajouter le client</button>
    </form>
  );
}
