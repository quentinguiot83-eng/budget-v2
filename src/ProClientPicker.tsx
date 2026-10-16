import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import "./pro-client-picker.css";

export type ProClientChoice = {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
};

export type ProClientDraft = {
  name: string;
  clientType: "individual" | "professional";
  companyName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  siret: string;
  vatNumber: string;
  notes: string;
};

type Props = {
  clients: ProClientChoice[];
  value: string;
  onChange: (id: string) => void;
  onCreate: (draft: ProClientDraft) => Promise<ProClientChoice>;
  required?: boolean;
};

const clean = (s: string) => s.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const newDraft = (): ProClientDraft => ({
  name: "", clientType: "individual", companyName: "", email: "", phone: "",
  address: "", postalCode: "", city: "", siret: "", vatNumber: "", notes: "",
});

export default function ProClientPicker({clients, value, onChange, onCreate, required=false}: Props) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<ProClientDraft>(newDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (patch: Partial<ProClientDraft>) => setDraft(d => ({...d, ...patch}));
  const query = clean(search);
  const matching = clients.filter(c => clean(c.name+" "+(c.companyName??"")+" "+(c.email??"")).includes(query));
  // Keep the current selection in the native select even when the user is typing a search.
  const options = value && !matching.some(c=>c.id===value)
    ? [...clients.filter(c=>c.id===value), ...matching] : matching;
  const duplicate = clients.find(c =>
    clean(c.name) === clean(draft.name) && clean(draft.name) !== "" ||
    (draft.email.trim() && clean(c.email??"") === clean(draft.email) && clean(draft.email) !== "")
  );
  const cancel = () => {setCreating(false);setError("");setDraft(newDraft());setExpanded(false);};
  const save = async () => {
    if (!draft.name.trim() || busy) return;
    if (duplicate) {setError("Ce client existe déjà. Sélectionnez sa fiche pour éviter un doublon.");return;}
    setBusy(true);setError("");
    try {
      const created = await onCreate({...draft, name:draft.name.trim(), companyName:draft.companyName.trim()});
      if (!created?.id) throw Error("Impossible de sélectionner le client créé.");
      onChange(created.id);
      setSearch("");
      cancel();
    } catch (e) {setError(e instanceof Error?e.message:"Impossible de créer le client.");}
    finally {setBusy(false);}
  };
  return <div className="pro-client-picker">
    {!creating ? <>
      <div className="pro-client-picker-row">
        <label className="pro-client-search">
          <span>Rechercher un client</span>
          <span className="pro-client-search-control"><Search size={17}/><input type="search" placeholder="Nom, entreprise ou e-mail" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(matching[0])onChange(matching[0].id);}}} autoComplete="off"/></span>
        </label>
        <button type="button" className="pro-client-new" onClick={()=>{setCreating(true);setDraft({...newDraft(),name:search.trim()});setError("");}}><Plus size={17}/> Nouveau</button>
      </div>
      <label className="pro-client-choice"><span>Client</span>
        <select value={value} required={required} onChange={e=>onChange(e.target.value)}>
          <option value="">{query&&!matching.length?"Aucun résultat":"Choisir un client…"}</option>
          {options.map(c=><option key={c.id} value={c.id}>{c.companyName?c.companyName+" — ":""}{c.name}</option>)}
        </select>
      </label>
      {query&&!matching.length&&<small>Aucun client trouvé. Vous pouvez en créer un sans quitter ce formulaire.</small>}
    </>:<div className="pro-client-create" onKeyDown={e=>{if(e.key==="Enter"&&(e.target as HTMLElement).tagName!=="TEXTAREA"){e.preventDefault();void save();}}}>
      <div className="pro-client-create-head"><strong>Nouveau client</strong><button type="button" title="Annuler" aria-label="Revenir au choix du client" onClick={cancel}><X size={18}/></button></div>
      <label>Nom du client<input autoFocus required value={draft.name} onChange={e=>update({name:e.target.value})} placeholder="Nom et prénom"/></label>
      <label>Type<select value={draft.clientType} onChange={e=>update({clientType:e.target.value as ProClientDraft["clientType"]})}><option value="individual">Particulier</option><option value="professional">Professionnel</option></select></label>
      {draft.clientType==="professional"&&<label>Entreprise<input value={draft.companyName} onChange={e=>update({companyName:e.target.value})}/></label>}
      <div className="pro-client-create-grid"><label>E-mail<input type="email" value={draft.email} onChange={e=>update({email:e.target.value})}/></label><label>Téléphone<input type="tel" value={draft.phone} onChange={e=>update({phone:e.target.value})}/></label></div>
      <button type="button" className="pro-client-more" onClick={()=>setExpanded(!expanded)}>{expanded?"Masquer les détails":"Plus de détails (adresse, SIRET…)"}</button>
      {expanded&&<><label>Adresse<input value={draft.address} onChange={e=>update({address:e.target.value})}/></label><div className="pro-client-create-grid"><label>Code postal<input value={draft.postalCode} onChange={e=>update({postalCode:e.target.value})}/></label><label>Ville<input value={draft.city} onChange={e=>update({city:e.target.value})}/></label></div>{draft.clientType==="professional"&&<div className="pro-client-create-grid"><label>SIRET<input value={draft.siret} onChange={e=>update({siret:e.target.value})}/></label><label>N° TVA<input value={draft.vatNumber} onChange={e=>update({vatNumber:e.target.value})}/></label></div>}<label>Notes<textarea rows={2} value={draft.notes} onChange={e=>update({notes:e.target.value})}/></label></>}
      {duplicate&&<div className="pro-client-duplicate">Une fiche correspondante existe déjà : <button type="button" onClick={()=>{onChange(duplicate.id);setSearch("");cancel();}}>{duplicate.companyName||duplicate.name} — utiliser cette fiche</button></div>}
      {error&&<p className="pro-client-error" role="alert">{error}</p>}
      <div className="pro-client-create-actions"><button type="button" onClick={cancel}>Retour</button><button type="button" className="pro-client-create-save" disabled={busy||!draft.name.trim()||!!duplicate} onClick={()=>void save()}>{busy?"Enregistrement…":"Créer et sélectionner"}</button></div>
    </div>}
  </div>;
}
