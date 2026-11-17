const styles = String.raw`
/* Projections : bloc critique livré avec la page (iOS PWA inclus). */
.projection-dashboard-v2 {display:grid;gap:18px;min-width:0;}
.projection-dashboard-v2 > * {min-width:0;}
.projection-main-amount{color:var(--ink);font-size:clamp(2rem,5vw,2.65rem);font-weight:850;line-height:1.15;letter-spacing:-.053em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
.projection-chart-v2 {height:290px;min-height:210px;width:100%;min-width:0;margin-top:8px;}
.projection-legend-v2 {display:flex;flex-wrap:wrap;gap:9px 15px;align-items:center;margin:2px 0 0;}
.projection-legend-v2 > span {display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:.73rem;color:var(--muted);font-weight:650;}
.projection-legend-line{width:21px;height:0;border-top:3px solid #38866c;display:inline-block;}
.projection-legend-line.net {border-color:#8e95a8;border-top-style:dashed;}
.projection-legend-line.travel {border-color:#7d8ed8;}
.projection-chart-v2 {touch-action:pan-y;cursor:crosshair;}
.projection-chart-v2:focus-visible {outline:2px solid var(--wimm-green);outline-offset:3px;border-radius:9px;}
.projection-chart-reading {margin-top:14px;padding:14px 0 0;background:transparent;border:0;border-top:1px solid var(--border);border-radius:0;display:grid;gap:13px;}
.projection-chart-reading-header {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:5px 10px;}
.projection-chart-reading-header strong{font-size:.85rem;color:var(--ink);}
.projection-chart-reading-header small{color:var(--muted);font-size:.7rem;}
.projection-chart-reading-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}
.projection-chart-reading-values>div{min-width:0;display:grid;gap:5px;}
.projection-chart-reading-values span{font-size:.7rem;color:var(--muted);line-height:1.35;}
.projection-chart-reading-values strong{font-size:.86rem;color:var(--ink);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}

/* Explication de la courbe grise déjà présente dans la légende ; place au besoin de trésorerie. */
.projection-cashflow-alert{margin-top:4px;padding:15px;display:grid;gap:12px;border-radius:16px;border:1px solid color-mix(in srgb,var(--wimm-amber) 24%,var(--border));background:var(--wimm-amber-wash);color:var(--ink);}
.projection-cashflow-alert-heading{display:flex;align-items:center;gap:9px;min-width:0;}
.projection-cashflow-alert-heading svg{flex:none;color:var(--wimm-amber);}
.projection-cashflow-alert-heading strong{font-size:.86rem;font-weight:830;line-height:1.3;}
.projection-cashflow-alert-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
.projection-cashflow-alert-details>div{min-width:0;display:grid;gap:6px;padding:11px;border-radius:12px;border:1px solid color-mix(in srgb,var(--wimm-amber) 15%,var(--border));background:color-mix(in srgb,var(--surface) 78%,transparent);}
.projection-cashflow-alert-details span{font-size:.69rem;line-height:1.35;color:var(--muted);}
.projection-cashflow-alert-details strong{font-size:clamp(.82rem,2.8vw,.99rem);font-weight:820;color:var(--ink);line-height:1.25;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
.projection-cashflow-alert>p{margin:0;font-size:.73rem;line-height:1.52;color:var(--muted);}
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
  .projection-main-amount{font-size:clamp(1.75rem,8vw,2.18rem);}
  .projection-chart-v2{height:235px;}
  .projection-legend-v2{gap:8px 11px;}
  .projection-legend-v2>span{font-size:.67rem;}
  .projection-chart-reading{padding:13px 0 0;gap:11px;}
  .projection-chart-reading-values strong{font-size:.8rem;}
}
`;
export default function ProjectionPageStyles() { return <style data-wimm-projections="v2">{styles}</style>; }
