import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  ChevronLeft,
  CircleDollarSign,
  Plus,
  Settings2,
  Store,
  Trash2,
  UserRound,
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

type ProTransaction = {
  id: string;
  kind: "income" | "expense";
  label: string;
  amount: number;
  date: string;
  category: string;
  clientId: string | null;
  vatAmount: number;
  paid: boolean;
  notes: string;
};

type ProData = {
  enabled: boolean;
  profile?: ProProfile;
  clients?: ProClient[];
  transactions?: ProTransaction[];
};

type ProStatus = {
  enabled: boolean;
  profileConfigured: boolean;
};

type Page = "closed" | "modules" | "pro";

type FormKind = "none" | "income" | "expense" | "client" | "profile";

const euro = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

const toCents = (value: string) => {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);

export default function ProShell() {
  const [status, setStatus] = useState<ProStatus>({
    enabled: false,
    profileConfigured: false,
  });
  const [data, setData] = useState<ProData | null>(null);
  const [page, setPage] = useState<Page>("closed");
  const [form, setForm] = useState<FormKind>("none");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [targetsVersion, setTargetsVersion] = useState(0);

  const sidebarNav = document.querySelector(".sidebar nav");
  const drawerNav = document.querySelector(".mobile-drawer-nav");

  useEffect(() => {
    const observer = new MutationObserver(() => setTargetsVersion((v) => v + 1));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    const { data: session } = await api.auth.getSession();
    if (!session.session) return;
    try {
      const next = (await rpc("budget_pro_status")) as ProStatus;
      setStatus(next);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!message.includes("initialisée")) setError(message);
    }
  }

  async function openPro() {
    setError("");
    setPage("pro");
    if (!status.enabled) return;
    setBusy(true);
    try {
      setData((await rpc("budget_pro_load")) as ProData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(enabled: boolean) {
    setBusy(true);
    setError("");
    try {
      const next = (await rpc("budget_pro_toggle", { p_enabled: enabled })) as ProStatus;
      setStatus(next);
      setNotice(enabled ? "Module professionnel activé" : "Module professionnel désactivé");
      if (!enabled && page === "pro") setPage("modules");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const transactions = data?.transactions ?? [];
  const clients = data?.clients ?? [];
  const profile = data?.profile;
  const month = thisMonth();

  const metrics = useMemo(() => {
    const paid = transactions.filter((t) => t.paid && t.date.slice(0, 7) === month);
    const income = paid
      .filter((t) => t.kind === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = paid
      .filter((t) => t.kind === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const contribution = Math.round(income * ((profile?.contributionRate ?? 0) / 100));
    const tax = Math.round(income * ((profile?.taxRate ?? 0) / 100));
    const vat = paid
      .filter((t) => t.kind === "income")
      .reduce((sum, t) => sum + t.vatAmount, 0);
    return {
      income,
      expense,
      contribution,
      tax,
      vat,
      available: income - expense - contribution - tax - vat,
    };
  }, [transactions, profile, month]);

  const navButton = (mobile = false) => (
    <>
      <button
        type="button"
        className={page === "modules" ? "active" : ""}
        onClick={() => setPage("modules")}
      >
        <Settings2 size={mobile ? 20 : 24} />
        <span>Modules</span>
      </button>
      {status.enabled && (
        <button
          type="button"
          className={page === "pro" ? "active" : ""}
          onClick={() => void openPro()}
        >
          <Briefcase size={mobile ? 20 : 24} />
          <span>Professionnel</span>
        </button>
      )}
    </>
  );

  return (
    <>
      {sidebarNav && createPortal(navButton(false), sidebarNav)}
      {drawerNav && createPortal(navButton(true), drawerNav)}

      {page !== "closed" && (
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
              <strong>{page === "modules" ? "Modules" : "Espace professionnel"}</strong>
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

            {page === "modules" && (
              <>
                <div className="pro-heading">
                  <div>
                    <p className="pro-eyebrow">EXTENSIONS WIMM</p>
                    <h1>Adaptez Wimm à vos besoins</h1>
                    <p>
                      Activez uniquement les espaces dont vous avez besoin. Les données professionnelles restent séparées de celles du foyer.
                    </p>
                  </div>
                </div>

                <section className="pro-module-card">
                  <div className="pro-module-icon"><Briefcase size={26} /></div>
                  <div className="pro-module-copy">
                    <div className="pro-module-title">
                      <div>
                        <h2>Gestion professionnelle</h2>
                        <p>Micro-entreprise, indépendant ou petite activité.</p>
                      </div>
                      <label className="pro-switch">
                        <input
                          type="checkbox"
                          checked={status.enabled}
                          disabled={busy}
                          onChange={(e) => void toggle(e.target.checked)}
                        />
                        <span />
                      </label>
                    </div>
                    <div className="pro-feature-pills">
                      <span>Chiffre d’affaires</span>
                      <span>Dépenses</span>
                      <span>Clients</span>
                      <span>Provisions</span>
                    </div>
                    {status.enabled && (
                      <button className="pro-primary" onClick={() => void openPro()}>
                        Ouvrir l’espace Pro
                      </button>
                    )}
                  </div>
                </section>
              </>
            )}

            {page === "pro" && !status.enabled && (
              <section className="pro-empty-card">
                <Briefcase size={34} />
                <h2>Le module professionnel est désactivé</h2>
                <p>Activez-le depuis la page Modules pour créer votre espace professionnel.</p>
                <button className="pro-primary" onClick={() => setPage("modules")}>Voir les modules</button>
              </section>
            )}

            {page === "pro" && status.enabled && (
              <>
                <div className="pro-heading pro-heading-actions">
                  <div>
                    <p className="pro-eyebrow">ACTIVITÉ PROFESSIONNELLE</p>
                    <h1>{profile?.businessName || "Mon activité"}</h1>
                    <p>
                      {profile?.businessName
                        ? "Suivez ce qui est encaissé, réservé et réellement disponible."
                        : "Commencez par renseigner les informations de votre activité."}
                    </p>
                  </div>
                  <div className="pro-actions">
                    <button className="pro-secondary" onClick={() => setForm("profile")}>
                      <Settings2 size={17} /> Paramètres
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
                    <section className="pro-metrics">
                      <article>
                        <span>CA encaissé ce mois</span>
                        <strong>{euro(metrics.income)}</strong>
                        <CircleDollarSign size={22} />
                      </article>
                      <article>
                        <span>Dépenses pro</span>
                        <strong>{euro(metrics.expense)}</strong>
                        <Store size={22} />
                      </article>
                      <article>
                        <span>À réserver</span>
                        <strong>{euro(metrics.contribution + metrics.tax + metrics.vat)}</strong>
                        <Briefcase size={22} />
                      </article>
                      <article className="pro-highlight">
                        <span>Disponible estimé</span>
                        <strong>{euro(metrics.available)}</strong>
                        <CircleDollarSign size={22} />
                      </article>
                    </section>

                    <div className="pro-grid-two">
                      <section className="pro-card">
                        <div className="pro-section-head">
                          <div>
                            <h2>Réserves estimées</h2>
                            <p>Basées sur les taux que vous avez renseignés.</p>
                          </div>
                        </div>
                        <ProRow label="Cotisations" value={euro(metrics.contribution)} />
                        <ProRow label="Impôt" value={euro(metrics.tax)} />
                        {profile?.vatEnabled && <ProRow label="TVA collectée" value={euro(metrics.vat)} />}
                        <ProRow label="Total à ne pas dépenser" value={euro(metrics.contribution + metrics.tax + metrics.vat)} strong />
                      </section>

                      <section className="pro-card">
                        <div className="pro-section-head">
                          <div>
                            <h2>Clients</h2>
                            <p>{clients.length} client{clients.length > 1 ? "s" : ""} enregistré{clients.length > 1 ? "s" : ""}</p>
                          </div>
                          <button className="pro-text-button" onClick={() => setForm("client")}><Plus size={16} /> Ajouter</button>
                        </div>
                        {clients.length ? clients.slice(0, 5).map((client) => (
                          <div className="pro-list-row" key={client.id}>
                            <span className="pro-avatar"><UserRound size={17} /></span>
                            <div><strong>{client.name}</strong><small>{client.email || client.phone || "Aucune coordonnée"}</small></div>
                          </div>
                        )) : <p className="pro-muted">Aucun client enregistré.</p>}
                      </section>
                    </div>

                    <section className="pro-card">
                      <div className="pro-section-head">
                        <div>
                          <h2>Dernières opérations</h2>
                          <p>Encaissements et dépenses restent séparés du budget du foyer.</p>
                        </div>
                        <button className="pro-secondary" onClick={() => setForm("expense")}><Plus size={16} /> Dépense</button>
                      </div>
                      {transactions.length ? transactions.slice(0, 12).map((tx) => (
                        <div className="pro-operation" key={tx.id}>
                          <span className={`pro-operation-icon ${tx.kind}`}>
                            {tx.kind === "income" ? "+" : "−"}
                          </span>
                          <div className="pro-operation-main">
                            <strong>{tx.label}</strong>
                            <small>{new Date(tx.date + "T12:00:00").toLocaleDateString("fr-FR")} · {tx.category || "Sans catégorie"}{!tx.paid ? " · En attente" : ""}</small>
                          </div>
                          <strong className={tx.kind === "income" ? "pro-positive" : ""}>
                            {tx.kind === "income" ? "+" : "−"}{euro(tx.amount)}
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
                      )) : <p className="pro-muted">Aucune opération professionnelle pour le moment.</p>}
                    </section>
                  </>
                )}
              </>
            )}
          </main>

          {form !== "none" && (
            <ProModal close={() => setForm("none")}>
              {form === "profile" && <ProfileForm profile={profile} submit={saveProfile} />}
              {(form === "income" || form === "expense") && (
                <TransactionForm kind={form} clients={clients} vatEnabled={Boolean(profile?.vatEnabled)} vatRate={profile?.vatRate ?? 20} submit={saveTransaction} />
              )}
              {form === "client" && <ClientForm submit={saveClient} />}
            </ProModal>
          )}
        </div>
      )}
    </>
  );

  async function saveProfile(values: ProProfile) {
    setBusy(true);
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

  async function saveTransaction(values: Record<string, unknown>) {
    setBusy(true);
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

  async function saveClient(values: Record<string, unknown>) {
    setBusy(true);
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
    if (!confirm("Supprimer cette opération professionnelle ?")) return;
    setBusy(true);
    try {
      setData((await rpc("budget_pro_transaction_delete", { p_id: id })) as ProData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
}

function ProRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`pro-row ${strong ? "strong" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function ProModal({ children, close }: { children: React.ReactNode; close: () => void }) {
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
      <div><p className="pro-eyebrow">PARAMÈTRES</p><h2>Mon activité</h2><p>Les taux servent à estimer vos réserves. Vous restez libre de les ajuster.</p></div>
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

function TransactionForm({ kind, clients, vatEnabled, vatRate, submit }: { kind: "income" | "expense"; clients: ProClient[]; vatEnabled: boolean; vatRate: number; submit: (values: Record<string, unknown>) => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState("");
  const [clientId, setClientId] = useState("");
  const [paid, setPaid] = useState(true);
  const [includeVat, setIncludeVat] = useState(vatEnabled);
  const amountCents = toCents(amount);
  const vatAmount = includeVat && amountCents > 0 ? Math.round(amountCents - amountCents / (1 + vatRate / 100)) : 0;

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
