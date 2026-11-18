import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, isSimulatedProject, uid, type Project, type State } from "./engine";
import {
  accountFree, accountProjects, monthsLeft, projectGoal, projectMonthly, projectSaved, realEstateBudget,
  syncTripProject, tripPhase, tripProjectId, withTripProjects,
} from "./projectGoals";

function accounts(s: State) {
  s.accounts.push(
    { id: "cc", name: "Compte courant", group: "current", opening: 500000, date: "2026-01-01", rate: 0, cap: 0, capType: "deposits", allocation: 0 } as State["accounts"][number],
    { id: "la", name: "Livret A", group: "wealth", opening: 1800000, date: "2026-01-01", rate: 2.4, cap: 0, capType: "deposits", allocation: 100 } as State["accounts"][number],
    { id: "ev", name: "Épargne voyage", group: "travel", opening: 180000, date: "2026-01-01", rate: 0, cap: 0, capType: "deposits", allocation: 0 } as State["accounts"][number],
  );
}

function setup() {
  const s: State = emptyState();
  accounts(s);
  const appart: Project = { id: "p1", name: "Appartement", type: "Immobilier", date: "2028-06-15", amount: 4000000, account: "la", active: true, settled: false, reserved: 1240000, reservedAt: "2026-10-31", monthly: 110000 };
  const voiture: Project = { id: "p2", name: "Voiture", type: "Véhicule", date: "2027-03-01", amount: 800000, account: "la", active: true, settled: false, reserved: 300000, reservedAt: "2026-10-31", monthly: 20000 };
  s.projects.push(appart, voiture);
  return { s, appart, voiture };
}

test("un projet seul sur son compte : tout le solde est mis de côté", () => {
  const s = emptyState();
  accounts(s);
  const p: Project = { id: "v", name: "Cyclades", type: "Voyage", date: "2026-12-24", amount: 250000, account: "ev", active: true, settled: false };
  s.projects.push(p);
  assert.equal(projectSaved(s, p), 180000);
  assert.equal(accountFree(s, "ev"), 0);
});

test("l'épargne arrivée sur le compte se partage selon les versements prévus", () => {
  const { s, appart, voiture } = setup();
  assert.equal(projectSaved(s, appart), 1240000);
  assert.equal(accountFree(s, "la"), 260000);
  // 1 300 € arrivent sur le Livret A : 1 100 € pour l'appartement, 200 € pour la voiture.
  s.transactions.push({ id: uid(), type: "transfer", account: "cc", to: "la", amount: 130000, date: "2026-11-05", description: "Épargne mensuelle", savingMonth: "2026-11" });
  assert.equal(projectSaved(s, appart), 1350000);
  assert.equal(projectSaved(s, voiture), 320000);
  // « Verser en plus » va entièrement au projet choisi.
  s.transactions.push({ id: uid(), type: "transfer", account: "cc", to: "la", amount: 50000, date: "2026-11-06", description: "Coup de pouce", project: "p2" });
  assert.equal(projectSaved(s, voiture), 370000);
  assert.equal(projectSaved(s, appart), 1350000);
  assert.equal(accountFree(s, "la"), 260000);
});

test("versement prévu, effort et statut", () => {
  const { s, appart, voiture } = setup();
  assert.equal(projectMonthly(s, appart), 110000);
  assert.equal(monthsLeft(appart, "2026-11-18"), 20);
  const g = projectGoal(s, appart, "2026-11-18");
  assert.equal(g.pace, 110000);
  assert.equal(g.perMonth, 138000);
  assert.equal(g.status, "late");
  assert.equal(g.missing, 4000000 - 1240000 - 110000 * 20);
  voiture.monthly = 120000;
  assert.equal(projectGoal(s, voiture, "2026-11-18").status, "ahead");
  voiture.reserved = 800000;
  assert.equal(projectGoal(s, voiture, "2026-11-18").status, "done");
});

test("reprise des voyages : chaque voyage a un projet, toujours le même", () => {
  const s = emptyState();
  accounts(s);
  s.trips.push({ id: "t1", name: "Cyclades", start: "2026-12-24", end: "2027-01-01", budget: 250000, categories: [] });
  s.projects.push({ id: "old", name: "Japon (projection)", type: "Voyage", date: "2027-04-01", amount: 400000, account: "ev", active: true, settled: false });
  s.trips.push({ id: "t2", name: "Japon", start: "2027-04-01", end: "2027-04-15", budget: 400000, categories: [], projectId: "old" });
  const a = withTripProjects(s);
  const b = withTripProjects(s);
  assert.deepEqual(a, b);
  assert.equal(a.projects.length, 3, "l'ancien projet des Projections reste une hypothèse");
  const japon = a.projects.find((x) => x.id === tripProjectId("t2"))!;
  assert.equal(japon.linkedPlan, "old");
  assert.equal(japon.plan, false);
  assert.equal(a.projects.find((x) => x.id === "old")!.plan, true);
  assert.equal(a.trips[1].projectId, japon.id);
  const p = a.projects.find((x) => x.id === tripProjectId("t1"))!;
  assert.equal(p.account, "ev");
  assert.equal(p.amount, 250000);
  assert.equal(a.trips[0].projectId, p.id);
  assert.equal(withTripProjects(a), a, "rien à faire la deuxième fois");
  a.trips[0].closedAt = "2027-01-02";
  syncTripProject(a, a.trips[0]);
  assert.equal(p.settled, true);
});

