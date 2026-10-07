import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { api, rpc } from "./api";
import { pushAlerts } from "./pushAlerts";
import type { State } from "./engine";

export async function dispatchPhoneAlerts() {
  try {
    const { data } = await api.auth.getSession();
    if (!data.session) return;
    await fetch("/api/push?action=dispatch", { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(15000) });
  } catch { /* Notification delivery must never fail a budget save. The daily worker catches missed alerts. */ }
}

export default function PhoneNotifications({ state }: { state: State }) {
  const [config, setConfig] = useState<{ ready: boolean; publicKey: string | null } | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [budgets, setBudgets] = useState(true);
  const [dues, setDues] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/push?action=config");
        if (!response.ok) throw Error("Impossible de vérifier les notifications.");
        const next = await response.json();
        if (cancelled) return;
        setConfig(next);
        if (!supported) return;
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          const status = await rpc("budget_push_device", { p_subscription: subscription.toJSON(), p_action: "status" });
          if (!cancelled) { setDeviceId(status.id ?? null); setEnabled(!!status.enabled); setBudgets(status.budgets ?? true); setDues(status.dues ?? true); }
        }
      } catch (e) { if (!cancelled) setMessage(e instanceof Error ? e.message : "Vérification indisponible."); }
    })();
    return () => { cancelled = true; };
  }, [supported]);

  async function save() {
    if (!config?.ready || !config.publicKey || busy) return;
    setBusy(true); setMessage("");
    try {
      // Keep the permission request directly inside the tap handler for iOS.
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw Error("Autorise les notifications pour Wimm dans les réglages de ton téléphone, puis réessaie.");
      await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const saved = await rpc("budget_push_device", { p_subscription: subscription.toJSON(), p_budgets: budgets, p_dues: dues,
        p_baseline: pushAlerts(state).filter(a => a.kind === "budgets").map(a => a.key) });
      setDeviceId(saved.id); setEnabled(true); setMessage("Notifications activées sur cet appareil.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Activation impossible."); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await rpc("budget_push_device", { p_subscription: subscription.toJSON(), p_action: "delete" });
        await subscription.unsubscribe();
      }
      setEnabled(false); setMessage("Notifications désactivées sur cet appareil.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Désactivation impossible."); }
    finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setMessage("");
    try {
      const { data } = await api.auth.getSession();
      if (!data.session) throw Error("Reconnecte-toi pour envoyer un test.");
      const response = await fetch("/api/push?action=test&device=" + encodeURIComponent(deviceId || ""), { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const result = await response.json();
      if (!response.ok || result.failed) throw Error(result.error || "Le test n’a pas pu être envoyé.");
      setMessage(result.sent ? "Notification de test envoyée. Vérifie ton téléphone." : "Test déjà envoyé récemment. Réessaie dans une minute.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Test indisponible."); }
    finally { setBusy(false); }
  }
  return <section className="card">
    <h2><Bell size={20} /> Notifications sur téléphone</h2>
    <p className="muted">Choisis les alertes à recevoir sur cet appareil, même quand Wimm est fermée.</p>
    {ios && !standalone ? <p>Dans Safari, ouvre Partager → Ajouter à l’écran d’accueil. Ouvre ensuite Wimm depuis sa nouvelle icône pour activer les notifications.</p>
      : !supported ? <p>Ce navigateur ne permet pas les notifications. Essaie depuis l’application Wimm ajoutée à l’écran d’accueil ou un navigateur compatible.</p>
      : <>
        {config && !config.ready && <p className="muted">Les notifications téléphone seront disponibles une fois leur activation terminée.</p>}
        <label className="check-row"><input type="checkbox" checked={budgets} onChange={e => setBudgets(e.target.checked)} disabled={busy} /> Dépassements de budget</label>
        <label className="check-row"><input type="checkbox" checked={dues} onChange={e => setDues(e.target.checked)} disabled={busy} /> Échéances à payer et factures Pro à suivre</label>
        <p className="muted">Une alerte par catégorie et par mois. Les échéances en attente sont signalées le matin, sans répétition quotidienne.</p>
        <div className="flex">
          <button className="primary" disabled={busy || !config?.ready} onClick={() => void save()}>{busy ? "Patiente…" : enabled ? "Enregistrer mes choix" : "Activer sur cet appareil"}</button>
          {enabled && <><button className="secondary" disabled={busy} onClick={() => void test()}>Envoyer un test</button><button className="text" disabled={busy} onClick={() => void disable()}><BellOff size={16} /> Désactiver</button></>}
        </div>
      </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
