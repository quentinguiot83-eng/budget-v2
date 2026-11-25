import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { emptyState, stats, type State } from "./engine";

// Exécute la vraie fonction budget_pro_transfer_to_current dans PGlite,
// sur un schéma réduit aux colonnes qu'elle utilise en production.
const owner = "00000000-0000-4000-8000-000000000001";
const stranger = "00000000-0000-4000-8000-000000000009";
const foyer = "10000000-0000-4000-8000-000000000001";
const business = "30000000-0000-4000-8000-000000000001";
const otherBusiness = "30000000-0000-4000-8000-000000000002";
const proAccount = "50000000-0000-4000-8000-000000000001";
const migration = readFileSync(
  new URL("../supabase/migrations/20261022_pro_transfer_to_current.sql", import.meta.url), "utf8");

function household(): State {
  const s = emptyState();
  const base = { rate: 0, cap: 0, capType: "balance" as const, contributed: 0, relay: "", allocation: 0 };
  s.accounts = [
    { ...base, id: "courant", name: "Courant", opening: 100000, date: "2020-01-01", group: "current" },
    { ...base, id: "livret", name: "Livret", opening: 0, date: "2020-01-01", group: "wealth" },
    { ...base, id: "ancien", name: "Ancien", opening: 0, date: "2020-01-01", group: "current", archived: true },
    { ...base, id: "recent", name: "Récent", opening: 0, date: "2099-01-01", group: "current" },
  ];
  return s;
}

async function setup() {
  const db = new PGlite();
  await db.exec(`
create schema auth;
create schema budget_private;
create role authenticated;
create role anon;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('app.test_uid',true),'')::uuid $$;
create table budget_private.members(user_id uuid, household_id uuid);
create table budget_private.documents(household_id uuid primary key, revision integer, body jsonb, updated_at timestamptz);
create table budget_private.audit(household_id uuid, user_id uuid, revision integer, action text);
create table budget_private.pro_modules(user_id uuid, enabled boolean);
create table budget_private.pro_accounts(id uuid, user_id uuid);
create table budget_private.pro_businesses(id uuid, user_id uuid, name text,
  contribution_rate numeric(6,3) not null default 0, tax_rate numeric(6,3) not null default 0,
  vat_enabled boolean not null default false, opening_balance bigint not null default 0);
create table budget_private.pro_transactions(
  id uuid default gen_random_uuid(), user_id uuid, business_id uuid,
  kind text check (kind in ('income','expense','transfer_personal','contribution_payment','tax_payment')),
  label text, amount bigint, transaction_date date, category text, client_id uuid, account_id uuid,
  vat_amount bigint, paid boolean, notes text, personal_transaction_id uuid);
create function budget_private.active_business_id(p_user uuid) returns uuid language sql stable as
  $$ select id from budget_private.pro_businesses where user_id=p_user order by name limit 1 $$;
create function budget_private.check_document(b jsonb) returns void language plpgsql as $$
begin
  if jsonb_typeof(b->'transactions') <> 'array' then raise exception 'invalid document'; end if;
end; $$;
create function public.budget_pro_suite_load() returns jsonb language sql as $$ select '{"ok":true}'::jsonb $$;
`);
  await db.query("select set_config('app.test_uid',$1,false)", [owner]);
  await db.query("insert into budget_private.members values ($1,$2)", [owner, foyer]);
  await db.query("insert into budget_private.documents values ($1,1,$2,now())", [foyer, JSON.stringify(household())]);
  await db.query("insert into budget_private.pro_modules values ($1,true)", [owner]);
  await db.query("insert into budget_private.pro_accounts values ($1,$2)", [proAccount, owner]);
  // « A » est l'entreprise active (ordre alphabétique dans le stub).
  await db.query(`insert into budget_private.pro_businesses(id,user_id,name,contribution_rate,tax_rate,opening_balance)
    values ($1,$3,'A Photo',21.2,0,10000), ($2,$3,'B Autre',21.2,0,0)`, [business, otherBusiness, owner]);
  // Entreprise active : 10 000 c + 300 000 c encaissés − 20 000 c de dépense = 290 000 c.
  await db.query(`insert into budget_private.pro_transactions(user_id,business_id,kind,label,amount,transaction_date,vat_amount,paid)
    values ($1,$2,'income','Séance',300000,'2026-01-10',0,true),
           ($1,$2,'expense','Matériel',20000,'2026-01-12',0,true),
           ($1,$2,'income','Non payée',999999,'2026-01-15',0,false),
           ($1,$3,'income','Autre entreprise',500000,'2026-01-10',0,true)`, [owner, business, otherBusiness]);
  await db.exec(migration);
  return db;
}

