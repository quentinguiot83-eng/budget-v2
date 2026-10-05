import fs from "node:fs";
const path="src/pro-suite.css";
let s=fs.readFileSync(path,"utf8");
const marker="/* Compact native Pro shell on mobile */";
if(!s.includes(marker)){
  s += `\n\n${marker}\n@media(max-width:800px){\n  .prosuite-native .prosuite-shell{display:block!important;height:auto!important;min-height:0!important;grid-template-rows:none!important}\n  .prosuite-native .prosuite-nav{height:auto!important;min-height:64px!important;max-height:64px!important;align-self:start!important;align-items:center!important;overflow-x:auto!important;overflow-y:hidden!important}\n  .prosuite-native .prosuite-main{height:auto!important;min-height:0!important;overflow:visible!important}\n}\n`;
  fs.writeFileSync(path,s);
}
console.log("Correctif hauteur shell Pro mobile appliqué");
