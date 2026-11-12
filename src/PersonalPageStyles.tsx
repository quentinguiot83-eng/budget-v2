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
.personal-v2-totals .personal-v2-due strong {color:var(--accent-deep)}
.personal-v2-quick-actions {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.personal-v2-quick-actions button {
  display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;min-width:0;
  text-align:center;border-radius:15px;font-size:.82rem;font-weight:780;line-height:1.25;padding:11px 12px
}
.personal-v2-quick-actions button svg {flex:0 0 auto}
.personal-v2-quick-actions .primary {color:#fff;background:var(--action)}
.personal-v2-quick-actions .secondary {background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--action) 24%,var(--border));color:var(--accent-deep)}
.personal-v2-panel {border:1px solid var(--border);background:var(--surface);border-radius:19px;
  box-shadow:var(--wimm-card-shadow);min-width:0;overflow:hidden}
.personal-v2-panel>summary {display:flex;align-items:center;gap:11px;cursor:pointer;list-style:none;min-height:81px;padding:17px 18px}
.personal-v2-panel>summary::-webkit-details-marker {display:none}
.personal-v2-panel>summary::marker {content:""}
.personal-v2-panel>summary:focus-visible{outline:2px solid var(--action);outline-offset:-3px}
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
.personal-v2-commitments-panel .personal-v2-panel-icon{background:var(--accent-soft);color:var(--accent-deep)}
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
  cursor:pointer;list-style:none;color:var(--accent-deep);font-size:.79rem;font-weight:780;padding:6px 0}
.personal-v2-history>details>summary::-webkit-details-marker{display:none}
.personal-v2-history>details>summary svg{transition:transform .18s}
.personal-v2-history>details[open]>summary svg{transform:rotate(90deg)}
.personal-v2-history-full {padding-top:12px;min-width:0}
.personal-v2-history-full .personal-history-card {box-shadow:none!important;border:0!important;background:transparent!important;padding:0!important}
.personal-v2-history-full .personal-history-card .section-head{display:none}
.personal-v2-history-full .row{min-width:0}
.personal-v2-history-full .row-value .flex{flex-wrap:wrap;gap:8px}
.personal-v2-transactions .personal-v2-history-header {flex-wrap:wrap}
.personal-v2-history-rows {min-width:0}
.personal-v2-history-toggle {display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;
  border-top:1px solid var(--border)!important;padding:13px 6px 2px!important;font-weight:750}
.personal-v2-history-toggle svg {transition:transform .18s ease}
.personal-v2-history-toggle svg.is-expanded {transform:rotate(-90deg)}

/* Personal v3: account tabs, modelled after Wimm Pro's compact menu. */
.personal-v3-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;
 padding:6px;border-radius:22px;border:1px solid color-mix(in srgb,var(--border) 65%,transparent);
 background:color-mix(in srgb,var(--surface) 92%,transparent);box-shadow:var(--wimm-card-shadow);
 -webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);min-width:0}
.personal-v3-nav button{display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;
 gap:9px;padding:14px 4px;border:1px solid transparent;border-radius:17px;background:transparent;
 color:var(--muted);font-size:.76rem;font-weight:750;cursor:pointer}
.personal-v3-nav button svg{flex:none}
.personal-v3-nav button.active{background:var(--wimm-blue-wash);color:var(--accent-deep);
 border-color:color-mix(in srgb,var(--action) 13%,transparent)}
.personal-v3-nav button:focus-visible{outline:2px solid var(--action);outline-offset:2px}
.personal-v3-month-picker{margin:0;width:100%;min-width:0}
.personal-v3-page-heading{display:grid;gap:5px;padding:4px 2px}
.personal-v3-page-heading>span{font-size:.7rem;font-weight:800;letter-spacing:.11em;color:var(--muted)}
.personal-v3-page-heading>h2{margin:0;color:var(--ink);font-size:clamp(1.4rem,4vw,1.85rem);letter-spacing:-.03em}
.personal-v3-page-heading>p{margin:0;color:var(--muted);font-size:.8rem;line-height:1.45}
.personal-v3-panel-head{display:flex;align-items:center;gap:11px;min-height:78px;padding:17px 18px}
.personal-v3-panel-head>.personal-v2-panel-copy{flex:1}
.personal-v3-panel-head>.personal-v2-panel-side{margin-left:auto}
.personal-v3-transaction-filters{display:grid;gap:11px;padding:6px 0 9px}
.personal-v3-search input{width:100%;min-width:0;min-height:45px;padding:11px 14px;
 background:var(--surface);border:1px solid var(--border);border-radius:13px;color:var(--ink);font:inherit;font-size:.85rem}
