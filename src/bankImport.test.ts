import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBankCsv, guessBankMapping, convertBankRows, reconcileBankRows, findBankDuplicateCandidates, readBankAmount } from "./bankImport";
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
test("near-date same-amount entries are flagged as possible matches",()=>{
  const table=parseBankCsv("Date;Libellé;Montant\n13/10/26;CB CARREFOUR;-42,80");
  const rows=convertBankRows(table,guessBankMapping(table.columns));
  assert.equal(rows[0].date,"2026-10-13");
  const existing:Tx={id:"old",account:"current",date:"2026-10-12",type:"expense",amount:4280,description:"Courses"};
  assert.equal(reconcileBankRows(rows,[existing],"current")[0].status,"possible");
});
test("bank reconciliation never changes the original household state",()=>{
  const state=emptyState();const before=JSON.stringify(state);
  reconcileBankRows([{index:0,date:today(),type:"expense",description:"Foo",amount:300}],state.transactions,"current");
  assert.equal(JSON.stringify(state),before);
});

test("suggests the actual matching Wimm transactions with date, amount and category",()=>{
  const csvRow={index:0,date:"2026-10-12",type:"expense" as const,amount:990,description:"Cotisation Offre METAL 10/2026"};
  const current:Tx[]=[
    {id:"fixed-1",type:"expense",account:"bank",date:"2026-10-12",description:"Abonnement Metal",amount:990,category:"subscriptions",fixed:true},
    {id:"other-amount",type:"expense",account:"bank",date:"2026-10-12",description:"Abonnement Metal",amount:999},
    {id:"other-account",type:"expense",account:"savings",date:"2026-10-12",description:"Cotisation Offre METAL 10/2026",amount:990},
    {id:"other-type",type:"income",account:"bank",date:"2026-10-12",description:"Cotisation Offre METAL 10/2026",amount:990},
    {id:"old",type:"expense",account:"bank",date:"2026-10-08",description:"Cotisation",amount:990},
  ];
  const candidates=findBankDuplicateCandidates(csvRow,current,"bank");
  assert.deepEqual(candidates.map(c=>c.transaction.id),["fixed-1"]);
  assert.equal(candidates[0].transaction.category,"subscriptions");
  assert.equal(candidates[0].daysApart,0);
  assert.equal(reconcileBankRows([csvRow],current,"bank")[0].status,"possible");
});
test("ranks stronger labels before date proximity and returns multiple distinct candidates",()=>{
  const csvRow={index:0,date:"2026-10-12",type:"expense" as const,amount:799,description:"BOUYGUES TELECOM"};
  const tx:Tx[]=[
    {id:"A",type:"expense",account:"current",date:"2026-10-12",amount:799,description:"Téléphone"},
    {id:"B",type:"expense",account:"current",date:"2026-10-11",amount:799,description:"Bouygues Telecom",category:"telecom"},
    {id:"C",type:"expense",account:"current",date:"2026-10-14",amount:799,description:"Opérateur"},
  ];
  const candidates=findBankDuplicateCandidates(csvRow,tx,"current");
  assert.deepEqual(candidates.map(c=>c.transaction.id),["B","A","C"]);
  assert.equal(candidates[0].sameLabel,true);
  assert.equal(candidates[0].daysApart,1);
  assert.equal(candidates[1].daysApart,0);
  assert.equal(candidates[2].daysApart,2);
});
test("duplicate suggestions are read-only and ignore amounts more than two days apart",()=>{
  const row={index:0,date:"2026-10-12",type:"expense" as const,amount:899,description:"Orange"};
  const tx:Tx[]=[
    {id:"far",type:"expense",account:"current",date:"2026-10-09",amount:899,description:"Orange"},
    {id:"near",type:"expense",account:"current",date:"2026-10-13",amount:899,description:"Mobile",category:"phone"},
  ];
  const snapshot=JSON.stringify(tx);
  assert.deepEqual(findBankDuplicateCandidates(row,tx,"current").map(x=>x.transaction.id),["near"]);
  assert.equal(JSON.stringify(tx),snapshot);
  assert.deepEqual(findBankDuplicateCandidates(row,tx,"different account"),[]);
});
