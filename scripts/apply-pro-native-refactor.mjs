import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOne(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: motif attendu 1 fois, trouvé ${count}`);
  }
  return source.replace(before, after);
}

const appPath = "src/App.tsx";
let app = read(appPath);

if (!app.includes('import ProWorkspace from "./ProWorkspace";')) {
  app = replaceOne(
    app,
    'import LoansPage from "./pages/LoansPage";\n',
    'import LoansPage from "./pages/LoansPage";\nimport ProWorkspace from "./ProWorkspace";\n',
    "import ProWorkspace",
  );
}

if (!app.includes("[proEnabled, setProEnabled]")) {
  app = replaceOne(
    app,
    '    [includeTravel, setIncludeTravel] = useState(false),\n    [mobileMenuOpen, setMobileMenuOpen] = useState(false);',
    '    [includeTravel, setIncludeTravel] = useState(false),\n    [proEnabled, setProEnabled] = useState(false),\n    [mobileMenuOpen, setMobileMenuOpen] = useState(false);',
    "état proEnabled",
  );
}

if (!app.includes('const proStatus = await rpc("budget_pro_status")')) {
  app = replaceOne(
    app,
    '    setDoc(d);\n\n    if (d.theme)\n      setTheme(d.theme);',
    '    setDoc(d);\n\n    try {\n      const proStatus = await rpc("budget_pro_status") as { enabled: boolean };\n      setProEnabled(!!proStatus.enabled);\n    } catch {\n      setProEnabled(false);\n    }\n\n    if (d.theme)\n      setTheme(d.theme);',
    "chargement statut Pro",
  );
}

if (!app.includes("setProEnabled(false);\n        setLoading(false);")) {
  app = replaceOne(
    app,
    '        setDoc(null);\n        setPersonalDoc(null);\n        setLoading(false);',
    '        setDoc(null);\n        setPersonalDoc(null);\n        setProEnabled(false);\n        setLoading(false);',
    "reset statut Pro à la déconnexion",
  );
}

if (!app.includes('{ id: "pro", label: "Professionnel", icon: <Briefcase /> }')) {
  app = replaceOne(
    app,
    '    { id: "wealth", label: "Patrimoine", icon: <Wallet /> },\n    { id: "trips", label: "Voyages", icon: <Plane /> },\n  ];',
    '    { id: "wealth", label: "Patrimoine", icon: <Wallet /> },\n    { id: "trips", label: "Voyages", icon: <Plane /> },\n    ...(proEnabled\n      ? [{ id: "pro", label: "Professionnel", icon: <Briefcase /> }]\n      : []),\n  ];',
    "rubrique Pro desktop",
  );
}

if (!app.includes('id: "pro",\n      label: "Professionnel",\n      icon: <Briefcase size={20} />')) {
  app = replaceOne(
    app,
    '    !s.hidden.includes("trips") && {\n      id: "trips",\n      label: "Voyages",\n      icon: <Plane size={20} />,\n    },\n    {\n      id: "projection",',
    '    !s.hidden.includes("trips") && {\n      id: "trips",\n      label: "Voyages",\n      icon: <Plane size={20} />,\n    },\n    proEnabled && {\n      id: "pro",\n      label: "Professionnel",\n      icon: <Briefcase size={20} />,\n    },\n    {\n      id: "projection",',
    "rubrique Pro menu mobile",
  );
}

if (!app.includes('    pro: "Professionnel",')) {
  app = replaceOne(
    app,
    '    trips: "Vos voyages",\n    projection: "Demain se prépare ici",',
    '    trips: "Vos voyages",\n    pro: "Professionnel",\n    projection: "Demain se prépare ici",',
    "titre route Pro",
  );
}

if (!app.includes('!["settings", "wealth", "pro"].includes(route)')) {
  app = replaceOne(
    app,
    '          {!current && !["settings", "wealth"].includes(route) && (',
    '          {!current && !["settings", "wealth", "pro"].includes(route) && (',
    "exclusion setup Pro",
  );
}

if (!app.includes('{route === "pro" && <ProWorkspace native />}')) {
  app = replaceOne(
    app,
    '          {route === "home" && (',
    '          {route === "pro" && <ProWorkspace native />}\n          {route === "home" && (',
    "rendu route Pro",
  );
}

if (!app.includes("Rubriques affichées")) {
  app = replaceOne(
    app,
    '                <h2>Modules affichés</h2>\n                <p className="muted">\n                  Masquer un module conserve toutes ses données.\n                </p>',
    '                <h2>Rubriques affichées</h2>\n                <p className="muted">\n                  Masquer une rubrique conserve toutes ses données.\n                </p>',
    "libellé rubriques",
  );
}

if (!app.includes('checked={proEnabled}\n                    disabled={demoEnabled}')) {
  app = replaceOne(
    app,
    '                ))}\n              </section>\n              <section className="card danger-zone">',
    '                ))}\n                <label className="toggle">\n                  <input\n                    type="checkbox"\n                    checked={proEnabled}\n                    disabled={demoEnabled}\n                    onChange={async (event) => {\n                      try {\n                        const next = event.target.checked;\n                        await rpc("budget_pro_toggle", { p_enabled: next });\n                        setProEnabled(next);\n                        if (!next && route === "pro") navigate("home");\n                        setNotice(\n                          next\n                            ? "Rubrique Professionnel affichée."\n                            : "Rubrique Professionnel masquée.",\n                        );\n                      } catch (e) {\n                        showError(e);\n                      }\n                    }}\n                  />\n                  Professionnel\n                </label>\n              </section>\n              <section className="card danger-zone">',
    "toggle Pro natif",
  );
}

write(appPath, app);

const proPath = "src/ProWorkspace.tsx";
let pro = read(proPath);

if (!pro.includes('export default function ProWorkspace({ native = false }')) {
  pro = replaceOne(
    pro,
    'export default function ProWorkspace(){\n  const [enabled,setEnabled]=useState(false);\n  const [open,setOpen]=useState(false);',
    'export default function ProWorkspace({ native = false }: { native?: boolean } = {}){\n  const [enabled,setEnabled]=useState(native);\n  const [open,setOpen]=useState(native);',
    "signature ProWorkspace native",
  );
}

if (!pro.includes('const sidebar=native?null:document.querySelector(".sidebar nav")')) {
  pro = replaceOne(
    pro,
    '  const [,tick]=useState(0);\n  const sidebar=document.querySelector(".sidebar nav");\n  const drawer=document.querySelector(".mobile-drawer-nav");',
    '  const [,tick]=useState(0);\n  const sidebar=native?null:document.querySelector(".sidebar nav");\n  const drawer=native?null:document.querySelector(".mobile-drawer-nav");',
    "désactivation cibles DOM en mode natif",
  );
}

if (!pro.includes('if(native)return;\n    const obs=new MutationObserver')) {
  pro = replaceOne(
    pro,
    '  useEffect(()=>{\n    const obs=new MutationObserver(()=>tick(v=>v+1)); obs.observe(document.body,{subtree:true,childList:true});\n    return()=>obs.disconnect();\n  },[]);',
    '  useEffect(()=>{\n    if(native)return;\n    const obs=new MutationObserver(()=>tick(v=>v+1)); obs.observe(document.body,{subtree:true,childList:true});\n    return()=>obs.disconnect();\n  },[native]);',
    "observer Pro legacy seulement",
  );
}

if (!pro.includes('if(native){setEnabled(true);setOpen(true);void load();return;}')) {
  pro = replaceOne(
    pro,
    '  useEffect(()=>{\n    let off=false;\n    const refresh=async()=>{ try{ const s=await api.auth.getSession(); if(!s.data.session||off)return; const st=await rpc("budget_pro_status") as {enabled:boolean}; if(!off)setEnabled(st.enabled); }catch{} };\n    void refresh();\n    const l=api.auth.onAuthStateChange((_e,s)=>{ if(s)void refresh(); else {setEnabled(false);setOpen(false);} });\n    return()=>{off=true;l.data.subscription.unsubscribe();};\n  },[]);',
    '  useEffect(()=>{\n    if(native){setEnabled(true);setOpen(true);void load();return;}\n    let off=false;\n    const refresh=async()=>{ try{ const s=await api.auth.getSession(); if(!s.data.session||off)return; const st=await rpc("budget_pro_status") as {enabled:boolean}; if(!off)setEnabled(st.enabled); }catch{} };\n    void refresh();\n    const l=api.auth.onAuthStateChange((_e,s)=>{ if(s)void refresh(); else {setEnabled(false);setOpen(false);} });\n    return()=>{off=true;l.data.subscription.unsubscribe();};\n  },[native]);',
    "chargement Pro natif",
  );
}

if (!pro.includes('{!native&&sidebar&&createPortal')) {
  pro = replaceOne(
    pro,
    '    {sidebar&&createPortal(nav(false),sidebar)}{drawer&&createPortal(nav(true),drawer)}\n    {open&&enabled&&<div className="prosuite-layer">',
    '    {!native&&sidebar&&createPortal(nav(false),sidebar)}{!native&&drawer&&createPortal(nav(true),drawer)}\n    {(native||(open&&enabled))&&<div className={native?"prosuite-layer prosuite-native":"prosuite-layer"}>',
    "rendu natif sans portal nav",
  );
}

if (!pro.includes('{!native&&<button className="prosuite-icon" onClick={()=>setOpen(false)}><ChevronLeft')) {
  pro = replaceOne(
    pro,
    '        <button className="prosuite-icon" onClick={()=>setOpen(false)}><ChevronLeft size={20}/></button>\n        <div><small>WIMM PRO</small><strong>{suite?.profile.businessName||"Espace professionnel"}</strong></div>\n        <button className="prosuite-icon" onClick={()=>setOpen(false)}><X size={20}/></button>',
    '        {!native&&<button className="prosuite-icon" onClick={()=>setOpen(false)}><ChevronLeft size={20}/></button>}\n        <div><small>PROFESSIONNEL</small><strong>{suite?.profile.businessName||"Espace professionnel"}</strong></div>\n        {!native&&<button className="prosuite-icon" onClick={()=>setOpen(false)}><X size={20}/></button>}',
    "topbar Pro natif",
  );
}

write(proPath, pro);

const mainPath = "src/main.tsx";
let main = read(mainPath);
main = main.replace('import ProWorkspace from "./ProWorkspace";\n', "");
main = main.replace('import ProSettingsBridge from "./ProSettingsBridge";\n', "");
main = main.replace('    <ProWorkspace />\n', "");
main = main.replace('    <ProSettingsBridge />\n', "");
write(mainPath, main);

const cssPath = "src/pro-suite.css";
let css = read(cssPath);
const marker = "/* Native Wimm route */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.prosuite-layer.prosuite-native{\n  position:relative;\n  inset:auto;\n  z-index:auto;\n  min-height:0;\n  width:100%;\n  background:transparent;\n  overflow:visible;\n}\n.prosuite-native .prosuite-topbar{\n  position:relative;\n  top:auto;\n}\n.prosuite-native .prosuite-shell{\n  min-height:0;\n}\n`;
}
write(cssPath, css);

console.log("Migration native Professionnel appliquée.");
