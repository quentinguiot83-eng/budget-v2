import {useState} from "react";
import {Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, CircleHelp, Wallet} from "lucide-react";
import {currentProMonth, formatProMonth, moveProMonth, monthRangeProSeries, proEuro, type ProCashEntry, type ProInvoiceSummary} from "./proFinance";
import "./pro-analysis.css";

type Period="3"|"6"|"12"|"year"|"custom";
type ClientName={id:string;name:string;companyName?:string};
type Props={month:string;transactions:ProCashEntry[];invoices:ProInvoiceSummary[];clients:ClientName[];openingBalance:number};
export default function ProAnalysis({month,transactions,invoices,clients,openingBalance}:Props){
  const [period,setPeriod]=useState<Period>("6");
  const [startCustom,setStartCustom]=useState(moveProMonth(currentProMonth(),-5));
  const [endCustom,setEndCustom]=useState(currentProMonth());
  const start=period==="year"?month.slice(0,4)+"-01":period==="custom"?startCustom:moveProMonth(month,1-Number(period));
  const end=period==="custom"?endCustom:month;
  const valid=start<=end;
  const series=valid?monthRangeProSeries(transactions,invoices,start,end,openingBalance):[];
  const plots=series.map(x=>({...x,label:new Date(x.month+"-15T12:00:00").toLocaleDateString("fr-FR",{month:"short",year:series.length>12?"2-digit":undefined}),income:x.income/100,expenses:x.expenses/100,billed:x.billed/100,treasury:x.treasury===null?null:x.treasury/100}));
  const totals=series.reduce((acc,p)=>({
    income:acc.income+p.income,expenses:acc.expenses+p.expenses,
    billed:acc.billed+p.billed,salary:acc.salary+p.salary,
    tax:acc.tax+p.tax,contributions:acc.contributions+p.contributions,
  }),{income:0,expenses:0,billed:0,salary:0,tax:0,contributions:0});
  const currentRange=transactions.filter(t=>t.paid&&t.kind==="expense"&&t.date.slice(0,7)>=start&&t.date.slice(0,7)<=end);
  const expenseCategories=Array.from(currentRange.reduce((map,t)=>{const k=t.category?.trim()||"Non classée";map.set(k,(map.get(k)||0)+t.amount);return map;},new Map<string,number>()))
    .sort((a,b)=>b[1]-a[1]).slice(0,8);
  const customerInvoices=invoices.filter(i=>i.status!=="draft"&&i.status!=="cancelled"&&i.issueDate.slice(0,7)>=start&&i.issueDate.slice(0,7)<=end);
  const customerTotals=Array.from(customerInvoices.reduce((map,i)=>{const key=i.clientId||"unknown";map.set(key,(map.get(key)||0)+i.totalTtc);return map;},new Map<string,number>()))
    .sort((a,b)=>b[1]-a[1]).slice(0,8);
  const moneyFormat=(v:unknown)=>proEuro(Math.round(Number(v||0)*100));
  return <div className="pro-an">
    <div className="pro-an-heading"><span>ANALYSE</span><h1>Analyse mon entreprise</h1><p>Évolution réelle des encaissements, dépenses et facturations</p></div>
    <div className="pro-an-period">
      <div className="pro-an-period-pills">{([["3","3 mois"],["6","6 mois"],["12","12 mois"],["year","Année"],["custom","Personnalisé"]] as const).map(([v,label])=>
        <button type="button" key={v} className={period===v?"active":""} aria-pressed={period===v} onClick={()=>setPeriod(v)}>{label}</button>)}</div>
      {period==="custom"&&<div className="pro-an-custom"><label>Du <input type="month" value={startCustom} onChange={e=>setStartCustom(e.target.value)}/></label><label>Au <input type="month" value={endCustom} onChange={e=>setEndCustom(e.target.value)}/></label></div>}
      <small>{valid?formatProMonth(start)+(start!==end?" → "+formatProMonth(end):""):"La date de fin doit être postérieure au début."}</small>
    </div>
    <div className="pro-an-kpis">
      <div><span><ArrowDownLeft size={16}/> CA encaissé TTC</span><strong>{proEuro(totals.income)}</strong></div>
      <div><span><ArrowUpRight size={16}/> Dépenses TTC</span><strong>{proEuro(totals.expenses)}</strong></div>
      <div><span><ChartNoAxesCombined size={16}/> Flux d'activité</span><strong>{proEuro(totals.income-totals.expenses)}</strong></div>
      <div><span><Wallet size={16}/> CA facturé TTC</span><strong>{proEuro(totals.billed)}</strong></div>
    </div>
    <section className="pro-an-card">
      <h2>Évolution de l'activité</h2><p>CA réellement encaissé et dépenses réglées, par mois</p>
      {series.length?<div className="pro-an-chart" role="img" aria-label="Histogramme des encaissements et des dépenses par mois">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={plots} margin={{top:10,right:8,left:-18,bottom:4}}>
            <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#aeb0bc" strokeOpacity={.28}/>
            <XAxis dataKey="label" tick={{fontSize:10}} interval="preserveStartEnd"/>
            <YAxis tick={{fontSize:10}} tickFormatter={n=>String(Math.round(n))+" €"}/>
            <Tooltip formatter={moneyFormat}/>
            <Legend iconType="circle" wrapperStyle={{fontSize:11}}/>
            <Bar name="CA encaissé" dataKey="income" fill="#8054cb" radius={[5,5,0,0]}/>
            <Bar name="Dépenses" dataKey="expenses" fill="#d4838d" radius={[5,5,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>:<p>Aucune période à afficher.</p>}
    </section>
    <section className="pro-an-card">
      <h2>Évolution de la trésorerie</h2><p>Solde après les opérations enregistrées, y compris virements personnels et charges payées</p>
      <div className="pro-an-chart" role="img" aria-label="Courbe de la trésorerie en fin de mois">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={plots} margin={{top:10,right:8,left:-18,bottom:4}}>
            <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#aeb0bc" strokeOpacity={.28}/>
            <XAxis dataKey="label" tick={{fontSize:10}} interval="preserveStartEnd"/>
            <YAxis tick={{fontSize:10}} tickFormatter={n=>String(Math.round(n))+" €"}/>
            <Tooltip formatter={moneyFormat}/>
            <Line name="Trésorerie" type="monotone" dataKey="treasury" stroke="#8054cb" strokeWidth={2.5} dot={{r:3}} connectNulls={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
    <section className="pro-an-card">
      <h2>Répartition des dépenses</h2><p>Catégories des dépenses réglées sur la période</p>
      {expenseCategories.length?expenseCategories.map(([name,value])=><div className="pro-an-breakdown" key={name}>
        <div><strong>{name}</strong><span>{proEuro(value)}</span></div>
        <div className="pro-an-progress"><span style={{width:String(Math.min(100,100*value/Math.max(1,totals.expenses)))+"%"}}/></div>
      </div>):<p className="pro-an-empty">Aucune dépense sur la période.</p>}
    </section>
    <section className="pro-an-card">
      <h2>Chiffre d'affaires facturé par client</h2><p>Factures émises TTC, distinctes des encaissements reçus</p>
      {customerTotals.length?customerTotals.map(([id,value])=><div className="pro-an-client" key={id}>
        <strong>{clients.find(c=>c.id===id)?.companyName||clients.find(c=>c.id===id)?.name||"Client non renseigné"}</strong><span>{proEuro(value)}</span>
      </div>):<p className="pro-an-empty">Aucune facture émise sur la période.</p>}
    </section>
    <section className="pro-an-card">
      <h2>Prélèvements & charges</h2>
      <div className="pro-an-client"><span>Virements Pro → perso</span><strong>{proEuro(totals.salary)}</strong></div>
      <div className="pro-an-client"><span>Cotisations payées</span><strong>{proEuro(totals.contributions)}</strong></div>
      <div className="pro-an-client"><span>Impôts payés</span><strong>{proEuro(totals.tax)}</strong></div>
      <div className="pro-an-client"><span>Flux net de trésorerie de la période</span><strong>{proEuro(totals.income-totals.expenses-totals.salary-totals.contributions-totals.tax)}</strong></div>
    </section>
    <p className="pro-an-note"><CircleHelp size={15}/> Les chiffres reposent sur les écritures enregistrées dans Wimm, et non sur un rapprochement bancaire. Les montants TTC ne correspondent pas à un bénéfice comptable ou fiscal.</p>
  </div>;
}
