import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { rpc } from "./api";
import "./pro-business.css";

type BusinessSummary = { id:string; name:string };
type Business = {
  id:string;
  name:string;
  legalStatus:string;
  activityType:string;
  siret:string;
  contributionRate:number;
  taxRate:number;
  vatEnabled:boolean;
  vatRate:number;
  address:string;
  postalCode:string;
  city:string;
  email:string;
  phone:string;
  iban:string;
  invoicePrefix:string;
  footerNote:string;
  accountName:string;
  openingBalance:number;
};
type BusinessState={activeBusinessId:string|null;businesses:Business[]};

type Props={
  activeBusinessId?:string|null;
  businesses:BusinessSummary[];
  onChanged:()=>Promise<void>;
};

const emptyBusiness:Omit<Business,"id">={
  name:"",
  legalStatus:"micro",
  activityType:"service",
  siret:"",
  contributionRate:0,
  taxRate:0,
  vatEnabled:false,
  vatRate:20,
  address:"",
  postalCode:"",
  city:"",
  email:"",
  phone:"",
  iban:"",
  invoicePrefix:"FAC",
  footerNote:"",
  accountName:"Compte professionnel",
  openingBalance:0,
};

export default function ProBusinessMenu({activeBusinessId,businesses,onChanged}:Props){
  const [open,setOpen]=useState(false);
  const [manage,setManage]=useState(false);
  const [editing,setEditing]=useState<Business|null|"new">(null);
  const [state,setState]=useState<BusinessState>({activeBusinessId:activeBusinessId??null,businesses:[]});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const active=useMemo(()=>businesses.find(b=>b.id===activeBusinessId)??businesses[0],[businesses,activeBusinessId]);

  async function refreshBusinesses(){
    const data=await rpc("budget_pro_businesses_list") as BusinessState;
    setState(data);
    return data;
  }

  async function switchBusiness(id:string){
    if(!id||id===activeBusinessId){setOpen(false);return;}
    setBusy(true);setError("");
    try{
      await rpc("budget_pro_business_select",{p_id:id});
      setOpen(false);
      await onChanged();
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  async function openManager(editCurrent=false){
    setBusy(true);setError("");
    try{
      const data=await refreshBusinesses();
      setManage(true);setOpen(false);
      if(editCurrent){
        setEditing(data.businesses.find(b=>b.id===data.activeBusinessId)??data.businesses[0]??null);
      }
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  async function saveBusiness(value:Business|Omit<Business,"id">){
    setBusy(true);setError("");
    try{
      await rpc("budget_pro_business_save",{p_business:value});
      await refreshBusinesses();
      await onChanged();
      setEditing(null);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  async function removeBusiness(b:Business){
    if(!confirm(`Supprimer l’entreprise « ${b.name} » ?`))return;
    setBusy(true);setError("");
    try{
      const data=await rpc("budget_pro_business_delete",{p_id:b.id}) as BusinessState;
      setState(data);setEditing(null);
      await onChanged();
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  return <div className="pro-business-menu">
    <button type="button" className="pro-business-menu-trigger" aria-label="Changer ou modifier l’entreprise" aria-expanded={open} onClick={()=>setOpen(v=>!v)} disabled={busy}>
      <ChevronDown size={17}/>
    </button>
    {open&&<>
      <button type="button" className="pro-business-menu-backdrop" aria-label="Fermer" onClick={()=>setOpen(false)}/>
      <div className="pro-business-dropdown">
        <small>ENTREPRISE</small>
        {businesses.map(b=><button type="button" key={b.id} className={b.id===activeBusinessId?"active":""} onClick={()=>void switchBusiness(b.id)}>
          <span>{b.name}</span>{b.id===activeBusinessId&&<Check size={15}/>} 
        </button>)}
        <div className="pro-business-dropdown-separator"/>
        <button type="button" onClick={()=>void openManager(true)}><Pencil size={15}/><span>Modifier l’entreprise</span></button>
        <button type="button" onClick={()=>{setEditing("new");void openManager(false)}}><Plus size={15}/><span>Ajouter une entreprise</span></button>
      </div>
    </>}

    {manage&&createPortal(<div className="pro-business-modal-layer">
      <button className="pro-business-backdrop" onClick={()=>{setManage(false);setEditing(null)}}/>
      <section className="pro-business-modal">
        <button className="pro-business-close" onClick={()=>{setManage(false);setEditing(null)}}><X size={18}/></button>
        <div className="pro-business-head"><div><small>PROFESSIONNEL</small><h2>Mes entreprises</h2><p>Chaque entreprise possède ses propres clients, factures, catalogue, agenda et trésorerie.</p></div><button className="pro-business-primary" onClick={()=>setEditing("new")}><Plus size={16}/> Ajouter</button></div>
        {error&&<div className="pro-business-error">{error}</div>}
        {!editing&&<div className="pro-business-list">
          {state.businesses.map(b=><article key={b.id} className={b.id===state.activeBusinessId?"active":""}>
            <div><strong>{b.name}</strong><small>{b.siret?`SIRET ${b.siret}`:"SIRET non renseigné"}{b.city?` · ${b.city}`:""}</small></div>
            {b.id===state.activeBusinessId&&<span>Active</span>}
            <button onClick={()=>setEditing(b)}>Modifier</button>
            {state.businesses.length>1&&<button className="danger" title="Supprimer" onClick={()=>void removeBusiness(b)}><Trash2 size={15}/></button>}
          </article>)}
        </div>}
        {editing&&<BusinessForm value={editing==="new"?emptyBusiness:editing} busy={busy} cancel={()=>setEditing(null)} submit={saveBusiness}/>} 
      </section>
    </div>,document.body)}
  </div>;
}

function BusinessForm({value,busy,cancel,submit}:{value:Business|Omit<Business,"id">;busy:boolean;cancel:()=>void;submit:(v:Business|Omit<Business,"id">)=>Promise<void>}){
  const [v,setV]=useState(value);
  const update=<K extends keyof typeof v>(key:K,value:(typeof v)[K])=>setV({...v,[key]:value});
  const cents=(n:string)=>Math.round((Number(n.replace(",","."))||0)*100);
  const euros=(n:number)=>(n/100).toFixed(2);
  const [opening,setOpening]=useState(euros(v.openingBalance));
  return <form className="pro-business-form" onSubmit={e=>{e.preventDefault();void submit({...v,openingBalance:cents(opening)})}}>
    <div className="pro-business-formgrid">
      <label className="wide">Nom de l’entreprise<input required value={v.name} onChange={e=>update("name",e.target.value)}/></label>
      <label>Statut<select value={v.legalStatus} onChange={e=>update("legalStatus",e.target.value)}><option value="micro">Micro-entreprise</option><option value="ei">EI</option><option value="eurl">EURL</option><option value="sasu">SASU</option><option value="sarl">SARL</option><option value="sas">SAS</option><option value="other">Autre</option></select></label>
      <label>Activité<select value={v.activityType} onChange={e=>update("activityType",e.target.value)}><option value="service">Services</option><option value="commerce">Commerce</option><option value="mixed">Mixte</option><option value="liberal">Libérale</option><option value="other">Autre</option></select></label>
      <label className="wide">SIRET<input inputMode="numeric" value={v.siret} onChange={e=>update("siret",e.target.value)}/></label>
      <label className="wide">Adresse<input value={v.address} onChange={e=>update("address",e.target.value)}/></label>
      <label>Code postal<input value={v.postalCode} onChange={e=>update("postalCode",e.target.value)}/></label>
      <label>Ville<input value={v.city} onChange={e=>update("city",e.target.value)}/></label>
      <label>E-mail<input type="email" value={v.email} onChange={e=>update("email",e.target.value)}/></label>
      <label>Téléphone<input value={v.phone} onChange={e=>update("phone",e.target.value)}/></label>
      <label className="wide">IBAN<input value={v.iban} onChange={e=>update("iban",e.target.value)}/></label>
      <label>Préfixe factures<input value={v.invoicePrefix} onChange={e=>update("invoicePrefix",e.target.value.toUpperCase())}/></label>
      <label>Nom du compte Pro<input value={v.accountName} onChange={e=>update("accountName",e.target.value)}/></label>
      <label>Solde de départ (€)<input type="number" step="0.01" value={opening} onChange={e=>setOpening(e.target.value)}/></label>
      <label>Cotisations estimées (%)<input type="number" step="0.01" min="0" max="100" value={v.contributionRate} onChange={e=>update("contributionRate",Number(e.target.value))}/></label>
      <label>Impôt estimé (%)<input type="number" step="0.01" min="0" max="100" value={v.taxRate} onChange={e=>update("taxRate",Number(e.target.value))}/></label>
      <label className="pro-business-check"><input type="checkbox" checked={v.vatEnabled} onChange={e=>update("vatEnabled",e.target.checked)}/> TVA activée</label>
      {v.vatEnabled&&<label>Taux de TVA (%)<input type="number" step="0.01" min="0" max="100" value={v.vatRate} onChange={e=>update("vatRate",Number(e.target.value))}/></label>}
      <label className="wide">Pied de facture<textarea rows={3} value={v.footerNote} onChange={e=>update("footerNote",e.target.value)}/></label>
    </div>
    <div className="pro-business-formactions"><button type="button" onClick={cancel}>Annuler</button><button className="primary" disabled={busy}>{busy?"Enregistrement…":"Enregistrer l’entreprise"}</button></div>
  </form>;
}
