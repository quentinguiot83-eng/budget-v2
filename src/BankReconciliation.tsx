import { useMemo, useState, type ChangeEvent } from "react";
import { AlertCircle, ArrowLeftRight, CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";
import { today, money, type State, type Tx } from "./engine";
import { convertBankRows, findBankDuplicateCandidates, guessBankMapping, parseBankCsv, reconcileBankRows,
  MAX_BANK_CSV_BYTES, type BankDuplicateCandidate, type CsvMapping, type CsvTable, type BankRow, type ReconciledRow } from "./bankImport";
import { quickSuggestions } from "./quickEntry";
import "./bankReconciliation.css";

export type BankDraft = Pick<Tx,"date"|"type"|"amount"|"description"|"account"|"category"|"incomeType"|"bankImportKey">;
type DuplicateDecision = { action: "skip"; transactionId: string } | { action: "import" };
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
  const [duplicateChoices,setDuplicateChoices]=useState<Record<number,DuplicateDecision>>({});
  const [expandedCandidates,setExpandedCandidates]=useState<number[]>([]);
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [visible,setVisible]=useState(100);
  const accountStart=accounts.find(a=>a.id===account)?.date||today();
  const matched=useMemo(()=>reconcileBankRows(rows,state.transactions,account),[rows,state.transactions,account]);
  const matchedCount=matched.filter(r=>r.status==="matched").length;
  const possibleCount=matched.filter(r=>r.status==="possible"&&!duplicateChoices[r.index]).length;
  const resolvedExisting=matched.filter(r=>r.status==="possible"&&duplicateChoices[r.index]?.action==="skip").length;
  const resolvedNew=matched.filter(r=>r.status==="possible"&&duplicateChoices[r.index]?.action==="import").length;
  const candidatesByRow=useMemo(()=>{
    const list=new Map<number,BankDuplicateCandidate[]>();
    for(const row of matched)if(row.status==="possible")
      list.set(row.index,findBankDuplicateCandidates(row,state.transactions,account));
    return list;
  },[matched,state.transactions,account]);
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
  function resetPreview(){
    setRows([]);setSelected([]);setCategoriesByRow({});
    setDuplicateChoices({});setExpandedCandidates([]);setConfirm(false);setVisible(100);
  }
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
  function toggle(index:number){
    setSelected(old=>old.includes(index)?old.filter(i=>i!==index):[...old,index]);setConfirm(false);
  }
  function markExisting(index:number,transactionId:string){
    if(Object.entries(duplicateChoices).some(([other,d])=>
      Number(other)!==index&&d.action==="skip"&&d.transactionId===transactionId)){
      setError("Cette opération Wimm est déjà rapprochée avec une autre ligne du relevé.");return;
    }
    setError("");
    setDuplicateChoices(old=>({...old,[index]:{action:"skip",transactionId}}));
    setSelected(old=>old.filter(i=>i!==index));setConfirm(false);
  }
  function markToImport(index:number){
    setError("");
    setDuplicateChoices(old=>({...old,[index]:{action:"import"}}));
    setSelected(old=>old.includes(index)?old:[...old,index]);setConfirm(false);
  }
  async function importRows(){
    if(busy||!confirm||!selection.length)return;
    setError("");setMessage("");
    const prepared:BankDraft[]=[];
    for(const r of selection){
      if(r.status==="matched"||r.date<accountStart||r.date>today()){setError("Une ligne sélectionnée est déjà présente ou hors période autorisée.");return;}
      if(r.status==="possible"&&duplicateChoices[r.index]?.action!=="import"){
        setError("Choisissez d’abord comment traiter chaque doublon possible.");return;
      }
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
        <label>Compte à rapprocher<select value={account} onChange={e=>{setAccount(e.target.value);setSelected([]);setDuplicateChoices({});setExpandedCandidates([]);setConfirm(false);}}>
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
        <div><strong>{matchedCount+resolvedExisting}</strong><span>Déjà présentes</span></div>
        <div><strong>{possibleCount}</strong><span>À vérifier</span></div>
        <div><strong>{matched.filter(r=>r.status==="new").length+resolvedNew}</strong><span>À importer</span></div>
      </div>
      <p className="muted">Pour chaque doublon possible, Wimm propose les opérations qui pourraient correspondre. Choisissez celle déjà enregistrée ou indiquez qu’aucune ne correspond. Rien n’est modifié sans votre confirmation. Vérifiez aussi les virements internes, qui ne doivent pas être saisis comme des dépenses.</p>
      <div className="wimm-bank-list">
        {matched.slice(0,visible).map(row=>{
          const decision=duplicateChoices[row.index];
          const candidates=candidatesByRow.get(row.index)||[];
          const allowed=row.status!=="matched"&&row.date>=accountStart&&row.date<=today()&&
            (row.status!=="possible"||decision?.action==="import");
          const checked=selected.includes(row.index);
          const duplicateSummary=row.status==="possible"
            ? !decision?"À rapprocher":decision.action==="skip"?"Déjà dans Wimm · vérifié":"À importer · vérifié"
            :row.status==="matched"?"Déjà dans Wimm":"Nouvelle opération";
          return <div className={"wimm-bank-row "+(row.status==="matched"?"is-matched":"")} key={row.index}>
            <label className="wimm-bank-row-main"><input type="checkbox" disabled={!allowed||busy} checked={checked} onChange={()=>toggle(row.index)}/>
              <span><strong>{row.description}</strong><small>{row.date} · {row.type==="expense"?"Débit":"Crédit"} · {duplicateSummary}{row.date<accountStart?" · Avant solde initial":""}</small></span>
              <strong className={row.type==="income"?"positive":""}>{row.type==="expense"?"−":"+"}{money(row.amount)}</strong></label>
            {row.status==="possible" && <div className="wimm-bank-duplicate-review">
              <div className="wimm-bank-duplicate-heading"><AlertCircle size={16}/>
                <span>{candidates.length===1?"Cette opération Wimm pourrait correspondre :":
                  candidates.length+" opérations Wimm pourraient correspondre :"}</span>
              </div>
              {(expandedCandidates.includes(row.index)?candidates:
                decision?.action==="skip"
                  ? candidates.filter(c=>c.transaction.id===decision.transactionId).slice(0,1)
                  : candidates.slice(0,1)).map(candidate=>{
                const tx=candidate.transaction;
                const categoryName=state.categories.find(c=>c.id===tx.category)?.name;
                const isChosen=decision?.action==="skip"&&decision.transactionId===tx.id;
                const usedElsewhere=Object.entries(duplicateChoices).some(([other,d])=>
                  Number(other)!==row.index&&d.action==="skip"&&d.transactionId===tx.id);
                return <div className={"wimm-bank-duplicate-candidate"+(isChosen?" selected":"")} key={tx.id}>
                  <div className="wimm-bank-duplicate-candidate-details">
                    <strong>{tx.description}</strong>
                    <span>{tx.date} · {tx.type==="expense"?"Dépense":"Revenu"} · {money(tx.amount)}</span>
                    <small>{categoryName || (tx.type==="income"?"Revenu sans catégorie":"Sans catégorie")}
                      {tx.fixed?" · Dépense fixe":""}
                      {candidate.daysApart===0?" · Même jour":candidate.daysApart===1?" · 1 jour d’écart":" · 2 jours d’écart"}
                      {candidate.sameLabel?" · Même libellé":""}</small>
                  </div>
                  <button type="button" className={"wimm-bank-duplicate-choice"+(isChosen?" selected":"")}
                    aria-pressed={isChosen} disabled={busy||usedElsewhere}
                    title={usedElsewhere?"Déjà rapprochée avec une autre ligne du relevé":undefined}
                    onClick={()=>markExisting(row.index,tx.id)}>
                    {isChosen?"✓ C’est cette opération":usedElsewhere?"Déjà rapprochée":"C’est cette opération"}
                  </button>
                </div>;
              })}
              {candidates.length>1 && <button type="button" className="wimm-bank-duplicate-expand" disabled={busy}
                onClick={()=>setExpandedCandidates(old=>old.includes(row.index)?old.filter(i=>i!==row.index):[...old,row.index])}>
                {expandedCandidates.includes(row.index)?"Masquer les autres":"Voir les "+(candidates.length-1)+" autre(s) correspondance(s)"}
              </button>}
              <button type="button" className={"wimm-bank-duplicate-none"+(decision?.action==="import"?" selected":"")}
                aria-pressed={decision?.action==="import"} disabled={busy||row.date<accountStart||row.date>today()}
                onClick={()=>markToImport(row.index)}>
                {decision?.action==="import"?"✓ Aucune ne correspond — à importer":"Aucune ne correspond → importer cette ligne"}
              </button>
              {decision?.action==="skip" && <small className="wimm-bank-duplicate-result">
                Ligne rapprochée : elle ne sera pas importée. L’opération Wimm reste inchangée.
              </small>}
            </div>}
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
