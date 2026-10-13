import { Capacitor } from "@capacitor/core";

const PREFIX = "wimm-ios-face-id-v1:";

export function isNativeWimmIos(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export function faceIdEnabledForUser(userId: string | null): boolean {
  if (!userId || !isNativeWimmIos()) return false;
  try {
    return localStorage.getItem(PREFIX + userId) === "on";
  } catch {
    return false;
  }
}

export function setFaceIdEnabledForUser(userId: string, enabled: boolean): void {
  if (!userId || !isNativeWimmIos()) return;
  if (enabled) localStorage.setItem(PREFIX + userId, "on");
  else localStorage.removeItem(PREFIX + userId);
  window.dispatchEvent(new Event("wimm-ios-face-id-changed"));
}

export async function getFaceIdAvailability(): Promise<{ available: boolean; deviceSecure: boolean; reason: string }> {
  if (!isNativeWimmIos()) return { available: false, deviceSecure: false, reason: "Disponible uniquement dans Wimm pour iPhone." };
  const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
  const info = await BiometricAuth.checkBiometry();
  return {
    available: info.isAvailable,
    deviceSecure: info.deviceIsSecure,
    reason: info.isAvailable ? "" : (info.reason || "Configure Face ID dans les réglages de ton iPhone."),
  };
}

/**
 * Déverrouillage local uniquement : ne remplace jamais la connexion Supabase.
 * iOS tente Face ID en premier, puis peut proposer le code de déverrouillage.
 */
export async function authenticateWimmLocally(): Promise<void> {
  if (!isNativeWimmIos()) throw Error("Face ID n'est pas disponible sur le Web.");
  const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
  await BiometricAuth.authenticate({
    reason: "Déverrouiller Wimm et accéder à tes finances",
    cancelTitle: "Annuler",
    allowDeviceCredential: true,
    iosFallbackTitle: "Utiliser le code de l’iPhone",
  });
}
