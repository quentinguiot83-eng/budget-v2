// Styles critiques de Patrimoine gardés avec le composant React pour que
// l'interface et son rendu se mettent à jour ensemble sur iOS/PWA.
const styles = String.raw`/* Patrimoine v2 — chiffres du foyer, puis comptes en premier, sans cartes géantes. */
.wealth-page-v2 {
  display:grid;
  grid-template-columns:minmax(0,1fr);
  gap:clamp(15px,2.8vw,23px);
  min-width:0;
}
.wealth-total-card {
  min-width:0; display:grid; gap:12px;
  padding:clamp(21px,3.6vw,30px);
  border-radius:24px; border:1px solid color-mix(in srgb,var(--wimm-mint) 25%,var(--border));
  background:linear-gradient(115deg,var(--wimm-mint-wash),var(--surface) 62%,var(--wimm-lavender-wash));
  box-shadow:var(--wimm-card-shadow);
}
.wealth-total-header { display:flex;justify-content:space-between;align-items:flex-start;gap:15px; }
.wealth-total-header>.block-title {display:flex;align-items:center;gap:8px;min-width:0;color:var(--ink);}
.wealth-total-header>.block-title>span {font-size:.89rem;font-weight:750;color:var(--muted);}
.wealth-total-header>.block-title .block-info {flex-shrink:0;}
.wealth-total-header>svg {color:var(--wimm-green);flex-shrink:0;}
.wealth-total-amount {
  font-size:clamp(2rem,4vw,2.8rem);letter-spacing:-.055em;line-height:1.2;
  color:var(--ink);font-weight:850;font-variant-numeric:tabular-nums;
  overflow-wrap:anywhere;
}
.wealth-total-card>p {color:var(--muted);font-size:.75rem;margin:0;line-height:1.5;}
.wealth-breakdown {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}
.wealth-breakdown-card {
  display:flex;flex-direction:column;align-items:flex-start;gap:9px;
  min-width:0; min-height:132px; padding:18px 19px; border-radius:20px;
  border:1px solid var(--border);box-shadow:var(--wimm-card-shadow);
}
.wealth-breakdown-travel {
  background:linear-gradient(140deg,var(--wimm-mint-wash),var(--surface));
  border-color:color-mix(in srgb,var(--wimm-mint) 22%,var(--border));
}
.wealth-breakdown-current {
  background:linear-gradient(140deg,var(--wimm-lavender-wash),var(--surface));
  border-color:color-mix(in srgb,var(--wimm-lavender) 20%,var(--border));
}
.wealth-breakdown-travel>svg {color:var(--wimm-green);}
.wealth-breakdown-current>svg {color:var(--wimm-lavender);}
.wealth-breakdown-card>span {font-size:.79rem;color:var(--muted);font-weight:650;}
.wealth-breakdown-card>strong {
  font-size:clamp(1.15rem,2.2vw,1.6rem);line-height:1.2;letter-spacing:-.04em;
  font-weight:820;color:var(--ink);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;
}
.wealth-breakdown-card>small {color:var(--muted);font-size:.7rem;line-height:1.35;}
.wealth-breakdown-card>.text {display:inline-flex;gap:3px;align-items:center;padding:0;font-size:.75rem;color:var(--wimm-green);font-weight:750;}
.wealth-page-v2 .savings-wealth-panel {margin:0;}
.wealth-page-v2 .savings-wealth-summary {padding:16px 20px;}
.wealth-page-v2 .savings-wealth-summary-right>strong {font-size:.81rem;}
.wealth-page-v2 .savings-wealth-heading>strong {font-size:.91rem;}
.wealth-page-v2 .savings-wealth-heading>small {font-size:.74rem;}
.wealth-savings-empty {
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:17px 20px!important;border-radius:19px;
  background:linear-gradient(115deg,var(--surface),color-mix(in srgb,var(--wimm-mint-wash) 40%,var(--surface)));
  box-shadow:var(--wimm-card-shadow);
}
.wealth-savings-empty-copy {display:grid;gap:6px;min-width:0;}
.wealth-savings-empty .block-title {display:flex;align-items:center;gap:7px;}
.wealth-savings-empty .block-title h2 {margin:0;font-size:.95rem;font-weight:800;}
.wealth-savings-empty p {margin:0;color:var(--muted);line-height:1.45;font-size:.77rem;}
.wealth-savings-empty small {font-size:.73rem;color:var(--wimm-green);font-weight:750;}
.wealth-savings-configure {
  display:inline-flex;align-items:center;justify-content:center;gap:4px;
  flex:0 0 auto;border-radius:12px;border:1px solid color-mix(in srgb,var(--wimm-green) 24%,var(--border));
  background:var(--wimm-mint-wash);padding:10px 12px;color:var(--wimm-green);
  font-size:.77rem;font-weight:800;text-align:center;
}
.wealth-accounts-section {min-width:0;display:grid;gap:12px;}
.wealth-accounts-heading {margin:0;align-items:center;gap:13px;}
.wealth-accounts-heading h2 {margin:0 0 3px;font-size:1.1rem;letter-spacing:-.025em;}
.wealth-accounts-heading p {margin:0;font-size:.74rem;line-height:1.4;}
.wealth-add-account {display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;border-radius:13px;padding:9px 14px;white-space:nowrap;font-size:.78rem;}
.wealth-accounts-list {
  display:block;min-width:0;
  border:1px solid var(--border);border-radius:20px;background:var(--surface);
  box-shadow:var(--wimm-card-shadow);overflow:hidden;
}
/* Un SwipeActions par compte : le séparateur est porté par son conteneur. */
.wealth-accounts-list > .account-swipe-row {
  display:block;margin:0;min-width:0;border-bottom:1px solid var(--border);
}
.wealth-accounts-list > .account-swipe-row:last-child {border-bottom:0;}
.wealth-accounts-list > .account-swipe-row > .swipe-actions-content {min-width:0;}
.wealth-account-row {display:block;min-width:0;margin:0;background:transparent;}
.wealth-account-row:not([open]) > .wealth-account-expanded {display:none!important;}
.wealth-account-row + .wealth-account-row {border-top:0;}
.wealth-account-summary {
  display:flex;align-items:center;gap:13px;list-style:none;cursor:pointer;
  min-width:0;min-height:73px;padding:12px 18px;
  -webkit-tap-highlight-color:transparent;transition:background .15s ease;
}
.wealth-account-summary::-webkit-details-marker {display:none;}
.wealth-account-summary::marker {content:"";}
.wealth-account-summary:hover {background:color-mix(in srgb,var(--wimm-mint-wash) 35%,var(--surface));}
.wealth-account-summary:focus-visible {outline:2px solid var(--wimm-green);outline-offset:-3px;}
.wealth-account-icon {
  width:42px;height:42px;flex:0 0 42px;border-radius:13px;
  display:grid;place-items:center;color:var(--wimm-lavender);background:var(--wimm-lavender-wash);
}
.wealth-account-current .wealth-account-icon {color:var(--wimm-blue);background:var(--wimm-blue-wash);}
.wealth-account-travel .wealth-account-icon {color:var(--wimm-green);background:var(--wimm-mint-wash);}
.wealth-account-name {flex:1;min-width:0;display:grid;gap:5px;}
.wealth-account-name strong {font-size:.89rem;font-weight:790;color:var(--ink);overflow-wrap:anywhere;line-height:1.32;}
.wealth-account-name small {font-size:.72rem;color:var(--muted);line-height:1.32;}
.wealth-account-balance {text-align:right;max-width:45%;font-size:1rem;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ink);overflow-wrap:anywhere;}
.wealth-account-chevron {flex:0 0 auto;color:var(--muted);transition:transform .18s ease;}
.wealth-account-row[open] .wealth-account-chevron {transform:rotate(90deg);}
.wealth-account-row[open] .wealth-account-summary {background:color-mix(in srgb,var(--wimm-mint-wash) 26%,var(--surface));}
.wealth-account-expanded {
  display:grid;gap:11px;padding:4px 18px 17px 73px;
  border-top:1px solid color-mix(in srgb,var(--border) 60%,transparent);
}
.wealth-account-expanded>p {margin:4px 0 0;font-size:.77rem;}
.wealth-account-expanded>small {font-size:.73rem;color:var(--muted);}
.wealth-account-cap {display:grid;gap:6px;max-width:420px;}
.wealth-account-cap .progress {margin:0;}
.wealth-account-cap small {font-size:.72rem;color:var(--muted);}
.wealth-account-actions {display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.wealth-account-actions button {
  display:inline-flex;align-items:center;justify-content:center;gap:5px;
  padding:8px 11px;font-size:.74rem;min-height:35px;
  border-radius:10px;
}
.wealth-account-actions .text {padding:8px 5px;}
.wealth-account-empty {padding:18px;margin:0;}
.wealth-projection-link {
  display:flex;align-items:center;text-align:left;width:100%;gap:14px;
  border-radius:18px;border:1px solid color-mix(in srgb,var(--wimm-lavender) 20%,var(--border));
  background:linear-gradient(110deg,var(--wimm-lavender-wash),var(--surface));
  padding:15px 18px;color:var(--ink);box-shadow:var(--wimm-card-shadow);
}
.wealth-projection-link:hover {border-color:color-mix(in srgb,var(--wimm-lavender) 50%,var(--border));}
.wealth-projection-link:focus-visible {outline:2px solid var(--wimm-lavender);outline-offset:3px;}
.wealth-projection-icon {display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;background:var(--surface);border-radius:13px;color:var(--wimm-lavender);}
.wealth-projection-text {display:grid;gap:4px;flex:1;min-width:0;}
.wealth-projection-text strong {font-size:.85rem;font-weight:800;}
.wealth-projection-text small {font-size:.74rem;color:var(--muted);line-height:1.35;}
.wealth-projection-link>svg {color:var(--wimm-lavender);flex-shrink:0;}
@media(max-width:560px) {
  .wealth-page-v2 {gap:16px;}
  .wealth-total-card {padding:20px;gap:10px;border-radius:21px;}
  .wealth-total-amount {font-size:clamp(1.8rem,7vw,2.4rem);}
  .wealth-total-card>p {font-size:.7rem;}
  .wealth-breakdown {gap:9px;}
  .wealth-breakdown-card {padding:13px;gap:8px;min-height:128px;border-radius:17px;}
  .wealth-breakdown-card>strong {font-size:clamp(1rem,4.2vw,1.32rem);}
  .wealth-breakdown-card>span {font-size:.73rem;}
  .wealth-breakdown-card>small {font-size:.66rem;}
  .wealth-savings-empty {flex-direction:column;align-items:stretch;gap:11px;padding:15px!important;}
  .wealth-savings-configure {align-self:flex-start;}
  .wealth-accounts-heading h2 {font-size:1.02rem;}
  .wealth-accounts-heading p {font-size:.7rem;}
  .wealth-add-account {padding:8px 11px;}
  .wealth-account-summary {padding:12px 11px;gap:9px;min-height:74px;}
  .wealth-account-icon {width:36px;height:36px;flex-basis:36px;border-radius:12px;}
  .wealth-account-icon>svg {width:19px;height:19px;}
  .wealth-account-name strong {font-size:.79rem;}
  .wealth-account-name small {font-size:.68rem;}
  .wealth-account-balance {font-size:.83rem;max-width:47%;}
  .wealth-account-chevron {width:15px;height:15px;}
  .wealth-account-expanded {padding:8px 12px 15px;gap:10px;}
  .wealth-account-actions button {font-size:.72rem;}
}
@media(prefers-reduced-motion:reduce) {
  .wealth-account-chevron,.wealth-account-summary {transition:none;}
}
`;

export default function WealthPageStyles() {
  return <style data-wimm-wealth="v2">{styles}</style>;
}
