const styles = String.raw`
/* Personal finance v2: only private account UI; styles shipped with React on iOS. */
.personal-page-v2 {display:grid;gap:17px;min-width:0}
.personal-page-v2 > * {min-width:0}
.personal-page-v2 .personal-v2-hero {
  display:grid;gap:16px;padding:clamp(20px,3.6vw,29px);border:1px solid color-mix(in srgb,var(--wimm-lavender) 25%,var(--border));
  border-radius:23px;background:linear-gradient(125deg,var(--wimm-lavender-wash),var(--surface) 69%,var(--wimm-blue-wash));
  box-shadow:var(--wimm-card-shadow);min-width:0
}
.personal-v2-hero-header {display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.personal-v2-account {display:flex;align-items:center;gap:8px;color:var(--muted);font-weight:740;font-size:.84rem;min-width:0;overflow-wrap:anywhere}
.personal-v2-account svg {color:var(--wimm-lavender);flex:0 0 auto}
.personal-v2-private {display:flex;align-items:center;gap:5px;border:0;background:color-mix(in srgb,var(--wimm-lavender-wash) 65%,var(--surface));
  color:var(--wimm-lavender);padding:7px 9px;border-radius:9px;font-size:.72rem;font-weight:800}
.personal-v2-amount {display:grid;gap:5px}
.personal-v2-amount>span {font-size:.75rem;font-weight:670;color:var(--muted)}
.personal-v2-amount>strong {color:var(--ink);font-size:clamp(2.25rem,6vw,3rem);font-weight:870;line-height:1.11;letter-spacing:-.055em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.personal-v2-totals {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;padding-top:15px;border-top:1px solid color-mix(in srgb,var(--wimm-lavender) 18%,var(--border))}
.personal-v2-totals>div {display:grid;gap:5px;min-width:0}
.personal-v2-totals small {font-size:.72rem;line-height:1.3;color:var(--muted)}
.personal-v2-totals strong {font-size:1.05rem;line-height:1.3;color:var(--ink);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.personal-v2-totals span {font-size:.7rem;color:var(--muted);overflow-wrap:anywhere}
.personal-v2-totals .personal-v2-due strong {color:var(--wimm-green)}
.personal-v2-quick-actions {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.personal-v2-quick-actions button {
  display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;min-width:0;
  text-align:center;border-radius:15px;font-size:.82rem;font-weight:780;line-height:1.25;padding:11px 12px
}
.personal-v2-quick-actions button svg {flex:0 0 auto}
.personal-v2-quick-actions .primary {color:#fff;background:var(--wimm-green)}
.personal-v2-quick-actions .secondary {background:var(--wimm-mint-wash);border:1px solid color-mix(in srgb,var(--wimm-green) 24%,var(--border));color:var(--wimm-green)}
.personal-v2-panel {border:1px solid var(--border);background:var(--surface);border-radius:19px;
  box-shadow:var(--wimm-card-shadow);min-width:0;overflow:hidden}
.personal-v2-panel>summary {display:flex;align-items:center;gap:11px;cursor:pointer;list-style:none;min-height:81px;padding:17px 18px}
.personal-v2-panel>summary::-webkit-details-marker {display:none}
.personal-v2-panel>summary::marker {content:""}
.personal-v2-panel>summary:focus-visible{outline:2px solid var(--wimm-green);outline-offset:-3px}
.personal-v2-panel-icon {display:grid;place-items:center;width:41px;height:41px;flex:0 0 41px;border-radius:13px;
  background:var(--wimm-lavender-wash);color:var(--wimm-lavender)}
.personal-v2-panel-copy {min-width:0;flex:1;display:grid;gap:5px}
.personal-v2-panel-copy>strong {font-size:.88rem;color:var(--ink);line-height:1.25;font-weight:830}
.personal-v2-panel-copy>small {font-size:.72rem;line-height:1.38;color:var(--muted);overflow-wrap:anywhere}
.personal-v2-panel-side {display:grid;gap:5px;align-items:end;text-align:right;min-width:0}
.personal-v2-panel-side>strong {font-size:.97rem;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.personal-v2-panel-side>small {font-size:.68rem;color:var(--muted)}
.personal-v2-panel>summary>.personal-v2-chevron{flex:0 0 auto;width:18px;height:18px;color:var(--muted);transition:transform .18s}
.personal-v2-panel[open]>summary>.personal-v2-chevron{transform:rotate(90deg)}
.personal-v2-panel-content{padding:4px 18px 18px;border-top:1px solid var(--border);display:grid;gap:10px;min-width:0}
.personal-v2-panel-content>.muted{font-size:.78rem;line-height:1.45}
.personal-v2-panel-content .rule-row {margin:0;padding:12px 0;gap:10px}
.personal-v2-panel-content .section-head {gap:10px;align-items:center;flex-wrap:wrap;margin:0}
.personal-v2-panel-content .section-head p{font-size:.75rem;line-height:1.45}
.personal-v2-panel-content .section-head h2{font-size:.87rem}
.personal-v2-panel-content .section-head button {padding:8px 10px;font-size:.74rem;min-height:34px}
.personal-v2-panel-content .card {box-shadow:none!important;border:0!important;background:transparent!important;
  padding:11px 0!important;margin:0!important;border-radius:0!important}
.personal-v2-panel-content .card + .card{border-top:1px solid var(--border)!important;padding-top:15px!important}
.personal-v2-panel-content .card h2{font-size:.91rem}
.personal-v2-panel-content .card > .muted {font-size:.76rem}
.personal-v2-panel-content .card button{max-width:100%}
.personal-v2-month-overview {padding:3px 0 8px;display:grid;gap:10px}
.personal-v2-month-overview .progress {margin:0}
.personal-v2-month-overview .row {min-height:0;padding:5px 0}
.personal-v2-month-overview .row .row-label,.personal-v2-month-overview .row .row-value{font-size:.79rem}
.personal-v2-budget-panel {background:linear-gradient(128deg,var(--wimm-lavender-wash),var(--surface) 82%);
  border-color:color-mix(in srgb,var(--wimm-lavender) 23%,var(--border))}
.personal-v2-projection-panel {background:linear-gradient(128deg,var(--wimm-blue-wash),var(--surface) 84%);
  border-color:color-mix(in srgb,var(--wimm-blue) 19%,var(--border))}
.personal-v2-projection-panel .personal-v2-panel-icon {background:var(--wimm-blue-wash);color:var(--wimm-blue)}
.personal-v2-projection-panel .chart {min-width:0}
.personal-v2-projection-panel .pills {display:flex;flex-wrap:wrap;gap:5px;max-width:100%;margin-top:9px}
.personal-v2-projection-panel .pills button {font-size:.74rem;padding:8px 11px}
.personal-v2-projection-panel .footnote {color:var(--muted);font-size:.74rem;line-height:1.5}
.personal-v2-commitments-panel .personal-v2-panel-icon{background:var(--wimm-mint-wash);color:var(--wimm-green)}
.personal-v2-commitments-panel .personal-advances-card,.personal-v2-commitments-panel .personal-installments-card{min-height:0}
.personal-v2-history {display:grid;gap:12px;padding:17px 18px;background:var(--surface);border:1px solid var(--border);
  border-radius:19px;box-shadow:var(--wimm-card-shadow);min-width:0}
.personal-v2-history-header {display:flex;align-items:center;justify-content:space-between;gap:10px}
.personal-v2-history-header>h2{margin:0;font-size:.93rem;font-weight:830}
.personal-v2-history-header>span{font-size:.75rem;color:var(--muted)}
.personal-v2-history-preview {display:grid;gap:0}
.personal-v2-history-preview>div{display:flex;align-items:center;gap:11px;padding:12px 0}
.personal-v2-history-preview>div+div{border-top:1px solid var(--border)}
.personal-v2-history-icon{display:grid;place-items:center;width:36px;height:36px;flex:0 0 36px;
  color:var(--wimm-green);background:var(--wimm-mint-wash);border-radius:12px}
.personal-v2-history-icon.negative{background:var(--wimm-coral-wash);color:var(--wimm-coral)}
.personal-v2-history-name{flex:1;min-width:0;display:grid;gap:4px}
.personal-v2-history-name>strong{font-size:.79rem;color:var(--ink);line-height:1.35;overflow-wrap:anywhere}
.personal-v2-history-name>small{font-size:.69rem;color:var(--muted)}
.personal-v2-history-value{font-size:.82rem;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--ink);font-weight:790}
.personal-v2-history-value.positive{color:var(--wimm-green)}
.personal-v2-history-empty{color:var(--muted);font-size:.77rem;margin:4px 0}
.personal-v2-history>details{border-top:1px solid var(--border);padding-top:10px;min-width:0}
.personal-v2-history>details>summary{display:flex;align-items:center;justify-content:space-between;gap:7px;
  cursor:pointer;list-style:none;color:var(--wimm-green);font-size:.79rem;font-weight:780;padding:6px 0}
.personal-v2-history>details>summary::-webkit-details-marker{display:none}
.personal-v2-history>details>summary svg{transition:transform .18s}
.personal-v2-history>details[open]>summary svg{transform:rotate(90deg)}
.personal-v2-history-full {padding-top:12px;min-width:0}
.personal-v2-history-full .personal-history-card {box-shadow:none!important;border:0!important;background:transparent!important;padding:0!important}
.personal-v2-history-full .personal-history-card .section-head{display:none}
.personal-v2-history-full .row{min-width:0}
.personal-v2-history-full .row-value .flex{flex-wrap:wrap;gap:8px}
.personal-v2-privacy-note {color:var(--muted);font-size:.73rem;line-height:1.45;margin:0}
@media(max-width:560px){
 .personal-page-v2{gap:14px}
 .personal-page-v2 .personal-v2-hero {padding:20px;gap:14px;border-radius:21px}
 .personal-v2-amount>strong {font-size:2.35rem}
 .personal-v2-totals {gap:9px}
 .personal-v2-totals strong{font-size:.94rem}
 .personal-v2-quick-actions{gap:9px}
 .personal-v2-quick-actions button{font-size:.74rem;padding:11px 8px;min-height:53px;gap:5px}
 .personal-v2-quick-actions button svg{width:17px;height:17px}
 .personal-v2-panel>summary{padding:15px 12px;gap:9px}
 .personal-v2-panel-icon{width:35px;height:35px;flex-basis:35px;border-radius:11px}
 .personal-v2-panel-icon svg{width:18px;height:18px}
 .personal-v2-panel-copy>strong{font-size:.81rem}
 .personal-v2-panel-copy>small{font-size:.69rem}
 .personal-v2-panel-side>strong{font-size:.87rem}
 .personal-v2-panel-content{padding:4px 12px 15px}
 .personal-v2-history{padding:16px 13px}
 .personal-v2-history-preview>div{gap:8px}
 .personal-v2-history-value{font-size:.75rem}
}
@media(prefers-reduced-motion:reduce){.personal-v2-panel>summary>.personal-v2-chevron,.personal-v2-history>details>summary svg{transition:none}}
`;
export default function PersonalPageStyles(){return <style data-wimm-personal="v2">{styles}</style>;}