.personal-v3-selects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.personal-v3-selects .field{min-width:0}
.personal-v3-selects select{width:100%;min-width:0}
@media(max-width:560px){
 .personal-v3-nav{gap:2px;padding:4px;border-radius:19px}
 .personal-v3-nav button{gap:7px;padding:13px 1px;font-size:.65rem;border-radius:15px}
 .personal-v3-nav button svg{width:19px;height:19px}
 .personal-v3-panel-head{padding:14px 12px}
 .personal-v3-selects{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:reduce){.personal-v3-nav button{transition:none}}

.personal-v2-privacy-note {color:var(--muted);font-size:.73rem;line-height:1.45;margin:0}
@media(max-width:560px){
 .personal-page-v2{gap:14px}
 .personal-page-v2 .personal-v2-hero {padding:20px;gap:14px;border-radius:21px}
 .personal-v2-amount>strong {font-size:2.35rem}
 .personal-v2-totals {gap:9px}
 .personal-v2-totals strong{font-size:.94rem}
 .personal-v2-quick-actions{gap:9px;grid-template-columns:repeat(2,minmax(0,1fr))}
 .personal-v2-quick-actions button:last-child{grid-column:1/-1}
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

.personal-projection-interactive{display:grid;gap:9px;min-width:0}
.personal-projection-chart{height:255px;min-width:0;width:100%;touch-action:pan-y;cursor:crosshair}
.personal-projection-chart:focus-visible{outline:2px solid var(--wimm-blue);outline-offset:3px;border-radius:8px}
.personal-projection-readout{border-top:1px solid var(--border);padding-top:13px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.personal-projection-readout span{font-size:.8rem;color:var(--muted)}
.personal-projection-readout strong{font-size:1.14rem;color:var(--ink);font-weight:850;font-variant-numeric:tabular-nums;text-align:right}
.personal-projection-help{margin:0;font-size:.7rem;line-height:1.45;color:var(--muted)}
@media(max-width:560px){.personal-projection-chart{height:226px}.personal-projection-readout strong{font-size:1rem}}

/* Cash and real spending are separate from future budget projections. */
.personal-v2-cash-accounts,
.personal-v2-month-estimate {display:grid;gap:8px;padding:13px 17px;margin:12px 0;border-radius:16px;background:var(--surface);border:1px solid var(--border);min-width:0}
.personal-v2-cash-accounts .row{min-height:0;margin:0}
.personal-v2-cash-accounts .text{justify-self:start;display:inline-flex;align-items:center;gap:7px;min-height:32px;font-size:.73rem}
.personal-v2-month-estimate>span{font-size:.8rem;color:var(--muted)}
.personal-v2-month-estimate>strong{font-size:clamp(1.35rem,5vw,1.75rem);font-weight:850;font-variant-numeric:tabular-nums}
.personal-v2-month-estimate>small{font-size:.71rem;color:var(--muted);line-height:1.5}
.personal-budget-expenses{display:grid;gap:4px;padding:9px;margin:7px 0 2px;border-radius:12px;background:var(--surface);border:1px solid var(--border)}
.personal-budget-expenses .row{min-height:0;padding:7px 0}
.personal-budget-swipe-row .progress{margin:7px 0}
.personal-budget-swipe-row .text{justify-self:start}

/* Budgets personnels : cartes compactes, même logique que les enveloppes du foyer. */
.personal-v2-budget-panel .personal-budgets-card {display:grid;gap:12px;min-width:0}
.personal-v2-budget-panel .personal-budgets-card .section-head p {margin:3px 0 0}
.personal-budget-overview {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;min-width:0}
.personal-budget-overview > div {display:grid;gap:5px;min-width:0;padding:12px 10px;border:1px solid var(--border);border-radius:13px;background:var(--surface)}
.personal-budget-overview > div > span {font-size:.7rem;color:var(--muted)}
.personal-budget-overview > div > strong {font-size:clamp(.86rem,3.3vw,1.13rem);font-weight:820;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;color:var(--ink)}
.personal-budget-overview .positive-money {color:var(--wimm-green)}
.personal-budget-overview .negative-money {color:var(--wimm-coral)}
.personal-budget-grid {display:grid;gap:10px;min-width:0}
.personal-v2-budget-panel .personal-budget-swipe-row {min-width:0}
.personal-v2-budget-panel .personal-budget-swipe-row .swipe-actions-content {padding-right:34px}
.personal-budget-item {min-width:0;border:1px solid var(--border);border-radius:16px;background:var(--surface);overflow:hidden}
.personal-budget-item-main {display:grid;gap:9px;width:100%;min-width:0;padding:12px 9px 12px 13px;background:transparent;border:0;text-align:left;cursor:pointer;color:var(--ink);font:inherit}
.personal-budget-item-main:hover {background:color-mix(in srgb,var(--wimm-blue-wash) 28%,var(--surface))}
.personal-budget-item-main:focus-visible {outline:2px solid var(--action);outline-offset:-3px}
.personal-budget-item-head {display:flex;align-items:center;gap:9px;min-width:0;padding-right:12px}
.personal-budget-item-head > strong {font-size:.85rem;flex:1;min-width:0;overflow-wrap:anywhere}
.personal-budget-item-glyph {display:grid;place-items:center;width:33px;height:33px;flex:0 0 33px;border-radius:11px;color:var(--wimm-blue);background:var(--wimm-blue-wash)}
.personal-budget-chevron {color:var(--muted);flex-shrink:0;transition:transform .17s ease}
.personal-budget-chevron.expanded {transform:rotate(90deg)}
.personal-budget-item-amounts {display:flex;justify-content:space-between;gap:10px;align-items:flex-end}
.personal-budget-item-amounts > span {display:grid;gap:2px;min-width:0}
.personal-budget-item-amounts > span:last-child {text-align:right}
.personal-budget-item-amounts strong {font-size:clamp(.96rem,3.4vw,1.13rem);font-variant-numeric:tabular-nums;color:var(--ink)}
.personal-budget-item-amounts strong.positive-money {color:var(--wimm-green)}
.personal-budget-item-amounts strong.negative-money {color:var(--wimm-coral)}
.personal-budget-item-amounts small {font-size:.68rem;color:var(--muted)}
.personal-budget-bar {display:block;min-width:0}
.personal-budget-bar .progress {margin:0}
.personal-budget-item-foot {font-size:.69rem;color:var(--muted);padding-top:2px}
.personal-budget-item.is-inactive {opacity:.75}
.personal-budget-details {display:grid;gap:6px;padding:11px 12px 13px;border-top:1px solid var(--border);min-width:0}
.personal-budget-detail-heading {display:flex;justify-content:space-between;align-items:center;gap:8px}
.personal-budget-detail-heading > strong {font-size:.75rem;color:var(--ink)}
.personal-v2-panel-content .personal-budget-detail-heading > button {font-size:.68rem;min-height:30px;display:inline-flex;align-items:center;gap:4px}
.personal-budget-transaction {display:flex;align-items:center;gap:9px;padding:8px 0;border-top:1px solid var(--border);min-width:0}
.personal-budget-transaction > span {min-width:0;flex:1;display:grid;gap:3px}
.personal-budget-transaction > span > strong {font-size:.73rem;overflow-wrap:anywhere}
.personal-budget-transaction > span > small {font-size:.67rem;color:var(--muted)}
.personal-budget-transaction > strong {font-size:.74rem;font-variant-numeric:tabular-nums;white-space:nowrap}
.personal-v2-budget-panel .personal-budget-transaction > .icon {padding:7px;min-width:32px;min-height:32px}
@media(max-width:850px) and (pointer:coarse) {
 .personal-v2-budget-panel .personal-budget-swipe-row .swipe-actions-content {padding-right:0}
 .personal-v2-budget-panel .personal-budget-item-main {padding-right:13px}
 .personal-v2-budget-panel .personal-budget-item-head {padding-right:0}
}
@media(max-width:390px){
 .personal-budget-overview {gap:5px}
 .personal-budget-overview > div {padding:10px 6px}
 .personal-budget-item-main {padding:10px}
}


/* Personal v4: compact overview with the same hierarchy as the shared account. */
.personal-page-v2 .personal-v2-hero{gap:12px;padding:18px 20px;border-radius:20px}
.personal-v2-hero-header{gap:7px}
.personal-v2-account{font-size:.84rem}
.personal-v2-private{padding:5px 8px}
.personal-v2-amount{gap:2px}
.personal-v2-amount>strong{font-size:clamp(2.15rem,6.3vw,2.65rem);line-height:1.05}
.personal-page-v2 .personal-v2-cash-accounts{
  gap:0;padding:0;margin:0;background:transparent;border:0;border-radius:0
}
.personal-page-v2 .personal-v2-cash-accounts .row{min-height:0;padding:6px 0}
.personal-page-v2 .personal-v2-cash-accounts .text{
  justify-self:start;min-height:0;padding:4px 0;font-size:.73rem
}
.personal-page-v2 .personal-v2-month-estimate{
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;
  gap:7px;padding:10px 12px;margin:0;border-radius:12px
}
.personal-v4-estimate-label{display:inline-flex;align-items:center;min-width:0;gap:5px}
.personal-v4-estimate-label>span{font-size:.76rem;color:var(--muted)}
.personal-page-v2 .personal-v2-month-estimate>strong{font-size:1.21rem;line-height:1.2;white-space:nowrap}
.personal-page-v2 .personal-v2-totals{gap:10px;padding-top:10px}
.personal-page-v2 .personal-v2-totals>div{gap:2px}
.personal-page-v2 .personal-v2-totals strong{font-size:.95rem}
.personal-page-v2 .personal-v2-totals span{font-size:.66rem}
.personal-v4-estimate-label .block-info,.personal-v2-privacy-note .block-info{
  width:27px;height:27px;min-width:27px;padding:4px;display:inline-grid;place-items:center;flex:none
}

/* Same crisp white transaction cards as the common account; dark mode retains its themed surface. */
:root:not([data-mode="dark"]) .personal-page-v2 .personal-v2-transactions{
  background:#fff!important;border-color:var(--border)!important
}
:root:not([data-mode="dark"]) .personal-v2-transactions .transaction-swipe-row .swipe-actions-content{
  background:#fff!important
}
:root[data-mode="dark"] .personal-page-v2 .personal-v2-transactions{
  background:var(--surface)!important;border-color:var(--border)!important
}
.personal-page-v2 .personal-v2-history{padding:15px 17px;gap:9px}
.personal-page-v2 .personal-v2-history-header{gap:5px}
.personal-page-v2 .personal-v2-history-header>h2{font-size:.9rem}
.personal-page-v2 .personal-v2-history-header>span{font-size:.7rem}
.personal-page-v2 .personal-v2-history-toggle{margin-top:2px}

/* Transactions: one search bar + two actions; filters stay tucked away until requested. */
.personal-page-v2 .personal-v4-search-panel{
  padding:15px!important;background:var(--surface);border-radius:19px;
  box-shadow:var(--wimm-card-shadow);min-width:0
}
.personal-v4-search-top{gap:9px}
.personal-v4-search-top .transaction-search-input{min-height:43px;min-width:0}
.personal-v4-search-top .transaction-search-input input{font-size:.82rem;padding:10px 0}
.personal-v4-search-top>button{min-height:42px;font-size:.8rem;padding:9px 12px}
.personal-v4-filter-grid{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
  gap:11px;margin-top:13px;padding-top:12px;border-top:1px solid var(--border)
}
.personal-v4-filter-grid .field{margin:0;min-width:0}
.personal-v4-filter-grid .field select{width:100%;min-width:0;font-size:.8rem;padding:10px}
.personal-v4-clear-filters{grid-column:1/-1;justify-self:start;min-height:30px;font-size:.76rem}
.personal-page-v2 .personal-v4-full-history{gap:6px}
.personal-page-v2 .personal-v4-full-history>p:first-child{padding:0}
.personal-page-v2 .personal-v4-full-history .list-sort{margin:0 0 5px}

/* Explanatory paragraphs now live inside the standard accessible information modal. */
.personal-v2-panel-content .section-head>div:first-child:has(>.block-info){
  display:flex;flex-wrap:wrap;align-items:center;gap:4px 7px
}
.personal-v2-panel-content .section-head>div:first-child:has(>.block-info)>h2{
  margin:0;min-width:0
}
.personal-v2-panel-content .section-head .block-info{
  display:inline-grid;place-items:center;min-width:28px;width:28px;height:28px;
  padding:5px;flex:none
}
.personal-v2-privacy-note{display:flex;align-items:center;justify-content:center;gap:5px;font-size:.72rem}
.personal-v2-privacy-note .block-info{vertical-align:middle}

@media(max-width:640px){
  .personal-v4-search-top{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .personal-v4-search-top .transaction-search-input{grid-column:1/-1;min-height:43px}
  .personal-v4-search-top>button{min-width:0;width:100%;font-size:.79rem}
}
@media(max-width:560px){
  .personal-page-v2 .personal-v2-hero{padding:16px 17px;gap:10px}
  .personal-v2-amount>strong{font-size:2.2rem}
  .personal-page-v2 .personal-v2-totals{gap:9px}
  .personal-page-v2 .personal-v2-history{padding:14px 14px}
  .personal-v4-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
}
@media(max-width:360px){.personal-v4-filter-grid{grid-template-columns:1fr}}

`;
export default function PersonalPageStyles(){return <style data-wimm-personal="v2">{styles}</style>;}
