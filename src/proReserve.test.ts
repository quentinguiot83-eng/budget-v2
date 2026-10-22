import test from "node:test";
import assert from "node:assert/strict";
import {calculateProReserve,previewReceiptReserves} from "./proReserve";
import type {ProCashEntry} from "./proFinance";
const row=(id:string,kind:string,amount:number,date="2026-10-10",vatAmount=0):ProCashEntry=>({id,kind,amount,date,vatAmount,paid:true});
const profile={contributionRate:21,taxRate:2,vatEnabled:false};
test("each recorded receipt earmarks social and income tax without changing bank cash",()=>{
  const value=calculateProReserve([row("a","income",100000),row("b","income",20000)],0,profile,"2026-10","2026-10-22");
  assert.equal(value.grossReceived,120000);
  assert.equal(value.monthContributions,25200);
  assert.equal(value.monthTax,2400);
  assert.equal(value.totalToKeep,27600);
  assert.equal(value.cashBalance,120000);
  assert.equal(value.availableForPay,92400);
});
test("previous contributions and tax payments release only remaining liabilities",()=>{
  const value=calculateProReserve([
    row("a","income",100000),row("social","contribution_payment",12000),
    row("tax","tax_payment",1000),row("expenses","expense",10000),
  ],0,profile,"2026-10","2026-10-22");
  assert.equal(value.contributionsOwed,9000);
  assert.equal(value.taxOwed,1000);
  assert.equal(value.cashBalance,77000);
  assert.equal(value.availableForPay,67000);
});
test("VAT-enabled profile bases statutory envelopes on tax-free receipts",()=>{
  const tax={contributionRate:20,taxRate:1,vatEnabled:true};
  const value=previewReceiptReserves(120000,20000,tax);
  assert.deepEqual(value,{taxable:100000,contributions:20000,tax:1000,vat:20000,total:41000,remaining:79000});
});
test("pending and future invoices are excluded and transfer does not generate a new reserve",()=>{
  const entries=[row("old","income",120000,"2026-10-01"),{...row("pending","income",600000),paid:false},
    row("future","income",300000,"2026-11-02"),row("salary","transfer_personal",40000)];
  const value=calculateProReserve(entries,0,profile,"2026-10","2026-10-22");
  assert.equal(value.grossReceived,120000);
  assert.equal(value.totalToKeep,27600);
  assert.equal(value.cashBalance,80000);
  assert.equal(value.availableForPay,52400);
});
test("unconfigured rates are warned; old balances cannot be called reserved",()=>{
  const value=calculateProReserve([row("a","income",50000)],100000,
    {contributionRate:0,taxRate:0,vatEnabled:false},"2026-10","2026-10-22");
  assert.equal(value.ratesConfigured,false);
  assert.equal(value.availableForPay,150000);
});
test("a previous month shows its own accrual but does not include later receipts",()=>{
  const data=[row("oct","income",100000),row("nov","income",200000,"2026-11-03")];
  const value=calculateProReserve(data,0,profile,"2026-10","2026-11-12");
  assert.equal(value.monthContributions,21000);
  assert.equal(value.grossReceived,100000);
});
test("VAT provision is explicitly conservative; expense VAT offsets collected VAT",()=>{
  const data=[row("sales","income",120000,"2026-10-10",20000),row("costs","expense",60000,"2026-10-15",10000)];
  const value=calculateProReserve(data,0,{contributionRate:20,taxRate:2,vatEnabled:true},"2026-10","2026-10-22");
  assert.equal(value.vatToKeep,10000);
  assert.equal(value.contributionsOwed,20000);
  assert.equal(value.taxOwed,2000);
  assert.equal(value.availableForPay,28000);
});
