import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const owner="00000000-0000-4000-8000-000000000001";
const member="00000000-0000-4000-8000-000000000002";
const foyer="10000000-0000-4000-8000-000000000001";
const otherFoyer="10000000-0000-4000-8000-000000000002";
const transactionId="20000000-0000-4000-8000-000000000001";
const migration = readFileSync(new URL("../supabase/12-backup-json-restoration-and-pro-export.sql",import.meta.url),"utf8");
const original = {
  schema:1,accounts:[],categories:[],rules:[],transactions:[{id:transactionId}],
  trips:[],projects:[],loans:[],hidden:[],cancelled:[],income:0,
};
const target={...original,transactions:[]};
const privateState={schema:1,account:null,transactions:[],rules:[]};
async function setUser(db:PGlite,uid=owner) {
  await db.query("select set_config('app.test_uid',$1,false)",[uid]);
}
async function setup(){
  const db=new PGlite();
  await db.exec(`
create schema auth;
create schema budget_private;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('app.test_uid',true),'')::uuid $$;
create table budget_private.members(user_id uuid,household_id uuid);
create table budget_private.households(id uuid,owner uuid);
create table budget_private.documents(household_id uuid primary key,revision integer,body jsonb);
create table budget_private.personal_documents(user_id uuid,household_id uuid,revision integer,body jsonb);
create table budget_private.pro_transactions(
  id uuid default gen_random_uuid(),user_id uuid,kind text,personal_transaction_id uuid);
create function budget_private.check_document(b jsonb) returns void
language plpgsql as $$
begin
 if jsonb_typeof(b->'transactions') <> 'array' or b->>'schema' <> '1'
 then raise exception 'invalid document'; end if;
end; $$;
create function budget_private.check_personal_document(b jsonb) returns void
language plpgsql as $$
begin
 if jsonb_typeof(b->'transactions') <> 'array' or b->>'schema' <> '1'
 then raise exception 'invalid private document'; end if;
end; $$;
create function public.budget_save(p_state jsonb,p_revision integer,p_action text)
returns jsonb language plpgsql as $$
declare r integer;
begin
 update budget_private.documents set body=p_state,revision=revision+1
 where household_id=(select household_id from budget_private.members where user_id=auth.uid())
 and revision=p_revision returning revision into r;
 if r is null then raise exception 'CONFLICT'; end if;
 return jsonb_build_object('revision',r);
end; $$;
create function public.budget_personal_save(p_state jsonb,p_revision integer,p_action text)
returns jsonb language plpgsql as $$
declare r integer;
begin
 update budget_private.personal_documents set body=p_state,revision=revision+1
 where user_id=auth.uid() and revision=p_revision
 returning revision into r;
 if r is null then raise exception 'CONFLICT'; end if;
 return jsonb_build_object('revision',r);
end; $$;
create table budget_private.pro_modules(user_id uuid,enabled boolean);
create table budget_private.pro_businesses(id uuid,user_id uuid,name text);
create table budget_private.pro_business_preferences(user_id uuid,active_business_id uuid);
create table budget_private.pro_accounts(id uuid,user_id uuid,name text);
create table budget_private.pro_profiles(user_id uuid,business_name text);
create table budget_private.pro_billing_settings(user_id uuid,iban text);
create table budget_private.pro_clients(id uuid,user_id uuid,business_id uuid,name text);
create table budget_private.pro_products(id uuid,user_id uuid,business_id uuid,name text);
create table budget_private.pro_quotes(id uuid,user_id uuid,business_id uuid);
create table budget_private.pro_quote_items(id uuid,quote_id uuid,description text);
create table budget_private.pro_invoices(id uuid,user_id uuid,business_id uuid,invoice_number text);
create table budget_private.pro_invoice_items(id uuid,invoice_id uuid,description text);
create table budget_private.pro_invoice_payments(id uuid,user_id uuid,invoice_id uuid,amount bigint);
create table budget_private.pro_events(id uuid,user_id uuid,business_id uuid,title text);
`);
  await setUser(db);
  await db.query("insert into budget_private.members values ($1,$2),($3,$2)",[owner,foyer,member]);
  await db.query("insert into budget_private.households values ($1,$2)",[foyer,owner]);
  await db.query("insert into budget_private.documents values ($1,1,$2)",[foyer,JSON.stringify(original)]);
  await db.query("insert into budget_private.personal_documents values ($1,$2,1,$3)",[owner,foyer,JSON.stringify(privateState)]);
  await db.exec(migration);
  return db;
}
function backup(scope:"household"|"personal",state:object,householdId=foyer) {
  return {format:"wimm-manual-backup",version:2,integrity:{algorithm:"SHA-256",contentHash:"test"},
    householdId,scope,revision:1,state};
}
async function restore(db:PGlite,file:object,revision=1,confirmation="RESTAURER"){
  const rows=await db.query<{budget_restore_import:{revision:number,scope:string}}>(
    "select public.budget_restore_import($1::jsonb,$2,$3) as budget_restore_import",
    [JSON.stringify(file),revision,confirmation]);
  return rows.rows[0].budget_restore_import;
}
test("SQL recovery: validates owner, foreign household, revision and confirmation",async()=>{
 const db=await setup();
 try{
   await assert.rejects(restore(db,backup("household",target),1,"NON"),/Confirmation/);
   await assert.rejects(restore(db,backup("household",target,otherFoyer)),/autre foyer/);
   await assert.rejects(restore(db,backup("household",target),8),/CONFLICT/);
   await setUser(db,member);
   await assert.rejects(restore(db,backup("household",target)),/propriétaire/);
   await setUser(db,owner);
   const d=await db.query<{revision:number}>("select revision from budget_private.documents");
   assert.equal(d.rows[0].revision,1);
 } finally{await db.close();}
});
test("SQL recovery: blocks deletion of a Pro-linked transfer",async()=>{
 const db=await setup();
 try{
   await db.query("insert into budget_private.pro_transactions(user_id,kind,personal_transaction_id) values ($1,'transfer_personal',$2)",[owner,transactionId]);
   await assert.rejects(restore(db,backup("household",target)),/Wimm Pro/);
   const d=await db.query<{revision:number}>("select revision from budget_private.documents");
   assert.equal(d.rows[0].revision,1);
 }finally{await db.close();}
});
test("SQL recovery: applies permitted restore atomically and isolates private data",async()=>{
 const db=await setup();
 try{
   const r=await restore(db,backup("personal",privateState));
   assert.deepEqual(r,{revision:2,scope:"personal"});
   const home=await db.query<{revision:number}>("select revision from budget_private.documents");
   assert.equal(home.rows[0].revision,1);
   const houseResult=await restore(db,backup("household",target));
   assert.deepEqual(houseResult,{revision:2,scope:"household"});
 }finally{await db.close();}
});
test("Pro export: all businesses and invoice items, no other user's data",async()=>{
 const db=await setup();
 try{
   const business="30000000-0000-4000-8000-000000000001";
   const invoice="40000000-0000-4000-8000-000000000001";
   const otherBusiness="30000000-0000-4000-8000-000000000002";
   await db.query("insert into budget_private.pro_modules values($1,true),($2,true)",[owner,member]);
   await db.query("insert into budget_private.pro_businesses values ($1,$2,'Mine'),($3,$4,'Other')",[business,owner,otherBusiness,member]);
   await db.query("insert into budget_private.pro_invoices values($1,$2,$3,'F-001')",[invoice,owner,business]);
   await db.query("insert into budget_private.pro_invoice_items values(gen_random_uuid(),$1,'Service')",[invoice]);
   const exportResult=await db.query<{budget_pro_backup_export:{businesses:object[],invoices:object[],invoiceItems:object[],excluded:string[]}}>(
     "select public.budget_pro_backup_export() as budget_pro_backup_export");
   const data=exportResult.rows[0].budget_pro_backup_export;
   assert.equal(data.businesses.length,1);
   assert.equal(data.invoices.length,1);
   assert.equal(data.invoiceItems.length,1);
   assert.ok(data.excluded.includes("calendarSubscriptionTokens"));
 }finally{await db.close();}
});
