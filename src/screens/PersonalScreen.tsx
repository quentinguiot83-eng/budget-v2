import { personalBudgetEnvelope, month, dateLabel, money, today, monthLabel, shiftMonth, personalTransferBudgetAmount } from "../engine";
import { personalBalance, personalCashBalance, personalMonthOutgoings, personalProjection, personalDues } from "../personal";
import PersonalPageStyles from "../PersonalPageStyles";
import { SortableList } from "../SortableList";
import SwipeActions from "../SwipeActions";
import { Row, Empty, BlockInfo, Progress } from "../ui";
import { UserRound, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, Wallet, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Coins, Plus, Search, SlidersHorizontal, ChartNoAxesCombined, CalendarDays, Check } from "lucide-react";
import { Suspense } from "react";
import { LazyPersonalProjectionChart } from "../app/shared";
import type { WimmView } from "../app/buildView";

export default function PersonalScreen({ view }: { view: WimmView }) {
  const {
    addPersonalMoney, changePersonal, confirmAction, deletePersonalTransaction, editCategory,
    editPersonalAccount, editPersonalBudget, editPersonalCash, editPersonalHistoryTransaction,
    editPersonalRule, explain, migrateLegacyPersonal, moveViewingMonth, payPersonalDue,
    personalAdvance, personalExpense, personalFiltersExpanded, personalOwnerId,
    personalProjectionMonths, personalTab, personalTransactionCategory,
    personalTransactionDetails, personalTransactionQuery, personalTransactionType,
    previousRecordedMonth, ps, recordedMonths, s, selectedMonth, selectedPersonalBudget,
    setMobileQuickAddOpen, setMonth, setPersonalFiltersExpanded, setPersonalProjectionMonths,
    setPersonalTab, setPersonalTransactionCategory, setPersonalTransactionQuery,
    setPersonalTransactionType, setSelectedPersonalBudget, showError, transferPersonal,
  } = view;
  return (
    <>
      {!ps.account ? (
        <>
          {s.accounts.some(
            (a) =>
              !a.archived &&
              a.group ===
                "personal",
          ) && (
            <section className="card">
              <h2>
                Importer votre ancien
                compte perso
              </h2>

              <p className="muted">
                Choisissez uniquement
                votre propre compte.
                Après migration, ses
                données personnelles
                quitteront le document
                partagé du foyer.
              </p>

              {s.accounts
                .filter(
                  (a) =>
                    !a.archived &&
                    a.group ===
                      "personal",
                )
                .map((a) => (
                  <Row
                    key={a.id}
                    icon={
                      <UserRound
                        size={18}
                      />
                    }
                    title={a.name}
                    sub={
                      s.categories.find(
                        (c) =>
                          c.id ===
                          a.personalCategory,
                      )?.name ||
                      "Aucune catégorie liée"
                    }
                    value={
                      <button
                        className="primary compact"
                        onClick={() =>
                          migrateLegacyPersonal(
                            a,
                          ).catch(
                            showError,
                          )
                        }
                      >
                        C’est mon compte
                      </button>
                    }
                  />
                ))}
            </section>
          )}

          <Empty
            title="Configurez votre compte perso"
            action={
              <button
                className="primary"
                onClick={() =>
                  editPersonalAccount()
                }
              >
                Créer mon compte perso
              </button>
            }
          >
            Un compte privé lié à votre
            enveloppe personnelle du
            budget commun.
          </Empty>
        </>
      ) : (() => {

        const account =
          ps.account;

        const category =
          s.categories.find(
            (c) =>
              c.id ===
              account.category,
          );

        const envelope =
          personalBudgetEnvelope(
            s,
            personalOwnerId,
            account.category,
            selectedMonth,
            month(account.date),
          );

        const privateBalance =
          personalBalance(
            ps,
            s,
            personalOwnerId,
          );

        const privateCash=personalCashBalance(ps);
        const privateBank=privateBalance-privateCash;

        const sharedIncoming =
          s.transactions
            .filter(
              (t) =>
                t.type ===
                  "personal_transfer" &&
                t.personalOwner ===
                  personalOwnerId &&
                t.category ===
                  account.category,
            )
            .map((t) => ({
              id: t.id,
              date: t.date,
              title:
                t.description ||
                "Virement perso",
              amount:
                t.amount,
              positive: true,
            }));

        const privateHistory =
          ps.transactions.filter(t=>!t.cashTransfer).map(
            (t) => ({
              id: t.id,
              date: t.date,
              title:
                t.description,
              amount:
                Math.abs(
                  t.amount,
                ),
              positive:
                t.type ===
                  "adjust" &&
                t.amount > 0,
              source: t,
            }),
          );

        const history = [
          ...sharedIncoming,
          ...privateHistory,
        ].sort(
          (a, b) =>
            b.date.localeCompare(
              a.date,
            ),
        );
        // The account's month picker controls private history as well.
        // Hide older/future months until the user deliberately navigates there.
        const monthlyHistory = history.filter(h => month(h.date) === selectedMonth);
        const filteredPersonalHistory = monthlyHistory.filter(h => {
          const tx = ps.transactions.find(t => t.id === h.id);
          const cat = tx?.budgetId ? (ps.budgets??[]).find(b=>b.id===tx.budgetId)?.name || "Sans catégorie" : tx?"Sans catégorie":"Virement du foyer";
          const query=personalTransactionQuery.trim().toLocaleLowerCase("fr");
          if(query&&![h.title,cat,dateLabel(h.date),money(h.amount)]
            .some(v=>(v||"").toLocaleLowerCase("fr").includes(query)))return false;
          if(personalTransactionType==="expense"&&tx?.type!=="expense")return false;
          if(personalTransactionType==="transfer"&&tx)return false;
          if(personalTransactionType==="adjust"&&tx?.type!=="adjust")return false;
          if(personalTransactionCategory!=="all"&&(tx?.budgetId||"none")!==personalTransactionCategory)return false;
          return true;
        });
        const renderPersonalHistoryRows = (items: typeof history) => items.map(h => {
          const privateTx = ps.transactions.find(t => t.id === h.id);
          const privateCategory = privateTx?.budgetId
            ? (ps.budgets ?? []).find(b => b.id === privateTx.budgetId)?.name
            : undefined;
          return (
            <SwipeActions key={h.id} label={h.title || "Mouvement personnel"} className="transaction-swipe-row"
              actions={privateTx ? [
                { label: "Modifier", icon: <Pencil size={17}/>, onClick: () => editPersonalHistoryTransaction(privateTx) },
                { label: "Supprimer", icon: <Trash2 size={17}/>, tone: "danger" as const,
                  onClick: () => deletePersonalTransaction(privateTx) },
              ] : []}>
              <Row
                icon={h.positive ? <ArrowDownLeft className="transaction-income-arrow"/> : <ArrowUpRight className="transaction-expense-arrow"/>}
                title={h.title || "Mouvement personnel"}
                sub={privateTx
                  ? `${dateLabel(h.date)}${h.date > today() ? " · À venir" : ""} · ${privateCategory || "Sans catégorie"}`
                  : `${dateLabel(h.date)} · Virement du foyer`}
                value={<span className={h.positive ? "positive" : "negative-money"}>
                  {h.positive ? "+" : "−"}{money(h.amount)}
                </span>}
                onClick={() => {
                  if (privateTx) personalTransactionDetails(privateTx);
                  else explain(h.title || "Virement perso", <>
                    <div className="big-number">+{money(h.amount)}</div>
                    <p>{dateLabel(h.date)} · Virement du foyer</p>
                    <p>Virement du compte commun vers votre budget personnel.</p>
                  </>);
                }}
              />
            </SwipeActions>
          );
        });

        const activePrivateBudgets = (ps.budgets ?? []).filter(
          b => selectedMonth >= b.start && (!b.end || selectedMonth <= b.end)
        );
        const privateBudgetsTotal = activePrivateBudgets.reduce((n, b) => n + b.amount, 0);
        const personalSpentForBudget=(budgetId:string)=>ps.transactions
          .filter(t=>t.type==="expense"&&t.budgetId===budgetId&&month(t.date)===selectedMonth&&t.date<=today())
          .reduce((sum,t)=>sum+t.amount,0);
        const personalPlannedForBudget=(budgetId:string)=>ps.transactions
          .filter(t=>t.type==="expense"&&t.budgetId===budgetId&&month(t.date)===selectedMonth&&t.date>today())
          .reduce((sum,t)=>sum+t.amount,0);
        const privateBudgetSpent = activePrivateBudgets.reduce((sum,b)=>sum+personalSpentForBudget(b.id),0);
        const privateBudgetPlanned = activePrivateBudgets.reduce((sum,b)=>sum+personalPlannedForBudget(b.id),0);
        const privateBudgetLeft = privateBudgetsTotal - privateBudgetSpent - privateBudgetPlanned;
        const personalOutgoings = personalMonthOutgoings(ps, selectedMonth);
        const personalEndOfMonth=privateBalance+Math.max(0,envelope.remaining)-
          personalOutgoings.budgetRemaining-personalOutgoings.uncovered;
        const activeAdvances = s.transactions.filter(t =>
          t.type === "personal_transfer" &&
          t.personalOwner === personalOwnerId &&
          t.category === account.category &&
          t.personalKind === "advance"
        );
        const activePrivateRules = ps.rules.filter(r => !r.end || r.end >= today());
        const projectionPreview = personalProjection(
          ps, s, personalOwnerId, personalProjectionMonths
        ).at(-1);

        return (
          <>
            <PersonalPageStyles/>
            <div className="personal-page-v2">
<div className="ws-segmented personal-ws-tabs" role="tablist" aria-label="Navigation du compte personnel">
{([{id:"home",label:"Accueil"},{id:"transactions",label:"Opérations"},
{id:"budgets",label:"Budgets"},{id:"projection",label:"Prévisions"}] as const).map(({id,label})=>
<button key={id} type="button" role="tab" aria-selected={personalTab===id}
  onClick={()=>{setPersonalTab(id);setMobileQuickAddOpen(false);}}>{label}</button>)}
</div>
<div className="month-picker month-picker-inline-arrows personal-v3-month-picker">
  <div className="month-picker-arrow-group month-picker-arrow-group-prev">
    {selectedMonth>month()&&<button className="month-reset icon" type="button" aria-label="Revenir au mois actuel" title="Mois actuel" onClick={()=>setMonth(month())}><ChevronsLeft size={19}/></button>}
    <button className="icon" type="button" aria-label="Mois précédent" disabled={selectedMonth<=month()&&!previousRecordedMonth} onClick={()=>moveViewingMonth(-1)}><ChevronLeft size={18}/></button>
  </div>
  <label className="month-picker-current"><span aria-hidden="true">{monthLabel(selectedMonth)}</span>
    <input type="month" aria-label="Choisir le mois affiché" min={recordedMonths[0]||month()} value={selectedMonth}
      onChange={e=>{const m=e.target.value;if(m&&(m>=month()||recordedMonths.includes(m)))setMonth(m);}}/>
  </label>
  <div className="month-picker-arrow-group month-picker-arrow-group-next">
    <button className="icon" type="button" aria-label="Mois suivant" onClick={()=>moveViewingMonth(1)}><ChevronRight size={18}/></button>
    {selectedMonth<month()&&<button className="month-reset icon" type="button" aria-label="Revenir au mois actuel" title="Mois actuel" onClick={()=>setMonth(month())}><ChevronsRight size={19}/></button>}
  </div>
</div>
{personalTab==="home"&&<>
<section className="ws-card ws-hero" aria-label="Solde de votre compte personnel">
  <div className="ws-head">
    <span className="ws-muted">Solde privé · {account.name}</span>
    <button type="button" className="ws-link" style={{ minHeight: 32 }}
      onClick={() => explain("Confidentialité du compte perso", <>
        <p>Le solde et les opérations privées sont accessibles uniquement à votre compte Wimm.</p>
        <p>Les autres membres du foyer voient le budget lié et les virements depuis le compte commun, sans voir les dépenses personnelles.</p>
      </>)}>
      <UserRound size={14} aria-hidden="true"/>Privé
    </button>
  </div>
  <span className={`ws-key${privateBalance < 0 ? " ws-negative" : ""}`}>{money(privateBalance)}</span>
  <span className="ws-muted">{privateCash > 0 ? money(privateBank) + " en banque · " + money(privateCash) + " en espèces" : "Solde actuel · " + dateLabel(today())}</span>
  {selectedMonth===month()&&<div className={`ws-highlight${personalEndOfMonth < 0 ? " is-negative" : ""}`}>
    <span className="ws-head-title">Disponible fin de mois
      <BlockInfo title="Calcul du disponible estimé">
        <p>Solde actuel + virements prévus − budgets restants, dépenses futures et échéances à payer.</p>
      </BlockInfo>
    </span>
    <span className={`ws-figure${personalEndOfMonth < 0 ? " ws-negative" : " ws-positive"}`}>{money(personalEndOfMonth)}</span>
  </div>}
</section>

<section className="ws-card ws-list" aria-label="Budget lié au foyer">
  <div className="ws-row">
    <span className="ws-row-main"><span className="ws-row-title">Budget lié au foyer</span>
      <span className="ws-row-sub">{category?.name || "Non configuré"} · {money(envelope.base)} / mois</span></span>
  </div>
  <div className="ws-row">
    <span className="ws-row-main"><span className="ws-row-title">Reste à virer</span>
      <span className="ws-row-sub">{envelope.carryIn > 0 ? money(envelope.carryIn) + " reportés" : "Aucun report"}</span></span>
    <span className={`ws-amount${envelope.remaining < 0 ? " ws-negative" : ""}`}>{money(envelope.remaining)}</span>
  </div>
  <button type="button" className="ws-row" onClick={editPersonalCash}>
    <span className="ws-row-main"><span className="ws-row-title">Espèces</span>
      <span className="ws-row-sub">{privateCash > 0 ? "Modifier le montant" : "Ajouter un montant en espèces"}</span></span>
    <span className="ws-amount">{money(privateCash)}</span>
    <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
  </button>
</section>

<nav className="ws-pill-row" aria-label="Actions du compte perso">
  <button type="button" className="ws-pill" onClick={() => personalExpense()}>Dépense</button>
  <button type="button" className="ws-pill" onClick={() => addPersonalMoney()}>Ajouter</button>
  <button type="button" className="ws-pill" onClick={() => transferPersonal()}>Virer</button>
</nav>

<section className="card transaction-search-results personal-v2-history personal-v2-transactions" aria-label="Aperçu des transactions">
<div className="ws-head"><h2 className="ws-card-title">Dernières opérations</h2>
<button type="button" className="ws-link" onClick={()=>setPersonalTab("transactions")}>Tout voir <ChevronRight size={16} aria-hidden="true"/></button></div>
{monthlyHistory.length?<div className="personal-v2-history-rows">{renderPersonalHistoryRows(monthlyHistory.slice(0,3))}</div>
:<p className="ws-muted" style={{ padding: "8px 0" }}>Aucune opération ce mois-ci.</p>}
</section>
</>}
{personalTab==="transactions"&&<>
<section className="card personal-v4-search-panel" aria-label="Rechercher des opérations privées">
  <div className="transaction-search-top personal-v4-search-top">
    <label className="transaction-search-input">
      <Search size={18} aria-hidden="true"/>
      <span className="sr-only">Rechercher une transaction</span>
      <input type="search" placeholder="Nom, catégorie ou montant…" value={personalTransactionQuery}
        onChange={e=>setPersonalTransactionQuery(e.target.value)}/>
    </label>
    <button type="button" className="secondary" onClick={()=>setPersonalFiltersExpanded(v=>!v)}
      aria-expanded={personalFiltersExpanded} aria-controls="personal-v4-filters">
      <SlidersHorizontal size={17}/> Filtres
      {(personalTransactionType!=="all"||personalTransactionCategory!=="all")
        ? ` (${Number(personalTransactionType!=="all")+Number(personalTransactionCategory!=="all")})` : ""}
    </button>
    <button type="button" className="primary" onClick={()=>personalExpense()}>
      <Plus size={17}/> Opération
    </button>
  </div>
  {personalFiltersExpanded&&<div className="personal-v4-filter-grid" id="personal-v4-filters">
    <label className="field"><span>Type</span>
      <select value={personalTransactionType} onChange={e=>setPersonalTransactionType(e.target.value)}>
        <option value="all">Toutes les opérations</option>
        <option value="expense">Dépenses</option>
        <option value="transfer">Virements du foyer</option>
        <option value="adjust">Ajustements privés</option>
      </select>
    </label>
    <label className="field"><span>Catégorie</span>
      <select value={personalTransactionCategory} onChange={e=>setPersonalTransactionCategory(e.target.value)}>
        <option value="all">Toutes les catégories</option>
        <option value="none">Sans catégorie</option>
        {(ps.budgets??[]).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
    <button type="button" className="text personal-v4-clear-filters" onClick={()=>{
      setPersonalTransactionQuery("");
      setPersonalTransactionType("all");
      setPersonalTransactionCategory("all");
    }}>Effacer les filtres</button>
  </div>}
</section>
<section className="card transaction-search-results personal-v2-history personal-v2-transactions personal-v4-full-history" aria-label="Toutes les opérations personnelles">
  <p className="muted" role="status">{filteredPersonalHistory.length} opération{filteredPersonalHistory.length!==1?"s":""}</p>
  {filteredPersonalHistory.length
    ? <SortableList items={filteredPersonalHistory}>{renderPersonalHistoryRows}</SortableList>
    : <p className="muted padded">Aucune opération correspondant à votre recherche sur {monthLabel(selectedMonth)}.</p>}
</section>
</>}
{personalTab==="budgets"&&<>
<section className="personal-v2-panel personal-v2-envelope">
                <div className="personal-v3-panel-head">
                  <span className="personal-v2-panel-icon"><Wallet size={21}/></span>
                  <span className="personal-v2-panel-copy">
                    <strong>Enveloppe du foyer · {monthLabel(selectedMonth)}</strong>
                    <small>Budget, versements et reports</small>
                  </span>
                  
                </div>
                <div className="personal-v2-panel-content">
                  <div className="personal-v2-month-overview">
                    <Row title="Budget mensuel lié" value={money(envelope.base)}/>
                    {envelope.carryIn > 0 && <Row title="Report précédent" value={"− " + money(envelope.carryIn)}/>}
                    <Row title="Budget disponible" value={money(envelope.available)}/>
                    <Row title="Déjà engagé / viré" value={money(envelope.committed)}/>
                    <Progress value={envelope.committed} max={Math.max(1, envelope.available)}/>
                    <Row title="Reste à virer" value={money(envelope.remaining)}/>
                    {envelope.carryOut > 0 && <p className="warning">
                      Dépassement de {money(envelope.carryOut)} reporté sur le mois suivant.
                    </p>}
                  </div>
                  {category && <button type="button" className="text" onClick={() => editCategory(category)}>
                    <Pencil size={15}/> Modifier le budget lié
                  </button>}
                </div>
              </section>

              
<section className="personal-v2-panel personal-v2-budget-panel">
                <div className="personal-v3-panel-head">
                  <span className="personal-v2-panel-icon"><Coins size={20}/></span>
                  <span className="personal-v2-panel-copy">
                    <strong>Mes budgets personnels</strong>
                    <small>Dépensé et restant · sans débit anticipé</small>
                  </span>
                  <span className="personal-v2-panel-side">
                    <strong>{money(privateBudgetsTotal)}</strong>
                    <small>par mois</small>
                  </span>
                  
                </div>
                <div className="personal-v2-panel-content">
                  <section className="card personal-budgets-card">
              <div className="section-head">
                <div>
                  <h2>
                    Budgets mensuels perso
                  </h2>

                  <BlockInfo title="Fonctionnement des budgets personnels">
                    <p>Chaque budget suit les dépenses réelles et affiche le montant encore disponible. Les prévisions n’affectent pas le budget commun et ne débitent pas votre compte.</p>
                  </BlockInfo>
                </div>

                <button
                  className="secondary"
                  onClick={() =>
                    editPersonalBudget()
                  }
                >
                  <Plus size={17} />
                  Budget
                </button>
              </div>

              <div className="personal-budget-overview" aria-label="Résumé des budgets personnels du mois">
                <div><span>Prévu</span><strong>{money(privateBudgetsTotal)}</strong></div>
                <div><span>Dépensé</span><strong>{money(privateBudgetSpent)}</strong></div>
                <div><span>Restant</span><strong className={privateBudgetLeft < 0 ? "negative-money" : "positive-money"}>{money(privateBudgetLeft)}</strong>{privateBudgetPlanned>0&&<small>{money(privateBudgetPlanned)} prévus</small>}</div>
              </div>
              <div className="personal-budget-grid">
              {(ps.budgets ?? []).map(b => {
                const active = selectedMonth >= b.start && (!b.end || selectedMonth <= b.end);
                const spent = personalSpentForBudget(b.id);
                const planned = personalPlannedForBudget(b.id);
                const remaining = b.amount - spent - planned;
                const expanded = selectedPersonalBudget === b.id;
                const txs = ps.transactions.filter(t => t.type === "expense" && t.budgetId === b.id && month(t.date) === selectedMonth)
                  .sort((a, c) => c.date.localeCompare(a.date));
                return (
                  <SwipeActions key={b.id} label={b.name} className="personal-budget-swipe-row" actions={[
                    {label:"Modifier",icon:<Pencil size={17}/>,onClick:()=>editPersonalBudget(b)},
                    {label:"Supprimer",icon:<Trash2 size={17}/>,tone:"danger" as const,onClick:()=>confirmAction(
                      "Supprimer " + b.name + " ?",
                      "Le budget disparaîtra des prévisions, mais les dépenses enregistrées seront conservées.",
                      async () => changePersonal(d => {d.budgets = (d.budgets ?? []).filter(x => x.id !== b.id);},"Budget perso supprimé")
                    )},
                  ]}>
                    <div className={"personal-budget-item"+(active?"":" is-inactive")}>
                      <button type="button" className="personal-budget-item-main"
                        aria-expanded={expanded} aria-label={"Voir les dépenses du budget " + b.name}
                        onClick={() => setSelectedPersonalBudget(id => id===b.id ? null : b.id)}>
                        <span className="personal-budget-item-head">
                          <span className="personal-budget-item-glyph"><Coins size={17}/></span>
                          <strong>{b.name}</strong>
                          <ChevronRight className={"personal-budget-chevron"+(expanded?" expanded":"")} size={16}/>
                        </span>
                        <span className="personal-budget-item-amounts">
                          <span><strong className={remaining < 0 ? "negative-money" : "positive-money"}>{money(remaining)}</strong><small>{active?"restants":"hors période"}</small></span>
                          <span><strong>{money(spent)}</strong><small>{planned>0 ? money(planned)+" à venir · " : ""}sur {money(b.amount)}</small></span>
                        </span>
                        {active && <span className="personal-budget-bar"><Progress value={spent+planned} max={Math.max(1,b.amount)}/></span>}
                        <span className="personal-budget-item-foot">{active ? txs.length+" dépense(s) · Voir le détail" : "Actif dès "+monthLabel(b.start)+(b.end?" · fin "+monthLabel(b.end):"")}</span>
                      </button>
                      {expanded && <div className="personal-budget-details">
                        <div className="personal-budget-detail-heading">
                          <strong>Dépenses · {monthLabel(selectedMonth)}</strong>
                          <button type="button" className="text" onClick={()=>editPersonalBudget(b)}><Pencil size={14}/> Modifier</button>
                        </div>
                        {txs.length ? txs.map(t => <div className="personal-budget-transaction" key={t.id}>
                          <span><strong>{t.description||"Dépense"}</strong><small>{dateLabel(t.date)}{t.date>today()?" · À venir":""}</small></span>
                          <strong>{money(t.amount)}</strong>
                          <button type="button" className="icon" title="Modifier cette dépense" aria-label={"Modifier "+(t.description||"la dépense")} onClick={()=>personalExpense(t)}><Pencil size={15}/></button>
                        </div>) : <p className="muted">Aucune dépense pour ce mois.</p>}
                      </div>}
                    </div>
                  </SwipeActions>
                );
              })}
              </div>
              {!(ps.budgets ?? [])
                .length && (
                <p className="muted">
                  Aucun budget mensuel personnel.
                </p>
              )}

            </section>
                </div>
              </section>

              
</>}
{personalTab==="projection"&&<>
<section className="personal-v2-panel personal-v2-projection-panel">
                <div className="personal-v3-panel-head">
                  <span className="personal-v2-panel-icon"><ChartNoAxesCombined size={20}/></span>
                  <span className="personal-v2-panel-copy">
                    <strong>Mon argent à venir</strong>
                    <small>Solde estimé en {projectionPreview ? monthLabel(projectionPreview.date) : "fin de période"}</small>
                  </span>
                  <span className="personal-v2-panel-side">
                    <strong>{projectionPreview ? money(projectionPreview.balance) : "—"}</strong>
                  </span>
                  
                </div>
                <div className="personal-v2-panel-content">
                  <section className="card">
              <div className="section-head">
                <div>
                  <h2>
                    Projection du compte perso
                  </h2>
                  <BlockInfo title="Comment fonctionne la projection ?">
                    <p>La projection est basée sur votre solde actuel, les futurs virements de budget, vos avances, vos mensualités connues et vos budgets mensuels personnels.</p>
                    <p>Les budgets mensuels personnels sont des dépenses futures prévues. Les dépenses futures enregistrées sont prises en compte sans être déduites deux fois des budgets.</p>
                    <p>Touchez ou faites glisser votre doigt sur la courbe pour consulter un autre mois.</p>
                  </BlockInfo>
                </div>

                <div className="pills">
                  {[
                    [6, "6 mois"],
                    [12, "1 an"],
                    [24, "2 ans"],
                    [60, "5 ans"],
                  ].map(
                    ([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        className={
                          personalProjectionMonths ===
                          value
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setPersonalProjectionMonths(
                            Number(
                              value,
                            ),
                          )
                        }
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <Suspense fallback={<div className="chart-loading"/>}>
                <LazyPersonalProjectionChart points={personalProjection(
                  ps, s, personalOwnerId, personalProjectionMonths
                )}/>
              </Suspense>

            </section>
                </div>
              </section>

              
<section className="personal-v2-panel personal-v2-commitments-panel">
                <div className="personal-v3-panel-head">
                  <span className="personal-v2-panel-icon"><CalendarDays size={20}/></span>
                  <span className="personal-v2-panel-copy">
                    <strong>Mes engagements</strong>
                    <small>Avances et paiements en plusieurs fois</small>
                  </span>
                  <span className="personal-v2-panel-side">
                    <strong>{activeAdvances.length + activePrivateRules.length}</strong>
                    <small>enregistré(s)</small>
                  </span>
                  
                </div>
                <div className="personal-v2-panel-content">
                  <section className="card personal-advances-card">
              <div className="section-head">
                <div>
                  <h2>
                    Avances en cours
                  </h2>
                  <BlockInfo title="Fonctionnement des avances personnelles">
                    <p>Le montant a déjà quitté le compte courant. Seule sa part mensuelle réduit maintenant votre budget perso.</p>
                  </BlockInfo>
                </div>

                <button
                  className="secondary"
                  onClick={() =>
                    personalAdvance()
                  }
                >
                  <Plus size={17} />
                  Faire une avance
                </button>
              </div>

              {s.transactions
                .filter(
                  (t) =>
                    t.type ===
                      "personal_transfer" &&
                    t.personalOwner ===
                      personalOwnerId &&
                    t.category ===
                      account.category &&
                    t.personalKind ===
                      "advance",
                )
                .map((t) => {

                  const start =
                    t.personalStartMonth ||
                    month(t.date);

                  const count =
                    Math.max(
                      1,
                      t.personalMonths ||
                        1,
                    );

                  const end =
                    shiftMonth(
                      start,
                      count - 1,
                    );

                  const currentPart =
                    personalTransferBudgetAmount(
                      t,
                      selectedMonth,
                    );

                  let remaining = 0;

                  for (
                    let i = 0;
                    i < count;
                    i++
                  ) {
                    const m =
                      shiftMonth(
                        start,
                        i,
                      );

                    if (
                      m >= month()
                    )
                      remaining +=
                        personalTransferBudgetAmount(
                          t,
                          m,
                        );
                  }

                  return (
                    <div
                      className="rule-row"
                      key={t.id}
                    >
                      <div className="grow">
                        <strong>
                          {t.description ||
                            "Avance perso"}
                        </strong>

                        <small>
                          {money(
                            t.amount,
                          )}{" "}
                          reçus immédiatement
                        </small>

                        <small>
                          {monthLabel(
                            start,
                          )}{" "}
                          →{" "}
                          {monthLabel(
                            end,
                          )}{" "}
                          · {count} mois
                        </small>

                        {currentPart >
                          0 && (
                          <small>
                            Part de{" "}
                            {monthLabel(
                              selectedMonth,
                            )}{" "}
                            :{" "}
                            {money(
                              currentPart,
                            )}
                          </small>
                        )}
                      </div>

                      <div>
                        <strong>
                          {money(
                            remaining,
                          )}
                        </strong>
                        <small>
                          encore à imputer
                        </small>
                      </div>
                    </div>
                  );

                })}

              {!s.transactions.some(
                (t) =>
                  t.type ===
                    "personal_transfer" &&
                  t.personalOwner ===
                    personalOwnerId &&
                  t.category ===
                    account.category &&
                  t.personalKind ===
                    "advance",
              ) && (
                <p className="muted">
                  Aucune avance en cours.
                </p>
              )}
            </section>


            <section className="card personal-installments-card">
              <div className="section-head">
                <div>
                  <h2>
                    Paiements en plusieurs fois
                  </h2>
                  <BlockInfo title="Paiements en plusieurs fois">
                    <p>Ces échéances débitent uniquement votre compte perso.</p>
                  </BlockInfo>
                </div>

                <button
                  className="secondary"
                  onClick={() =>
                    editPersonalRule()
                  }
                >
                  <Plus size={17} />
                  Paiement
                </button>
              </div>

              {ps.rules
                .filter(
                  (r) =>
                    !r.end ||
                    r.end >= today(),
                )
                .map((r) => {

                const due =
                  personalDues(
                    ps,
                    selectedMonth,
                  ).find(
                    (d) =>
                      d.rule.id ===
                      r.id,
                  );

                const paidCount =
                  ps.transactions.filter(
                    (t) =>
                      t.dueKey?.startsWith(
                        r.id + ":",
                      ),
                  ).length;

                return (
                  <div
                    className="rule-row"
                    key={r.id}
                  >
                    <div className="grow">
                      <strong>
                        {r.name}
                      </strong>

                      <small>
                        {money(
                          r.amount,
                        )}{" "}
                        · {r.count} paiement
                        {r.count >
                        1
                          ? "s"
                          : ""}
                      </small>

                      <small>
                        Catégorie :{" "}
                        {r.budgetId
                          ? (
                              ps.budgets ??
                              []
                            ).find(
                              (b) =>
                                b.id ===
                                r.budgetId,
                            )?.name ||
                            "Catégorie supprimée"
                          : "Sans catégorie"}
                      </small>

                      <small>
                        {paidCount} validé
                        {paidCount >
                        1
                          ? "s"
                          : ""}{" "}
                        ·{" "}
                        {Math.max(
                          0,
                          r.count -
                            paidCount,
                        )}{" "}
                        restant
                        {Math.max(
                          0,
                          r.count -
                            paidCount,
                        ) > 1
                          ? "s"
                          : ""}
                      </small>
                    </div>

                    {due &&
                      (
                        due.paid ? (
                          <span className="badge">
                            <Check
                              size={14}
                            />
                            Payé
                          </span>
                        ) : (
                          <button
                            className="primary compact"
                            onClick={() =>
                              payPersonalDue(
                                due,
                              )
                            }
                          >
                            Valider{" "}
                            {money(
                              r.amount,
                            )}
                          </button>
                        )
                      )}

                    <button
                      className="secondary compact"
                      onClick={() =>
                        editPersonalRule(
                          r,
                        )
                      }
                    >
                      Modifier
                    </button>

                    <button
                      className="icon"
                      aria-label="Supprimer cet échéancier"
                      onClick={() =>
                        confirmAction(
                          "Supprimer " +
                            r.name +
                            " ?",
                          "Les échéances futures seront supprimées. Les mensualités déjà validées pour cet échéancier seront également retirées de l’historique et recréditées sur le solde du compte perso.",
                          async () =>
                            changePersonal(
                              (d) => {
                                d.rules =
                                  d.rules.filter(
                                    (
                                      x,
                                    ) =>
                                      x.id !==
                                      r.id,
                                  );

                                d.transactions =
                                  d.transactions.filter(
                                    (t) =>
                                      !t.dueKey?.startsWith(
                                        r.id + ":",
                                      ),
                                  );
                              },
                              "Paiement en plusieurs fois supprimé",
                            ),
                        )
                      }
                    >
                      <Trash2
                        size={16}
                      />
                    </button>
                  </div>
                );

              })}

              {!ps.rules.length && (
                <p className="muted">
                  Aucun paiement en plusieurs fois sur votre compte perso.
                </p>
              )}
            </section>
                </div>
              </section>

              
</>}
<div className="personal-v2-privacy-note">
  <span>Compte privé · fonctionnement</span>
  <BlockInfo title="Confidentialité et prévisions personnelles">
    <p>Les dépenses de ce compte ne sont pas incluses dans le patrimoine commun.</p>
    <p>Les budgets suivent les dépenses réelles et anticipent celles à venir, sans débit automatique.</p>
  </BlockInfo>
</div>
            </div>
          </>
        );



      })()}
    </>
  );
}
