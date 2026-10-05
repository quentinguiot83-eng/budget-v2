import fs from "node:fs";

const appPath = "src/ProWorkspace.tsx";
let app = fs.readFileSync(appPath, "utf8");

const oldState = `  const [cursor,setCursor]=useState(()=>new Date());\n  const [selectedDay,setSelectedDay]=useState<number|null>(null);\n  const y=cursor.getFullYear(),m=cursor.getMonth();`;
const newState = `  const [cursor,setCursor]=useState(()=>new Date());\n  const [selectedDay,setSelectedDay]=useState<number|null>(null);\n  const y=cursor.getFullYear(),m=cursor.getMonth();\n  const now=new Date();\n  const isCurrentMonth=y===now.getFullYear()&&m===now.getMonth();`;
if (!app.includes(oldState)) throw new Error("État Agenda introuvable");
app = app.replace(oldState,newState);

const oldChange = `  const changeMonth=(delta:number)=>{setCursor(new Date(y,m+delta,1));setSelectedDay(null)};`;
const newChange = `  const changeMonth=(delta:number)=>{setCursor(new Date(y,m+delta,1));setSelectedDay(null)};\n  const goCurrentMonth=()=>{const d=new Date();setCursor(new Date(d.getFullYear(),d.getMonth(),1));setSelectedDay(null)};`;
if (!app.includes(oldChange)) throw new Error("changeMonth introuvable");
app = app.replace(oldChange,newChange);

const oldHead = `    <PageHead eyebrow="AGENDA" title={cursor.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})} text="Rendez-vous, prestations, échéances et tâches administratives." actions={<><Btn secondary onClick={()=>changeMonth(-1)}><ChevronLeft size={16}/></Btn><Btn secondary onClick={()=>changeMonth(1)}><ChevronRight size={16}/></Btn><Btn onClick={add}><Plus size={16}/> Événement</Btn></>}/>`;
const newHead = `    <PageHead eyebrow="AGENDA" title="Agenda" text="Rendez-vous, prestations, échéances et tâches administratives." actions={<Btn onClick={add}><Plus size={16}/> Événement</Btn>}/>\n    <div className="prosuite-agenda-monthnav" aria-label="Navigation du calendrier">\n      <button type="button" className="prosuite-agenda-montharrow" onClick={()=>changeMonth(-1)} aria-label="Mois précédent"><ChevronLeft size={22}/></button>\n      <strong>{cursor.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</strong>\n      <button type="button" className="prosuite-agenda-montharrow" onClick={()=>changeMonth(1)} aria-label="Mois suivant"><ChevronRight size={22}/></button>\n    </div>\n    <button type="button" className="prosuite-agenda-today" onClick={goCurrentMonth} disabled={isCurrentMonth}>Mois en cours</button>`;
if (!app.includes(oldHead)) throw new Error("En-tête Agenda introuvable");
app = app.replace(oldHead,newHead);

fs.writeFileSync(appPath,app);

const cssPath = "src/pro-suite.css";
let css = fs.readFileSync(cssPath,"utf8");
const marker = "/* Pro agenda month navigation */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.prosuite-agenda-monthnav{display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;gap:14px;margin:0 0 10px}.prosuite-agenda-monthnav>strong{text-align:center;font-size:18px;font-weight:700}.prosuite-agenda-montharrow{width:52px;height:52px;border:1px solid #dfe3e8;border-radius:14px;background:#fff;color:#344054;display:grid;place-items:center}.prosuite-agenda-today{display:block;margin:0 auto 18px;border:0;background:transparent;color:#3f735d;font-weight:800;padding:8px 12px;border-radius:10px}.prosuite-agenda-today:disabled{opacity:.42;cursor:default}\n@media(max-width:650px){.prosuite-agenda-monthnav{grid-template-columns:58px minmax(0,1fr) 58px;gap:10px;margin-top:2px}.prosuite-agenda-montharrow{width:58px;height:58px;border-radius:15px}.prosuite-agenda-monthnav>strong{font-size:17px}.prosuite-agenda-today{margin-bottom:14px}}\n:root[data-mode="dark"] .prosuite-agenda-montharrow{background:#17212b;border-color:#2a3744;color:#e5edf5}\n`;
}
fs.writeFileSync(cssPath,css);
console.log("Navigation mensuelle Agenda Pro corrigée.");
