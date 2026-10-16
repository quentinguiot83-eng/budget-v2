import {useState} from "react";
import {Area, Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {ChevronDown, CircleHelp} from "lucide-react";
import {currentProMonth,formatProMonth,moveProMonth,monthRangeProSeries,proEuro,type ProCashEntry,type ProInvoiceSummary} from "./proFinance";
import "./pro-analysis.css";

type Period="3"|"6"|"12"|"year"|"custom";
type ClientName={id:string;name:string;companyName?:string};
type Props={month:string;transactions:ProCashEntry[];invoices:ProInvoiceSummary[];clients:ClientName[];openingBalance:number};
const indicators=[
  {key:"income",label:"CA encaissé",color:"#2a9a72"},
  {key:"billed",label:"CA facturé",color:"#8358c9"},
  {key:"expenses",label:"Dépenses",color:"#d77d85"},
  {key:"treasury",label:"Trésorerie",color:"#7074ad"},
  {key:"salary",label:"Virements perso",color:"#bb81c6"},
  {key:"contributions",label:"Cotisations",color:"#be8b4d"},
  {key:"tax",label:"Impôts",color:"#9a6771"},
] as const;
type Key=typeof indicators[number]["key"];
export default function ProAnalysis({month,transactions,invoices,clients,openingBalance}:Props){
  const [period,setPeriod]=useState<Period>("6");
  const [startCustom,setStartCustom]=useState(moveProMonth(currentProMonth(),-5));
  const [endCustom,setEndCustom]=useState(currentProMonth());
  const [selected,setSelected]=useState<Key[]>(["income","expenses"]);
  const [details,setDetails]=useState<""|"expenses"|"clients"|"charges">("");
  const start=period==="year"?month.slice(0,4)+"-01":period==="custom"?startCustom:moveProMonth(month,1-Number(period));
  const end=period==="custom"?endCustom:month;
  const valid=start<=end;
  const series=valid?monthRangeProSeries(transactions,invoices,start,end,openingBalance):[];
  const data=series.map(x=>({...x,label:new Date(x.month+"-15T12:00:00").toLocaleDateString("fr-FR",{month:"short",year:series.length>12?"2-digit":undefined}),income:x.income/100,billed:x.billed/100,expenses:x.expenses/100,treasury:x.treasury===null?null:x.treasury/100,salary:x.salary/100,contributions:x.contributions/100,tax:x.tax/100}));
  const selection=indicators.filter(x=>selected.includes(x.key));
  const total=(key:Key)=>key==="treasury"?series[series.length-1]?.treasury??0:series.reduce((n,x)=>n+x[key],0);
  const expenseCategories=Array.from(transactions.filter(t=>t.paid&&t.kind==="expense"&&t.date.slice(0,7)>=start&&t.date.slice(0,7)<=end).reduce((map,t)=>{const k=t.category?.trim()||"Non classée";map.set(k,(map.get(k)||0)+t.amount);return map;},new Map<string,number>())).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const customers=Array.from(invoices.filter(i=>i.status!=="draft"&&i.status!=="cancelled"&&i.issueDate.slice(0,7)>=start&&i.issueDate.slice(0,7)<=end).reduce((map,i)=>{const key=i.clientId||"unknown";map.set(key,(map.get(key)||0)+i.totalTtc);return map;},new Map<string,number>())).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const toggle=(key:Key)=>setSelected(s=>s.includes(key)?s.length===1?s:s.filter(x=>x!==key):[...s,key]);
  const formatMoney=(v:unknown)=>proEuro(Math.round(Number(v||0)*100));
  return <div className="pro-an pro-v3-analysis">
    <div className="pro-an-heading"><span>ANALYSE</span><h1>Analyse mon entreprise</h1><p>Choisissez les données à comparer.</p></div>
    <section className="pro-an-period">
      <div className="pro-an-period-pills">{([["3","3 mois"],["6","6 mois"],["12","12 mois"],["year","Année"],["custom","Personnalisé"]] as const).map(([k,label])=><button type="button" key={k} className={period===k?"active":""} aria-pressed={period===k} onClick={()=>setPeriod(k)}>{label}</button>)}</div>
      {period==="custom"&&<div className="pro-an-custom"><label>Du<input type="month" value={startCustom} onChange={e=>setStartCustom(e.target.value)}/></label><label>Au<input type="month" value={endCustom} onChange={e=>setEndCustom(e.target.value)}/></label></div>}
      <small>{valid?formatProMonth(start)+(start!==end?" → "+formatProMonth(end):""):"Dates incohérentes"}</small>
    </section>
    <section className="pro-an-card">
      <h2>Évolution de l'activité</h2>
      <p>Un seul graphique. Touchez les indicateurs à afficher ou masquer.</p>
      <div className="pro-v3-series">{indicators.map(i=><button type="button" key={i.key} onClick={()=>toggle(i.key)} aria-pressed={selected.includes(i.key)} className={selected.includes(i.key)?"selected":""} style={{"--indicator":i.color} as React.CSSProperties}><span/>{i.label}</button>)}</div>
      {valid&&data.length?<div className="pro-an-chart pro-v3-chart" role="img" aria-label="Graphique interactif des indicateurs financiers sélectionnés">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{top:12,right:8,left:-22,bottom:4}}>
            <CartesianGrid strokeDasharray="3 5" stroke="#adb0bb" strokeOpacity={.25} vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:10}} interval="preserveStartEnd"/>
            <YAxis tick={{fontSize:10}} tickFormatter={v=>String(Math.round(v))+" €"}/>
            <Tooltip formatter={formatMoney}/>
            <Legend iconType="circle" wrapperStyle={{fontSize:11}}/>
            {selection.map(item=>item.key==="expenses"?<Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color} barSize={14} radius={[4,4,0,0]}/>:<Area key={item.key} dataKey={item.key} name={item.label} type="monotone" stroke={item.color} fill={item.color} fillOpacity={.06} strokeWidth={2} connectNulls={false}/>)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>:<p className="pro-an-empty">Choisissez une période valide.</p>}
    </section>
    <div className="pro-an-kpis pro-v3-kpis">{selection.map(i=><div key={i.key}><span>{i.label}</span><strong>{i.key==="treasury"&&series.at(-1)?.treasury===null?"—":proEuro(total(i.key))}</strong><small>{i.key==="treasury"?"Solde en fin de période":"Total sur la période"}</small></div>)}</div>
    <section className="pro-an-card pro-v3-details">
      <h2>Détails</h2>
      {([{id:"expenses",label:"Répartition des dépenses"},{id:"clients",label:"CA facturé par client"},{id:"charges",label:"Prélèvements & fiscalité"}] as const).map(item=><div className="pro-v3-detail" key={item.id}>
        <button type="button" aria-expanded={details===item.id} onClick={()=>setDetails(details===item.id?"":item.id)}>{item.label}<ChevronDown size={17}/></button>
        {details===item.id&&<div className="pro-v3-detail-body">
          {item.id==="expenses"&&(expenseCategories.length?expenseCategories.map(([name,value])=><div className="pro-an-client" key={name}><span>{name}</span><strong>{proEuro(value)}</strong></div>):<p>Aucune dépense sur la période.</p>)}
          {item.id==="clients"&&(customers.length?customers.map(([id,value])=><div className="pro-an-client" key={id}><span>{clients.find(c=>c.id===id)?.companyName||clients.find(c=>c.id===id)?.name||"Client non renseigné"}</span><strong>{proEuro(value)}</strong></div>):<p>Aucune facture émise sur la période.</p>)}
          {item.id==="charges"&&<><div className="pro-an-client"><span>Virements Pro → perso</span><strong>{proEuro(total("salary"))}</strong></div><div className="pro-an-client"><span>Cotisations payées</span><strong>{proEuro(total("contributions"))}</strong></div><div className="pro-an-client"><span>Impôts payés</span><strong>{proEuro(total("tax"))}</strong></div></>}
        </div>}
      </div>)}
    </section>
    <p className="pro-an-note"><CircleHelp size={15}/> Indicateurs issus des écritures Wimm. Le CA encaissé, le CA facturé, le résultat d'activité et la trésorerie ne sont pas interchangeables.</p>
  </div>;
}
