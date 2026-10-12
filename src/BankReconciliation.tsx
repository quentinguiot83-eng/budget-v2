import { useMemo, useState, type ChangeEvent } from "react";
import { ArrowLeftRight, CheckCircle2, FileSpreadsheet, ShieldCheck, UploadCloud } from "lucide-react";
import { today, money, type State, type Tx } from "./engine";
import { convertBankRows, guessBankMapping, parseBankCsv, reconcileBankRows,
  MAX_BANK_CSV_BYTES, type CsvMapping, type CsvTable, type BankRow, type ReconciledRow } from "./bankImport";
import { quickSuggestions } from "./quickEntry";
import "./bankReconciliation.css";

export type BankDraft = Pick<Tx,"date"|"type"|"amount"|"description"|"account"|"category"|"incomeType"|"bankImportKey">;
type Props={state:State;onImport:(drafts:BankDraft[],rows:BankRow[],account:string)=>Promise<void>};
const mappingLabels:{key:keyof CsvMapping;label:string}[]=[
  {key:"date",label:"Date"},{key:"description",label:"Libellé"},{key:"amount",label:"Montant signé"},
  {key:"debit",label:"Débit"},{key:"credit",label:"Crédit"},
];
export default function BankReconciliation({state,onImport}:Props){
  const accounts=state.accounts.filter(a=>a.group==="current"&&!a.archived);
  const categories=state.categories.filter(c=>!c.archived);
  const [account,setAccount]=useState(accounts[0]?.id||"");
  const [table,setTable]=useState<CsvTable|null>(null);
  const [map,setMap]=useState<CsvMapping>({date:-1,description:-1,amount:-1,debit:-1,credit:-1});
  const [fileName,setFileName]=useState("");
  const [rows,setRows]=useState<BankRow[]>([]);
  const [selected,setSelected]=useState<number[]>([]);
  const [categoriesByRow,setCategoriesByRow]=useState<Record<number,string>>({});
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [visible,setVisible]=useState(100);
  const accountStart=accounts.find(a=>a.id===account)?.date||today();
  const matched=useMemo(()=>reconcileBankRows(rows,state.transactions,account),[rows,state.transactions,account]);
  const matchedCount=matched.filter(r=>r.status==="matched").length;
  const possibleCount=matched.filter(r=>r.status==="possible").length;
  const selectable=matched.filter(r=>r.status!=="matched"&&r.date>=accountStart&&r.date<=today());
  const suggestions=useMemo(()=>{
    const out:Record<number,string>={};
    for(const row of matched){
      if(row.type!=="expense")continue;
      const best=quickSuggestions(state,"expense",row.description,1)[0];
      if(best?.category && categories.some(c=>c.id===best.category))out[row.index]=best.category;
    }
    return out;
  },[matched,state]);
  const selection=selected.map(i=>matched.find(row=>row.index===i)).filter((r):r is ReconciledRow=>!!r);
  function effectiveCategory(row:ReconciledRow){return categoriesByRow[row.index]??suggestions[row.index]??"";}
  function resetPreview(){setRows([]);setSelected([]);setCategoriesByRow({});setConfirm(false);setVisible(100);}
  async function openFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.currentTarget.value="";
    if(!file)return;
    setError("");setMessage("");setTable(null);resetPreview();setFileName("");
    try{
      if(file.size>MAX_BANK_CSV_BYTES)throw Error("Fichier CSV trop volumineux (4 Mo maximum).");
      const next=parseBankCsv(await file.text());
      setTable(next);setMap(guessBankMapping(next.columns));setFileName(file.name);
    }catch(ex){setError(ex instanceof Error?ex.message:"Ce CSV ne peut pas être lu.");}
  }
  function analyse(){
    if(!table)return;
    setError("");setMessage("");resetPreview();
    try{
      const result=convertBankRows(table,map);
      if(result.some(r=>r.date>today()))throw Error("Le CSV contient des opérations futures. Vérifiez le fichier et les dates.");
      setRows(result);
    }catch(e){setError(e instanceof Error?e.message:"Impossible d’analyser le fichier.");}
  }
  function toggle(index:number){setSelected(old=>old.includes(index)?old.filter(i=>i!==index):[...old,index]);setConfirm(false);}
  async function importRows(){
    if(busy||!confirm||!selection.length)return;
    setError("");setMessage("");
    const prepared:BankDraft[]=[];
    for(const r of selection){
      if(r.status==="matched"||r.date<accountStart||r.date>today()){setError("Une ligne sélectionnée est déjà présente ou hors période autorisée.");return;}
      const category= r.type==="expense"?effectiveCategory(r):undefined;
      if(r.type==="expense"&&!category){setError("Choisissez une catégorie pour toutes les dépenses sélectionnées.");return;}
      prepared.push({date:r.date,description:r.description,amount:r.amount,type:r.type,account,
        category,incomeType:r.type==="income"?"Autre":undefined,bankImportKey:r.key});
    }
    setBusy(true);
    try{
      await onImport(prepared,rows,account);
      setMessage(prepared.length+" opération(s) enregistrée(s). Les lignes ont été rapprochées.");
      setSelected([]);setConfirm(false);
    }catch(e){setError(e instanceof Error?e.message:"Import impossible.");}
    finally{setBusy(false);}
  }
  if(!accounts.length)return <section className="card"><h2>Rapprochement bancaire</h2><p>Ajoutez d’abord un compte courant.</p></section>;
  return <div className="wimm-bank-reconcile">
    <section className="card">
      <div className="section-head"><div className="block-title"><h2><ArrowLeftRight size={19}/> Rapprochement bancaire</h2></div></div>
      <p className="muted">Importez un relevé CSV pour comparer les opérations de votre banque avec Wimm. Le fichier reste sur votre appareil et aucune opération n’est enregistrée automatiquement.</p>
      <div className="wimm-bank-toolbar">
        <label>Compte à rapprocher<select value={account} onChange={e=>{setAccount(e.target.value);setSelected([]);setConfirm(false);}}>
          {accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}
        </select></label>
        <label className="wimm-bank-file"><UploadCloud size={18}/> Choisir un relevé CSV<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={e=>void openFile(e)}/></label>
      </div>
      {table&&<div className="wimm-bank-mapping">
        <h3><FileSpreadsheet size={17}/> {fileName} · {table.rows.length} lignes</h3>
        <p className="muted">Vérifiez les colonnes reconnues. Choisissez soit « Montant signé » (négatif = dépense), soit « Débit » et « Crédit ».</p>
        <div className="wimm-bank-mapping-grid">{mappingLabels.map(x=><label key={x.key}>{x.label}
          <select value={map[x.key]} onChange={e=>{setMap(old=>({...old,[x.key]:Number(e.target.value)}));resetPreview();}}>
            <option value={-1}>Non utilisé</option>
            {table.columns.map((name,i)=><option key={i} value={i}>{name||"Colonne "+(i+1)}</option>)}
          </select></label>)}</div>
        <button className="primary" type="button" onClick={analyse}>Analyser et comparer</button>
      </div>}
      {error&&<p role="alert" className="error">{error}</p>}
      {message&&<p role="status" className="wimm-bank-success"><CheckCircle2 size={17}/> {message}</p>}
    </section>
    {rows.length>0&&<section className="card">
      <div className="section-head"><h2>Comparaison du relevé</h2></div>
      <div className="wimm-bank-summary">
        <div><strong>{rows.length}</strong><span>Lignes lues</span></div>
        <div><strong>{matchedCount}</strong><span>Déjà présentes</span></div>
        <div><strong>{possibleCount}</strong><span>À vérifier</span></div>
        <div><strong>{rows.length-matchedCount-possibleCount}</strong><span>Nouvelles</span></div>
      </div>
      <p className="muted">Les correspondances exactes ne peuvent pas être importées une seconde fois. Un même montant et une même date avec un libellé différent sont signalés comme possibles doublons. Vérifiez aussi les virements internes, qui ne doivent pas être saisis comme dépenses.</p>
      <div className="wimm-bank-list">
        {matched.slice(0,visible).map(row=>{
          const allowed=row.status!=="matched"&&row.date>=accountStart&&row.date<=today();
          const checked=selected.includes(row.index);
          return <div className={"wimm-bank-row "+(row.status==="matched"?"is-matched":"")} key={row.index}>
            <label className="wimm-bank-row-main"><input type="checkbox" disabled={!allowed||busy} checked={checked} onChange={()=>toggle(row.index)}/>
              <span><strong>{row.description}</strong><small>{row.date} · {row.type==="expense"?"Débit":"Crédit"} · {row.status==="matched"?"Déjà dans Wimm":row.status==="possible"?"Possible doublon":"Nouvelle opération"}{row.date<accountStart?" · Avant solde initial":""}</small></span>
              <strong className={row.type==="income"?"positive":""}>{row.type==="expense"?"−":"+"}{money(row.amount)}</strong></label>
            {checked&&row.type==="expense"&&<label className="wimm-bank-category">Catégorie
              <select value={effectiveCategory(row)} onChange={e=>{setCategoriesByRow(old=>({...old,[row.index]:e.target.value}));setConfirm(false);}}>
                <option value="">Choisir une catégorie…</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>}
          </div>;
        })}
      </div>
      {visible<matched.length&&<button className="secondary" type="button" onClick={()=>setVisible(v=>v+100)}>Afficher 100 lignes supplémentaires</button>}
      <div className="wimm-bank-confirm">
        <strong>{selected.length} opération(s) sélectionnée(s) · {money(selection.filter(r=>r.type==="expense").reduce((n,r)=>n+r.amount,0))} en débits</strong>
        <label><input type="checkbox" checked={confirm} disabled={!selection.length||busy} onChange={e=>setConfirm(e.target.checked)}/>
          J’ai vérifié les lignes sélectionnées, notamment les virements entre comptes et les possibles doublons.</label>
        <button className="primary" type="button" disabled={!confirm||!selection.length||busy} onClick={()=>void importRows()}>
          {busy?"Import en cours…":"Importer "+selected.length+" opération(s) sélectionnée(s)"}
        </button>
      </div>
    </section>}
  </div>;
}
