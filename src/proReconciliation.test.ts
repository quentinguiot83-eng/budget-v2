import test from "node:test";
import assert from "node:assert/strict";
import {proOpeningForTargetBalance,proPaymentsForPeriod} from "./proReconciliation.ts";
test("recalibration changes opening only by the bank discrepancy without inventing turnover",()=>{
  assert.equal(proOpeningForTargetBalance(10000,25000,22000),7000);
  assert.equal(proOpeningForTargetBalance(10000,25000,25000),10000);
  assert.equal(proOpeningForTargetBalance(0,-2000,8000),10000);
});
test("recalibration blocks invalid or extreme values",()=>{
  assert.throws(()=>proOpeningForTargetBalance(0,0,Number.NaN));
  assert.throws(()=>proOpeningForTargetBalance(0,0,1000000000001));
});
test("adjustable contribution and tax payments remain assigned to declaration period, not payment month",()=>{
  const rows=[
    {id:"c1",kind:"contribution_payment",amount:12000,date:"2027-01-31",paid:true,contributionPeriodKey:"2026-10"},
    {id:"c2",kind:"contribution_payment",amount:2000,date:"2027-01-30",paid:true,contributionPeriodKey:"2026-09"},
    {id:"t1",kind:"tax_payment",amount:800,date:"2027-01-31",paid:true,taxPeriodKey:"2026-11"},
    {id:"c3",kind:"contribution_payment",amount:12000,date:"2027-01-31",paid:false,contributionPeriodKey:"2026-12"},
    {id:"income",kind:"income",amount:50000,date:"2026-10-01",paid:true},
  ];
  assert.deepEqual(proPaymentsForPeriod(rows,"2026-10","2026-12").map(r=>r.id),["c1","t1"]);
  assert.deepEqual(proPaymentsForPeriod(rows,"2026-09","2026-09").map(r=>r.id),["c2"]);
});
