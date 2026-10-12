const styles = String.raw`
/* Projections : bloc critique livré avec la page (iOS PWA inclus). */
.projection-dashboard-v2 {display:grid;gap:18px;min-width:0;}
.projection-dashboard-v2 > * {min-width:0;}
.projection-topline {display:flex;justify-content:space-between;align-items:center;gap:12px;}
.projection-topline .pills {width:auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:5px;border-radius:15px;background:var(--wimm-mint-wash);gap:4px;flex:1;}
.projection-topline .pills button {min-width:0;white-space:nowrap;font-weight:750;font-size:.82rem;padding:11px 9px;border-radius:11px;color:var(--muted);background:transparent;box-shadow:none;}
.projection-topline .pills button.selected {color:var(--wimm-green);background:var(--surface);box-shadow:0 2px 7px rgba(33,80,61,.1);border-color:color-mix(in srgb,var(--wimm-mint) 28%,var(--border));}
.projection-topline .pills button:focus-visible {outline:2px solid var(--wimm-green);}
.projection-settings-card {margin:0;min-width:0;border:1px solid var(--border);background:var(--surface);border-radius:16px;overflow:hidden;}
.projection-settings-card > summary {display:flex;align-items:center;gap:11px;cursor:pointer;list-style:none;padding:14px 16px;font-size:.81rem;font-weight:750;color:var(--ink);}
.projection-settings-card > summary::-webkit-details-marker{display:none;}
.projection-settings-card>summary svg:first-child{color:var(--wimm-lavender);}
.projection-settings-card>summary svg:last-child{margin-left:auto;color:var(--muted);transition:transform .18s;}
.projection-settings-card[open]>summary svg:last-child{transform:rotate(90deg);}
.projection-settings-details{border-top:1px solid var(--border);padding:15px;display:grid;gap:12px;}
.projection-settings-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
.projection-settings-metrics>div{display:grid;gap:7px;border-radius:13px;padding:13px;background:var(--wimm-blue-wash);}
.projection-settings-metrics>div:last-child{background:var(--wimm-mint-wash);}
.projection-settings-metrics span{font-size:.72rem;color:var(--muted);}
.projection-settings-metrics strong{font-size:1.08rem;color:var(--ink);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
.projection-settings-details p{font-size:.75rem;color:var(--muted);line-height:1.5;margin:0;}
.projection-settings-details button{justify-self:start;display:flex;align-items:center;gap:8px;border-radius:11px;padding:10px 13px;font-size:.79rem;font-weight:750;}
.projection-main-card {border-radius:23px;padding:clamp(20px,3.4vw,28px);display:grid;gap:12px;
  background:linear-gradient(116deg,var(--wimm-mint-wash),var(--surface) 64%,var(--wimm-lavender-wash));
  border:1px solid color-mix(in srgb,var(--wimm-mint) 23%,var(--border));box-shadow:var(--wimm-card-shadow);}
.projection-main-heading{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:.85rem;font-weight:710;}
.projection-main-heading svg{flex-shrink:0;color:var(--wimm-green);}
.projection-main-amount{color:var(--ink);font-size:clamp(2rem,5vw,2.65rem);font-weight:850;line-height:1.15;letter-spacing:-.053em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
.projection-main-card > p{color:var(--muted);font-size:.73rem;margin:0;line-height:1.5;}
.projection-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;}
.projection-kpi{border-radius:17px;padding:17px;min-width:0;display:grid;gap:10px;border:1px solid var(--border);box-shadow:var(--wimm-card-shadow);}
.projection-kpi:nth-child(1){background:linear-gradient(125deg,var(--wimm-lavender-wash),var(--surface));}
.projection-kpi:nth-child(2){background:linear-gradient(125deg,var(--wimm-blue-wash),var(--surface));}
.projection-kpi svg{color:var(--wimm-lavender);}
.projection-kpi:nth-child(2) svg{color:var(--wimm-blue);}
.projection-kpi span{color:var(--muted);font-size:.75rem;line-height:1.35;}
.projection-kpi strong{color:var(--ink);font-variant-numeric:tabular-nums;font-size:clamp(1.1rem,2.8vw,1.45rem);font-weight:830;letter-spacing:-.035em;overflow-wrap:anywhere;}
.projection-chart-card, .projection-projects-card, .projection-annual-card {
  background:var(--surface);border:1px solid var(--border);box-shadow:var(--wimm-card-shadow);
  border-radius:21px;padding:clamp(16px,3vw,23px);min-width:0;
}
.projection-card-heading {display:flex;align-items:center;gap:9px;justify-content:space-between;min-width:0;}
.projection-card-heading h2 {font-size:1.06rem;font-weight:840;line-height:1.3;margin:0;letter-spacing:-.018em;}
.projection-card-heading .block-title {min-width:0;display:flex;align-items:center;gap:7px;}
.projection-card-heading .block-info {flex-shrink:0;}
.projection-chart-v2 {height:290px;min-height:210px;width:100%;min-width:0;margin-top:8px;}
.projection-legend-v2 {display:flex;flex-wrap:wrap;gap:9px 15px;align-items:center;margin:2px 0 0;}
.projection-legend-v2 > span {display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:.73rem;color:var(--muted);font-weight:650;}
.projection-legend-line{width:21px;height:0;border-top:3px solid #38866c;display:inline-block;}
.projection-legend-line.net {border-color:#8e95a8;border-top-style:dashed;}
.projection-legend-line.travel {border-color:#7d8ed8;}
.projection-chart-reading {margin-top:15px;border-radius:15px;padding:13px 15px;background:color-mix(in srgb,var(--wimm-blue-wash) 35%,var(--surface));border:1px solid var(--border);display:grid;gap:12px;}
.projection-chart-reading-header {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:5px 10px;}
.projection-chart-reading-header strong{font-size:.85rem;color:var(--ink);}
.projection-chart-reading-header small{color:var(--muted);font-size:.7rem;}
.projection-chart-reading-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}
.projection-chart-reading-values>div{min-width:0;display:grid;gap:5px;}
.projection-chart-reading-values span{font-size:.7rem;color:var(--muted);line-height:1.35;}
.projection-chart-reading-values strong{font-size:.86rem;color:var(--ink);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
.projection-chart-reading input[type=range]{width:100%;accent-color:var(--wimm-green);cursor:pointer;height:22px;margin:0;}
.projection-chart-note{font-size:.72rem;line-height:1.48;color:var(--muted);margin:12px 0 0;}
.projection-dashboard-v2 .projection-warning {margin:0;}
.projection-projects-card{display:grid;gap:13px;}
.projection-projects-card .section-head {display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0;}
.projection-projects-card .section-head h2 {font-size:1.06rem;font-weight:840;margin:0;}
.projection-projects-card .section-head button{min-height:40px;border-radius:12px;font-size:.78rem;display:inline-flex;gap:7px;align-items:center;padding:9px 13px;}
.projection-projects-card .projection-project-row{display:flex;align-items:center;gap:11px;padding:14px 3px;min-width:0;margin:0;border-top:1px solid var(--border);}
.projection-project-row .projection-project-icon{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border-radius:12px;background:var(--wimm-lavender-wash);color:var(--wimm-lavender);}
.projection-project-row .grow{flex:1;min-width:0;display:grid;gap:6px;}
.projection-project-row .grow strong{font-size:.86rem;color:var(--ink);overflow-wrap:anywhere;}
.projection-project-row .grow small{color:var(--muted);font-size:.72rem;line-height:1.45;}
.projection-project-row .icon{flex:0 0 35px;width:35px;height:35px;display:grid;place-items:center;color:var(--ink);padding:7px;}
.projection-project-amount{font-size:.84rem;font-weight:770;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap;}
.projection-project-status{display:inline-flex;align-items:center;align-self:start;padding:3px 8px;border-radius:7px;font-size:.67rem;font-weight:770;background:var(--wimm-mint-wash);color:var(--wimm-green);}
.projection-project-status.excluded{background:var(--wimm-amber-wash);color:var(--wimm-amber);}
.projection-project-status.financed{background:var(--wimm-lavender-wash);color:var(--wimm-lavender);}
.projection-project-copy{display:flex;flex-wrap:wrap;align-items:center;gap:7px;}
.projection-annual-card{display:grid;gap:10px;}
.projection-annual-card>summary{display:flex;align-items:center;gap:12px;list-style:none;cursor:pointer;padding:0;min-height:45px;}
.projection-annual-card>summary::-webkit-details-marker{display:none;}
.projection-annual-card>summary svg:first-child{color:var(--wimm-lavender);}
.projection-annual-card>summary .projection-annual-summary-copy{display:grid;flex:1;gap:4px;}
.projection-annual-card>summary strong{font-size:.88rem;color:var(--ink);}
.projection-annual-card>summary small{font-size:.71rem;color:var(--muted);}
.projection-annual-card>summary svg:last-child{color:var(--muted);transition:transform .18s;}
.projection-annual-card[open]>summary svg:last-child{transform:rotate(90deg);}
.projection-annual-mobile{display:none;}
.projection-year-card{border:1px solid var(--border);border-radius:13px;padding:0 13px;overflow:hidden;}
.projection-year-card+ .projection-year-card{margin-top:8px;}
.projection-year-card>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;justify-content:space-between;min-height:52px;font-size:.81rem;}
.projection-year-card>summary::-webkit-details-marker{display:none;}
.projection-year-card>summary strong{font-variant-numeric:tabular-nums;color:var(--ink);}
.projection-year-card>summary span{color:var(--muted);}
.projection-year-card[open]>summary{border-bottom:1px solid var(--border);}
.projection-year-details{display:grid;gap:8px;padding:11px 0;}
.projection-year-details>div{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:.74rem;}
.projection-year-details>div span{color:var(--muted);}
.projection-year-details>div strong{color:var(--ink);font-variant-numeric:tabular-nums;text-align:right;}
.projection-annual-table{overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch;}
.projection-annual-table table{width:100%;min-width:680px;border-collapse:collapse;}
.projection-annual-table th,.projection-annual-table td{padding:11px 9px;text-align:left;font-size:.78rem;border-bottom:1px solid var(--border);}
.projection-annual-table th{color:var(--muted);font-weight:750;white-space:nowrap;}
.projection-annual-table td{font-variant-numeric:tabular-nums;white-space:nowrap;}
@media(max-width:720px) {
  .projection-chart-v2{height:245px;}
  .projection-chart-reading-values{grid-template-columns:1fr;gap:9px;}
  .projection-chart-reading-values>div{display:flex;align-items:center;justify-content:space-between;gap:15px;}
  .projection-annual-mobile{display:block;}
  .projection-annual-table{display:none;}
}
@media(max-width:560px){
  .projection-dashboard-v2{gap:14px;}
  .projection-topline .pills button{font-size:.74rem;padding:11px 5px;}
  .projection-main-card{padding:19px;gap:10px;}
  .projection-main-amount{font-size:clamp(1.75rem,8vw,2.18rem);}
  .projection-kpis{gap:9px;}
  .projection-kpi{padding:13px;gap:8px;}
  .projection-kpi strong{font-size:clamp(.99rem,4vw,1.21rem);}
  .projection-kpi span{font-size:.7rem;}
  .projection-chart-card,.projection-projects-card,.projection-annual-card{padding:16px 13px;}
  .projection-chart-v2{height:235px;}
  .projection-legend-v2{gap:8px 11px;}
  .projection-legend-v2>span{font-size:.67rem;}
  .projection-chart-reading{padding:11px;}
  .projection-chart-reading-values strong{font-size:.8rem;}
  .projection-project-row .projection-project-icon{width:35px;height:35px;flex-basis:35px;}
  .projection-project-row .icon{width:31px;flex-basis:31px;}
  .projection-project-amount{font-size:.76rem;}
}
@media(prefers-reduced-motion:reduce){.projection-settings-card>summary svg:last-child,.projection-annual-card>summary svg:last-child{transition:none;}}
`;
export default function ProjectionPageStyles() { return <style data-wimm-projections="v2">{styles}</style>; }
