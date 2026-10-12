const styles = String.raw`
.wimm-data-security{display:grid;gap:18px;border:1px solid color-mix(in srgb,var(--wimm-mint) 23%,var(--border));
border-radius:21px;padding:20px 22px;background:linear-gradient(115deg,var(--wimm-mint-wash),var(--surface) 42%);box-shadow:var(--wimm-card-shadow)}
.wimm-data-security-head{display:flex;align-items:flex-start;gap:13px}
.wimm-security-symbol{display:grid;place-items:center;width:45px;height:45px;flex:0 0 45px;border-radius:14px;background:var(--wimm-mint-wash);color:var(--wimm-green)}
.wimm-data-security-head h2{margin:2px 0 5px;font-size:1.05rem;font-weight:830}
.wimm-data-security-head p{margin:0;color:var(--muted);font-size:.8rem;line-height:1.5}
.wimm-security-row{padding:15px;border:1px solid var(--border);border-radius:15px;background:var(--surface);display:grid;gap:11px;min-width:0}
.wimm-security-row-heading{display:flex;align-items:center;gap:11px;min-width:0}
.wimm-security-row-heading>svg{flex:0 0 20px;color:var(--wimm-lavender)}
.wimm-security-row-heading>div{display:grid;gap:4px;min-width:0}
.wimm-security-row-heading strong{font-size:.87rem;color:var(--ink);font-weight:790}
.wimm-security-row-heading small{font-size:.73rem;color:var(--muted)}
.wimm-security-actions{display:flex;gap:9px;flex-wrap:wrap}
.wimm-security-actions button{display:inline-flex;gap:7px;align-items:center;justify-content:center;min-height:40px;padding:9px 12px;border:1px solid var(--border);border-radius:11px;background:var(--wimm-blue-wash);color:var(--ink);font-size:.77rem;font-weight:750}
.wimm-security-actions button:hover:not(:disabled){background:var(--wimm-mint-wash)}
.wimm-security-actions button:disabled{opacity:.58;cursor:not-allowed}
.wimm-security-explainer{display:flex;align-items:flex-start;gap:10px}
.wimm-security-explainer>svg{flex:0 0 17px;color:var(--wimm-green);margin-top:2px}
.wimm-security-explainer p{font-size:.75rem;line-height:1.55;color:var(--muted);margin:0}
.wimm-security-explainer strong{color:var(--ink)}
.wimm-security-success{margin:0;border:1px solid color-mix(in srgb,var(--wimm-green) 25%,var(--border));border-radius:11px;color:var(--wimm-green);background:var(--wimm-mint-wash);padding:10px;font-size:.78rem}
@media(max-width:570px){
 .wimm-data-security{padding:16px 13px;gap:13px}
 .wimm-data-security-head{gap:9px}
 .wimm-security-symbol{width:38px;height:38px;flex-basis:38px}
 .wimm-security-row{padding:12px}
 .wimm-security-actions button{flex:1 1 auto;font-size:.75rem}
}

.wimm-security-verify-action{display:inline-flex;align-items:center;justify-content:center;gap:9px;
  justify-self:start;cursor:pointer;border:1px solid color-mix(in srgb,var(--wimm-green) 25%,var(--border));
  background:var(--wimm-mint-wash);color:var(--wimm-green);padding:11px 13px;
  border-radius:11px;font-weight:770;font-size:.78rem;position:relative}
.wimm-security-verify-action input[type=file]{position:absolute;inset:0;width:100%;height:100%;
  opacity:0;cursor:pointer}
.wimm-security-verify-action:focus-within{outline:2px solid var(--wimm-green);outline-offset:2px}
.wimm-security-validation{display:grid;gap:5px;border:1px solid color-mix(in srgb,var(--wimm-green) 28%,var(--border));
 background:var(--wimm-mint-wash);padding:12px;border-radius:11px}
.wimm-security-validation strong{font-size:.8rem;color:var(--wimm-green)}
.wimm-security-validation span{font-size:.75rem;color:var(--ink);line-height:1.4}
.wimm-security-validation span.wimm-security-foreign{color:var(--wimm-coral);font-weight:750}
.wimm-security-validation small{font-size:.7rem;color:var(--muted);line-height:1.5}
.wimm-security-comparison{display:grid;gap:5px;margin-top:5px;padding:12px;
 border:1px solid var(--border);border-radius:10px;background:var(--surface)}
.wimm-security-comparison strong{font-size:.76rem;color:var(--ink)}
.wimm-security-comparison span{font-size:.73rem;color:var(--muted);line-height:1.4}

@media(max-width:560px){.wimm-security-verify-action{justify-self:stretch}}

.wimm-history{display:grid;gap:14px;padding:21px 22px;border:1px solid var(--border);
 border-radius:20px;background:var(--surface);box-shadow:var(--wimm-card-shadow)}
.wimm-history-title{display:flex;align-items:flex-start;gap:12px}
.wimm-history-title h3{font-size:1.05rem;letter-spacing:-.015em;margin:2px 0 5px;color:var(--ink);font-weight:830}
.wimm-history-title p{margin:0;color:var(--muted);font-size:.78rem;line-height:1.45}
.wimm-history-group{border:1px solid var(--border);border-radius:15px;overflow:hidden;background:var(--surface)}
.wimm-history-group>summary{display:flex;align-items:center;gap:11px;list-style:none;cursor:pointer;
 min-height:68px;padding:13px 14px}
.wimm-history-group>summary::-webkit-details-marker{display:none}
.wimm-history-group>summary:focus-visible{outline:2px solid var(--wimm-green);outline-offset:-2px}
.wimm-history-group>summary>svg:last-child{flex:0 0 auto;color:var(--muted);transition:transform .18s}
.wimm-history-group[open]>summary>svg:last-child{transform:rotate(90deg)}
.wimm-history-icon{height:38px;width:38px;flex:0 0 38px;display:grid;place-items:center;
 border-radius:12px;background:var(--wimm-blue-wash);color:var(--wimm-blue)}
.wimm-history-group:nth-of-type(2) .wimm-history-icon{background:var(--wimm-lavender-wash);color:var(--wimm-lavender)}
.wimm-history-caption{flex:1;min-width:0;display:grid;gap:4px}
.wimm-history-caption strong{font-size:.86rem;color:var(--ink)}
.wimm-history-caption small{font-size:.71rem;color:var(--muted);line-height:1.35}
.wimm-history-items{border-top:1px solid var(--border);display:grid;gap:0;padding:8px 13px 13px}
.wimm-history-refresh{justify-self:start;display:flex;align-items:center;gap:7px;min-height:36px;
 padding:8px;font-size:.72rem;font-weight:770;color:var(--wimm-green)}
.wimm-history-version{display:flex;align-items:center;gap:10px;border-top:1px solid var(--border);padding:13px 0}
.wimm-history-version-copy{display:grid;gap:4px;flex:1;min-width:0}
.wimm-history-version-copy strong{font-size:.79rem;color:var(--ink)}
.wimm-history-version-copy small{font-size:.71rem;color:var(--muted);line-height:1.38}
.wimm-history-pick{display:inline-flex;align-items:center;gap:6px;justify-content:center;min-height:36px;
 padding:8px 10px;border-radius:10px;font-size:.74rem;font-weight:760;
 background:var(--wimm-lavender-wash);border:1px solid color-mix(in srgb,var(--wimm-lavender) 22%,var(--border));
 color:var(--wimm-lavender)}
.wimm-history-pick:disabled{opacity:.43;cursor:not-allowed}
.wimm-history-confirm{border:1px solid color-mix(in srgb,var(--wimm-coral) 32%,var(--border));
 background:var(--wimm-coral-wash);border-radius:15px;padding:15px;display:grid;gap:11px}
.wimm-history-confirm>strong{font-size:.91rem;color:var(--ink)}
.wimm-history-confirm>p{margin:0;color:var(--ink);line-height:1.55;font-size:.76rem}
.wimm-history-confirm>label{color:var(--ink);font-size:.76rem;font-weight:710}
.wimm-history-confirm>input{width:100%;box-sizing:border-box;padding:12px;border:1px solid var(--border);
 border-radius:10px;background:var(--surface);color:var(--ink);font-size:1rem}
.wimm-history-confirm-actions{display:flex;gap:9px;flex-wrap:wrap}
.wimm-history-confirm-actions>button{min-height:40px;padding:10px 14px;border-radius:10px;font-size:.77rem;font-weight:760}
.wimm-history-confirm-actions>button:disabled{opacity:.5;cursor:not-allowed}
.wimm-history-note{font-size:.72rem;color:var(--muted);line-height:1.5;margin:0}
@media(max-width:570px){
 .wimm-history{padding:16px 13px}
 .wimm-history-title{gap:9px}
 .wimm-history-group>summary{padding:12px 10px;gap:8px}
 .wimm-history-icon{height:34px;width:34px;flex-basis:34px}
 .wimm-history-items{padding:8px 10px}
 .wimm-history-version{gap:7px}
 .wimm-history-pick{font-size:.7rem;padding:7px 8px}
 .wimm-history-confirm-actions>button{flex:1 1 130px}
}
@media(prefers-reduced-motion:reduce){.wimm-history-group>summary>svg:last-child{transition:none}}
`;
export default function DataProtectionStyles(){return <style data-wimm-data-security="v1">{styles}</style>;}
