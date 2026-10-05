import fs from "node:fs";

const path="src/ProWorkspace.tsx";
let s=fs.readFileSync(path,"utf8");

const oldModal='  | {type:"event"; event?:EventItem}\n';
const newModal='  | {type:"event"; event?:EventItem; initialDate?:string}\n';
if(!s.includes(oldModal)) throw new Error("Modal event introuvable");
s=s.replace(oldModal,newModal);

const oldAgendaCall='{section==="agenda"&&<AgendaPage events={suite.events} clients={suite.clients} add={()=>setModal({type:"event"})} edit={e=>setModal({type:"event",event:e})} remove={e=>void removeEvent(e)}/>}';
const newAgendaCall='{section==="agenda"&&<AgendaPage events={suite.events} clients={suite.clients} add={date=>setModal({type:"event",initialDate:date})} edit={e=>setModal({type:"event",event:e})} remove={e=>void removeEvent(e)}/>}';
if(!s.includes(oldAgendaCall)) throw new Error("Appel AgendaPage introuvable");
s=s.replace(oldAgendaCall,newAgendaCall);

const oldEventFormCall='{modal.type==="event"&&<EventForm value={modal.event} clients={suite.clients} submit={v=>call("budget_pro_event_save",{p_event:v},"Agenda mis à jour")} remove={modal.event?()=>removeEvent(modal.event!):undefined}/>}';
const newEventFormCall='{modal.type==="event"&&<EventForm value={modal.event} initialDate={modal.initialDate} clients={suite.clients} submit={v=>call("budget_pro_event_save",{p_event:v},"Agenda mis à jour")} remove={modal.event?()=>removeEvent(modal.event!):undefined}/>}';
if(!s.includes(oldEventFormCall)) throw new Error("Appel EventForm introuvable");
s=s.replace(oldEventFormCall,newEventFormCall);

const oldAgendaSig='function AgendaPage({events,clients,add,edit,remove}:{events:EventItem[];clients:Client[];add:()=>void;edit:(e:EventItem)=>void;remove:(e:EventItem)=>void}){';
const newAgendaSig='function AgendaPage({events,clients,add,edit,remove}:{events:EventItem[];clients:Client[];add:(date?:string)=>void;edit:(e:EventItem)=>void;remove:(e:EventItem)=>void}){';
if(!s.includes(oldAgendaSig)) throw new Error("Signature AgendaPage introuvable");
s=s.replace(oldAgendaSig,newAgendaSig);

const oldDay='return <button type="button" key={day} className={className} onClick={()=>dayEvents.length&&setSelectedDay(selectedDay===day?null:day)}>';
const newDay='return <button type="button" key={day} className={className} onClick={()=>{setSelectedDay(day);add(key(day));}} title={"Ajouter un événement le "+day+" "+cursor.toLocaleDateString("fr-FR",{month:"long"})}>';
if(!s.includes(oldDay)) throw new Error("Bouton jour introuvable");
s=s.replace(oldDay,newDay);

const oldForm='function EventForm({value,clients,submit,remove}:{value?:EventItem;clients:Client[];submit:(v:Record<string,unknown>)=>Promise<boolean>;remove?:()=>Promise<void>}){\n  const start=value?value.startsAt.slice(0,16):new Date(Date.now()+3600000).toISOString().slice(0,16);\n  const end=value?value.endsAt.slice(0,16):new Date(Date.now()+7200000).toISOString().slice(0,16);';
const newForm='function EventForm({value,initialDate,clients,submit,remove}:{value?:EventItem;initialDate?:string;clients:Client[];submit:(v:Record<string,unknown>)=>Promise<boolean>;remove?:()=>Promise<void>}){\n  const start=value?value.startsAt.slice(0,16):(initialDate?initialDate+"T09:00":new Date(Date.now()+3600000).toISOString().slice(0,16));\n  const end=value?value.endsAt.slice(0,16):(initialDate?initialDate+"T10:00":new Date(Date.now()+7200000).toISOString().slice(0,16));';
if(!s.includes(oldForm)) throw new Error("EventForm introuvable");
s=s.replace(oldForm,newForm);

fs.writeFileSync(path,s);
console.log("Ajout direct d’événement depuis le calendrier Pro appliqué.");
