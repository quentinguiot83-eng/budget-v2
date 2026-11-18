import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, uid, type Project, type State } from "./engine";
import { accountFree, monthsLeft, projectGoal, projectSaved, realEstateBudget } from "./projectGoals";

function setup() {
  const s: State = emptyState();
  s.accounts.push(
    { id: "cc", name: "Compte courant", group: "current", opening: 500000, date: "2026-01-01", rate: 0, cap: 0, capType: "deposits", allocation: 0 } as State["accounts"][number],
    { id: "la", name: "Livret A", group: "wealth", opening: 1800000, date: "2026-01-01", rate: 2.4, cap: 0, capType: "deposits", allocation: 100 } as State["accounts"][number],
  );
  const appart: Project = { id: "p1", name: "Appartement", type: "Immobilier", date: "2028-06-15", amount: 4000000, account: "la", active: true, settled: false, reserved: 1240000 };
  const voiture: Project = { id: "p2", name: "Voiture", type: "Véhicule", date: "2027-03-01", amount: 800000, account: "la", active: true, settled: false, reserved: 300000 };
  s.projects.push(appart, voiture);
  return { s, appart, voiture };
}

test("part réservée, versements rattachés et partie libre du compte", () => {
  const { s, appart } = setup();
  assert.equal(projectSaved(s, appart), 1240000);
  assert.equal(accountFree(s, "la"), 260000);
  s.transactions.push({ id: uid(), type: "transfer", account: "cc", to: "la", amount: 110000, date: "2026-11-05", description: "Épargne Appartement", project: "p1" });
  assert.equal(projectSaved(s, appart), 1350000);
  assert.equal(accountFree(s, "la"), 260000, "le versement rattaché ne change pas la partie libre");
});

test("effort mensuel, rythme actuel et retard", () => {
  const { s, appart } = setup();
  assert.equal(monthsLeft(appart, "2026-11-18"), 20);
  for (const d of ["2026-09-05", "2026-10-05", "2026-11-05"])
    s.transactions.push({ id: uid(), type: "transfer", account: "cc", to: "la", amount: 110000, date: d, description: "Épargne", project: "p1" });
  const g = projectGoal(s, appart, "2026-11-18");
  assert.equal(g.saved, 1570000);
  assert.equal(g.pace, 110000);
  assert.equal(g.perMonth, 121500);
  assert.equal(g.status, "late");
  assert.equal(g.missing, 4000000 - 1570000 - 110000 * 20);
});

test("projet atteint et projet dans les temps", () => {
  const { s, voiture } = setup();
  voiture.reserved = 450000;
  s.transactions.push({ id: uid(), type: "transfer", account: "cc", to: "la", amount: 150000, date: "2026-11-01", description: "Épargne", project: "p2" });
  // 6 000 € de côté + 500 €/mois pendant 5 mois = 8 500 € pour 8 000 €.
  assert.equal(projectGoal(s, voiture, "2026-11-18").status, "onTrack");
  voiture.reserved = 800000;
  assert.equal(projectGoal(s, voiture, "2026-11-18").status, "done");
});

test("budget immobilier : notaire, emprunt, mensualité et endettement", () => {
  const r = realEstateBudget({ price: 28000000, newBuild: false, works: 1000000, rate: 3.4, years: 25 }, 4000000, 420000);
  assert.equal(r.notary, 2100000);
  assert.equal(r.total, 31100000);
  assert.equal(r.borrowed, 27100000);
  assert.ok(Math.abs(r.payment - 134220) <= 1, String(r.payment));
  assert.ok(r.debtRatio! > 0.31 && r.debtRatio! < 0.33);
  const neuf = realEstateBudget({ price: 28000000, newBuild: true, works: 0, rate: 0, years: 20 }, 28700000, 0);
  assert.equal(neuf.notary, 700000);
  assert.equal(neuf.payment, 0);
  assert.equal(neuf.debtRatio, null);
});
