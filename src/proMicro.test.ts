import test from "node:test";
import assert from "node:assert/strict";
import { microPeriod, microSummary, microSuggestedRate } from "./proMicro.ts";
const profile = { activityType:"service", contributionRate:21.2, taxRate:1.7, vatEnabled:false };
test("2026 activity rates include service, goods and BNC", () => {
  assert.equal(microSuggestedRate("commerce"),12.3);
  assert.equal(microSuggestedRate("service"),21.2);
  assert.equal(microSuggestedRate("liberal"),25.6);
  assert.equal(microSuggestedRate("mixed"),null);
});
test("monthly and quarterly deadlines follow the receipt period", () => {
  assert.equal(microPeriod("2026-10","monthly").dueDate,"2026-11-30");
  assert.deepEqual([microPeriod("2026-10","quarterly").key,microPeriod("2026-10","quarterly").end,microPeriod("2026-10","quarterly").dueDate],["2026-10","2026-12","2027-01-31"]);
  assert.equal(microPeriod("2026-09","quarterly").dueDate,"2026-10-31");
});
test("only paid receipts less VAT count; invoices are not a cash transaction", () => {
  const rows = [
    {kind:"income",amount:120000,vatAmount:20000,paid:true,date:"2026-10-04"},
    {kind:"income",amount:40000,paid:false,date:"2026-10-09"},
    {kind:"expense",amount:14000,paid:true,date:"2026-10-11"},
    {kind:"contribution_payment",amount:8000,paid:true,date:"2026-11-30",contributionPeriodKey:"2026-10"},
    {kind:"tax_payment",amount:1000,paid:true,date:"2026-11-30",taxPeriodKey:"2026-10"},
  ];
  const result = microSummary(rows,profile,"2026-10",{frequency:"monthly",taxMode:"liberatoire"});
  assert.equal(result.turnover,100000);
  assert.equal(result.vat,20000);
  assert.equal(result.estimatedContribution,21200);
  assert.equal(result.contributionSettled,true);
  assert.equal(result.dueContribution,0);
  assert.equal(result.dueTax,700);
  assert.equal(result.afterEstimatedCharges,63100);
});
test("quarterly payments are collected by their assigned period and tax can be disabled", () => {
  const rows = [
    {kind:"income",amount:10000,paid:true,date:"2026-10-14"},
    {kind:"income",amount:10000,paid:true,date:"2026-11-14"},
    {kind:"income",amount:10000,paid:true,date:"2026-12-14"},
    {kind:"contribution_payment",amount:6360,paid:true,date:"2027-01-15",contributionPeriodKey:"2026-10"},
  ];
  const r=microSummary(rows,profile,"2026-11",{frequency:"quarterly",taxMode:"none"});
  assert.equal(r.turnover,30000);
  assert.equal(r.dueContribution,0);
  assert.equal(r.dueTax,0);
});

test("partial or above-estimate social debit settles the declaration while income tax remains separate",()=>{
  for(const amount of [1,5000,30000]){
    const rows=[
      {kind:"income",amount:100000,paid:true,date:"2026-10-04",vatAmount:0},
      {kind:"contribution_payment",amount,paid:true,date:"2026-10-22",contributionPeriodKey:"2026-10"},
    ];
    const result=microSummary(rows,profile,"2026-10",{frequency:"monthly",taxMode:"liberatoire"});
    assert.equal(result.estimatedContribution,21200);
    assert.equal(result.paidContribution,amount);
    assert.equal(result.contributionSettled,true);
    assert.equal(result.dueContribution,0);
    assert.equal(result.dueTax,1700);
  }
});
test("a social payment for another period or not marked paid must not clear this period",()=>{
 const tx=[
  {kind:"income",amount:100000,paid:true,date:"2026-10-04"},
  {kind:"contribution_payment",amount:5000,paid:false,date:"2026-10-22",contributionPeriodKey:"2026-10"},
  {kind:"contribution_payment",amount:7000,paid:true,date:"2026-10-22",contributionPeriodKey:"2026-09"},
 ];
 const r=microSummary(tx,profile,"2026-10",{frequency:"monthly",taxMode:"none"});
 assert.equal(r.contributionSettled,false);
 assert.equal(r.dueContribution,21200);
});
