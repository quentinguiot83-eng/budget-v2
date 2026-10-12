import { useMemo, useState, type FormEvent } from "react";
import { Bookmark, Check, Sparkles, X } from "lucide-react";
import { euro, money, today, type State, type Tx } from "./engine";
import { checkFavorite, quickSuggestions, type QuickFavorite } from "./quickEntry";
import "./quickEntry.css";

export type QuickDraft = Pick<Tx,"type"|"date"|"description"|"account"|"amount"|"category"|"incomeType">;
type Props = {
  state: State;
  save: (draft: QuickDraft) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
};
export default function QuickEntry({state,save,removeFavorite}:Props){
  const accounts=state.accounts.filter(a=>a.group==="current"&&!a.archived);
  const categories=state.categories.filter(c=>!c.archived);
  const [type,setType]=useState<"expense"|"income">("expense");
  const [description,setDescription]=useState("");
  const [amount,setAmount]=useState("");
  const [date,setDate]=useState(today());
  const [account,setAccount]=useState(accounts[0]?.id||"");
  const [category,setCategory]=useState(categories[0]?.id||"");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const suggestions=useMemo(()=>quickSuggestions(state,type,description,4),[state,type,description]);
  const favorites=(state.quickFavorites||[]).filter(f=>f.type===type&&accounts.some(a=>a.id===f.account));
  function usePreset(p:{description:string;account:string;category?:string;amount:number}){
    setDescription(p.description);setAccount(p.account);
    setCategory(p.category&&categories.some(c=>c.id===p.category)?p.category:categories[0]?.id||"");
    // Suggestions do not prefill prices; explicit favorites do.
    if("id" in p)setAmount((p.amount/100).toFixed(2));
    setError("");setMessage("");
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      const amountCents=euro(amount);
      if(!Number.isSafeInteger(amountCents)||amountCents<=0)throw Error("Saisissez un montant positif.");
      if(!description.trim())throw Error("Le libellé est obligatoire.");
      if(description.length>180)throw Error("Le libellé est trop long.");
      if(date>today())throw Error("La date ne peut pas être future.");
      if(!accounts.some(a=>a.id===account&&date>=a.date))throw Error("Compte indisponible à cette date.");
      if(type==="expense"&&!categories.some(c=>c.id===category))throw Error("Choisissez une catégorie valide.");
      const draft:QuickDraft={type,date,description:description.trim(),account,amount:amountCents,
        category:type==="expense"?category:undefined,incomeType:type==="income"?"Autre":undefined};
      await save(draft);
      setAmount("");setDescription("");setDate(today());
      setMessage("Opération enregistrée.");
    }catch(e){setError(e instanceof Error?e.message:"Impossible d’enregistrer.");}
    finally{setBusy(false);}
  }
  if(!accounts.length)return <section className="card"><h3>Saisie rapide</h3><p className="muted">Créez d’abord un compte courant.</p></section>;
  return <section className="card wimm-quick-entry" aria-label="Saisie rapide">
    <div className="section-head"><div className="block-title"><h2><Sparkles size={18}/> Saisie rapide</h2></div></div>
    <p className="muted">Une opération ponctuelle en quelques secondes. Les montants restent à vérifier avant validation.</p>
    <div className="wimm-quick-type" role="group" aria-label="Type d’opération">
      <button type="button" className={type==="expense"?"active":""} aria-pressed={type==="expense"} onClick={()=>{setType("expense");setDescription("");setAmount("");}}>Dépense</button>
      <button type="button" className={type==="income"?"active":""} aria-pressed={type==="income"} onClick={()=>{setType("income");setDescription("");setAmount("");}}>Revenu</button>
    </div>
    {favorites.length>0&&<div className="wimm-quick-favorites">
      <strong><Bookmark size={15}/> Favoris</strong>
      <div className="wimm-quick-pills">{favorites.map(f=>{
        let invalid=false;try{checkFavorite(f,state.accounts,state.categories);}catch{invalid=true;}
        return <span className="wimm-quick-favorite" key={f.id}>
          <button type="button" disabled={busy||invalid} onClick={()=>usePreset(f)} title={invalid?"Catégorie ou compte archivé":money(f.amount)}>{f.description}</button>
          <button type="button" disabled={busy} title="Retirer des favoris" aria-label={"Retirer "+f.description+" des favoris"}
            onClick={()=>{void removeFavorite(f.id).catch(e=>setError(e instanceof Error?e.message:"Suppression impossible."));}}><X size={13}/></button>
        </span>;
      })}</div>
    </div>}
    <form className="wimm-quick-form" onSubmit={e=>void submit(e)}>
      <label>Montant (€)<input type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0,00"/></label>
      <label>Libellé<input type="text" autoComplete="off" maxLength={180} required value={description} onChange={e=>{
        const next=e.target.value;setDescription(next);
        const hit=quickSuggestions(state,type,next,1)[0];
        if(next.trim().length>=3&&hit&&hit.description.toLowerCase()===next.toLowerCase()){
          setAccount(hit.account);if(hit.category)setCategory(hit.category);
        }
      }} placeholder="Carrefour, pharmacie…"/></label>
      {description.trim().length>=2&&suggestions.length>0&&
        <div className="wimm-quick-suggestions"><small>Suggestions d’après votre historique</small>
          <div className="wimm-quick-pills">{suggestions.map(s=>
            <button key={s.account+":"+s.description} type="button" onClick={()=>usePreset(s)}>
              {s.description} {s.count>1&&<small>×{s.count}</small>}
            </button>)}</div>
        </div>}
      <div className="wimm-quick-form-grid">
        <label>Compte<select value={account} onChange={e=>setAccount(e.target.value)} required>
          {accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}
        </select></label>
        {type==="expense"&&<label>Catégorie<select value={category} onChange={e=>setCategory(e.target.value)} required>
          {categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
        </select></label>}
        <label>Date<input type="date" required max={today()} value={date} onChange={e=>setDate(e.target.value)}/></label>
      </div>
      {error&&<p role="alert" className="error">{error}</p>}
      {message&&<p role="status" className="wimm-quick-success"><Check size={14}/> {message}</p>}
      <button className="primary" type="submit" disabled={busy||!accounts.length||(type==="expense"&&!categories.length)}>{busy?"Enregistrement…":"Enregistrer"}</button>
    </form>
    <small className="muted">Pour un salaire, une charge fixe, un virement ou une dépense de voyage, utilisez les options habituelles ci-dessous.</small>
  </section>;
}
