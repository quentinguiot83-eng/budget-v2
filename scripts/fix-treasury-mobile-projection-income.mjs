import fs from "node:fs";

const appPath = "src/App.tsx";
let app = fs.readFileSync(appPath, "utf8");

const oldConsts = `  function calc() {\n    const useActualIncome = totals.income > 0;\n    const incomeUsed = useActualIncome ? totals.income : s.income;\n    const capacityUsed = useActualIncome\n      ? totals.actualCapacity\n      : totals.capacity;`;
const newConsts = `  function calc() {\n    const incomeUsed = s.income;\n    const capacityUsed = totals.capacity;`;
if (!app.includes(oldConsts)) throw new Error("Bloc de calcul projection introuvable");
app = app.replace(oldConsts, newConsts);

const oldIncomeRow = `          title={\n            useActualIncome\n              ? "Revenus affectés à ce mois"\n              : "Revenus mensuels estimés"\n          }\n          value={money(incomeUsed)}\n        />\n\n        {!useActualIncome && (\n          <p className="muted">\n            Aucun revenu réel n’a encore été enregistré pour ce mois.\n            L’estimation mensuelle est donc utilisée provisoirement.\n          </p>\n        )}`;
const newIncomeRow = `          title="Revenus mensuels estimés"\n          value={money(incomeUsed)}\n        />\n\n        <p className="muted">\n          Cette projection utilise votre revenu mensuel estimé, indépendamment des revenus déjà enregistrés ou affectés au mois.\n        </p>`;
if (!app.includes(oldIncomeRow)) throw new Error("Ligne de revenu du calcul projection introuvable");
app = app.replace(oldIncomeRow, newIncomeRow);

const oldPlanStart = `        {useActualIncome ? (\n          <p>\n            Le plan d’épargne de ce mois est calculé à partir des revenus\n            réellement enregistrés, soit {money(totals.income)}.\n          </p>\n        ) : (\n          <p>\n            Le plan d’épargne utilise pour le moment votre estimation mensuelle`;
if (!app.includes(oldPlanStart)) throw new Error("Texte explicatif projection introuvable");
const start = app.indexOf(oldPlanStart);
const endMarker = `          </p>\n        )}`;
const end = app.indexOf(endMarker, start);
if (end === -1) throw new Error("Fin du texte explicatif projection introuvable");
app = app.slice(0, start) + `        <p>\n          Le plan d’épargne prévisionnel est calculé à partir de votre revenu mensuel estimé, soit {money(s.income)}.\n        </p>` + app.slice(end + endMarker.length);
fs.writeFileSync(appPath, app);

const proPath = "src/ProWorkspace.tsx";
let pro = fs.readFileSync(proPath, "utf8");
const tableOld = `<table className="prosuite-table"><thead><tr><th>Date</th><th>Opération</th><th>Règlement</th><th>Montant</th><th></th></tr></thead>`;
const tableNew = `<table className="prosuite-table prosuite-treasury-table"><thead><tr><th>Date</th><th>Opération</th><th>Règlement</th><th>Montant</th><th></th></tr></thead>`;
if (!pro.includes(tableOld)) throw new Error("Tableau trésorerie introuvable");
pro = pro.replace(tableOld, tableNew);
fs.writeFileSync(proPath, pro);

const cssPath = "src/pro-suite.css";
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* Treasury mobile cards + native containment */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media(max-width:650px){\n  .prosuite-native,\n  .prosuite-native .prosuite-shell,\n  .prosuite-native .prosuite-main,\n  .prosuite-native .prosuite-card,\n  .prosuite-native .prosuite-grid2,\n  .prosuite-native .prosuite-tablewrap{min-width:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box!important}\n  .prosuite-native,.prosuite-native .prosuite-shell,.prosuite-native .prosuite-main{overflow-x:hidden!important}\n  .prosuite-native .prosuite-tablewrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch}\n  .prosuite-treasury-table{display:block!important;min-width:0!important;width:100%!important}\n  .prosuite-treasury-table thead{display:none!important}\n  .prosuite-treasury-table tbody{display:grid!important;gap:10px!important}\n  .prosuite-treasury-table tr{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"operation amount" "date payment" "actions actions"!important;gap:5px 12px!important;padding:13px!important;border:1px solid #e9ebef!important;border-radius:14px!important;background:#fff!important}\n  .prosuite-treasury-table td{display:block!important;border:0!important;padding:0!important;min-width:0!important}\n  .prosuite-treasury-table td:nth-child(1){grid-area:date;color:#98a2b3;font-size:12px!important}\n  .prosuite-treasury-table td:nth-child(2){grid-area:operation;font-weight:800;overflow-wrap:anywhere}\n  .prosuite-treasury-table td:nth-child(3){grid-area:payment;color:#667085;font-size:12px!important;text-align:right!important}\n  .prosuite-treasury-table td:nth-child(4){grid-area:amount;text-align:right!important;font-weight:800;font-size:15px!important;white-space:nowrap}\n  .prosuite-treasury-table td:nth-child(5){grid-area:actions;display:flex!important;justify-content:flex-end!important;padding-top:4px!important}\n  .prosuite-treasury-table .prosuite-block{font-weight:400;font-size:11px}\n  .prosuite-native .prosuite-pagehead .prosuite-actions{width:100%!important;display:grid!important;grid-template-columns:1fr!important;gap:8px!important}\n  .prosuite-native .prosuite-pagehead .prosuite-actions .prosuite-btn{width:100%!important}\n  .prosuite-native .prosuite-grid2{grid-template-columns:1fr!important}\n}\n:root[data-mode="dark"] .prosuite-treasury-table tr{background:#17212b!important;border-color:#2a3744!important}\n`;
}
fs.writeFileSync(cssPath, css);
console.log("Correctifs trésorerie mobile et capacité projection appliqués.");
