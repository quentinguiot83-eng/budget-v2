import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Trip } from "./engine";

export const TRIP_COVERS_BUCKET = "wimm-trip-covers";
const PHOTO_MAX_BYTES = 20 * 1024 * 1024;
const PHOTO_TARGET_SIDE = 1800;

/**
 * A signed URL is short-lived and never persisted into a household's JSON budget.
 * Access to the private Storage bucket is gated by household membership (SQL policy).
 */
export function useTripCoverUrls(trips: Trip[], householdId: string | undefined, enabled: boolean) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = useMemo(
    () => trips.map(t => t.coverPath).filter((p): p is string => !!p).sort().join("\n"),
    [trips],
  );
  useEffect(() => {
    let canceled = false;
    if (!enabled || !householdId || !paths) { setUrls({}); return; }
    const validPaths = paths.split("\n").filter(path => path.startsWith(householdId + "/"));
    Promise.all(validPaths.map(async path => {
      const { data, error } = await api.storage.from(TRIP_COVERS_BUCKET).createSignedUrl(path, 60 * 30);
      return error || !data?.signedUrl ? null : ([path, data.signedUrl] as const);
    })).then(entries => {
      if (!canceled) setUrls(Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null)));
    }).catch(() => { if (!canceled) setUrls({}); });
    return () => { canceled = true; };
  }, [paths, householdId, enabled]);
  return urls;
}

export async function compressTripCover(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))
    throw Error("Choisissez une photo JPEG, PNG, WebP ou HEIC.");
  if (file.size > PHOTO_MAX_BYTES)
    throw Error("La photo est trop volumineuse (20 Mo maximum).");

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(Error("Cette photo ne peut pas être ouverte. Essayez au format JPEG."));
      element.src = url;
    });
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw Error("Cette photo est invalide.");
    const factor = Math.min(1, PHOTO_TARGET_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * factor));
    canvas.height = Math.max(1, Math.round(height * factor));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw Error("Compression indisponible sur ce téléphone.");
    ctx.fillStyle = "#eef2ee";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    async function encode(type: string, quality: number) {
      return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
    }
    const webp = await encode("image/webp", 0.76);
    // Older iOS Safari versions may encode JPEG even for a WebP request.
    if (webp && webp.type === "image/webp") return webp;
    const jpeg = await encode("image/jpeg", 0.79);
    if (!jpeg) throw Error("Impossible de compresser cette photo.");
    return jpeg;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadTripCover(file: File, householdId: string, tripId: string) {
  if (!householdId || !tripId) throw Error("Voyage introuvable.");
  const blob = await compressTripCover(file);
  if (blob.size > 2 * 1024 * 1024) throw Error("Cette photo reste trop lourde après compression. Essayez une autre image.");
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  const path = householdId + "/" + tripId + "/" + crypto.randomUUID() + "." + extension;
  const { error } = await api.storage.from(TRIP_COVERS_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    contentType: blob.type,
    upsert: false,
  });
  if (error) {
    const message = /bucket not found|not found|row-level security|does not exist|unauthorized/i.test(error.message)
      ? "Le stockage des photos n’est pas encore configuré dans Supabase. Appliquez le script trip_covers.sql."
      : error.message;
    throw Error(message);
  }
  return path;
}

export async function deleteTripCover(path: string) {
  if (!path) return;
  const { error } = await api.storage.from(TRIP_COVERS_BUCKET).remove([path]);
  if (error) throw error;
}
