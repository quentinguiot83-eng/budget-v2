/**
 * Release version from package.json, injected by Vite at build time.
 * Build metadata changes automatically on every Vercel compilation.
 * Keep the release version in package.json / package-lock.json in sync
 * with each deliberate release.
 */
declare const __WIMM_APP_VERSION__: string;
declare const __WIMM_BUILD_SHA__: string;
declare const __WIMM_BUILD_TIMESTAMP__: string;

export const APP_VERSION = __WIMM_APP_VERSION__;
export const APP_VERSION_LABEL = `v${APP_VERSION.replace("-beta.", " bêta ")}`;
export const APP_BUILD_SHA = __WIMM_BUILD_SHA__ === "local" ? "local" : __WIMM_BUILD_SHA__.slice(0, 8);
export const APP_BUILD_AT = __WIMM_BUILD_TIMESTAMP__;
export const APP_BUILD_ID = `${APP_BUILD_AT.replace(/[-:TZ.]/g, "").slice(0, 14)}-${APP_BUILD_SHA}`;

export const APP_BUILD_DATE_LABEL = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
}).format(new Date(APP_BUILD_AT));
