import fs from "node:fs";

const appPath = "src/App.tsx";
let app = fs.readFileSync(appPath, "utf8");
const oldMarkup = '<span className="brandmark">N</span>';
const newMarkup = '<img src="/wimm-icon.png" alt="Wimm" className="loading-brand-logo" />';
if (!app.includes(oldMarkup)) throw new Error("Ancien logo de chargement introuvable");
app = app.replace(oldMarkup, newMarkup);
fs.writeFileSync(appPath, app);

const cssPath = "src/style.css";
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* Wimm loading logo */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.loading-brand-logo {\n  width: 68px;\n  height: 68px;\n  border-radius: 20px;\n  object-fit: cover;\n  box-shadow: 0 10px 28px rgba(38, 54, 71, 0.10);\n}\n`;
}
fs.writeFileSync(cssPath, css);
console.log("Logo de chargement Wimm mis à jour.");
