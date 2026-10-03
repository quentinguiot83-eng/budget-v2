import fs from "node:fs";

const mainPath = "src/main.tsx";
let main = fs.readFileSync(mainPath, "utf8");
main = main.replace('import ProAgendaBridge from "./ProAgendaBridge";\n', "");
main = main.replace('    <ProAgendaBridge />\n', "");
fs.writeFileSync(mainPath, main);

const proPath = "src/ProWorkspace.tsx";
let pro = fs.readFileSync(proPath, "utf8");

const oldCall = '{modal.type==="event"&&<EventForm value={modal.event} clients={suite.clients} submit={v=>call("budget_pro_event_save",{p_event:v},"Agenda mis à jour")}/>} ';
const newCall = '{modal.type==="event"&&<EventForm value={modal.event} clients={suite.clients} submit={v=>call("budget_pro_event_save",{p_event:v},"Agenda mis à jour")} remove={modal.event?()=>removeEvent(modal.event!):undefined}/>} ';
if (pro.includes(oldCall)) pro = pro.replace(oldCall, newCall);

const start = pro.indexOf("function EventForm(");
const end = pro.indexOf("\n\nfunction TransactionForm", start);
if (start < 0 || end < 0) throw new Error("EventForm introuvable");

const newEvent = `function EventForm({value,clients,submit,remove}:{value?:EventItem;clients:Client[];submit:(v:Record<string,unknown>)=>Promise<boolean>;remove?:()=>Promise<void>}){
  const start=value?value.startsAt.slice(0,16):new Date(Date.now()+3600000).toISOString().slice(0,16);
  const end=value?value.endsAt.slice(0,16):new Date(Date.now()+7200000).toISOString().slice(0,16);
  const [v,setV]=useState({id:value?.id,title:value?.title??"",eventType:value?.eventType??"appointment",clientId:value?.clientId??"",startsAt:start,endsAt:end,location:value?.location??"",notes:value?.notes??""});
  return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({...v,clientId:v.clientId||null,startsAt:new Date(v.startsAt).toISOString(),endsAt:new Date(v.endsAt).toISOString()})}}>
    <FormTitle eyebrow="AGENDA" title={value?"Modifier l’événement":"Nouvel événement"}/>
    <label>Titre<input required value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></label>
    <div className="prosuite-form2"><label>Type<select value={v.eventType} onChange={e=>setV({...v,eventType:e.target.value})}>{Object.entries(eventLabel).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label>Client<select value={v.clientId} onChange={e=>setV({...v,clientId:e.target.value})}><option value="">Aucun</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
    <div className="prosuite-form2"><label>Début<input type="datetime-local" required value={v.startsAt} onChange={e=>setV({...v,startsAt:e.target.value})}/></label><label>Fin<input type="datetime-local" required value={v.endsAt} onChange={e=>setV({...v,endsAt:e.target.value})}/></label></div>
    <label>Lieu<input value={v.location} onChange={e=>setV({...v,location:e.target.value})}/></label>
    <label>Notes<textarea rows={3} value={v.notes} onChange={e=>setV({...v,notes:e.target.value})}/></label>
    <div className="prosuite-event-actions">
      {value&&remove&&<button type="button" className="prosuite-delete-action" onClick={()=>void remove()}><Trash2 size={16}/>{v.eventType==="appointment"?"Supprimer le rendez-vous":"Supprimer l’événement"}</button>}
      <button className="prosuite-btn">Enregistrer</button>
    </div>
  </form>
}`;

pro = pro.slice(0, start) + newEvent + pro.slice(end);
fs.writeFileSync(proPath, pro);

const cssPath = "src/pro-suite.css";
let css = fs.readFileSync(cssPath, "utf8");
if (!css.includes("/* Native agenda actions */")) {
  css += `\n\n/* Native agenda actions */\n.prosuite-event-actions{display:flex;gap:12px;justify-content:flex-end;align-items:center;flex-wrap:wrap}\n.prosuite-delete-action{display:inline-flex;align-items:center;gap:8px;padding:12px 15px;border-radius:12px;border:1px solid #f0caca;background:#fff7f7;color:#a33;font-weight:650}\n.prosuite-delete-action:hover{background:#fff0f0}\n`;
}
fs.writeFileSync(cssPath, css);

console.log("Suppression agenda intégrée directement au workspace Pro.");
