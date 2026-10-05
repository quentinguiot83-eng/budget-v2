import fs from "node:fs";

{
  const path = "src/ProWorkspace.tsx";
  let s = fs.readFileSync(path, "utf8");
  const start = s.indexOf("function AgendaPage(");
  const end = s.indexOf("\n\nfunction TreasuryPage", start);
  if (start < 0 || end < 0) throw new Error("AgendaPage introuvable");

  const agenda = `function AgendaPage({events,clients,add,edit,remove}:{events:EventItem[];clients:Client[];add:()=>void;edit:(e:EventItem)=>void;remove:(e:EventItem)=>void}){
  const [cursor,setCursor]=useState(()=>new Date());
  const [selectedDay,setSelectedDay]=useState<number|null>(null);
  const y=cursor.getFullYear(),m=cursor.getMonth();
  const first=new Date(y,m,1);
  const offset=(first.getDay()+6)%7;
  const count=new Date(y,m+1,0).getDate();
  const key=(d:number)=>String(y)+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  const monthEvents=events.filter(e=>{const d=new Date(e.startsAt);return d.getFullYear()===y&&d.getMonth()===m});
  const clientName=(id:string|null)=>clients.find(c=>c.id===id)?.name;
  const shownEvents=selectedDay?monthEvents.filter(e=>e.startsAt.slice(0,10)===key(selectedDay)):monthEvents;
  const changeMonth=(delta:number)=>{setCursor(new Date(y,m+delta,1));setSelectedDay(null)};
  return <>
    <PageHead eyebrow="AGENDA" title={cursor.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})} text="Rendez-vous, prestations, échéances et tâches administratives." actions={<><Btn secondary onClick={()=>changeMonth(-1)}><ChevronLeft size={16}/></Btn><Btn secondary onClick={()=>changeMonth(1)}><ChevronRight size={16}/></Btn><Btn onClick={add}><Plus size={16}/> Événement</Btn></>}/>
    <section className="prosuite-card prosuite-agenda-calendar-card">
      <h2>{cursor.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</h2>
      <div className="calendar-grid prosuite-payment-calendar">
        {["L","M","M","J","V","S","D"].map((n,i)=><span className="day-name" key={"n"+i}>{n}</span>)}
        {Array.from({length:offset},(_,i)=><div key={"empty"+i}/>) }
        {Array.from({length:count},(_,i)=>{
          const day=i+1;
          const dayEvents=monthEvents.filter(e=>e.startsAt.slice(0,10)===key(day));
          const className="day "+(dayEvents.length?"has-due ":"")+(selectedDay===day?"selected":"");
          return <button type="button" key={day} className={className} onClick={()=>dayEvents.length&&setSelectedDay(selectedDay===day?null:day)}>
            <strong>{day}</strong>
            {dayEvents.length>0&&<small>{dayEvents.length}</small>}
          </button>;
        })}
      </div>
    </section>
    <Card title={selectedDay?("Événements du "+selectedDay+" "+cursor.toLocaleDateString("fr-FR",{month:"long"})):"Événements du mois"} action={selectedDay?<button onClick={()=>setSelectedDay(null)}>Tout le mois</button>:undefined}>
      {shownEvents.map(e=><div className="prosuite-list" key={e.id}><CalendarDays size={17}/><div><strong>{e.title}</strong><small>{new Date(e.startsAt).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"})}{clientName(e.clientId)?(" · "+clientName(e.clientId)):""}</small></div><div className="prosuite-rowactions"><button onClick={()=>edit(e)}><Pencil size={15}/></button><button onClick={()=>remove(e)}><Trash2 size={15}/></button></div></div>)}
      {!shownEvents.length&&<Empty text={selectedDay?"Aucun événement ce jour-là.":"Aucun événement ce mois-ci."}/>} 
    </Card>
  </>;
}`;

  s = s.slice(0,start) + agenda + s.slice(end);
  fs.writeFileSync(path,s);
}

function appendOnce(path,marker,css){
  let s=fs.readFileSync(path,"utf8");
  if(!s.includes(marker)) s+=`\n\n${marker}\n${css}\n`;
  fs.writeFileSync(path,s);
}

appendOnce("src/pro-suite.css","/* Budget-style Pro calendar + mobile containment */",`
.prosuite-shell,.prosuite-main{min-width:0}
.prosuite-agenda-calendar-card{min-width:0;overflow:hidden}
.prosuite-payment-calendar{width:100%;min-width:0}
.prosuite-payment-calendar .day{min-width:0}
.prosuite-payment-calendar .day.selected{outline:2px solid var(--accent-deep);outline-offset:1px}
@media(max-width:540px){
  .prosuite-payment-calendar{grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin:14px 0}
  .prosuite-payment-calendar .day-name{padding:5px 1px;font-size:.7rem}
  .prosuite-payment-calendar .day{min-height:58px;padding:7px 5px;border-radius:9px;gap:4px}
  .prosuite-payment-calendar .day strong{font-size:.78rem}
  .prosuite-payment-calendar .day small{font-size:.65rem}
  .prosuite-main{overflow-x:hidden}
}
:root[data-mode="dark"] .prosuite-payment-calendar .day{background:#17212b;border-color:#2a3744;color:#e5edf5}
:root[data-mode="dark"] .prosuite-payment-calendar .day.has-due{background:var(--accent-soft);border-color:var(--accent)}
`);

appendOnce("src/pro-billing-v2.css","/* Mobile billing containment */",`
.billing-v2,.billing-v2-card,.billing-v2-tablewrap{min-width:0;max-width:100%}
.billing-v2{width:100%;overflow-x:hidden}
.billing-v2-card{overflow:hidden}
.billing-v2-tablewrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-inline:contain}
@media(max-width:650px){
  .billing-v2{overflow-x:hidden}
  .billing-v2-card{padding:16px}
  .billing-v2-tablewrap{margin:0;width:100%;max-width:100%;overflow-x:auto}
  .billing-v2-table{min-width:720px}
  .billing-v2-head,.billing-v2-cardhead{min-width:0;max-width:100%}
  .billing-v2-head>div:first-child,.billing-v2-cardhead>div:first-child{min-width:0;max-width:100%}
  .billing-v2-head h1,.billing-v2-head p,.billing-v2-cardhead h2,.billing-v2-cardhead p{max-width:100%;overflow-wrap:anywhere}
}
`);

appendOnce("src/pro-business.css","/* Business dropdown mobile containment */",`
@media(max-width:800px){
  .pro-business-dropdown{left:auto!important;right:-4px!important;width:220px!important;max-width:calc(100vw - 32px)!important}
  .pro-business-dropdown>button{font-size:.88rem;white-space:normal;line-height:1.25}
  .pro-business-dropdown>button>span{white-space:normal;overflow:visible;text-overflow:clip}
}
`);

console.log("Correctifs mobile Pro V2 appliqués.");
