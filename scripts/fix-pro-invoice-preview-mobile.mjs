import fs from "node:fs";

const appPath = "src/ProBillingV2.tsx";
let app = fs.readFileSync(appPath, "utf8");

const oldOpen = '    {modal.type!=="none"&&<BillingModal close={()=>setModal({type:"none"})}>';
const newOpen = '    {modal.type==="preview" ? <DocumentPreview kind={modal.kind} value={modal.value} close={()=>setModal({type:"none"})}/> : modal.type!=="none"&&<BillingModal close={()=>setModal({type:"none"})}>';
if (!app.includes(oldOpen)) throw new Error("Ouverture de modale Facturation introuvable");
app = app.replace(oldOpen, newOpen);

const nestedPreview = '      {modal.type==="preview"&&<DocumentPreview kind={modal.kind} value={modal.value} close={()=>setModal({type:"none"})}/>} \n';
if (!app.includes(nestedPreview)) throw new Error("Aperçu imbriqué introuvable");
app = app.replace(nestedPreview, "");
fs.writeFileSync(appPath, app);

const cssPath = "src/pro-billing-v2.css";
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* Mobile invoice preview fullscreen */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media(max-width:650px){\n  .billing-v2-preview{\n    position:fixed!important;\n    inset:0!important;\n    z-index:3000!important;\n    width:100vw!important;\n    height:100dvh!important;\n    max-width:none!important;\n    max-height:none!important;\n    padding:calc(env(safe-area-inset-top) + 66px) 0 calc(env(safe-area-inset-bottom) + 20px)!important;\n    margin:0!important;\n    overflow-y:auto!important;\n    overflow-x:hidden!important;\n    -webkit-overflow-scrolling:touch;\n    background:#eef1f5;\n  }\n  .billing-v2-preview-actions{\n    position:fixed!important;\n    top:calc(env(safe-area-inset-top) + 8px)!important;\n    left:10px!important;\n    right:10px!important;\n    transform:none!important;\n    width:auto!important;\n    max-width:none!important;\n    justify-content:space-between!important;\n    z-index:3002!important;\n  }\n  .billing-v2-preview-actions button{\n    flex:1;\n    justify-content:center;\n    min-width:0;\n    white-space:nowrap;\n  }\n  .billing-v2-sheet{\n    width:100%!important;\n    max-width:none!important;\n    min-height:calc(100dvh - 66px)!important;\n    margin:0!important;\n    padding:24px 18px 40px!important;\n    border-radius:0!important;\n    box-shadow:none!important;\n  }\n  .billing-v2-document-table{table-layout:fixed}\n  .billing-v2-document-table th,.billing-v2-document-table td{padding:8px 4px;font-size:.68rem;overflow-wrap:anywhere}\n  .billing-v2-document-table th:first-child,.billing-v2-document-table td:first-child{width:36%}\n  .billing-v2-document-table th:nth-child(2),.billing-v2-document-table td:nth-child(2){width:10%}\n  .billing-v2-document-table th:nth-child(3),.billing-v2-document-table td:nth-child(3){width:20%}\n  .billing-v2-document-table th:nth-child(4),.billing-v2-document-table td:nth-child(4){width:12%}\n  .billing-v2-document-table th:nth-child(5),.billing-v2-document-table td:nth-child(5){width:22%}\n}\n`;
}
fs.writeFileSync(cssPath, css);
console.log("Aperçu facture mobile corrigé");
