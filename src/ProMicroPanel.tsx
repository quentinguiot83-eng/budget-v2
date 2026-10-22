import {useEffect, useState} from "react";
import {ArrowRight, CalendarDays, CheckCircle2, CircleHelp, CirclePlus, FilePlus2, Settings2, Wallet} from "lucide-react";
import {microSummary, type MicroFrequency, type MicroSettings, type MicroTaxMode, type MicroLedgerEntry, type MicroProfile} from "./proMicro";
import {proFullEuro} from "./proFinance";
import "./pro-micro.css";

type Props = {
  businessId: string;
  profile: MicroProfile;
  transactions: MicroLedgerEntry[];
  month: string;
  balance: number;
  onActivitySettings: ()=>void;
  onContributionPayment: ()=>void;
  onTaxPayment: ()=>void;
  onIncome: ()=>void;
  onInvoice: ()=>void;
  onTransfer: ()=>void;
};

const defaultSettings: MicroSettings={frequency:"monthly",taxMode:"none"};
function readPreferences(id:string): MicroSettings {
  try{
    if(!id)return defaultSettings;
    const saved=JSON.parse(localStorage.getItem("wimm:pro:micro:"+id)??"null") as Partial<MicroSettings> | null;
    return {
      frequency:saved?.frequency==="quarterly"?"quarterly":"monthly",
      taxMode:saved?.taxMode==="liberatoire"?"liberatoire":saved?.taxMode==="estimate"?"estimate":"none",
    };
  }catch{return defaultSettings;}
}

export default function ProMicroPanel({businessId,profile,transactions,month,balance,onActivitySettings,onContributionPayment,onTaxPayment,onIncome,onInvoice,onTransfer}:Props){
  const [settings,setSettings]=useState<MicroSettings>(()=>readPreferences(businessId));
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{setSettings(readPreferences(businessId));setExpanded(false);},[businessId]);
  const update=(change:Partial<MicroSettings>)=>{
    const next={...settings,...change};
    setSettings(next);
    try{if(businessId)localStorage.setItem("wimm:pro:micro:"+businessId,JSON.stringify(next));}catch{ /* blocked storage: keep in memory */ }
  };
  const s=microSummary(transactions,profile,month,settings);
  const taxEnabled=settings.taxMode!=="none";
  const nearDue=Date.now()>=new Date(s.period.dueDate+"T23:59:59").getTime()-7*86400000;
  return <section className="pro-micro-card" aria-label="Réserves et échéances micro-entreprise">
    <div className="pro-micro-heading">
      <div><small>MON ACTIVITÉ · MICRO-ENTREPRISE</small><h2>Ce que je dois mettre de côté</h2><p>Estimation basée sur les sommes réellement encaissées, hors TVA.</p></div>
      <button className="pro-micro-settings" type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}><Settings2 size={16}/> Réglages</button>
    </div>
    {expanded&&<div className="pro-micro-config">
      <label>Déclarations Urssaf
        <select value={settings.frequency} onChange={e=>update({frequency:e.target.value as MicroFrequency})}>
          <option value="monthly">Chaque mois</option><option value="quarterly">Chaque trimestre</option>
        </select>
      </label>
      <label>Impôt sur le revenu
        <select value={settings.taxMode} onChange={e=>update({taxMode:e.target.value as MicroTaxMode})}>
          <option value="none">Non provisionné ici</option>
          <option value="liberatoire">Versement libératoire (si option validée)</option>
          <option value="estimate">Provision personnalisée</option>
        </select>
      </label>
      <button type="button" onClick={onActivitySettings}>Modifier les taux de mon activité <ArrowRight size={15}/></button>
      <p>Fréquence et option fiscale mémorisées uniquement sur cet appareil dans cette version de test. Les taux de votre entreprise sont enregistrés dans Wimm.</p>
    </div>}
    <div className="pro-micro-period">
      <span><CalendarDays size={17}/> Période {s.period.label}</span>
      <strong>Déclaration estimée : {new Date(s.period.dueDate+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</strong>
    </div>
    <div className="pro-micro-numbers">
      <div><small>CA encaissé hors TVA</small><strong>{proFullEuro(s.turnover)}</strong><span>Factures impayées exclues</span></div>
      <div><small>Cotisations à réserver</small><strong>{proFullEuro(s.dueContribution)}</strong><span>{s.contributionRate.toLocaleString("fr-FR")}% · {proFullEuro(s.paidContribution)} déjà payé</span></div>
      <div><small>{taxEnabled?"Impôt à réserver":"Impôt sur le revenu"}</small><strong>{taxEnabled?proFullEuro(s.dueTax):"À configurer"}</strong><span>{taxEnabled?`${s.taxRate.toLocaleString("fr-FR")}% · ${proFullEuro(s.paidTax)} payé`:"Hors versement libératoire : calcul fiscal distinct"}</span></div>
    </div>
    <div className="pro-micro-available"><Wallet size={19}/><span>Solde Pro après réserves <small>Sur cette période seulement, sans virement automatique</small></span><strong>{proFullEuro(balance-s.dueContribution-s.dueTax-s.vat)}</strong></div>
    {s.vat>0&&<p className="pro-micro-notice">TVA des encaissements : {proFullEuro(s.vat)} à isoler séparément. Les versements de TVA ne sont pas encore suivis ici.</p>}
    {(s.ratesNeedReview||s.taxRateNeedsReview)&&<p className="pro-micro-warning">Activité mixte, ACRE ou taux manquant : vérifiez et adaptez votre taux Urssaf dans les paramètres avant de vous fier à l’estimation.</p>}
    {nearDue&&<p className="pro-micro-notice"><CalendarDays size={15}/> Pensez à vérifier votre échéance réelle dans votre espace Urssaf, y compris les exceptions de calendrier.</p>}
    <div className="pro-micro-actions">
      <button type="button" onClick={onIncome}><CirclePlus size={17}/> Encaisser</button>
      <button type="button" onClick={onInvoice}><FilePlus2 size={17}/> Facturer</button>
      <button type="button" onClick={onTransfer}><ArrowRight size={17}/> Vers le perso</button>
    </div>
    <div className="pro-micro-payments">
      <button type="button" onClick={onContributionPayment}><CheckCircle2 size={16}/> Enregistrer un paiement Urssaf</button>
      {taxEnabled&&<button type="button" onClick={onTaxPayment}><CheckCircle2 size={16}/> Enregistrer un impôt payé</button>}
    </div>
    <p className="pro-micro-legal"><CircleHelp size={14}/> Réserve virtuelle : rien n’est prélevé ni déclaré par Wimm. Dates indicatives (première déclaration et exceptions possibles). Pour une activité mixte, les taux peuvent varier selon la nature des recettes.</p>
  </section>;
}
