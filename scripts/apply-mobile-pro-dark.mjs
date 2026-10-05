import fs from "node:fs";

function replaceOne(source,before,after,label){
  const count=source.split(before).length-1;
  if(count!==1) throw new Error(`${label}: motif attendu 1 fois, trouvé ${count}`);
  return source.replace(before,after);
}

// ProWorkspace : menu entreprise natif + libellé de brouillon lisible.
{
  const path="src/ProWorkspace.tsx";
  let s=fs.readFileSync(path,"utf8");
  if(!s.includes('import ProBusinessMenu from "./ProBusinessMenu";')){
    s=replaceOne(s,'import ProBillingV2 from "./ProBillingV2";\n','import ProBillingV2 from "./ProBillingV2";\nimport ProBusinessMenu from "./ProBusinessMenu";\n','import ProBusinessMenu');
  }
  const oldSuite='type Suite = { enabled:boolean; profile:Profile; account:Account; billing:BillingSettings; clients:Client[]; products:Product[]; transactions:Transaction[]; invoices:Invoice[]; events:EventItem[] };';
  const newSuite='type Suite = { enabled:boolean; activeBusinessId?:string|null; businesses?:{id:string;name:string}[]; profile:Profile; account:Account; billing:BillingSettings; clients:Client[]; products:Product[]; transactions:Transaction[]; invoices:Invoice[]; events:EventItem[] };';
  if(s.includes(oldSuite)) s=s.replace(oldSuite,newSuite);
  const oldTop='<div><small>PROFESSIONNEL</small><strong>{suite?.profile.businessName||"Espace professionnel"}</strong></div>';
  const newTop='<div className="prosuite-titleblock"><small>PROFESSIONNEL</small><div className="prosuite-business-title"><strong>{suite?.profile.businessName||"Espace professionnel"}</strong>{suite&&<ProBusinessMenu activeBusinessId={suite.activeBusinessId} businesses={suite.businesses??[]} onChanged={load}/>}</div></div>';
  if(s.includes(oldTop)) s=s.replace(oldTop,newTop);
  else if(!s.includes('className="prosuite-business-title"')) throw new Error('Header Pro introuvable');
  const oldRecent='<strong>{i.number}</strong><small>{invoiceStatus[i.status]} · {euro(i.totalTtc)}</small>';
  const newRecent='<strong className="prosuite-list-title" title={i.number}>{i.status==="draft"?"Brouillon":i.number}</strong><small>{invoiceStatus[i.status]} · {euro(i.totalTtc)}</small>';
  if(s.includes(oldRecent)) s=s.replace(oldRecent,newRecent);
  else if(!s.includes('className="prosuite-list-title"')) throw new Error('Factures récentes introuvables');
  fs.writeFileSync(path,s);
}

// Le bridge entreprise n’est plus monté globalement : le menu vit dans ProWorkspace.
{
  const path="src/main.tsx";
  let s=fs.readFileSync(path,"utf8");
  s=s.replace('import ProBusinessBridge from "./ProBusinessBridge";\n','');
  s=s.replace('    <ProBusinessBridge />\n','');
  fs.writeFileSync(path,s);
}

