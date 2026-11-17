import { useState } from "react";
import { Check, ChevronRight, Wallet, ChartLine, CalendarDays, Coins, BriefcaseBusiness, X } from "lucide-react";
import { month, today, uid, euro, money, previousDate, shiftMonth, monthLabel } from "./engine";
import { PRE_WIMM_SPENDING } from "./SetupWizard";
import { field, amountField, onboardingChecklistPreviewEnabled, demoEnabled } from "./app/shared";
import { rpc } from "./api";
import type { WimmView } from "./app/buildView";

// Catégories proposées et part du revenu suggérée pour chacune.
const STARTERS: [string, string, number][] = [
  ["Courses", "food", .14], ["Transports", "transport", .06], ["Sorties", "out", .06],
  ["Santé", "health", .02], ["Abonnements", "other", .02],
];
const round10 = (cents: number) => Math.round(cents / 1000) * 1000;
const slug = (name: string) => name.normalize("NFD").replace(/[^a-z0-9]/gi, "").toLowerCase() || uid();

// « Premiers pas » : ce que la configuration minimale n'a pas demandé, proposé
// sur l'accueil jusqu'à ce que tout soit fait ou que la carte soit masquée.
export default function FirstSteps({ view }: { view: WimmView }) {
  const {
    s, current, change, openForm, editRule, navigate, proEnabled, setProEnabled, setNotice, showError,
    confirmAction, session,
  } = view;
  const storageKey = `wimm-first-steps-${session?.user.id || "demo"}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(storageKey) === "hidden"; } catch { return false; } });
  const [proSkipped, setProSkipped] = useState(() => { try { return localStorage.getItem(storageKey + "-pro") === "no"; } catch { return false; } });
  const m = month();
  // Seulement pour un foyer récent (compte courant ouvert depuis moins de deux mois).
  const recent = !!current && current.date >= shiftMonth(m, -1) + "-01";
  if (!onboardingChecklistPreviewEnabled && (hidden || !recent || demoEnabled)) return null;

  const preSpending = s.transactions.find(t => t.description === PRE_WIMM_SPENDING && !t.category && month(t.date) === m);
  const budgetsDone = s.categories.some(c => (c.budgets[m] ?? 0) > 0);
  const fixedDone = s.rules.some(r => r.kind === "fixed");
  const savingsDone = s.accounts.some(a => a.group === "wealth" && !a.archived);
  const proDone = proEnabled || proSkipped;

  const budgets = () => {
    const existing = s.categories.filter(c => !c.archived);
    const rows = existing.length
      ? existing.map(c => ({ id: c.id, name: c.name, icon: c.icon, budget: c.budgets[m] ?? 0 }))
      : STARTERS.map(([name, icon, share]) => ({ id: "", name, icon, budget: round10(s.income * share) }));
    const key = (name: string) => slug(name);
    openForm("Tes budgets du mois", [
      ...rows.flatMap(r => [
        amountField("b_" + key(r.name), "Budget " + r.name + " (€)", r.budget),
        ...(preSpending ? [amountField("s_" + key(r.name), "Déjà dépensé · " + r.name + " (€)", 0)] : []),
      ]),
    ], async (v) => {
      await change(d => {
        let spent = 0;
        for (const r of rows) {
          let category = r.id ? d.categories.find(c => c.id === r.id) : undefined;
          if (!category) { category = { id: uid(), name: r.name, icon: r.icon, budgets: {} }; d.categories.push(category); }
          category.budgets[m] = euro(v["b_" + key(r.name)] || "0");
          const already = preSpending ? euro(v["s_" + key(r.name)] || "0") : 0;
          if (already > 0 && preSpending) {
            spent += already;
            d.transactions.push({ id: uid(), type: "expense", amount: already, date: preSpending.date,
              description: "Dépenses avant Wimm · " + r.name, account: preSpending.account, category: category.id });
          }
        }
        if (preSpending) {
          const pre = d.transactions.find(t => t.id === preSpending.id)!;
          if (spent > pre.amount) throw Error("Tu as réparti plus que les " + money(pre.amount) + " déjà dépensés.");
          pre.amount -= spent;
          if (pre.amount <= 0) d.transactions = d.transactions.filter(t => t.id !== pre.id);
        }
      }, "Budgets enregistrés");
    }, "Enregistrer mes budgets", preSpending
      ? <p className="ws-muted">Montants proposés à partir de ton revenu. {money(preSpending.amount)} déjà dépensés en {monthLabel(m).split(" ")[0]} sont à répartir ; ce qui reste non réparti compte dans les dépenses sans catégorie.</p>
      : <p className="ws-muted">Montants proposés à partir de ton revenu, modifiables à tout moment.</p>);
  };

  const savings = () => {
    const carried = s.onboardingSaved?.month === m ? s.onboardingSaved.amount : 0;
    openForm("Ton épargne", [
      field("name", "Nom du compte", "Livret A"),
      amountField("opening", "Solde actuel (€)", 0),
      { ...field("share", "Part du reste du mois à épargner ici (%)", s.accounts.some(a => a.group === "wealth" && !a.archived) ? 0 : 100, "number",
        "Ce qui reste chaque mois après tes charges et tes budgets ; modifiable dans Patrimoine."), min: 0, max: 100 },
      ...(carried ? [amountField("already", "Déjà versé ce mois-ci (€)", carried)] : []),
    ], async (v) => {
      await change(d => {
        const name = v.name.trim();
        if (!name) throw Error("Donne un nom au compte.");
        const id = uid();
        const share = Number(String(v.share || "0").replace(",", "."));
        const used = d.accounts.filter(a => ["wealth", "travel"].includes(a.group) && !a.archived).reduce((n, a) => n + a.allocation, 0);
        if (!Number.isFinite(share) || share < 0 || used + share > 100.0001) throw Error("La répartition de l’épargne ne peut pas dépasser 100 %.");
        d.accounts.push({ id, name, group: "wealth", opening: euro(v.opening || "0"), date: today(), rate: 0,
          taxMode: "none", taxRate: 0, cap: 0, capType: "balance", contributed: 0, relay: "", allocation: share });
        const already = carried ? euro(v.already || "0") : 0;
        const from = d.accounts.find(a => a.group === "current" && !a.archived);
        if (already > 0 && from) {
          const before = previousDate([from.date, today()].sort()[0]);
          d.transactions.push({ id: uid(), type: "transfer", amount: already, date: before < m + "-01" ? m + "-01" : before,
            description: "Épargne versée avant Wimm", account: from.id, to: id, savingMonth: m });
        }
        delete d.onboardingSaved;
      }, "Compte d’épargne ajouté");
    }, "Ajouter");
  };

  const pro = () => confirmAction("Activer Wimm Pro ?",
    "Un espace séparé pour ton activité d’indépendant : clients, factures, encaissements, cotisations. Tu peux le désactiver dans les réglages.",
    async () => {
      try { await rpc("budget_pro_toggle", { p_enabled: true }); setProEnabled(true); setNotice("Wimm Pro activé."); }
      catch (e) { showError(e); }
    });

  const items = [
    { done: true, icon: Wallet, title: "Solde et revenu", sub: "C’est fait", run: () => navigate("wealth") },
    { done: budgetsDone, icon: ChartLine, title: "Tes budgets du mois", sub: preSpending ? "Répartis aussi ce que tu as déjà dépensé" : "Montants proposés à partir de ton revenu", run: budgets },
    { done: fixedDone, icon: CalendarDays, title: "Tes charges fixes", sub: "Loyer, abonnements, assurances… celles déjà prélevées sont reconnues", run: () => { navigate("fixed"); editRule(); } },
    { done: savingsDone, icon: Coins, title: "Ton épargne", sub: s.onboardingSaved ? "Livret, PEA… et ce que tu as déjà versé" : "Livret A, PEA… et combien mettre de côté", run: savings },
    { done: proDone, icon: BriefcaseBusiness, title: "Une activité pro ?", sub: "Active Wimm Pro si tu es indépendant", run: pro,
      skip: () => { try { localStorage.setItem(storageKey + "-pro", "no"); } catch { /* rien */ } setProSkipped(true); setNotice("D’accord. Wimm Pro reste activable dans les réglages."); } },
  ];
  const doneCount = items.filter(i => i.done).length;
  if (doneCount === items.length) return null;
  const hide = () => { try { localStorage.setItem(storageKey, "hidden"); } catch { /* rien */ } setHidden(true); };

  return (
    <section className="ws-card ws-list ws-first-steps" data-tour="home-first-steps" aria-label="Premiers pas">
      <div className="ws-head" style={{ paddingTop: 10 }}>
        <h2 className="ws-card-title">Premiers pas</h2>
        <span className="ws-row-end">
          <span className="ws-muted">{doneCount} sur {items.length}</span>
          <button type="button" className="ws-info" aria-label="Masquer les premiers pas" onClick={hide}><X size={16}/></button>
        </span>
      </div>
      <span className="ws-progress is-thin" aria-hidden="true" style={{ margin: "8px 0 4px" }}><span style={{ width: doneCount / items.length * 100 + "%" }}/></span>
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div className="ws-first-step" key={item.title}>
            <button type="button" className="ws-row" disabled={item.done && item.title === "Solde et revenu"} onClick={item.run}>
              <span className={"ws-first-tick" + (item.done ? " is-done" : "")} aria-hidden="true">{item.done ? <Check size={15}/> : <Icon size={15}/>}</span>
              <span className="ws-row-main">
                <span className={"ws-row-title" + (item.done ? " is-done" : "")}>{item.title}</span>
                <span className="ws-row-sub">{item.done ? "C’est fait" : item.sub}</span>
              </span>
              {!item.done && <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>}
            </button>
            {!item.done && item.skip && <button type="button" className="ws-link ws-first-skip" onClick={item.skip}>Non merci</button>}
          </div>
        );
      })}
    </section>
  );
}
