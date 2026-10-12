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
`;
export default function DataProtectionStyles(){return <style data-wimm-data-security="v1">{styles}</style>;}