// Réglages : mode nuit local, mémorisé sur l’appareil.
{
  const path="src/App.tsx";
  let s=fs.readFileSync(path,"utf8");
  const oldTheme='    [theme, setTheme] = useState("blue"),\n';
  const newTheme='    [theme, setTheme] = useState("blue"),\n    [nightMode, setNightMode] = useState(() => localStorage.getItem("wimm-night-mode") === "1"),\n';
  if(!s.includes('wimm-night-mode')) s=replaceOne(s,oldTheme,newTheme,'État mode nuit');
  const themeEffect=`  useEffect(() => {\n    document.documentElement.dataset.theme = theme;\n  }, [theme]);`;
  const themeEffects=`  useEffect(() => {\n    document.documentElement.dataset.theme = theme;\n  }, [theme]);\n  useEffect(() => {\n    document.documentElement.dataset.mode = nightMode ? "dark" : "light";\n    localStorage.setItem("wimm-night-mode", nightMode ? "1" : "0");\n  }, [nightMode]);`;
  if(!s.includes('document.documentElement.dataset.mode')) s=replaceOne(s,themeEffect,themeEffects,'Effet mode nuit');
  const colorTitle='                  <h2>Votre couleur</h2>';
  const appearance=`                  <div className="appearance-mode-row">\n                    <div>\n                      <strong>Mode nuit</strong>\n                      <small>Assombrit Wimm pour une utilisation plus confortable le soir.</small>\n                    </div>\n                    <label className="night-switch">\n                      <input type="checkbox" checked={nightMode} onChange={(event) => setNightMode(event.target.checked)} />\n                      <span aria-hidden="true" />\n                    </label>\n                  </div>\n                  <h2>Votre couleur</h2>`;
  if(!s.includes('className="appearance-mode-row"')) s=replaceOne(s,colorTitle,appearance,'Réglage mode nuit');
  fs.writeFileSync(path,s);
}

function appendOnce(path,marker,css){
  let s=fs.readFileSync(path,"utf8");
  if(!s.includes(marker)) s+=`\n\n${marker}\n${css}\n`;
  fs.writeFileSync(path,s);
}

appendOnce('src/style.css','/* Night mode */',`
.appearance-mode-row{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:2px 0 22px;margin-bottom:22px;border-bottom:1px solid var(--border)}
.appearance-mode-row>div{display:flex;flex-direction:column;gap:4px}.appearance-mode-row small{max-width:520px}.night-switch{position:relative;display:inline-flex;flex:0 0 auto}.night-switch input{position:absolute;opacity:0;pointer-events:none}.night-switch span{width:48px;height:28px;border-radius:999px;background:#dce3ea;display:block;position:relative;transition:.2s}.night-switch span:after{content:"";position:absolute;width:22px;height:22px;border-radius:50%;background:#fff;left:3px;top:3px;box-shadow:0 2px 6px #16233025;transition:.2s}.night-switch input:checked+span{background:var(--accent-deep)}.night-switch input:checked+span:after{transform:translateX(20px)}
:root[data-mode="dark"]{color-scheme:dark;color:#e5edf5;background:#0e151c;--border:#2a3744;--muted:#93a2b2;--ink:#e5edf5;--surface:#17212b;--accent-soft:color-mix(in srgb,var(--accent) 16%,#17212b);--accent-deep:color-mix(in srgb,var(--accent) 72%,#ffffff);--chart:color-mix(in srgb,var(--accent) 74%,#ffffff)}
:root[data-mode="dark"] body,:root[data-mode="dark"] #root{background:#0e151c;color:var(--ink)}
:root[data-mode="dark"] .sidebar,:root[data-mode="dark"] .metric,:root[data-mode="dark"] .category,:root[data-mode="dark"] .month-picker,:root[data-mode="dark"] dialog,:root[data-mode="dark"] .auth-page,:root[data-mode="dark"] .auth-visual,:root[data-mode="dark"] .bottom-nav{background:var(--surface)!important;color:var(--ink)}
:root[data-mode="dark"] .sidebar nav button{color:#9aa9b8}:root[data-mode="dark"] .sidebar nav button.active{color:var(--accent-deep)}
:root[data-mode="dark"] .field input,:root[data-mode="dark"] .field select,:root[data-mode="dark"] .toolbar select,:root[data-mode="dark"] textarea{background:#101922!important;border-color:var(--border)!important;color:var(--ink)!important}
:root[data-mode="dark"] .row{border-color:var(--border)}:root[data-mode="dark"] .progress{background:#263440}:root[data-mode="dark"] .fake-line.short{background:#2a3744}
:root[data-mode="dark"] .trip-hero{background:linear-gradient(125deg,#16271f,#17251f);border-color:#294035}:root[data-mode="dark"] .trip-hero p:last-child{color:#9bb0a4}
:root[data-mode="dark"] .alert-bar{background:#2a2418;color:#d8c49b}:root[data-mode="dark"] .alert-bar>span{color:#bda77b}
:root[data-mode="dark"] .danger{background:#321f22;color:#ef9aa1}:root[data-mode="dark"] .saving{background:#0e151ccc}
:root[data-mode="dark"] .bottom-nav{background:#17212bf2!important}:root[data-mode="dark"] .bottom-nav button{color:#91a0b0}:root[data-mode="dark"] .add-nav svg{border-color:var(--surface);color:#233341}
:root[data-mode="dark"] .auth-story{background:#111b24}:root[data-mode="dark"] .auth-visual{box-shadow:none}
@media(max-width:850px){.appearance-mode-row{align-items:flex-start}.night-switch{margin-top:2px}}
`);

