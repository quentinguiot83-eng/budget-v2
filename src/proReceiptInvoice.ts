/** Build a paid invoice from a receipt without generating a separate cash entry.
 * The invoice payment RPC becomes the only source of the cash transaction.
 * All amounts are integer cents and VAT is derived from the gross receipt.
 */
export type ProReceiptInvoiceInput={
  amount:number;
  description:string;
  clientId:string;
  productId?:string|null;
  productKind?:"product"|"service";
  paymentDate:string;
  issueDate:string;
  paymentMethod:"card"|"check"|"cash"|"transfer"|"other";
  vatEnabled:boolean;
  vatRate:number;
};
export type ReceiptInvoicePayload={
  invoice:{
    clientId:string;
    issueDate:string;
    serviceDate:string;
    dueDate:string;
    operationType:"goods"|"services";
    notes:string;
    items:{productId:string|null;description:string;quantity:number;unitPrice:number;vatRate:number}[];
  };
  payment:{
    invoiceId:string;amount:number;date:string;method:ProReceiptInvoiceInput["paymentMethod"];
  };
  vatAmount:number;
};
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&
  !Number.isNaN(Date.parse(value+"T12:00:00"))&&new Date(value+"T12:00:00").toISOString().slice(0,10)===value;
export function createReceiptInvoicePayload(input:ProReceiptInvoiceInput):ReceiptInvoicePayload {
  if(!Number.isSafeInteger(input.amount)||input.amount<=0)
    throw Error("Le montant du règlement doit être positif.");
  if(!input.clientId.trim())throw Error("Choisis un client pour créer sa facture.");
  if(!input.description.trim())throw Error("Précise la prestation ou le produit facturé.");
  if(input.description.trim().length>200)throw Error("Le libellé de facture est trop long.");
  if(!validDate(input.paymentDate)||!validDate(input.issueDate)||input.paymentDate>input.issueDate)
    throw Error("La date d’encaissement ne peut pas être postérieure à la date d’émission de la facture.");
  if(!Number.isFinite(input.vatRate)||input.vatRate<0||input.vatRate>100)
    throw Error("Le taux de TVA est invalide.");
  const rate=input.vatEnabled?input.vatRate:0;
  const unitPrice=Math.round(input.amount/(1+rate/100));
  const vatAmount=Math.round(unitPrice*rate/100);
  if(unitPrice+vatAmount!==input.amount)
    throw Error("Ce montant TTC ne correspond pas exactement à une ligne de facture à "+rate+" % de TVA. Ajuste le montant d’un centime ou utilise l’éditeur de factures pour détailler les lignes.");
  const productId=input.productId||null;
  return {
    invoice:{
      clientId:input.clientId,
      issueDate:input.issueDate,
      serviceDate:input.paymentDate,
      dueDate:input.issueDate,
      operationType:input.productKind==="product"?"goods":"services",
      notes:"",
      items:[{productId,description:input.description.trim(),quantity:1,unitPrice,vatRate:rate}],
    },
    payment:{
      invoiceId:"",
      amount:input.amount,
      date:input.paymentDate,
      method:input.paymentMethod,
    },
    vatAmount,
  };
}