async function pay(db: PGlite, transfer: Record<string, unknown>) {
  await db.query("select public.budget_pro_transfer_to_current($1::jsonb)",
    [JSON.stringify({ syncToHousehold: true, targetAccountId: "courant", ...transfer })]);
}

async function householdBody(db: PGlite) {
  const r = await db.query<{ body: State; revision: number }>("select body, revision from budget_private.documents");
  return r.rows[0];
}

test("salaire Pro : revenu « Salaire » du mois du versement, lié à l'opération Pro", async () => {
  const db = await setup();
  try {
    await pay(db, { amount: 150000, date: "2026-03-05" });
    const { body, revision } = await householdBody(db);
    assert.equal(revision, 2);
    const salary = body.transactions.at(-1)!;
    assert.equal(salary.type, "income");
    assert.equal(salary.incomeType, "Salaire");
    assert.equal(salary.budgetMonth, "2026-03");
    assert.equal(salary.account, "courant");
    assert.equal(salary.amount, 150000);
    assert.equal(salary.description, "Salaire — A Photo");

    const pro = await db.query<{ business_id: string; personal_transaction_id: string; kind: string; amount: string }>(
      "select business_id, personal_transaction_id, kind, amount from budget_private.pro_transactions where kind='transfer_personal'");
    assert.equal(pro.rows.length, 1);
    assert.equal(pro.rows[0].business_id, business);
    assert.equal(pro.rows[0].personal_transaction_id, salary.id);
    assert.equal(Number(pro.rows[0].amount), 150000);
    const audit = await db.query<{ action: string }>("select action from budget_private.audit");
    assert.deepEqual(audit.rows.map((r) => r.action), ["Salaire versé depuis le compte professionnel"]);

    // Le moteur de Wimm le compte bien dans les salaires du mois (épargne du mois).
    assert.equal(stats(body, "2026-03").salaryIncome, 150000);
  } finally { await db.close(); }
});

test("salaire Pro : jamais plus que le solde réel de l'entreprise active", async () => {
  const db = await setup();
  try {
    // Solde : 290 000 c (encaissement non payé et autre entreprise exclus).
    await assert.rejects(pay(db, { amount: 290001, date: "2026-03-05" }), /maximum 2900/);
    await pay(db, { amount: 200000, date: "2026-03-05" });
    // Le premier versement est déduit du solde suivant.
    await assert.rejects(pay(db, { amount: 90001, date: "2026-03-06" }), /maximum 900/);
    await pay(db, { amount: 90000, date: "2026-03-06" });
    assert.equal((await householdBody(db)).revision, 3);
  } finally { await db.close(); }
});

test("salaire Pro : refus sans rien écrire (date future, compte invalide, module, taux)", async () => {
  const db = await setup();
  try {
    await assert.rejects(pay(db, { amount: 1000, date: "2999-01-01" }), /futur/);
    await assert.rejects(pay(db, { amount: 0, date: "2026-03-05" }), /Montant/);
    await assert.rejects(pay(db, { amount: 1000, date: "2026-03-05", targetAccountId: "livret" }), /Compte courant/);
    await assert.rejects(pay(db, { amount: 1000, date: "2026-03-05", targetAccountId: "ancien" }), /Compte courant/);
    await assert.rejects(pay(db, { amount: 1000, date: "2026-03-05", targetAccountId: "recent" }), /Compte courant/);
    await assert.rejects(pay(db, { amount: 1000, date: "2026-03-05", syncToHousehold: false }), /destinataire/);
    await db.query("update budget_private.pro_businesses set contribution_rate=0, tax_rate=0");
    await assert.rejects(pay(db, { amount: 1000, date: "2026-03-05" }), /taux/);
    await db.query("update budget_private.pro_modules set enabled=false");
    await assert.rejects(pay(db, { amount: 1000, date: "2026-03-05" }), /désactivé/);
    await db.query("select set_config('app.test_uid',$1,false)", [stranger]);
    await assert.rejects(pay(db, { amount: 1000, date: "2026-03-05" }), /désactivé/);

    const { revision } = await householdBody(db);
    assert.equal(revision, 1);
    const pro = await db.query("select 1 from budget_private.pro_transactions where kind='transfer_personal'");
    assert.equal(pro.rows.length, 0);
  } finally { await db.close(); }
});