appendOnce('src/pro-suite.css','/* Mobile Pro fixes + night mode */',`
.prosuite-business-title{display:flex;align-items:center;gap:3px;min-width:0}.prosuite-business-title strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prosuite-list-title{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:540px){
  .prosuite-calendar{overflow:hidden}.prosuite-week,.prosuite-days{grid-template-columns:repeat(7,minmax(0,1fr));min-width:0!important;width:100%}.prosuite-week strong{padding:7px 1px;font-size:8px}.prosuite-day{min-width:0;min-height:62px;padding:4px 3px}.prosuite-day>span{font-size:10px}.prosuite-day button{width:100%;height:6px;min-height:6px;padding:0;border-radius:999px;font-size:0;line-height:0}.prosuite-list{grid-template-columns:auto minmax(0,1fr) auto}.prosuite-cardhead{align-items:flex-start}.prosuite-cardhead button{max-width:46%;font-size:.78rem;text-align:right;line-height:1.25}
}
:root[data-mode="dark"] .prosuite-layer{background:#0e151c;color:#e5edf5}:root[data-mode="dark"] .prosuite-topbar,:root[data-mode="dark"] .prosuite-nav,:root[data-mode="dark"] .prosuite-card,:root[data-mode="dark"] .prosuite-metric,:root[data-mode="dark"] .prosuite-client,:root[data-mode="dark"] .prosuite-product,:root[data-mode="dark"] .prosuite-calendar,:root[data-mode="dark"] .prosuite-modal{background:#17212b;color:#e5edf5;border-color:#2a3744}
:root[data-mode="dark"] .prosuite-week,:root[data-mode="dark"] .prosuite-day.empty,:root[data-mode="dark"] .prosuite-table th{background:#121b24}:root[data-mode="dark"] .prosuite-day,:root[data-mode="dark"] .prosuite-list,:root[data-mode="dark"] .prosuite-table td,:root[data-mode="dark"] .prosuite-reserve{border-color:#273542}
:root[data-mode="dark"] .prosuite-pagehead p,:root[data-mode="dark"] .prosuite-client p,:root[data-mode="dark"] .prosuite-form label,:root[data-mode="dark"] .prosuite-invoice-total span{color:#99a8b7}:root[data-mode="dark"] .prosuite-invoice-total strong{color:#e5edf5}
:root[data-mode="dark"] .prosuite-form input,:root[data-mode="dark"] .prosuite-form select,:root[data-mode="dark"] .prosuite-form textarea,:root[data-mode="dark"] .prosuite-search{background:#101922;color:#e5edf5;border-color:#2a3744}
:root[data-mode="dark"] .prosuite-btn.secondary,:root[data-mode="dark"] .prosuite-rowactions button,:root[data-mode="dark"] .prosuite-trash,:root[data-mode="dark"] .prosuite-addline,:root[data-mode="dark"] .prosuite-icon{background:#17212b;color:#d8e2ec;border-color:#334250}
`);

