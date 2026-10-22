import {useState} from "react";
import {CalendarDays, CheckCircle2, ChevronDown, ChevronUp, CircleHelp, Settings2} from "lucide-react";
import {microSummary, type MicroSettings, type MicroLedgerEntry, type MicroProfile, type MicroFrequency, type MicroTaxMode} from "./proMicro";
import {proFullEuro} from "./proFinance";
import "./pro-micro-v4.css";

type Props={
  profile:MicroProfile;
  transactions:MicroLedgerEntry[];
  month:string;
  settings:MicroSettings;
  onSettingsChange:(next:MicroSettings)=>void;
  onRates:()=>void;
  onContributionPayment:()=>void;
  onTaxPayment:()=>void;
};

export default function ProMicroStatus({
  profile,transactions,month,settings,onSettingsChange,onRates,onContributionPayment,onTaxPayment,
}:Props) {
  const [expanded,setExpanded]=useState(false);
  const s=microSummary(transactions,profile,month,settings);
  const dateLabel=new Date(s.period.dueDate+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
  const update=<K extends keyof MicroSettings>(key:K,value:MicroSettings[K])=>{
    onSettingsChange({...settings,[key]:value});
  };
  return <section className="pro-v4-micro" aria-label="Déclaration et réserves micro-entreprise">
    <div className="pro-v4-micro-head">
      <div><small>MICRO-ENTREPRISE · URSSAF</small><h2>Ma prochaine déclaration</h2>
        <p>{s.period.label} · Échéance indicative : <strong>{dateLabel}</strong></p></div>
      <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
        <Settings2 size={15}/> Réglages {expanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
      </button>
    </div>
    {expanded&&<div className="pro-v4-micro-settings">
      <label>Périodicité Urssaf
        <select value={settings.frequency} onChange={event=>update("frequency",event.target.value as MicroFrequency)}>
          <option value="monthly">Mensuelle</option><option value="quarterly">Trimestrielle</option>
        </select>
      </label>
      <label>Impôt sur le revenu
        <select value={settings.taxMode} onChange={event=>update("taxMode",event.target.value as MicroTaxMode)}>
          <option value="none">Non provisionné ici</option>
          <option value="liberatoire">Versement libératoire (si éligible et choisi)</option>
          <option value="estimate">Provision personnalisée</option>
        </select>
      </label>
      <button type="button" className="pro-v4-micro-edit" onClick={onRates}>Modifier mes taux d’activité</button>
      <p>Ces deux préférences sont enregistrées sur cet appareil pour l’entreprise sélectionnée. Aucun changement de régime fiscal n’est effectué auprès de l’administration.</p>
    </div>}
    <div className="pro-v4-micro-columns">
      <div><span>CA réellement encaissé HT</span><strong>{proFullEuro(s.turnover)}</strong><small>Factures non réglées exclues</small></div>
      <div><span>Cotisations encore à réserver</span><strong>{proFullEuro(s.dueContribution)}</strong>
        <small>{s.contributionRate.toLocaleString("fr-FR")}% · {proFullEuro(s.paidContribution)} enregistré payé</small></div>
      <div><span>Impôt sur le revenu</span><strong>{settings.taxMode==="none"?"Non provisionné":proFullEuro(s.dueTax)}</strong>
        <small>{settings.taxMode==="none"?"Hors versement libératoire : à estimer séparément":s.taxRate.toLocaleString("fr-FR")+"% · "+proFullEuro(s.paidTax)+" payé"}</small></div>
    </div>
    <div className="pro-v4-micro-actions">
      {s.contributionSettled
        ?<span className="pro-v4-micro-settled"><CheckCircle2 size={16}/> Cotisations réglées — réserve à 0 €. Pour corriger le montant payé, utilise « Modifier » dans les paiements enregistrés ci-dessous.</span>
        :<button type="button" onClick={onContributionPayment}><CheckCircle2 size={16}/> Paiement Urssaf effectué</button>}
      {settings.taxMode!=="none"&&<button type="button" onClick={onTaxPayment}><CheckCircle2 size={16}/> Impôt payé</button>}
    </div>
    {(s.ratesNeedReview||s.taxRateNeedsReview)&&
      <p className="pro-v4-micro-warning"><CircleHelp size={15}/> Vérifie les taux de ton activité, notamment en cas d’ACRE, de profession Cipav ou d’activités mixtes. Les taux suggérés ne valent pas déclaration.</p>}
    <p className="pro-v4-micro-note"><CalendarDays size={14}/> Ce calendrier est indicatif (première déclaration ou exceptions possibles). La réserve est virtuelle, sans prélèvement automatique et sans transmission à l’Urssaf.</p>
  </section>;
}
