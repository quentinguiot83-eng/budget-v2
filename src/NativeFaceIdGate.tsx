import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { LockKeyhole } from "lucide-react";
import { api } from "./api";
import {
  authenticateWimmLocally,
  faceIdEnabledForUser,
  isNativeWimmIos,
} from "./nativeFaceId";

type Phase = "checking" | "open" | "locked";
const isIos = isNativeWimmIos();

function SecureCover({ locked, busy, error, onUnlock, onSignOut }: {
  locked: boolean;
  busy: boolean;
  error: string;
  onUnlock: () => void;
  onSignOut: () => void;
}) {
  return <main className="wimm-native-face-gate" role="main" aria-label="Verrouillage de Wimm">
    <div className="wimm-native-face-gate-content">
      <div className="wimm-native-face-gate-symbol"><LockKeyhole size={36} strokeWidth={1.65}/></div>
      <h1>Wimm</h1>
      <p>{locked ? "Protégé par Face ID" : "Ouverture sécurisée…"}</p>
      {locked && <>
        <button className="primary" type="button" onClick={onUnlock} disabled={busy}>
          {busy ? "Identification en cours…" : "Déverrouiller avec Face ID"}
        </button>
        {error && <p role="alert" className="wimm-native-face-gate-error">{error}</p>}
        <button type="button" className="wimm-native-face-gate-logout" onClick={onSignOut} disabled={busy}>
          Se déconnecter de Wimm
        </button>
      </>}
    </div>
  </main>;
}

export default function NativeFaceIdGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(isIos ? "checking" : "open");
  const [started, setStarted] = useState(!isIos);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tryCount, setTryCount] = useState(0);
  const active = useRef(true);
  const wasBackgrounded = useRef(false);
  const authenticating = useRef(false);
  const uid = useRef<string | null>(null);

  const unlock = useCallback(async () => {
    if (authenticating.current || !active.current || !uid.current || !faceIdEnabledForUser(uid.current))
      return;
    authenticating.current = true;
    setBusy(true);
    setError("");
    const expectedUser = uid.current;
    try {
      await authenticateWimmLocally();
      // Never unlock an account other than the one whose Face ID prompt succeeded.
      if (uid.current === expectedUser) setPhase("open");
    } catch (e) {
      setError("Identification non validée. Réessaie ou utilise le code de ton iPhone.");
      console.warn("Wimm Face ID unlock unsuccessful", e instanceof Error ? e.name : "unknown");
    } finally {
      authenticating.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!isIos) return;
    let disposed = false;
    let appListener: PluginListenerHandle | null = null;
    const privacyCover = () => document.documentElement.classList.add("wimm-ios-hiding-for-privacy");
    const removePrivacyCover = () => document.documentElement.classList.remove("wimm-ios-hiding-for-privacy");

    const lockIfNecessary = () => {
      if (!faceIdEnabledForUser(uid.current)) return;
      privacyCover();
      setPhase("locked");
    };
    const onActivity = (isActive: boolean) => {
      // iOS may briefly deactivate the WebView while Face ID is on screen.
      // Do not mistake that for the user leaving the app.
      if (!isActive && authenticating.current) return;
      active.current = isActive;
      if (!isActive) {
        wasBackgrounded.current = true;
        lockIfNecessary();
      } else {
        removePrivacyCover();
        if (wasBackgrounded.current && !authenticating.current) {
          wasBackgrounded.current = false;
          if (faceIdEnabledForUser(uid.current)) {
            setPhase("locked");
            setTryCount(n => n + 1);
          }
        }
      }
    };
    const onVisibility = () => onActivity(document.visibilityState === "visible");

    const authListener = api.auth.onAuthStateChange((event, session) => {
      if (disposed) return;
      if (event === "SIGNED_OUT") {
        uid.current = null;
        setUserId(null);
        setError("");
        setPhase("open");
        removePrivacyCover();
      } else if (event === "SIGNED_IN" && session?.user.id && uid.current !== session.user.id) {
        uid.current = session.user.id;
        setUserId(session.user.id);
        setError("");
        setPhase(faceIdEnabledForUser(session.user.id) ? "locked" : "open");
      }
    });

    void (async () => {
      try {
        const { data } = await api.auth.getSession();
        if (disposed) return;
        const id = data.session?.user.id ?? null;
        uid.current = id;
        setUserId(id);
        setPhase(faceIdEnabledForUser(id) ? "locked" : "open");
      } catch {
        if (!disposed) setPhase("open");
      } finally {
        if (!disposed) setStarted(true);
      }
    })();

    void CapacitorApp.addListener("appStateChange", event => {
      if (!disposed) onActivity(event.isActive);
    }).then(listener => {
      if (disposed) void listener.remove();
      else appListener = listener;
    }).catch(e => console.warn("Wimm iOS activity listener unavailable", e));
    document.addEventListener("visibilitychange", onVisibility);
    const onSettingChanged = () => {
      if (!faceIdEnabledForUser(uid.current)) {
        setError("");
        setPhase("open");
      }
    };
    window.addEventListener("wimm-ios-face-id-changed", onSettingChanged);
    return () => {
      disposed = true;
      authListener.data.subscription.unsubscribe();
      if (appListener) void appListener.remove();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("wimm-ios-face-id-changed", onSettingChanged);
      removePrivacyCover();
    };
  }, []);

  useEffect(() => {
    if (phase !== "locked" || !started || !active.current) return;
    // The content is replaced by the lock screen, so the blank privacy cover
    // used during app suspension can be removed safely.
    document.documentElement.classList.remove("wimm-ios-hiding-for-privacy");
    void unlock();
  }, [phase, started, tryCount, userId, unlock]);

  async function signOut() {
    if (busy) return;
    try {
      await api.auth.signOut();
      uid.current = null;
      setPhase("open");
      setError("");
    } catch {
      setError("Déconnexion indisponible. Réessaie après avoir vérifié ta connexion.");
    }
  }

  if (!isIos) return <>{children}</>;
  if (!started) return <SecureCover locked={false} busy={false} error="" onUnlock={() => {}} onSignOut={() => {}}/>;
  return <>
    {/* Conserver l'état des formulaires pendant un simple verrouillage. */}
    <div className="wimm-native-protected-content" style={{ display: phase === "open" ? "contents" : "none" }}>
      {children}
    </div>
    {phase === "locked" && <SecureCover locked busy={busy} error={error}
      onUnlock={() => { setTryCount(n => n + 1); }} onSignOut={() => void signOut()} />}
  </>;
}
