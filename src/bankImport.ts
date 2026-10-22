import type { Tx } from "./engine";

/** Parse a bank export entirely in the browser; never upload the source CSV. */
export type CsvTable = { columns: string[]; rows: string[][] };
export type CsvMapping = { date: number; description: number; amount: number; debit: number; credit: number };
export type BankRow = { index: number; date: string; description: string; type: "expense" | "income"; amount: number };
export type ReconciledRow = BankRow & {
  key: string; status: "matched" | "possible" | "new"; matches: number;
};
export const MAX_BANK_CSV_BYTES = 4 * 1024 * 1024;

export function parseBankCsv(text: string): CsvTable {
  if (new TextEncoder().encode(text).length > MAX_BANK_CSV_BYTES)
    throw Error("Fichier trop volumineux (maximum 4 Mo).");
  let input = text.replace(/^\uFEFF/, "");
  if (/^sep=[;,\t]\r?\n/i.test(input)) input = input.replace(/^sep=[;,\t]\r?\n/i, "");
  const headerLine = input.split(/\r?\n/,1)[0] ?? "";
  const count = (delimiter: string) => {
    let quoted = false, n = 0;
    for (let i = 0; i < headerLine.length; i++) {
      if (headerLine[i] === '"') {
        if (quoted && headerLine[i+1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && headerLine[i] === delimiter) n++;
    }
    return n;
  };
  const delimiter = ([";","\t",","].sort((a,b) => count(b) - count(a)))[0];
  if (count(delimiter) === 0) throw Error("Séparateur CSV non reconnu (point-virgule, virgule ou tabulation).");
  const result: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(ch==='"'){
      if(quoted && input[i+1]==='"'){cell+='"';i++;}
      else if(!quoted && !cell)quoted=true;
      else if(quoted)quoted=false;
      else throw Error("Guillemets CSV invalides.");
    }else if(!quoted && ch===delimiter){row.push(cell.trim());cell="";}
    else if(!quoted && (ch==="\n" || ch==="\r")){
      if(ch==="\r" && input[i+1]==="\n")i++;
      row.push(cell.trim());cell="";
      if(row.some(v=>v!==""))result.push(row);
      row=[];
      if(result.length>2501)throw Error("Fichier trop long (maximum 2 500 opérations).");
    }else cell+=ch;
  }
  if(quoted)throw Error("Guillemet CSV non fermé.");
  row.push(cell.trim());
  if(row.some(v=>v!==""))result.push(row);
  if(result.length<2)throw Error("Le CSV doit contenir un en-tête et des opérations.");
  const columns=result[0];
  if(columns.length<3)throw Error("Le CSV doit contenir au moins trois colonnes.");
  return {columns, rows:result.slice(1)};
}

function normalizeHeader(v:string){
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
}
export function guessBankMapping(columns:string[]):CsvMapping{
  const headers=columns.map(normalizeHeader);
  const seek=(words:string[])=>headers.findIndex(h=>words.some(w=>h===w||h.includes(w)));
  return {
    date:seek(["dateoperation","datecomptable","datevaleur","date","operationdate"]),
    description:seek(["libelle","description","intitule","label","operation","motif","designation"]),
    amount:seek(["montanteur","montant","amount","somme"]),
    debit:seek(["debit","sortie"]),
    credit:seek(["credit","entree"]),
  };
}
function readDate(s:string):string{
  const v=s.trim();
  let year:number,month:number,day:number;
  let m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s.*)?$/);
  if(m){year=+m[1];month=+m[2];day=+m[3];}
  else{
    m=v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})(?:\s.*)?$/);
    if(!m)throw Error("Date bancaire non reconnue : "+v.slice(0,40));
    day=+m[1];month=+m[2];year=m[3].length===2?2000+Number(m[3]):Number(m[3]);
  }
  const check=new Date(Date.UTC(year,month-1,day));
  if(year<2000||check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)
    throw Error("Date bancaire invalide : "+v.slice(0,40));
  return [year,String(month).padStart(2,"0"),String(day).padStart(2,"0")].join("-");
}
/** Bank amounts are converted to integer cents; never use floating-point totals. */
export function readBankAmount(raw:string):number{
  let s=raw.trim().replace(/[€\s\u00A0\u202F]/g,"").replace(/[−–]/g,"-");
  if(!s)throw Error("Montant bancaire manquant.");
  const negative=s.startsWith("-")||(s.startsWith("(")&&s.endsWith(")"));
  s=s.replace(/^[+(-]/,"").replace(/\)$/,"");
  // European 1.234,56 and English 1,234.56
  if(s.includes(",")&&s.includes(".")){
    if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"");
  }else if(s.includes(",")){
    if(/^\d{1,3}(,\d{3})+$/.test(s))s=s.replace(/,/g,"");
    else s=s.replace(",",".");
  }else if(/^\d{1,3}(\.\d{3})+$/.test(s)){
    s=s.replace(/\./g,"");
  }else if((s.match(/\./g)||[]).length>1){
    if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
  }
  if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error("Montant bancaire invalide : "+raw.slice(0,40));
  const [units,cents=""] = s.split(".");
  const value=Number(units)*100+Number(cents.padEnd(2,"0"));
  if(!Number.isSafeInteger(value)||value<=0||value>1e12)throw Error("Montant bancaire hors limites.");
  return negative?-value:value;
}
export function convertBankRows(table:CsvTable,map:CsvMapping):BankRow[]{
  const {columns,rows}=table;
  const exists=(i:number)=>Number.isInteger(i)&&i>=0&&i<columns.length;
  if(!exists(map.date)||!exists(map.description)||(!exists(map.amount)&&!(exists(map.debit)&&exists(map.credit))))
    throw Error("Sélectionnez les colonnes Date, Libellé et Montant ou Débit/Crédit.");
  const useAmount=exists(map.amount);
  const required=[map.date,map.description,...(useAmount?[map.amount]:[map.debit,map.credit])];
  if(new Set(required).size!==required.length)throw Error("Chaque champ doit utiliser une colonne différente.");
  const converted:BankRow[]=[];
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(r.length!==columns.length)throw Error("Nombre de colonnes incorrect à la ligne "+(i+2)+".");
    const description=(r[map.description]||"").trim();
    if(!description)throw Error("Libellé manquant à la ligne "+(i+2)+".");
    let signed:number;
    if(useAmount) signed=readBankAmount(r[map.amount]);
    else {
      const debit=(r[map.debit]||"").trim();
      const credit=(r[map.credit]||"").trim();
      if(!!debit===!!credit)throw Error("Débit et crédit ambigus à la ligne "+(i+2)+".");
      signed=credit?Math.abs(readBankAmount(credit)):-Math.abs(readBankAmount(debit));
    }
    converted.push({index:i,date:readDate(r[map.date]),description:description.slice(0,180),amount:Math.abs(signed),type:signed<0?"expense":"income"});
  }
  return converted;
}
export function normalizeBankLabel(v:string){
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function signature(r:Pick<BankRow,"date"|"type"|"amount"|"description">){
  return [r.date,r.type,r.amount,normalizeBankLabel(r.description)].join("|");
}
/** Possible matches in Wimm, never an automatic reconciliation decision.
 * Same current account, direction and amount; booking dates may vary by two days.
 * Return real transactions so the UI can name the suggested match and its category.
 */
export type BankDuplicateCandidate = {
  transaction: Tx;
  daysApart: number;
  sameLabel: boolean;
};

export function findBankDuplicateCandidates(
  row: Pick<BankRow,"date"|"type"|"amount"|"description">,
  transactions: Tx[],
  account: string,
): BankDuplicateCandidate[] {
  const day = Date.parse(row.date + "T00:00:00Z");
  if (!Number.isFinite(day)) return [];
  const label = normalizeBankLabel(row.description);
  return transactions
    .filter(t => t.account === account && t.type === row.type && t.amount === row.amount)
    .map(t => ({
      transaction: t,
      daysApart: Math.round(Math.abs(Date.parse(t.date + "T00:00:00Z") - day) / 86400000),
      sameLabel: normalizeBankLabel(t.description) === label,
    }))
    .filter(c => c.daysApart <= 2)
    .sort((a,b) => {
      // Name match first, then nearest banking date, then newest recorded movement.
      if(a.sameLabel !== b.sameLabel) return a.sameLabel ? -1 : 1;
      return a.daysApart - b.daysApart || b.transaction.date.localeCompare(a.transaction.date);
    });
}

export function reconcileBankRows(rows:BankRow[], transactions:Tx[], account:string):ReconciledRow[]{
  const existing=transactions.filter(t=>t.account===account&&(t.type==="income"||t.type==="expense"));
  const exactCounts=new Map<string,number>();
  const knownImportKeys=new Set<string>();
  const indexedCandidates=new Map<string,Tx[]>();
  for(const t of existing){
    const sig=signature({date:t.date,type:t.type as "expense"|"income",amount:t.amount,description:t.description});
    exactCounts.set(sig,(exactCounts.get(sig)||0)+1);
    if(t.bankImportKey)knownImportKeys.add(t.bankImportKey);
    const key=t.type+":"+t.amount;
    const matches=indexedCandidates.get(key)||[];
    matches.push(t);
    indexedCandidates.set(key,matches);
  }
  const consumed=new Map<string,number>();
  const seen=new Map<string,number>();
  return rows.map(row=>{
    const sig=signature(row);
    const occurrence=(seen.get(sig)||0)+1;
    seen.set(sig,occurrence);
    const key=["csv",account,sig,occurrence].join(":");
    const alreadyImported=knownImportKeys.has(key);
    const matched=(consumed.get(sig)||0)<(exactCounts.get(sig)||0);
    if(matched)consumed.set(sig,(consumed.get(sig)||0)+1);
    // A suggestion is only a warning; never silently merge two operations.
    const possible=!matched && findBankDuplicateCandidates(row,indexedCandidates.get(row.type+":"+row.amount)||[],account).length>0;
    return {...row,key,status:alreadyImported||matched?"matched":possible?"possible":"new",
      matches:(exactCounts.get(sig)||0)};
  });
}