test("phase d'un voyage", () => {
  const t = { id: "t", name: "x", start: "2026-12-24", end: "2027-01-01", budget: 0, categories: [] };
  assert.equal(tripPhase(t, "2026-11-18"), "before");
  assert.equal(tripPhase(t, "2026-12-26"), "during");
  assert.equal(tripPhase(t, "2027-01-03"), "after");
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

test("un nouveau projet sur un compte déjà utilisé partage le solde non réservé", () => {
  const s = emptyState();
  accounts(s);
  s.projects.push({ id: "a", name: "A", type: "Autre", date: "2027-06-01", amount: 1000000, account: "la", active: true, settled: false });
  s.projects.push({ id: "b", name: "B", type: "Autre", date: "2027-06-01", amount: 1000000, account: "la", active: true, settled: false });
  assert.equal(projectSaved(s, s.projects[0]), 900000);
  s.projects[1].reserved = 300000; s.projects[1].reservedAt = "2026-11-17";
  assert.equal(projectSaved(s, s.projects[0]), 1500000);
});

test("voyage : ce qui est déjà payé avant le départ compte dans la progression", () => {
  const s = emptyState();
  accounts(s);
  s.trips.push({ id: "t", name: "Cyclades", start: "2026-12-24", end: "2027-01-01", budget: 250000, categories: [], projectId: "trip-t" });
  s.projects.push({ id: "trip-t", name: "Cyclades", type: "Voyage", date: "2026-12-24", amount: 250000, account: "ev", active: true, settled: false });
  const p = s.projects[0];
  // Vol payé avec le compte courant : 1 800 € de côté + 900 € payés.
  s.transactions.push({ id: uid(), type: "expense", account: "cc", amount: 90000, date: "2026-11-02", description: "Vol", trip: "t" });
  let g = projectGoal(s, p, "2026-11-18");
  assert.equal(g.used, 90000);
  assert.equal(g.saved, 160000, "le mis de côté s'arrête à ce qu'il reste à couvrir");
  assert.equal(g.status, "done");
  // Le compte voyage rembourse le vol (« Financer ») : rien ne change.
  s.transactions.push({ id: uid(), type: "transfer", account: "ev", to: "cc", amount: 90000, date: "2026-11-03", description: "Financement", trip: "t" });
  g = projectGoal(s, p, "2026-11-18");
  assert.equal(g.covered, 180000);
  assert.equal(g.used, 90000);
  // Un hôtel payé directement depuis l'épargne voyage : toujours compté une fois.
  s.transactions.push({ id: uid(), type: "expense", account: "ev", amount: 40000, date: "2026-11-04", description: "Hôtel", trip: "t" });
  g = projectGoal(s, p, "2026-11-18");
  assert.equal(g.used, 130000);
  assert.equal(g.covered, 180000);
  assert.equal(g.remaining, 70000);
});

test("hypothèses et projets concrets dans la simulation", () => {
  const s = emptyState();
  accounts(s);
  s.projects.push({ id: "h", name: "Voyage été", type: "Voyage", date: "2027-07-01", amount: 400000, account: "ev", active: true, settled: false, plan: true });
  s.projects.push({ id: "c", name: "Féroé", type: "Voyage", date: "2027-07-10", amount: 350000, account: "ev", active: true, settled: false, plan: false });
  s.projects.push({ id: "old", name: "Ancien", type: "Autre", date: "2026-01-01", amount: 1000, account: "la", active: true, settled: false, plan: true });
  assert.equal(isSimulatedProject(s, s.projects[0], "2026-11-18"), true);
  assert.equal(isSimulatedProject(s, s.projects[1], "2026-11-18"), true, "un projet concret non rattaché est simulé");
  assert.equal(isSimulatedProject(s, s.projects[2], "2026-11-18"), false, "un projet passé n'est plus simulé");
  s.projects[1].linkedPlan = "h";
  assert.equal(isSimulatedProject(s, s.projects[0], "2026-11-18"), false, "l'hypothèse est remplacée par le concret");
  assert.equal(accountProjects(s, "ev").map((p) => p.id).join(), "c", "une hypothèse ne réserve pas d'argent");
});
