import test from "node:test";
import assert from "node:assert/strict";
import {createReceiptInvoicePayload,type ProReceiptInvoiceInput} from "./proReceiptInvoice";
const entry:ProReceiptInvoiceInput={
  amount:12000,description:"Nettoyage hebdomadaire",clientId:"client-1",
  productId:"service-1",productKind:"service",paymentDate:"2026-10-22",
  issueDate:"2026-10-22",paymentMethod:"transfer",vatEnabled:true,vatRate:20,
};
test("a paid invoice uses the amount, client, service and payment once",()=>{
  const value=createReceiptInvoicePayload(entry);
  assert.equal(value.invoice.clientId,"client-1");
  assert.equal(value.invoice.items[0].unitPrice,10000);
  assert.equal(value.vatAmount,2000);
  assert.equal(value.invoice.items[0].vatRate,20);
  assert.equal(value.payment.amount,12000);
  assert.equal(value.payment.method,"transfer");
  assert.equal(value.invoice.items[0].productId,"service-1");
  assert.equal(value.invoice.dueDate,"2026-10-22");
});
test("non VAT enabled receipt creates exactly one tax-free invoice line",()=>{
  const value=createReceiptInvoicePayload({...entry,amount:5899,vatEnabled:false});
  assert.equal(value.invoice.items.length,1);
  assert.equal(value.invoice.items[0].unitPrice,5899);
  assert.equal(value.invoice.items[0].vatRate,0);
  assert.equal(value.vatAmount,0);
});
test("a product is classified as goods",()=>{
  const value=createReceiptInvoicePayload({...entry,productKind:"product"});
  assert.equal(value.invoice.operationType,"goods");
});
test("invoice requires a client and rejects zero/invalid amount",()=>{
  assert.throws(()=>createReceiptInvoicePayload({...entry,clientId:""}),/client/);
  assert.throws(()=>createReceiptInvoicePayload({...entry,amount:0}),/montant/);
  assert.throws(()=>createReceiptInvoicePayload({...entry,amount:1.25}),/montant/);
});
test("a predated receipt may be invoiced today, but not after the invoice issue date",()=>{
  assert.equal(createReceiptInvoicePayload({...entry,paymentDate:"2026-10-21"}).payment.date,"2026-10-21");
  assert.throws(()=>createReceiptInvoicePayload({...entry,paymentDate:"2026-10-23"}),/date/);
  assert.throws(()=>createReceiptInvoicePayload({...entry,paymentDate:"2026-02-30"}),/date/);
});
test("VAT gross-to-net inconsistencies are rejected instead of inventing an invoice total",()=>{
  assert.throws(()=>createReceiptInvoicePayload({...entry,amount:3}),/centime|lignes/);
});