appendOnce('src/pro-business.css','/* Inline business menu */',`
.pro-business-menu{position:relative;display:inline-flex;align-items:center;flex:0 0 auto}.pro-business-menu-trigger{width:26px;height:26px;padding:0;border:0;background:transparent;color:#8b96a5;display:grid;place-items:center;border-radius:7px}.pro-business-menu-trigger:hover{background:var(--accent-soft);color:var(--accent-deep)}.pro-business-menu-backdrop{position:fixed;inset:0;z-index:178;background:transparent;border:0}.pro-business-dropdown{position:absolute;z-index:179;top:32px;left:-8px;width:min(270px,calc(100vw - 32px));padding:7px;background:#fff;border:1px solid #e4e7ec;border-radius:13px;box-shadow:0 16px 40px rgba(22,35,48,.16);display:grid;gap:2px}.pro-business-dropdown>small{padding:7px 9px 5px;font-size:9px;font-weight:800;letter-spacing:.13em;color:#98a2b3}.pro-business-dropdown>button{display:flex;align-items:center;gap:9px;width:100%;padding:9px;border:0;border-radius:9px;background:transparent;color:#475467;text-align:left;font-weight:650}.pro-business-dropdown>button>span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pro-business-dropdown>button:hover,.pro-business-dropdown>button.active{background:#f5f1fa;color:#6f5898}.pro-business-dropdown-separator{height:1px;background:#eaecf0;margin:5px 3px}
:root[data-mode="dark"] .pro-business-dropdown,:root[data-mode="dark"] .pro-business-modal{background:#17212b;color:#e5edf5;border-color:#2a3744}:root[data-mode="dark"] .pro-business-dropdown>button,:root[data-mode="dark"] .pro-business-list article>button{color:#dbe5ee}:root[data-mode="dark"] .pro-business-dropdown>button:hover,:root[data-mode="dark"] .pro-business-dropdown>button.active,:root[data-mode="dark"] .pro-business-list article.active{background:#241f31}:root[data-mode="dark"] .pro-business-dropdown-separator,:root[data-mode="dark"] .pro-business-form{border-color:#2a3744}:root[data-mode="dark"] .pro-business-list article{border-color:#2a3744}:root[data-mode="dark"] .pro-business-list article>button,:root[data-mode="dark"] .pro-business-close,:root[data-mode="dark"] .pro-business-formactions button{background:#17212b;border-color:#334250}:root[data-mode="dark"] .pro-business-formgrid input,:root[data-mode="dark"] .pro-business-formgrid select,:root[data-mode="dark"] .pro-business-formgrid textarea{background:#101922;color:#e5edf5;border-color:#2a3744}
@media(max-width:800px){.pro-business-dropdown{left:auto;right:-8px}}
`);

appendOnce('src/pro-billing-v2.css','/* Billing night mode */',`
:root[data-mode="dark"] .billing-v2-card,:root[data-mode="dark"] .billing-v2-modal{background:#17212b;color:#e5edf5;border-color:#2a3744}:root[data-mode="dark"] .billing-v2-table th,:root[data-mode="dark"] .billing-v2-table td{border-color:#2a3744}:root[data-mode="dark"] .billing-v2-form input,:root[data-mode="dark"] .billing-v2-form select,:root[data-mode="dark"] .billing-v2-form textarea{background:#101922;color:#e5edf5;border-color:#2a3744}:root[data-mode="dark"] .billing-v2-tabs span,:root[data-mode="dark"] .billing-v2-info{background:#202c37}:root[data-mode="dark"] .overdue-row{background:#2a211d}:root[data-mode="dark"] .billing-v2-close:hover,:root[data-mode="dark"] .billing-v2-actions button:hover{background:#24313d}:root[data-mode="dark"] .billing-v2-payment{border-color:#2a3744}
`);

console.log('Correctifs mobile, entreprise et mode nuit appliqués.');
