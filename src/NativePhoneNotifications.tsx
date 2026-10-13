import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { BlockInfo } from "./ui";
import type { State } from "./engine";
import {
  readNativeNotificationSettings,
  requestNativeNotificationPermission,
  sendNativeTestNotification,
  syncNativeNotifications,
  writeNativeNotificationSettings,
} from "./nativeNotifications";

export default function NativePhoneNotifications({ state, userId }: { state: State; userId: string }) {
  const [options, setOptions] = useState(() => readNativeNotificationSettings(userId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [permission, setPermission] = useState("unknown");

  useEffect(() => {
    setOptions(readNativeNotificationSettings(userId));
    let alive = true;
    void import("@capacitor/local-notifications").then(({ LocalNotifications }) =>
      LocalNotifications.checkPermissions()).then(result => {
        if (alive) setPermission(result.display);
      }).catch(() => { if (alive) setPermission("unknown"); });
    return () => { alive = false; };
  }, [userId]);

  async function save() {
    if (!userId || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (!options.fixedDues && !options.dailyReminder)
        throw Error("Choisis au moins un type de rappel.");
      const granted = await requestNativeNotificationPermission();
      setPermission(granted ? "granted" : "denied");
      if (!granted)
        throw Error("Notifications refusées. Active-les dans Réglages → Notifications → Wimm.");
      const next = { ...options, enabled: true };
      writeNativeNotificationSettings(userId, next);
      setOptions(next);
      const count = await syncNativeNotifications(userId, state);
      setMessage("Rappels activés sur cet iPhone (" + count + " notification(s) programmée(s)).");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const next = { ...options, enabled: false };
      writeNativeNotificationSettings(userId, next);
      setOptions(next);
      await syncNativeNotifications(userId, state);
      setMessage("Les rappels iPhone programmés par Wimm ont été annulés.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Désactivation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage("");
    try {
      await sendNativeTestNotification();
      setMessage("Test programmé dans 10 secondes. Verrouille ton iPhone pour le vérifier.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test indisponible.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="card">
    <div className="section-head"><div className="block-title">
      <h2><Bell size={20} /> Notifications iPhone</h2>
      <BlockInfo title="Rappels natifs iOS">
        <p>Les rappels sont programmés sur cet iPhone. Ils peuvent s'afficher même lorsque Wimm est fermée.</p>
        <p>Les dépenses fixes sont programmées à 9 h sur les 45 prochains jours, puis actualisées à l'ouverture de Wimm et après modification des données.</p>
        <p>Le nom d'une dépense fixe peut apparaître sur l'écran verrouillé. Les alertes de budgets dépassés et les factures Pro ne sont pas encore proposées en notifications locales.</p>
      </BlockInfo>
    </div></div>
    <p className="muted">Réglages propres à cet appareil. Aucune inscription à un service de notifications push n'est nécessaire.</p>
    <label className="check-row">
      <input type="checkbox" checked={options.fixedDues} disabled={busy}
        onChange={e => setOptions(current => ({ ...current, fixedDues: e.target.checked }))} />
      Dépenses fixes et mensualités de crédit à valider (9 h)
    </label>
    <div className="wimm-daily-reminder-settings">
      <label className="check-row">
        <input type="checkbox" checked={options.dailyReminder} disabled={busy}
          onChange={e => setOptions(current => ({ ...current, dailyReminder: e.target.checked }))} />
        <span><strong>Rappel quotidien de saisie</strong><small>Enregistrer les transactions de la journée</small></span>
      </label>
      {options.dailyReminder && <div className="wimm-daily-reminder-time">
        <label htmlFor="wimm-native-daily-time">Heure du rappel</label>
        <input id="wimm-native-daily-time" type="time" value={options.reminderTime}
          disabled={busy} onChange={e => setOptions(current => ({ ...current, reminderTime: e.target.value }))} />
        <small>Une notification chaque jour, selon l'heure locale de ton iPhone.</small>
      </div>}
    </div>
    <div className="flex">
      <button className="primary" disabled={busy} onClick={() => void save()}>
        {busy ? "Patiente…" : options.enabled ? "Enregistrer mes choix" : "Activer les notifications"}
      </button>
      {options.enabled && <>
        <button className="secondary" disabled={busy || permission !== "granted"} onClick={() => void test()}>
          Envoyer un test
        </button>
        <button className="text" disabled={busy} onClick={() => void disable()}>
          <BellOff size={16} /> Désactiver
        </button>
      </>}
    </div>
    {permission === "denied" && <p className="muted">Les notifications sont bloquées dans les réglages iOS.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
