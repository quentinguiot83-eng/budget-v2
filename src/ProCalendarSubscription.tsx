import { useEffect, useState } from "react";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import { rpc } from "./api";

export default function ProCalendarSubscription({ businessId }: { businessId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let current = true;
    rpc("budget_pro_calendar_subscription", { p_business_id: businessId }).then(data => { if (current) setToken(data.token); }).catch(e => { if (current) setError(e.message.includes("initialisée") ? "L’abonnement doit être activé dans Supabase avec le script 09-pro-calendar-subscriptions.sql." : e.message); }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [businessId]);
  async function change(action: "create" | "rotate" | "revoke") {
    if (action !== "create" && !window.confirm(action === "revoke" ? "Désactiver le lien ? Les calendriers abonnés ne recevront plus les mises à jour. Les événements déjà récupérés peuvent rester visibles." : "Remplacer le lien ? Il faudra réabonner Google ou Apple avec le nouveau lien.")) return;
    setBusy(true); setError(""); setNotice("");
    try { const data = await rpc("budget_pro_calendar_subscription", { p_business_id: businessId, p_action: action }); setToken(data.token); setNotice(action === "revoke" ? "Lien désactivé." : action === "rotate" ? "Nouveau lien créé. Réabonne ton calendrier avec ce lien." : "Lien créé."); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de mettre à jour le lien."); }
    finally { setBusy(false); }
  }
  const url = token ? `${window.location.origin}/api/calendar?token=${token}` : "";
  async function copy() {
    try { await navigator.clipboard.writeText(url); setNotice("Lien copié."); }
    catch { setError("Sélectionne le lien ci-dessous pour le copier manuellement."); }
  }
  return <div className="prosuite-form prosuite-calendar-subscription">
    <div className="prosuite-formtitle"><span>AGENDA PRO</span><h2>Relier mon calendrier</h2><p>Retrouve les événements de cette entreprise dans Google Agenda ou Calendrier Apple.</p></div>
    <p>Les changements se font dans Wimm. Google et Apple récupèrent ensuite les mises à jour selon leur propre délai.</p>
    {error && <div className="prosuite-error" role="alert">{error}</div>}
    {notice && <div className="prosuite-notice" role="status">{notice}</div>}
    {busy && <p role="status">Chargement…</p>}
    {!token ? <button type="button" className="prosuite-btn" disabled={busy || !!error} onClick={() => void change("create")}><Link2 size={16}/> Créer mon lien d’abonnement</button> : <>
      <label>Lien personnel<input readOnly value={url} onFocus={e => e.currentTarget.select()}/></label>
      <div className="prosuite-actions"><button type="button" className="prosuite-btn" disabled={busy} onClick={() => void copy()}><Copy size={16}/> Copier le lien</button><a className="prosuite-btn secondary" href={url.replace(/^https?:/, "webcal:")} referrerPolicy="no-referrer"><ExternalLink size={16}/> Ouvrir Calendrier Apple</a></div>
      <div className="prosuite-calendar-help"><strong>Google Agenda</strong><p>Sur ordinateur : Autres agendas → + → À partir de l’URL. Colle le lien puis ajoute l’agenda.</p><strong>Apple / iCloud</strong><p>Dans Calendrier Apple : Calendriers → Ajouter un calendrier → Ajouter un calendrier avec abonnement. Colle le lien et choisis le compte iCloud pour le retrouver sur tes appareils. Sur Mac : Fichier → Nouvel abonnement à un calendrier.</p></div>
      <p className="prosuite-calendar-private">Toute personne ayant ce lien peut lire les titres, horaires et lieux. Les notes et fiches clients restent dans Wimm.</p>
      <div className="prosuite-actions"><button type="button" className="prosuite-btn secondary" disabled={busy} onClick={() => void change("rotate")}>Remplacer le lien</button><button type="button" className="prosuite-btn secondary" disabled={busy} onClick={() => void change("revoke")}>Désactiver le lien</button></div>
    </>}
  </div>;
}
