import fs from "node:fs";
const path="src/pro-suite.css";
let s=fs.readFileSync(path,"utf8");
const marker="/* Uniform mobile Pro nav buttons */";
if(!s.includes(marker)){
  s += `\n\n${marker}\n@media(max-width:540px){\n  .prosuite-nav{align-items:center!important;min-height:0!important;height:auto!important}\n  .prosuite-nav button{flex:0 0 48px!important;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;max-width:48px!important;max-height:48px!important;padding:0!important;align-self:center!important;justify-content:center!important}\n  .prosuite-nav button.active{flex:0 0 48px!important;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;max-width:48px!important;max-height:48px!important}\n  .prosuite-nav button svg{width:20px!important;height:20px!important;flex:0 0 20px!important}\n}\n`;
  fs.writeFileSync(path,s);
}
console.log("Correctif menu Pro mobile appliqué");
// workflow trigger
