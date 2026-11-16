import { rpc, api } from "../api";
import { applyAppearance } from "../appearance";
import { APP_VERSION_LABEL, APP_BUILD_ID, APP_BUILD_DATE_LABEL } from "../appVersion";
import { categoryUsage } from "../categoryDeletion";
import DataProtectionPanel from "../DataProtectionPanel";
import DataProtectionStyles from "../DataProtectionStyles";
import { month, monthLabel, emptyState } from "../engine";
import PhoneNotifications from "../PhoneNotifications";
import RecurringIncomeManager from "../RecurringIncomeManager";
import SettingsNavigation from "../SettingsNavigation";
import { BlockInfo, Row } from "../ui";
import VersionHistoryPanel from "../VersionHistoryPanel";
import { CircleHelp, ChevronRight, Check, LogOut, Users, ArrowUpRight, RefreshCw, Pencil } from "lucide-react";
import { choice, demoEnabled, field, themes } from "../app/shared";
import type { WimmView } from "../app/buildView";

export default function SettingsScreen({ view }: { view: WimmView }) {
  const {
    appearanceMode, change, commit, confirmAction, displayName, doc, invite, isOwner, load,
    navigate, openForm, personalDoc, proEnabled, reconcileHouseholdAccounts,
    removeArchivedCategory, s, salaryBudget, salaryDay, salaryReminder, selectedMonth, session,
    setAppearanceMode, setDoc, setInvite, setNotice, setPreviewName, setProEnabled, setSession,
    setSettingsCategory, setSettingsDetail, setTheme, setTutorialMode, setTutorialOpen,
    setTutorialPage, settingsCategory, settingsDetail, showError, theme,
  } = view;
  return (
    <div className="settings-v2">
      <SettingsNavigation
        category={settingsCategory}
        detail={settingsDetail}
        displayName={displayName}
        householdName={doc.household.name}
        membersCount={doc.members.length}
        onCategory={(id) => { setSettingsCategory(id); setSettingsDetail(null); window.scrollTo(0, 0); }}
        onDetail={(id) => { setSettingsDetail(id); window.scrollTo(0, 0); }}
        onBack={() => {
          if (settingsDetail) setSettingsDetail(null);
          else setSettingsCategory(null);
          window.scrollTo(0, 0);
        }}
      />
      {settingsDetail === "notifications" && (
!demoEnabled ? (
  <div data-tour="phone-notifications"><PhoneNotifications state={s} /></div>
) : (
  <section className="card"><p className="muted">Les notifications sont disponibles après connexion à votre compte Wimm.</p></section>
)
)}
      {settingsDetail === "tutoriel" && (
<section className="card tutorial-settings-card tutorial-learning-hub" data-tour="tutorial-settings">
        <div className="tutorial-learning-head">
          <span className="tutorial-learning-icon"><CircleHelp size={25}/></span>
          <div>
            <span className="eyebrow">CENTRE D’APPRENTISSAGE</span>
            <h2>Découvre Wimm à ton rythme</h2>
            <p className="muted">Un écran figé, une zone entourée et une explication courte. Les exemples ne modifient jamais tes données. Le mode Pro est facultatif.</p>
          </div>
        </div>
        <div className="tutorial-learning-actions">
          <button type="button" className="primary" onClick={() => { setSettingsCategory(null); setSettingsDetail(null); setTutorialMode("library"); setTutorialPage(null); setTutorialOpen(true); }}>
            <CircleHelp size={17}/> Découvrir les 8 chapitres
          </button>
          <button type="button" className="secondary" onClick={() => { setSettingsCategory(null); setSettingsDetail(null); setTutorialMode("quick"); setTutorialPage(null); setTutorialOpen(true); }}>
            <ChevronRight size={17}/> Découverte rapide · 6 étapes
          </button>
        </div>
      </section>
)}
      {settingsDetail === "apparence" && (
<div className="two-col settings-appearance">
<section className="card">
          <div className="section-head"><div className="block-title"><h2>Apparence</h2><BlockInfo title="Apparence"><p>Automatique suit le mode clair ou sombre choisi dans les réglages de votre téléphone. Clair et Nuit gardent le même thème à tout moment.</p></BlockInfo></div></div>
          <div className="appearance-choices" role="group" aria-label="Apparence">
            {([["light", "Clair"], ["dark", "Nuit"], ["auto", "Automatique"]] as const).map(([mode, label]) => (
              <button type="button" key={mode} aria-pressed={appearanceMode === mode} onClick={() => {
                applyAppearance(mode);
                setAppearanceMode(mode);
              }}>{label}</button>
            ))}
          </div>
          <div className="section-head"><div className="block-title"><h2>Votre couleur</h2><BlockInfo title="Votre couleur"><p>Un thème personnel, même dans un foyer partagé.</p></BlockInfo></div></div>
          <div className="theme-grid">
            {themes.map(([id, label]) => (
              <button
                key={id}
                className={
                  "theme-option " + (theme === id ? "selected" : "")
                }
                onClick={async () => {
                  try {
                    if (!demoEnabled)
                      await rpc("budget_theme", { p_theme: id });
                    setTheme(id);
                    setNotice(demoEnabled ? "Couleur appliquée à l’aperçu." : "Votre thème est enregistré.");
                  } catch (e) {
                    showError(e);
                  }
                }}
              >
                <span className={"swatch " + id}>
                  {theme === id && <Check size={18} />}
                </span>
                {label}
              </button>
            ))}
          </div>
        </section>
</div>
)}
      {["profil", "connexion"].includes(settingsDetail || "") && (
        <section className="card">
  <h2>{settingsDetail === "connexion" ? "Connexion et accès" : "Votre compte"}</h2>
  {settingsDetail === "profil" && (<>
<p>{session?.user.email || "Aperçu de démonstration"}</p>
          <div className="profile-name-row"><span>Nom affiché : <strong>{displayName || "Non renseigné"}</strong></span>
            <button className="text" onClick={() => openForm("Votre nom affiché", [field("name", "Nom affiché", displayName)], async v => {
              const name = v.name.trim();
              if (!name) throw Error("Indiquez votre nom affiché.");
              if (demoEnabled) setPreviewName(name);
              else {
                const { data, error } = await api.auth.updateUser({ data: { display_name: name } });
                if (error) throw error;
                if (data.user) setSession(current => current ? { ...current, user: data.user } : current);
              }
            })}>Modifier</button>
          </div>
          
  </>)}
  {settingsDetail === "connexion" && (<>
<button
            className="secondary"
            onClick={() => {
              if (demoEnabled) {
                location.href = "/";
                return;
              }
              api.auth.signOut().catch(showError);
            }}
          >
            <LogOut size={17} />
            Se déconnecter
          </button>
          <p className="muted">
            Sur iPhone : Safari → Partager → Sur l’écran d’accueil. Une
            connexion Internet est nécessaire pour enregistrer.
          </p>
        
  </>)}
</section>
      )}
      {settingsDetail === "membres" && (
<section className="card">
        <div className="section-head">
          <h2>{doc.household.name}</h2>
          {isOwner && (
            <button
              className="text"
              onClick={() =>
                openForm(
                  "Renommer le foyer",
                  [field("name", "Nom du foyer", doc.household.name)],
                  async (v) => {
                    if (demoEnabled)
                      setDoc((d) =>
                        d
                          ? {
                              ...d,
                              household: {
                                ...d.household,
                                name: v.name,
                              },
                            }
                          : d,
                      );
                    else {
                      await rpc("budget_rename", { p_name: v.name });
                      await load();
                    }
                  },
                )
              }
            >
              Renommer
            </button>
          )}
        </div>
        {doc.members.map((m) => (
          <Row
            key={m.id}
            icon={<Users size={18} />}
            title={m.email}
            sub={m.owner ? "Propriétaire" : "Membre"}
            value={
              isOwner && !m.owner ? (
                <button
                  className="text danger-text"
                  onClick={() =>
                    confirmAction(
                      "Retirer ce membre ?",
                      "Cette personne n’aura plus accès au foyer. Son historique restera conservé.",
                      async () => {
                        await rpc("budget_remove_member", {
                          p_user: m.id,
                        });
                        await load();
                      },
                    )
                  }
                >
                  Retirer
                </button>
              ) : undefined
            }
          />
        ))}
        {isOwner && (
          <button
            className="secondary"
            onClick={async () => {
              try {
                if (demoEnabled) {
                  setNotice(
                    "Les invitations sont disponibles après connexion à votre vrai foyer.",
                  );
                  return;
                }
                setInvite(await rpc("budget_invite"));
              } catch (e) {
                showError(e);
              }
            }}
          >
            Générer un code d’invitation
          </button>
        )}
        {invite && (
          <div className="invite">
            <strong>Code ou lien à transmettre à votre partenaire</strong>
            <code>{invite}</code>
            <p>
              Valable 7 jours, une seule utilisation. Générer un nouveau
              code annule le précédent.
            </p>
            <button type="button" className="secondary" onClick={async()=>{
              const url = location.origin + location.pathname + "#join=" + encodeURIComponent(invite);
              try {
                if (navigator.share) await navigator.share({
                  title:"Rejoindre mon foyer Wimm",text:"Rejoins mon foyer Wimm avec ce lien sécurisé.",url
                });
                else { await navigator.clipboard.writeText(url);setNotice("Lien d’invitation copié"); }
              } catch(e) {if(!(e instanceof Error && e.name==="AbortError"))setNotice("Impossible de partager ce lien sur cet appareil.");}
            }}>
              <ArrowUpRight size={16}/> Partager un lien
            </button>
            <button
              className="secondary"
              onClick={() =>
                navigator.clipboard
                  .writeText(invite)
                  .then(() => setNotice("Code copié"))
                  .catch(() =>
                    setNotice(
                      "Sélectionnez et copiez le code affiché.",
                    ),
                  )
              }
            >
              Copier le code
            </button>
          </div>
        )}
      </section>
)}
      {settingsDetail === "mise-a-jour-comptes" && (
        <section className="card wimm-settings-account-refresh">
          <div className="section-head">
            <div className="block-title"><h2>Vos comptes ne sont plus à jour ?</h2></div>
            <RefreshCw size={20} aria-hidden="true" />
          </div>
          <p>
            Vous avez oublié de saisir des transactions depuis quelque temps et
            vos soldes ne correspondent plus à ceux de votre banque ?
            Vous pouvez les mettre à jour ici.
          </p>
          <p className="muted">
            Wimm enregistre seulement la différence pour retrouver le bon solde.
            Vos anciennes transactions restent conservées, mais les dépenses
            oubliées ne sont pas recréées automatiquement.
          </p>
          <button type="button" className="primary"
            onClick={reconcileHouseholdAccounts}>
            <RefreshCw size={17} /> Mettre à jour mes comptes
          </button>
        </section>
      )}
      {settingsDetail === "salaire" && (
        <RecurringIncomeManager
          sources={s.incomeSources || []}
          legacyIncome={s.income}
          onSave={async items => {
            await change(d => {
              d.incomeSources = items;
              d.income = Math.round(items.reduce((total,item) =>
                total + item.amount / (item.frequency === "quarterly" ? 3 : item.frequency === "annual" ? 12 : 1), 0));
              const firstMonthly = items.find(item => item.frequency === "monthly");
              if (firstMonthly) d.salaryDay = firstMonthly.day;
              const currentMonth = month();
              d.salaryReceivedMonths ??= [];
              if (items.length > 0 && items.every(item=>item.receivedMonths.includes(currentMonth))) {
                if(!d.salaryReceivedMonths.includes(currentMonth)) d.salaryReceivedMonths.push(currentMonth);
              } else {
                d.salaryReceivedMonths = d.salaryReceivedMonths.filter(m=>m!==currentMonth);
              }
            }, "Sources de revenus habituels modifiées");
          }}
        />
      )}
      {settingsDetail === "salaire" && !(s.incomeSources && s.incomeSources.length>0) && (
<section className="card settings-salary-card">
        <div className="section-head">
          <div>
            <h2>Salaire</h2>
            <p className="muted">
              Choisissez la date prévue et le mois auquel votre salaire
              doit être affecté dans le budget.
            </p>
          </div>

          <button
            type="button"
            className="text settings-edit"
            onClick={() =>
              openForm(
                "Réglages du salaire",
                [
                  {
                    ...field(
                      "day",
                      "Jour prévu de réception",
                      salaryDay,
                      "number",
                      "Si le mois est plus court, Wimm utilisera automatiquement le dernier jour du mois.",
                    ),
                    min: 1,
                    max: 31,
                    step: "1",
                  },
                  choice(
                    "budget",
                    "Affecter le salaire au",
                    [
                      ["current", "Mois de réception"],
                      ["next", "Mois suivant"],
                    ],
                    salaryBudget,
                  ),
                  choice(
                    "reminder",
                    "Rappel à la date prévue",
                    [
                      ["yes", "Activé"],
                      ["no", "Désactivé"],
                    ],
                    salaryReminder ? "yes" : "no",
                  ),
                ],
                async (v) => {
                  const day = Number(v.day);

                  if (!Number.isInteger(day) || day < 1 || day > 31) {
                    throw Error("Le jour doit être compris entre 1 et 31.");
                  }

                  await change((d) => {
                    d.salaryDay = day;
                    d.salaryBudget =
                      v.budget === "current" ? "current" : "next";
                    d.salaryReminder = v.reminder === "yes";
                  }, "Réglages du salaire modifiés");
                },
                "Enregistrer",
              )
            }
          >
            <Pencil size={16} /> Modifier
          </button>
        </div>

        <Row
          title="Date prévue"
          value={`Le ${salaryDay} de chaque mois`}
        />

        <Row
          title="Affectation budgétaire"
          value={
            salaryBudget === "next"
              ? "Mois suivant"
              : "Mois de réception"
          }
        />

        <Row
          title="Rappel"
          value={salaryReminder ? "Activé" : "Désactivé"}
        />
      </section>
)}
      {settingsDetail === "rubriques" && (
<section className="card">
        <h2>Rubriques affichées</h2>
        <p className="muted">
          Choisissez les espaces utiles à votre quotidien. Masquer une
          rubrique ne supprime aucune donnée : vous pourrez la réactiver
          à tout moment.
        </p>
        <div className="visibility-list">
          {[
            {
              id: "personal",
              label: "Compte perso",
              description:
                "Gérez vos comptes et dépenses privés séparément du budget du foyer.",
            },
            {
              id: "trips",
              label: "Projets",
              description:
                "Préparez vos voyages, leurs budgets par catégorie et les dépenses associées.",
            },
            {
              id: "loans",
              label: "Crédits et prêts",
              description:
                "Suivez vos crédits, prêts à un tiers, mensualités et montants restant à rembourser.",
            },
          ].map(({ id, label, description }) => (
            <label className="visibility-item" key={id}>
              <span className="visibility-copy">
                <strong>{label}</strong>
                <span>{description}</span>
              </span>
              <input
                type="checkbox"
                checked={!s.hidden.includes(id)}
                onChange={() =>
                  change((d) => {
                    d.hidden = d.hidden.includes(id)
                      ? d.hidden.filter((x) => x !== id)
                      : [...d.hidden, id];
                  }, "Affichage des rubriques modifié").catch(showError)
                }
              />
            </label>
          ))}
          <label className="visibility-item">
            <span className="visibility-copy">
              <strong>Professionnel</strong>
              <span>
                Gérez vos entreprises, clients, factures, encaissements,
                rendez-vous et trésorerie.
              </span>
            </span>
            <input
              type="checkbox"
              checked={proEnabled}
              disabled={demoEnabled}
              onChange={async (event) => {
                try {
                  const next = event.target.checked;
                  await rpc("budget_pro_toggle", { p_enabled: next });
                  setProEnabled(next);
                  setNotice(
                    next
                      ? "Rubrique Professionnel affichée."
                      : "Rubrique Professionnel masquée.",
                  );
                } catch (e) {
                  showError(e);
                }
              }}
            />
          </label>
        </div>
      </section>
)}
      {settingsDetail === "archives" && (
<section className="card archived-category-settings">
        <h2>Catégories archivées</h2>
        <p className="muted">Supprimez une catégorie inutilisée ou transférez son historique vers une catégorie active.</p>
        {s.categories.filter(c => c.archived).map(c => {
          const usage = categoryUsage(s, c.id);
          return <div className="archived-category-row" key={c.id}><div><strong>{c.name}</strong><small className="muted">Archivée depuis {monthLabel(c.archived!)} · {usage.transactions} opération(s) · {usage.rules} échéance(s)</small></div><button type="button" className="text danger-text" onClick={() => removeArchivedCategory(c)}>Supprimer</button></div>;
        })}
        {!s.categories.some(c => c.archived) && <p className="muted">Aucune catégorie archivée.</p>}
      </section>
)}
      {(settingsDetail === "sauvegardes" || settingsDetail === "historique") && <DataProtectionStyles />}
      {settingsDetail === "sauvegardes" && (
<DataProtectionPanel
        household={{ id: doc.household.id, name: doc.household.name, revision: doc.revision, state: s }}
        personal={personalDoc}
        demo={demoEnabled}
        isOwner={isOwner}
        proEnabled={proEnabled}
        onRestored={load}
      />
)}
      {settingsDetail === "historique" && (
<VersionHistoryPanel
        householdRevision={doc.revision}
        personalRevision={personalDoc?.revision ?? null}
        isOwner={isOwner}
        demo={demoEnabled}
        onRestored={load}
      />
)}
      {settingsDetail === "confidentialite" && (
<section className="card wimm-settings-info">
        <h2>Confidentialité de vos finances</h2>
        <p>Vos comptes et opérations personnels sont séparés des données du foyer. Les autres membres du foyer ne peuvent pas consulter le détail de vos dépenses privées.</p>
        <p className="muted">Les virements entre le foyer et le compte personnel restent visibles dans l’historique commun lorsque cela concerne le budget du foyer.</p>
        <p>Les fichiers JSON et CSV téléchargés sont enregistrés sur votre appareil. Conservez ces exports dans un emplacement privé et protégé.</p>
        <p className="muted">La gestion des sessions actives et la suppression du compte ne sont pas encore disponibles depuis cet écran.</p>
      </section>
)}
      {settingsDetail === "reset" && (
<section className="card danger-zone">
        <h2>Réinitialisation</h2>
        <p>
          Remettre une enveloppe à zéro conserve les dépenses. Archiver
          une catégorie conserve tout son historique.
        </p>
        <button
          className="secondary"
          onClick={() =>
            openForm(
              "Remettre une enveloppe à zéro",
              [
                choice(
                  "category",
                  "Catégorie",
                  s.categories.map((c) => [c.id, c.name]),
                ),
                field(
                  "month",
                  "À partir du mois",
                  selectedMonth,
                  "month",
                ),
              ],
              async (v) =>
                change((d) => {
                  d.categories.find(
                    (c) => c.id === v.category,
                  )!.budgets[v.month] = 0;
                }, "Enveloppe remise à zéro"),
            )
          }
        >
          Réinitialiser une enveloppe
        </button>
        {isOwner && (
          <button
            className="danger"
            onClick={() =>
              openForm(
                "Effacer toutes les données du foyer",
                [
                  field(
                    "confirmation",
                    "Saisissez REINITIALISER",
                    "",
                    "text",
                    `${s.transactions.length} opérations, ${s.accounts.length} comptes, catégories, voyages, prêts et projets seront réinitialisés pour tous les membres. Les anciennes versions restent récupérables dans l’historique. Les comptes utilisateurs et le foyer restent.`,
                  ),
                ],
                async (v) => {
                  if (v.confirmation !== "REINITIALISER")
                    throw Error("Confirmation incorrecte.");
                  if (demoEnabled)
                    await commit(emptyState(), "Réinitialisation");
                  else
                    setDoc(
                      await rpc("budget_reset", {
                        p_confirmation: v.confirmation,
                        p_revision: doc.revision,
                      }),
                    );
                  navigate("home");
                },
                "Effacer les données",
              )
            }
          >
            Tout réinitialiser
          </button>
        )}
      </section>
)}
      {settingsDetail === "apropos" && (
<section className="card wimm-settings-info">
        <h2>Wimm</h2>
        <p>Where is my money?</p>
        <div className="wimm-release-card" aria-label="Version installée">
          <span className="wimm-release-label">Version de Wimm</span>
          <strong className="wimm-release-number">{APP_VERSION_LABEL}</strong>
          <span className="wimm-release-status">Version bêta</span>
          <span className="wimm-release-build">Compilation {APP_BUILD_ID}</span>
          <small className="muted">Construite le {APP_BUILD_DATE_LABEL}</small>
        </div>
        <p className="muted">Le numéro de version évolue à chaque nouvelle mise à jour publiée. La référence de compilation s'actualise automatiquement à chaque déploiement.</p>
        <p className="muted">Application de gestion du budget, du patrimoine, des voyages et des finances personnelles, installable sur l'écran d'accueil de votre iPhone.</p>
      </section>
)}
    </div>
  );
}
