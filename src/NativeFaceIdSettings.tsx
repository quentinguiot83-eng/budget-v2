import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import {
  authenticateWimmLocally,
  faceIdEnabledForUser,
  getFaceIdAvailability,
  isNativeWimmIos,
  setFaceIdEnabledForUser,
} from "./nativeFaceId";

export default function NativeFaceIdSettings({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(() => faceIdEnabledForUser(userId));
  const [available, setAvailable] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isNativeWimmIos()) return;
    setEnabled(faceIdEnabledForUser(userId));
    let active = true;
    void getFaceIdAvailability().then(result => {
      if (active) {
        setAvailable(result.available);
        setReason(result.reason);
      }
    }).catch(() => {
      if (active) { setAvailable(false); setReason("Impossible de vérifier Face ID sur cet iPhone."); }
    });
    return () => { active = false; };
  }, [userId]);

  if (!isNativeWimmIos()) return null;

  async function toggle() {
    if (busy || available === null || !userId) return;
    if (!enabled && !available) return;
    setBusy(true);
    setMessage("");
    try {
      // Toujours exiger une confirmation native pour activer ET pour désactiver.
      await authenticateWimmLocally();
      setFaceIdEnabledForUser(userId, !enabled);
      setEnabled(!enabled);
      setMessage(enabled
        ? "Verrouillage Face ID désactivé sur cet iPhone."
        : "Face ID activé : Wimm demandera une identification à la prochaine ouverture.");
    } catch {
      setMessage("Identification annulée ou impossible. Aucune modification enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="wimm-native-face-setting">
    <div className="section-head"><div className="block-title">
      <h3><Fingerprint size={19} /> Verrouillage de Wimm</h3>
    </div></div>
    <p className="muted">Protège l'affichage de tes budgets et de ton patrimoine avec Face ID, ou le code de ton iPhone en secours.</p>
    {available === false && !enabled && <p className="muted">{reason}</p>}
    <label className="check-row">
      <input type="checkbox" checked={enabled} disabled={busy || available === null || (!enabled && !available)}
        onChange={() => void toggle()} />
      Demander Face ID à l'ouverture et au retour dans Wimm
    </label>
    {enabled && <p className="muted">Face ID protège l'ouverture locale de l'application. Il ne remplace pas la connexion à ton compte Wimm.</p>}
    {message && <p role="status">{message}</p>}
  </div>;
}
