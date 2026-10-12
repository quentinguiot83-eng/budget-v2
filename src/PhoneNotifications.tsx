import { BlockInfo } from "./ui";
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { api, rpc } from "./api";
import { pushAlerts } from "./pushAlerts";
import type { State } from "./engine";

function decodeVapidPublicKey(value: string) {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  let binary = "";
  try {
    binary = atob(padded);
  } catch {
    throw Error("La clé de notifications du serveur est invalide. Recharge Wimm puis réessaie.");
  }
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw Error("La clé de notifications du serveur est invalide. Recharge Wimm puis réessaie.");
  }
  return bytes;
}

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
  const [dailyReminder, setDailyReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [reminderTimezone, setReminderTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris"; }
    catch { return "Europe/Paris"; }
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/push-config");
        if (!response.ok) throw Error("Impossible de vérifier les notifications.");
        const next = await response.json();
        if (cancelled) return;
        setConfig(next);
        if (!supported) return;
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          const status = await rpc("budget_push_device", { p_subscription: subscription.toJSON(), p_action: "status" });
          const reminder = status.enabled
            ? await rpc("budget_push_reminder", { p_subscription: subscription.toJSON(), p_action: "status" })
            : null;
          if (!cancelled) {
            setDeviceId(status.id ?? null);
            setEnabled(!!status.enabled);
            setBudgets(status.budgets ?? true);
            setDues(status.dues ?? true);
            setDailyReminder(reminder?.dailyReminder ?? false);
            if (reminder?.time) setReminderTime(reminder.time);
            if (reminder?.timezone) setReminderTimezone(reminder.timezone);
          }
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
      const key = decodeVapidPublicKey(config.publicKey);
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const saved = await rpc("budget_push_device", { p_subscription: subscription.toJSON(), p_budgets: budgets, p_dues: dues,
        p_baseline: pushAlerts(state).filter(a => a.kind === "budgets").map(a => a.key) });
      setDeviceId(saved.id); setEnabled(true);
      await rpc("budget_push_reminder", {
        p_subscription: subscription.toJSON(),
        p_action: "save",
        p_enabled: dailyReminder,
        p_time: reminderTime,
        p_timezone: reminderTimezone,
      });
      setMessage(dailyReminder
        ? "Préférences enregistrées. Le rappel quotidien est activé sur cet appareil."
        : "Notifications activées sur cet appareil.");
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
      setEnabled(false); setDailyReminder(false); setMessage("Notifications désactivées sur cet appareil.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Désactivation impossible."); }
    finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setMessage("");
    try {
      const { data } = await api.auth.getSession();
      if (!data.session) throw Error("Reconnecte-toi pour envoyer un test.");
      const response = await fetch("/api/push-test?device=" + encodeURIComponent(deviceId || ""), { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const raw = await response.text();
      let result: { sent?: number; failed?: number; error?: string; code?: string };
      try {
        result = JSON.parse(raw);
      } catch {
        throw Error(`Le serveur de notifications a répondu avec une erreur (${response.status}). Recharge Wimm puis réessaie.`);
      }
      if (!response.ok || result.failed) throw Error(result.code ? `${result.error || "Le test n’a pas pu être envoyé."} (${result.code})` : result.error || "Le test n’a pas pu être envoyé.");
      setMessage(result.sent ? "Notification de test envoyée. Vérifie ton téléphone." : "Test déjà envoyé récemment. Réessaie dans une minute.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Test indisponible."); }
    finally { setBusy(false); }
  }
  return <section className="card">
    <div className="section-head"><div className="block-title"><h2><Bell size={20} /> Notifications sur téléphone</h2><BlockInfo title="Notifications sur téléphone"><p className="muted">Choisis les alertes à recevoir sur cet appareil, même quand Wimm est fermée.</p><p className="muted">Les alertes de dépenses fixes sont envoyées le jour de l’échéance. Le rappel de saisie est indépendant des autres alertes, facultatif et limité à une fois par jour. Il utilise l’heure locale de cet appareil.</p></BlockInfo></div></div>
    
    {ios && !standalone ? <p>Dans Safari, ouvre Partager → Ajouter à l’écran d’accueil. Ouvre ensuite Wimm depuis sa nouvelle icône pour activer les notifications.</p>
      : !supported ? <p>Ce navigateur ne permet pas les notifications. Essaie depuis l’application Wimm ajoutée à l’écran d’accueil ou un navigateur compatible.</p>
      : <>
        {config && !config.ready && <p className="muted">Les notifications téléphone seront disponibles une fois leur activation terminée.</p>}
        <label className="check-row"><input type="checkbox" checked={budgets} onChange={e => setBudgets(e.target.checked)} disabled={busy} /> Dépassements de budget</label>
        <label className="check-row"><input type="checkbox" checked={dues} onChange={e => setDues(e.target.checked)} disabled={busy} /> Dépenses fixes à valider et factures Pro à suivre</label>
        <div className="wimm-daily-reminder-settings">
          <label className="check-row">
            <input type="checkbox" checked={dailyReminder} onChange={e => setDailyReminder(e.target.checked)} disabled={busy} />
            <span><strong>Rappel quotidien de saisie</strong><small>Penser à enregistrer les transactions de la journée</small></span>
          </label>
          {dailyReminder && (
            <div className="wimm-daily-reminder-time">
              <label htmlFor="wimm-daily-reminder-time">Heure du rappel</label>
              <input id="wimm-daily-reminder-time" type="time" value={reminderTime}
                onChange={e => setReminderTime(e.target.value)} disabled={busy} required />
              <small>Une notification par jour sur cet appareil · fuseau : {reminderTimezone.replaceAll("_"," ")}.</small>
            </div>
          )}
        </div>
        
        <div className="flex">
          <button className="primary" disabled={busy || !config?.ready} onClick={() => void save()}>{busy ? "Patiente…" : enabled ? "Enregistrer mes choix" : "Activer sur cet appareil"}</button>
          {enabled && <><button className="secondary" disabled={busy} onClick={() => void test()}>Envoyer un test</button><button className="text" disabled={busy} onClick={() => void disable()}><BellOff size={16} /> Désactiver</button></>}
        </div>
      </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
