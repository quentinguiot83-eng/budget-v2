import fs from "node:fs";

function replaceOne(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: motif attendu 1 fois, trouvé ${count}`);
  return source.replace(before, after);
}

const appPath = "src/App.tsx";
let app = fs.readFileSync(appPath, "utf8");

const mobilePersonal = `    {
      id: "personal",
      label: "Compte perso",
      icon: <UserRound size={20} />,
    },`;
const mobilePersonalHidden = `    !s.hidden.includes("personal") && {
      id: "personal",
      label: "Compte perso",
      icon: <UserRound size={20} />,
    },`;
if (!app.includes(mobilePersonalHidden)) {
  app = replaceOne(app, mobilePersonal, mobilePersonalHidden, "Compte perso dans le menu mobile");
}

const oldVisibility = `              <section className="card">
                <h2>Rubriques affichées</h2>
                <p className="muted">
                  Masquer une rubrique conserve toutes ses données.
                </p>
                {[
                  ["trips", "Voyages"],
                  ["loans", "Crédits et prêts"],
                ].map(([id, label]) => (
                  <label className="toggle" key={id}>
                    <input
                      type="checkbox"
                      checked={!s.hidden.includes(id)}
                      onChange={() =>
                        change((d) => {
                          d.hidden = d.hidden.includes(id)
                            ? d.hidden.filter((x) => x !== id)
                            : [...d.hidden, id];
                        }, "Affichage des modules modifié").catch(showError)
                      }
                    />
                    {label}
                  </label>
                ))}
                <label className="toggle">
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
                  Professionnel
                </label>
              </section>`;

const newVisibility = `              <section className="card">
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
                      label: "Voyages",
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
              </section>`;

if (!app.includes('className="visibility-list"')) {
  app = replaceOne(app, oldVisibility, newVisibility, "Réglages des rubriques affichées");
}
fs.writeFileSync(appPath, app);

const cssPath = "src/style.css";
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* Visibility settings */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.visibility-list{display:grid;margin-top:18px;border-top:1px solid var(--border)}\n.visibility-item{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 0;border-bottom:1px solid var(--border);cursor:pointer}\n.visibility-copy{display:flex;flex-direction:column;gap:4px;min-width:0}\n.visibility-copy strong{font-size:.9rem}\n.visibility-copy span{color:var(--muted);font-size:.8125rem;line-height:1.45}\n.visibility-item input{width:19px;height:19px;accent-color:var(--accent-deep);flex:0 0 auto}\n.visibility-item:has(input:disabled){cursor:not-allowed;opacity:.65}\n@media(max-width:640px){.visibility-item{align-items:flex-start;gap:16px}.visibility-item input{margin-top:2px}}\n`;
}
fs.writeFileSync(cssPath, css);

console.log("Réglages de visibilité mis à jour.");
