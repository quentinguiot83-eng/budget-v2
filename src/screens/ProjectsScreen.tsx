import { money, today, dateLabel } from "../engine";
import { deleteTripCover } from "../tripCovers";
import TripsPageStyles from "../TripsPageStyles";
import { Empty, Progress } from "../ui";
import { Plane, Target, Plus, CalendarDays, ChevronRight, ChevronLeft, Pencil, Trash2, ArrowUpRight } from "lucide-react";
import { palette } from "../app/shared";
import type { WimmView } from "../app/buildView";

export default function ProjectsScreen({ view }: { view: WimmView }) {
  const {
    activeTrip, change, confirmAction, editTrip, explain, operation, projectsSection,
    retryFailedImage, s, setActiveTrip, setProjectsSection, setShowArchivedTrip,
    showArchivedTrip, transfer, tripCategory, tripCoverUrls, txDetails, txRows,
  } = view;
  return (
    <div className="trips-page-v2 projects-page">
      <TripsPageStyles/>
      <div className="projects-type-switch" role="tablist" aria-label="Types de projets">
        <button type="button" role="tab" aria-selected={projectsSection==="trips"}
          className={projectsSection==="trips"?"selected":""} onClick={()=>setProjectsSection("trips")}>
          <Plane size={18}/> Voyages
        </button>
        <button type="button" role="tab" aria-selected={projectsSection==="other"}
          className={projectsSection==="other"?"selected":""} onClick={()=>setProjectsSection("other")}>
          <Target size={18}/> Autres projets <small>Bientôt</small>
        </button>
      </div>
      {projectsSection==="other" ? (
        <section className="card projects-coming-soon">
          <span className="projects-future-icon"><Target size={29}/></span>
          <span className="badge">En développement</span>
          <h2>Vos futurs projets, au même endroit</h2>
          <p>Vous pourrez bientôt suivre d’autres projets : un achat immobilier, une voiture ou tout objectif d’épargne.</p>
          <p className="muted">Cette fonctionnalité n’est pas encore disponible. Vos voyages restent inchangés.</p>
          <button type="button" className="secondary" onClick={()=>setProjectsSection("trips")}>
            <Plane size={17}/> Voir mes voyages
          </button>
        </section>
      ) : (
        <>
      <div className="trips-top-actions">
        <p className="muted">Des projets de voyage, un budget maîtrisé.</p>
        <button type="button" className="primary" onClick={() => editTrip()}>
          <Plus size={17}/> Nouveau voyage
        </button>
      </div>
      {!s.trips.length ? (
        <Empty title="Quel sera votre prochain départ ?"
          action={<button className="primary" onClick={() => editTrip()}>Préparer un voyage</button>}>
          Prévoyez le budget, suivez les dépenses et son financement.
        </Empty>
      ) : (
        <>
          {s.trips.some(t => !t.closedAt) && (
            <section className="trips-active-picker" aria-label="Choisir un voyage actif">
              <div className="trips-section-heading">
                <strong>Mes voyages</strong>
                <small className="muted">{s.trips.filter(t => !t.closedAt).length} actif(s)</small>
              </div>
              <div className="trip-tabs">
                {s.trips.filter(t => !t.closedAt).map(t => {
                  const selected = (activeTrip || s.trips.find(x => !x.closedAt)?.id || s.trips[0]?.id) === t.id;
                  return (
                    <button type="button" key={t.id} className={selected ? "selected" : ""}
                      aria-pressed={selected} onClick={() => { setActiveTrip(t.id); setShowArchivedTrip(false); }}>
                      {t.coverPath && tripCoverUrls[t.coverPath]
                        ? <img className="trips-tab-image" src={tripCoverUrls[t.coverPath]} alt="" loading="lazy" onError={() => t.coverPath && retryFailedImage(t.coverPath)}/>
                        : <Plane size={16}/>}
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {s.trips.some(t => !!t.closedAt) && (
            <details className="trips-archive-picker" onToggle={event => {
               if (!event.currentTarget.open) {
                 setShowArchivedTrip(false);
                 setActiveTrip(id => s.trips.some(trip => trip.id === id && !!trip.closedAt) ? "" : id);
               }
             }}>
              <summary>
                <CalendarDays size={17}/>
                Voyages terminés ({s.trips.filter(t => !!t.closedAt).length})
                <ChevronRight size={17}/>
              </summary>
              <div className="trip-tabs">
                {s.trips.filter(t => !!t.closedAt).map(t => {
                  const total = s.transactions.filter(x => x.trip === t.id && x.type === "expense")
                    .reduce((n, x) => n + x.amount, 0);
                  return (
                    <button type="button" className={activeTrip === t.id ? "selected" : ""}
                      aria-pressed={activeTrip === t.id} key={t.id} onClick={() => { setActiveTrip(t.id); setShowArchivedTrip(true); }}>
                      {t.coverPath && tripCoverUrls[t.coverPath]
                        ? <img className="trips-tab-image" src={tripCoverUrls[t.coverPath]} alt="" loading="lazy" onError={() => t.coverPath && retryFailedImage(t.coverPath)}/>
                        : <Plane size={16}/>}
                      {t.name} · {money(total)}
                    </button>
                  );
                })}
              </div>
            </details>
          )}
          {(() => {
            const t = s.trips.find(t => t.id === activeTrip && (!t.closedAt || showArchivedTrip)) ||
               s.trips.find(t => !t.closedAt);
             if (!t) return <p className="muted trips-no-active">Aucun voyage actif. Ouvrez « Voyages terminés » pour consulter vos anciens séjours.</p>;
            const tx = s.transactions.filter(x => x.trip === t.id);
            const expenses = tx.filter(x => x.type === "expense");
            const spent = expenses.reduce((n, x) => n + x.amount, 0);
            const transfers = tx.filter(x => x.type === "transfer");
            const funded = transfers.reduce((n, x) =>
              n + (s.accounts.find(a => a.id === x.to)?.group === "current" ? x.amount : -x.amount), 0);
            const availableCategories = t.categories.filter(c => !c.archived || tx.some(x => x.tripCategory === c.id));
            const allocated = t.categories.filter(c => !c.archived).reduce((n, c) => n + c.budget, 0);
            const leftover = t.budget - spent;
            return (
              <>
                {t.closedAt && <div className="trips-archive-back">
                  <button type="button" className="secondary" onClick={() => {
                    setActiveTrip("");
                    setShowArchivedTrip(false);
                  }}><ChevronLeft size={17}/> Retour aux voyages terminés</button>
                </div>}
                <section className={"trips-v2-hero trips-cover-hero" + (t.coverPath && tripCoverUrls[t.coverPath] ? " has-cover" : "")}
                  aria-label="Voyage sélectionné">
                  {t.coverPath && tripCoverUrls[t.coverPath] && (
                    <img className="trips-cover-photo" src={tripCoverUrls[t.coverPath]}
                      alt="" onError={() => t.coverPath && retryFailedImage(t.coverPath)}
                      style={{ objectPosition: "50% " + (t.coverPosition ?? 50) + "%" }}/>
                  )}
                  <div className="trips-cover-overlay"/>
                  <div className="trips-cover-header">
                    <span className="trip-icon"><Plane size={25}/></span>
                    <div className="trips-hero-content">
                      <span className="trips-hero-status">
                        {t.closedAt ? "Voyage terminé" :
                          today() < t.start ? "Voyage à venir" :
                          today() <= t.end ? "Voyage en cours" : "Voyage à clôturer"}
                      </span>
                      <h2>{t.name}</h2>
                      <p>{dateLabel(t.start)} — {dateLabel(t.end)}</p>
                    </div>
                    {!t.closedAt && (
                      <button type="button" className="icon trips-cover-edit-trip"
                        aria-label={"Modifier le voyage " + t.name}
                        onClick={() => editTrip(t)}><Pencil size={18}/></button>
                    )}
                  </div>
                </section>

                <section className="trips-overview-card" aria-label="Budget du voyage">
                  <div className="trips-budget-header">
                    <div>
                      <h2>Budget du voyage</h2>
                      <strong className="trips-budget-spent">{money(spent)}</strong>
                    </div>
                    <span className="trips-budget-target">dépensés sur {money(t.budget)}</span>
                  </div>
                  <Progress value={spent} max={t.budget}/>
                  <div className="trips-budget-footer">
                    <span className={"trips-budget-rest" + (leftover < 0 ? " negative" : "")}>
                      {leftover < 0 ? "Dépassé de " + money(-leftover) : money(leftover) + " disponibles"}
                    </span>
                    {!t.closedAt && (
                      <button type="button" className="primary" onClick={() => operation("expense", t)}>
                        <Plus size={17}/> Ajouter une dépense
                      </button>
                    )}
                  </div>
                </section>

                <section className="trips-financing-card" aria-label="Financement du voyage">
                  <div className="trips-finance-copy">
                    <h2>Financement</h2>
                    <strong className="trips-finance-value">{money(funded)}</strong>
                    <p>Transférés vers le compte courant pour ce voyage</p>
                    <small>{funded >= spent
                      ? "Avance disponible : " + money(funded - spent)
                      : "Dépenses non compensées : " + money(spent - funded)}</small>
                  </div>
                  {!t.closedAt && (
                    <button type="button" className="secondary" onClick={() => transfer(
                      undefined, t, s.accounts.find(a => a.group === "travel")
                    )}>Financer le voyage <ChevronRight size={16}/></button>
                  )}
                </section>

                <section className="trips-categories-card" aria-label="Enveloppes du voyage">
                  <div className="section-head">
                    <h2>Mes enveloppes</h2>
                    {!t.closedAt && (
                      <button type="button" className="text" onClick={() => tripCategory(t)}>
                        <Plus size={16}/> Ajouter
                      </button>
                    )}
                  </div>
                  <div className="trips-category-list">
                    {availableCategories.map((c, i) => {
                      const paid = expenses.filter(x => x.tripCategory === c.id)
                        .reduce((n, x) => n + x.amount, 0);
                      return (
                        <div className="trip-category trip-category-clickable" key={c.id} role="button" tabIndex={0}
                          style={{ cursor: "pointer" }} aria-label={"Voir toutes les dépenses de " + c.name}
                          onClick={event => {
                            if (!(event.target as HTMLElement).closest("button"))
                              explain("Dépenses · " + c.name, txRows([...expenses].filter(x => x.tripCategory === c.id).sort((a,b) => b.date.localeCompare(a.date))));
                          }}
                          onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                            event.preventDefault();
                            explain("Dépenses · " + c.name, txRows([...expenses].filter(x => x.tripCategory === c.id).sort((a,b) => b.date.localeCompare(a.date))));
                          } }}>
                          <div className="trips-category-top">
                            <strong className="trips-category-name">{c.name}{c.archived ? " (archivée)" : ""}</strong>
                            <span className="trips-category-amount">
                              {money(paid)} <small>/ {money(c.budget)}</small>
                            </span>
                            {!t.closedAt && (
                              <span className="trips-category-actions">
                                <button type="button" className="icon" aria-label={"Modifier la catégorie " + c.name}
                                  onClick={() => tripCategory(t, c)}><Pencil size={15}/></button>
                                {!c.archived && (
                                  <button type="button" className="icon" aria-label={"Archiver la catégorie " + c.name}
                                    onClick={() => confirmAction(
                                      "Archiver cette catégorie ?",
                                      "Les dépenses passées restent consultables.",
                                      async () => change(d => {
                                        d.trips.find(x => x.id === t.id)!.categories
                                          .find(x => x.id === c.id)!.archived = true;
                                      }, "Catégorie voyage archivée")
                                    )}><Trash2 size={15}/></button>
                                )}
                              </span>
                            )}
                          </div>
                          <Progress value={paid} max={c.budget} color={palette[i % 6]}/>
                          <small className={"trips-category-sub" + (paid > c.budget ? " negative" : "")}>
                            {paid > c.budget ? "Dépassé de " + money(paid - c.budget) :
                              money(c.budget - paid) + " restants"}
                          </small>
                        </div>
                      );
                    })}
                    {!availableCategories.length && (
                      <p className="trips-empty-categories">Aucune enveloppe pour le moment. Ajoutez des catégories pour répartir les dépenses du voyage.</p>
                    )}
                  </div>
                  <div className="trips-unallocated">
                    <span>{allocated <= t.budget ? "Budget non réparti" : "Enveloppes au-dessus du budget"}</span>
                    <strong>{money(Math.abs(t.budget - allocated))}</strong>
                  </div>
                </section>


                <section className="card home-recent-expenses" aria-label="Cinq dernières dépenses du voyage">
                  <div className="section-head home-recent-expenses-heading">
                    <h2>Dernières dépenses</h2>
                    <button type="button" className="text home-recent-expenses-all"
                      onClick={() => explain("Toutes les dépenses · " + t.name,
                        txRows([...expenses].sort((a,b) => b.date.localeCompare(a.date))))}>
                      Tout voir <ChevronRight size={16}/>
                    </button>
                  </div>
                  {expenses.length ? <div className="home-recent-expenses-list">
                    {[...expenses].reverse().sort((a,b) => b.date.localeCompare(a.date)).slice(0,5).map(tx => (
                      <button type="button" className="home-recent-expense" key={tx.id}
                        onClick={() => txDetails(tx)}>
                        <span className="home-recent-expense-icon"><ArrowUpRight size={18}/></span>
                        <span className="home-recent-expense-details">
                          <strong>{tx.description}</strong>
                          <small>{dateLabel(tx.date)} · {t.categories.find(c => c.id === tx.tripCategory)?.name || "Sans enveloppe"}</small>
                        </span>
                        <strong className="home-recent-expense-amount negative-money">−{money(tx.amount)}</strong>
                      </button>
                    ))}
                  </div> : <p className="home-recent-expenses-empty">Aucune dépense pour ce voyage.</p>}
                </section>

                <div className="trips-management-actions trips-management-inline" aria-label="Actions du voyage">
                  {t.closedAt ? (
                    <button type="button" className="secondary" onClick={() => confirmAction(
                      "Réouvrir ce voyage ?",
                      "Vous pourrez de nouveau ajouter des dépenses et modifier ses enveloppes.",
                      async () => change(d => {
                        d.trips.find(x => x.id === t.id)!.closedAt = undefined;
                         setShowArchivedTrip(false);
                      }, "Voyage réouvert")
                    )}>Réouvrir le voyage</button>
                  ) : (
                    <button type="button" className="secondary" onClick={() => confirmAction(
                      "Clôturer ce voyage ?",
                      "Il sera déplacé dans Voyages terminés. Son historique et son coût total resteront accessibles.",
                      async () => change(d => {
                        d.trips.find(x => x.id === t.id)!.closedAt = today();
                         setActiveTrip("");
                         setShowArchivedTrip(false);
                      }, "Voyage clôturé")
                    )}>Clôturer le voyage</button>
                  )}
                  <button type="button" className="text danger-text" onClick={() => confirmAction(
                    "Supprimer le voyage ?",
                    "La suppression est possible seulement sans transaction liée. Sinon conservez-le pour garder son historique.",
                    async () => {
                      await change(d => {
                        if (d.transactions.some(x => x.trip === t.id))
                          throw Error("Ce voyage possède des transactions. Il est conservé pour votre historique.");
                        d.trips = d.trips.filter(x => x.id !== t.id);
                        setActiveTrip("");
                      }, "Voyage supprimé");
                      if (t.coverPath) {
                        try { await deleteTripCover(t.coverPath); } catch { /* Clean up later if needed. */ }
                      }
                    }
                  )}><Trash2 size={16}/> Supprimer</button>
                </div>
              </>
            );
          })()}
        </>
      )}
        </>
      )}
    </div>
  );
}
