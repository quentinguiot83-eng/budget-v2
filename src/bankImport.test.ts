import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBankCsv, guessBankMapping, convertBankRows, reconcileBankRows, readBankAmount } from "./bankImport";
import { emptyState, today, type Tx } from "./engine";
const csv = "Date;Libellé;Montant\n12/10/2026;\"CARREFOUR;MARSEILLE\";-42,80\n11/10/2026;Virement reçu;+75,00";
test("CSV with quoted semicolons, French decimals and header suggestions",()=>{
  const table=parseBankCsv(csv);
  assert.equal(table.rows[0][1],"CARREFOUR;MARSEILLE");
  const mapping=guessBankMapping(table.columns);
  assert.equal(mapping.date,0);assert.equal(mapping.description,1);assert.equal(mapping.amount,2);
  const rows=convertBankRows(table,mapping);
  assert.deepEqual(rows.map(r=>[r.date,r.type,r.amount]),[
    ["2026-10-12","expense",4280],["2026-10-11","income",7500]
  ]);
});
test("signed amounts, separate debit-credit, ISO dates, quotes and numeric exactness",()=>{
  assert.equal(readBankAmount("1 234,56 €"),123456);
  assert.equal(readBankAmount("1.234,56"),123456);
  assert.equal(readBankAmount("1,234.56"),123456);
  assert.equal(readBankAmount("−1 234,56"),-123456);
  assert.equal(readBankAmount("(123,45)"),-12345);
  const table=parseBankCsv('Date,Description,Debit,Credit\n2026-10-11,\"Pharmacie, rue A\",\"12,99\",\n2026-10-10,Revenu,,100.00');
  const rows=convertBankRows(table,guessBankMapping(table.columns));
  assert.deepEqual(rows.map(r=>[r.type,r.amount]),[["expense",1299],["income",10000]]);
});
test("rejects malformed CSV, ambiguous values and impossible dates without partial import",()=>{
  assert.throws(()=>parseBankCsv("hello"),/Séparateur/);
  assert.throws(()=>parseBankCsv('Date;Libellé;Montant\n"not closed'),/Guillemet/);
  assert.throws(()=>readBankAmount("1,23,45"),/invalide/);
  assert.throws(()=>convertBankRows(parseBankCsv("Date;Libellé;Montant\n31/02/2026;Erreur;-10"),{
    date:0,description:1,amount:2,debit:-1,credit:-1}),/invalide/);
  assert.throws(()=>convertBankRows(parseBankCsv("Date;Libellé;Montant\n12/10/2026;A;-10;extra"),{
    date:0,description:1,amount:2,debit:-1,credit:-1}),/colonnes/);
});
test("exact matches and imported fingerprints prevent double importing",()=>{
  const rows=convertBankRows(parseBankCsv(csv),guessBankMapping(["Date","Libellé","Montant"]));
  const before=reconcileBankRows(rows,[],"current");
  assert.deepEqual(before.map(r=>r.status),["new","new"]);
  const existing:Tx[]=[{
    id:"first",account:"current",date:rows[0].date,type:"expense",amount:rows[0].amount,description:rows[0].description,
    bankImportKey:before[0].key,
  },{
    id:"other",account:"other",date:rows[1].date,type:"income",amount:rows[1].amount,description:rows[1].description
  }];
  const next=reconcileBankRows(rows,existing,"current");
  assert.deepEqual(next.map(r=>r.status),["matched","new"]);
  assert.equal(reconcileBankRows(rows,existing,"other")[1].status,"matched");
});
test("potential duplicates with altered labels are reviewed, not automatically matched",()=>{
  const table=parseBankCsv("Date;Libellé;Montant\n12/10/2026;CB SUPERMARCHE;-42,80");
  const rows=convertBankRows(table,guessBankMapping(table.columns));
  const tx={id:"x",type:"expense" as const,amount:4280,date:"2026-10-12",description:"Carrefour",account:"current"};
  assert.equal(reconcileBankRows(rows,[tx],"current")[0].status,"possible");
});
test("duplicate same-amount same-label lines respect occurrence and reimport",()=>{
  const table=parseBankCsv("Date;Libellé;Montant\n12/10/2026;Cafe;-2,50\n12/10/2026;Cafe;-2,50");
  const rows=convertBankRows(table,guessBankMapping(table.columns));
  const one:Tx={id:"existing",type:"expense",date:"2026-10-12",amount:250,description:"Cafe",account:"current"};
  let reconciled=reconcileBankRows(rows,[one],"current");
  assert.deepEqual(reconciled.map(x=>x.status),["matched","possible"]); // same amount on same day requires review
  assert.notEqual(reconciled[0].key,reconciled[1].key);
  const two={...one,id:"imported",bankImportKey:reconciled[1].key};
  reconciled=reconcileBankRows(rows,[one,two],"current");
  assert.deepEqual(reconciled.map(x=>x.status),["matched","matched"]);
});
test("bank reconciliation never changes the original household state",()=>{
  const state=emptyState();const before=JSON.stringify(state);
  reconcileBankRows([{index:0,date:today(),type:"expense",description:"Foo",amount:300}],state.transactions,"current");
  assert.equal(JSON.stringify(state),before);
});
