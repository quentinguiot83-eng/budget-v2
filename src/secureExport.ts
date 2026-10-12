/** Manual export helpers. They never upload or store the document remotely. */
export async function createIntegrityExport(payload: Record<string, unknown>) {
  const material = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(material);
  const sha = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(sha), x => x.toString(16).padStart(2, "0")).join("");
  return JSON.stringify({
    format: "wimm-manual-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    integrity: { algorithm: "SHA-256", contentHash: hash },
    ...payload,
  }, null, 2);
}

export async function sendFile(name: string, content: string, mime: string): Promise<boolean> {
  const file = new File([content], name, { type: mime });
  const navigatorWithShare = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[] }) => Promise<void>;
  };
  // iOS installed PWA: let users save to Files via native share sheet.
  if (navigatorWithShare.share && navigatorWithShare.canShare?.({ files: [file] })) {
    try {
      await navigatorWithShare.share({ files: [file], title: "Sauvegarde Wimm" });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      // Fall back to a browser download.
    }
  }
  const href = URL.createObjectURL(file);
  try {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(href), 60000);
  }
}


export type VerifiedBackup = {
  scope: "household" | "personal" | "professional";
  createdAt: string;
  revision?: number;
  householdId?: string;
  operationCount: number | null;
};

/** Checks JSON integrity only. An unsigned SHA-256 is not proof of authenticity. */
export async function verifyIntegrityExport(contents: string): Promise<VerifiedBackup> {
  if (contents.length > 20 * 1024 * 1024) throw Error("La sauvegarde dépasse 20 Mo.");
  let source: unknown;
  try {
    source = JSON.parse(contents);
  } catch {
    throw Error("Ce fichier ne contient pas un JSON valide.");
  }
  if (!source || Array.isArray(source) || typeof source !== "object")
    throw Error("Ce fichier n’est pas une sauvegarde Wimm.");
  const value = source as Record<string, unknown>;
  if (value.format !== "wimm-manual-backup" || value.version !== 1)
    throw Error("Format de sauvegarde Wimm inconnu.");
  const integrity = value.integrity;
  if (!integrity || Array.isArray(integrity) || typeof integrity !== "object")
    throw Error("L’empreinte d’intégrité est absente.");
  const data = integrity as Record<string, unknown>;
  const hash = data.contentHash;
  if (data.algorithm !== "SHA-256" || typeof hash !== "string" || !/^[a-f0-9]{64}$/i.test(hash))
    throw Error("Empreinte d’intégrité invalide.");
  const { format: _format, version: _version, createdAt, integrity: _integrity, ...payload } = value;
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  if (actual !== hash.toLowerCase())
    throw Error("La sauvegarde a été modifiée ou est endommagée (empreinte incorrecte).");
  const scope = payload.scope;
  if (scope !== "household" && scope !== "personal" && scope !== "professional")
    throw Error("Type de sauvegarde inconnu.");
  if (typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt)))
    throw Error("Date de sauvegarde invalide.");
  const state = payload.state as Record<string, unknown> | undefined;
  const professional = payload.data as Record<string, unknown> | undefined;
  if ((scope === "household" || scope === "personal") &&
      (!state || typeof state !== "object" || Array.isArray(state) || !Array.isArray(state.transactions) ||
      typeof payload.householdId !== "string" || !Number.isInteger(payload.revision)))
    throw Error("Les données de la sauvegarde sont incomplètes.");
  if (scope === "professional" && (!professional || !Array.isArray(professional.transactions)))
    throw Error("Les données professionnelles sont incomplètes.");
  const tx = scope === "professional" ? professional?.transactions : state?.transactions;
  return {
    scope,
    createdAt,
    revision: typeof payload.revision === "number" ? payload.revision : undefined,
    householdId: typeof payload.householdId === "string" ? payload.householdId : undefined,
    operationCount: Array.isArray(tx) ? tx.length : null,
  };
}
