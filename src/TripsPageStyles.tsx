const styles=String.raw`
/* Onglet Voyages : styles locaux co-déployés avec la page pour iOS/PWA. */
.trips-page-v2{display:grid;gap:18px;min-width:0}
.trips-page-v2>*{min-width:0}
.trips-top-actions{display:flex;align-items:center;justify-content:space-between;gap:13px;flex-wrap:wrap}
.trips-top-actions>p{margin:0;color:var(--muted);font-size:.84rem;line-height:1.4}
.trips-top-actions>button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;border-radius:13px;padding:10px 15px;font-size:.84rem;font-weight:750}
.trips-section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.trips-section-heading>strong{color:var(--muted);font-size:.72rem;font-weight:810;letter-spacing:.095em;text-transform:uppercase}
.trips-active-picker{display:grid;gap:9px;min-width:0}
.trips-page-v2 .trip-tabs{display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;overscroll-behavior-x:contain;max-width:100%;padding:7px;border-radius:16px;background:var(--wimm-mint-wash);border:1px solid color-mix(in srgb,var(--wimm-mint) 20%,var(--border))}
.trips-page-v2 .trip-tabs button{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;max-width:230px;overflow:hidden;text-overflow:ellipsis;min-height:39px;white-space:nowrap;border-radius:11px;font-size:.8rem;font-weight:730;padding:8px 13px;color:var(--muted);background:transparent;border:1px solid transparent}
.trips-page-v2 .trip-tabs button.selected{color:var(--wimm-green);background:var(--surface);border-color:color-mix(in srgb,var(--wimm-mint) 25%,var(--border));box-shadow:0 3px 9px rgba(26,72,57,.07)}
.trips-page-v2 .trip-tabs button:focus-visible{outline:2px solid var(--wimm-green);outline-offset:2px}
.trips-archive-picker{border:1px solid var(--border);border-radius:13px;background:var(--surface);min-width:0}
.trips-archive-picker>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:11px 14px;color:var(--muted);font-size:.78rem;font-weight:750}
.trips-archive-picker>summary::-webkit-details-marker{display:none}
.trips-archive-picker>summary svg:last-child{margin-left:auto;transition:transform .16s}
.trips-archive-picker[open]>summary svg:last-child{transform:rotate(90deg)}
.trips-archive-picker .trip-tabs{border:0;border-radius:0;background:var(--surface);padding:8px 10px 12px}
.trips-v2-hero{display:flex;align-items:center;gap:14px;min-width:0;padding:18px 20px;border-radius:21px;border:1px solid color-mix(in srgb,var(--wimm-mint) 25%,var(--border));background:linear-gradient(114deg,var(--wimm-mint-wash),var(--surface) 59%,var(--wimm-blue-wash));box-shadow:var(--wimm-card-shadow);overflow:hidden}
.trips-v2-hero::after{display:none}
.trips-v2-hero .trip-icon{width:51px;height:51px;flex:0 0 51px;border-radius:15px;display:grid;place-items:center;background:color-mix(in srgb,var(--wimm-mint) 18%,var(--surface));color:var(--wimm-green)}
.trips-v2-hero .trip-icon svg{width:27px;height:27px}
.trips-v2-hero .trips-hero-content{flex:1;min-width:0;display:grid;gap:5px}
.trips-v2-hero .trips-hero-content h2{margin:0;font-size:clamp(1.25rem,3vw,1.65rem);font-weight:860;letter-spacing:-.035em;line-height:1.2;overflow-wrap:anywhere}
.trips-v2-hero .trips-hero-content p{color:var(--muted);margin:0;font-size:.8rem;line-height:1.35}
.trips-v2-hero .trips-hero-status{color:var(--wimm-green);font-size:.65rem;letter-spacing:.07em;font-weight:820;text-transform:uppercase}
.trips-v2-hero>.icon{flex:0 0 38px;width:38px;height:38px;padding:9px;display:grid;place-items:center;border-radius:12px;background:var(--surface);border:1px solid var(--border);color:var(--ink)}
.trips-overview-card{display:grid;gap:15px;padding:21px 22px;border-radius:22px;background:var(--surface);border:1px solid var(--border);box-shadow:var(--wimm-card-shadow)}
.trips-overview-card h2,.trips-financing-card h2,.trips-categories-card h2{font-size:1.03rem;line-height:1.3;margin:0;font-weight:840;letter-spacing:-.015em}
.trips-budget-header{display:flex;align-items:flex-end;justify-content:space-between;gap:15px;flex-wrap:wrap}
.trips-budget-header>div{display:grid;gap:7px}
.trips-budget-spent{font-size:clamp(1.65rem,5vw,2.25rem);font-weight:860;line-height:1.16;color:var(--ink);letter-spacing:-.045em;font-variant-numeric:tabular-nums}
.trips-budget-target{font-size:.81rem;color:var(--muted);font-weight:680;padding-bottom:3px}
.trips-overview-card>.progress{margin:0}
.trips-budget-footer{display:flex;align-items:center;justify-content:space-between;gap:13px;flex-wrap:wrap}
.trips-budget-rest{color:var(--wimm-green);font-weight:730;font-size:.84rem}
.trips-budget-rest.negative{color:var(--wimm-coral)}
.trips-budget-footer button{display:inline-flex;align-items:center;gap:8px;min-height:40px;border-radius:12px;padding:10px 13px;font-size:.79rem;font-weight:780}
.trips-financing-card{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:17px 20px;min-width:0;border-radius:20px;border:1px solid color-mix(in srgb,var(--wimm-lavender) 18%,var(--border));background:linear-gradient(114deg,var(--wimm-lavender-wash),var(--surface));box-shadow:var(--wimm-card-shadow)}
.trips-finance-copy{display:grid;gap:7px;flex:1;min-width:0}
.trips-finance-value{font-size:1.4rem;line-height:1.15;font-weight:825;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.trips-finance-copy>p{color:var(--muted);font-size:.75rem;line-height:1.4;margin:0}
.trips-finance-copy>small{color:var(--ink);font-size:.75rem;line-height:1.3}
.trips-financing-card>button{flex:0 0 auto;display:flex;gap:7px;align-items:center;justify-content:center;min-height:41px;padding:10px 13px;border-radius:12px;font-size:.78rem;font-weight:750;white-space:nowrap}
.trips-categories-card{padding:20px 22px;border-radius:22px;display:grid;gap:12px;background:var(--surface);border:1px solid var(--border);box-shadow:var(--wimm-card-shadow)}
.trips-categories-card .section-head{margin:0;display:flex;gap:10px;align-items:center;justify-content:space-between}
.trips-categories-card .section-head>button{padding:8px 10px;display:inline-flex;gap:6px;align-items:center;font-size:.76rem;color:var(--wimm-green);font-weight:760}
.trips-category-list{display:grid;gap:0;min-width:0}
.trips-category-list .trip-category{border-radius:0;border-bottom:1px solid var(--border);padding:14px 0;display:grid;gap:10px}
.trips-category-list .trip-category:last-child{border-bottom:0}
.trips-category-top{display:flex;align-items:center;gap:10px;min-width:0}
.trips-category-name{font-size:.85rem;font-weight:750;flex:1;min-width:0;overflow-wrap:anywhere;color:var(--ink)}
.trips-category-amount{font-size:.78rem;font-weight:760;font-variant-numeric:tabular-nums;color:var(--ink);text-align:right}
.trips-category-amount small{color:var(--muted);font-size:.72rem;font-weight:500}
.trips-category-actions{display:flex;align-items:center;gap:3px}
.trips-category-actions .icon{width:32px;height:32px;flex:0 0 32px;display:grid;place-items:center;padding:7px;color:var(--muted);border-radius:9px}
.trips-category-actions .icon:hover{background:var(--wimm-mint-wash);color:var(--wimm-green)}
.trips-category-list .trip-category .progress{margin:0}
.trips-category-sub{font-size:.71rem;color:var(--muted);line-height:1.35}
.trips-category-sub.negative{color:var(--wimm-coral)}
.trips-unallocated{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--border);padding-top:13px;font-size:.78rem;color:var(--muted)}
.trips-unallocated strong{font-variant-numeric:tabular-nums;color:var(--ink)}
.trips-empty-categories{font-size:.78rem;color:var(--muted);padding:10px 0;line-height:1.5}
.trips-disclosure{border:1px solid var(--border);background:var(--surface);border-radius:19px;overflow:hidden;box-shadow:var(--wimm-card-shadow)}
.trips-disclosure>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;min-height:66px;padding:16px 19px}
.trips-disclosure>summary::-webkit-details-marker{display:none}
.trips-disclosure>summary .trips-disclosure-icon{display:grid;place-items:center;width:40px;height:40px;flex:0 0 40px;border-radius:13px;background:var(--wimm-blue-wash);color:var(--wimm-blue)}
.trips-disclosure>summary .trips-disclosure-copy{display:grid;gap:5px;flex:1;min-width:0}
.trips-disclosure>summary strong{font-size:.87rem;color:var(--ink);line-height:1.3}
.trips-disclosure>summary small{font-size:.73rem;color:var(--muted);line-height:1.35}
.trips-disclosure>summary>svg:last-child{color:var(--muted);transition:transform .16s}
.trips-disclosure[open]>summary>svg:last-child{transform:rotate(90deg)}
.trips-disclosure-content{display:grid;gap:15px;padding:4px 19px 20px;border-top:1px solid var(--border)}
.trips-disclosure-content h3{font-size:.85rem;margin:13px 0 4px}
.trips-disclosure-content>.trips-disclosure-section{min-width:0}
.trips-disclosure-content .rule-row{max-width:100%}
.trips-management-card>summary .trips-disclosure-icon{background:var(--wimm-lavender-wash);color:var(--wimm-lavender)}
.trips-management-content>p{margin:12px 0 0;font-size:.76rem;line-height:1.5;color:var(--muted)}
.trips-management-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:7px}
.trips-management-actions button{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 13px;font-size:.78rem;border-radius:11px}
.trips-management-actions .danger-text{color:var(--wimm-coral)}
@media(max-width:720px){
 .trips-page-v2{gap:15px}
 .trips-overview-card,.trips-categories-card{padding:17px 16px}
 .trips-v2-hero{padding:16px}
 .trips-financing-card{padding:16px;flex-direction:column;align-items:stretch}
 .trips-financing-card>button{align-self:flex-start}
}
@media(max-width:560px){
 .trips-top-actions{flex-wrap:nowrap}
 .trips-top-actions>p{font-size:.75rem}
 .trips-top-actions>button{padding:10px 12px;min-height:40px;white-space:nowrap;font-size:.75rem}
 .trips-v2-hero .trip-icon{width:43px;height:43px;flex-basis:43px}
 .trips-v2-hero .trip-icon svg{width:23px;height:23px}
 .trips-v2-hero{gap:11px}
 .trips-v2-hero .trips-hero-content h2{font-size:1.3rem}
 .trips-v2-hero .trips-hero-content p{font-size:.71rem}
 .trips-overview-card{gap:13px}
 .trips-budget-header{flex-wrap:nowrap;align-items:end}
 .trips-budget-spent{font-size:1.9rem}
 .trips-budget-target{font-size:.74rem;text-align:right}
 .trips-budget-footer{align-items:flex-start}
 .trips-budget-footer button{font-size:.75rem}
 .trips-category-top{gap:7px;flex-wrap:wrap}
 .trips-category-name{flex:1 1 42%}
 .trips-category-amount{font-size:.73rem}
 .trips-category-actions{flex:0 0 auto}
 .trips-category-actions .icon{width:28px;height:28px;flex-basis:28px;padding:6px}
 .trips-section-heading>strong{font-size:.68rem}
}
@media(prefers-reduced-motion:reduce){.trips-disclosure>summary>svg:last-child,.trips-archive-picker>summary svg:last-child{transition:none}}
`;
export default function TripsPageStyles(){return <style data-wimm-trips="v2">{styles}</style>;}
