/** Local-only Wimm exports. An unsigned checksum detects damage, not malicious edits. */
export const MAX_BACKUP_SIZE = 20 * 1024 * 1024;

async function checksum(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const sha = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(sha), x => x.toString(16).padStart(2, "0")).join("");
}

export async function createIntegrityExport(payload: Record<string, unknown>) {
  // Reserve envelope keys so a caller cannot accidentally override integrity metadata.
  for (const key of ["format", "version", "createdAt", "integrity"]) {
    if (Object.prototype.hasOwnProperty.call(payload, key))
      throw Error("Champ réservé dans la sauvegarde : " + key);
  }
  const envelope = {
    format: "wimm-manual-backup",
    version: 2,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  const contentHash = await checksum(envelope);
  return JSON.stringify({
    ...envelope,
    integrity: { algorithm: "SHA-256", contentHash },
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
  accountCount: number | null;
  formatVersion: 1 | 2;
  metadataProtected: boolean;
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Verify an exported JSON file in memory only. Never sends data, restores state,
 * or trusts a checksum as proof of authorship. Version 1 exports remain readable.
 */
export async function verifyIntegrityExport(contents: string): Promise<VerifiedBackup> {
  if (contents.length > MAX_BACKUP_SIZE || new TextEncoder().encode(contents).length > MAX_BACKUP_SIZE)
    throw Error("La sauvegarde dépasse 20 Mo.");
  let source: unknown;
  try {
    source = JSON.parse(contents);
  } catch {
    throw Error("Ce fichier ne contient pas un JSON valide.");
  }
  if (!record(source)) throw Error("Ce fichier n’est pas une sauvegarde Wimm.");
  if (source.format !== "wimm-manual-backup" || (source.version !== 1 && source.version !== 2))
    throw Error("Format de sauvegarde Wimm inconnu.");
  if (!record(source.integrity) || source.integrity.algorithm !== "SHA-256" ||
      typeof source.integrity.contentHash !== "string" ||
      !/^[a-f0-9]{64}$/i.test(source.integrity.contentHash))
    throw Error("Empreinte d’intégrité invalide.");

  const { format: _format, version: _version, createdAt, integrity: _integrity, ...payload } = source;
  const signedData = source.version === 2
    ? Object.fromEntries(Object.entries(source).filter(([key]) => key !== "integrity"))
    : payload;
  if (await checksum(signedData) !== source.integrity.contentHash.toLowerCase())
    throw Error("La sauvegarde a été modifiée ou est endommagée (empreinte incorrecte).");

  if (typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt)))
    throw Error("Date de sauvegarde invalide.");
  const scope = payload.scope;
  if (scope !== "household" && scope !== "personal" && scope !== "professional")
    throw Error("Type de sauvegarde inconnu.");

  let state: Record<string, unknown> | undefined;
  let accountCount: number | null = null;
  if (scope === "household" || scope === "personal") {
    if (typeof payload.householdId !== "string" || !payload.householdId.trim() ||
        !isNonNegativeInteger(payload.revision) || !record(payload.state))
      throw Error("Les données de la sauvegarde sont incomplètes.");
    state = payload.state;
    if (state.schema !== 1 || !Array.isArray(state.transactions) || !Array.isArray(state.rules))
      throw Error("Structure de sauvegarde incompatible avec cette version de Wimm.");
    if (scope === "household") {
      for (const field of ["accounts", "categories", "trips", "projects", "loans", "hidden", "cancelled"]) {
        if (!Array.isArray(state[field]))
          throw Error("Structure du foyer incomplète : " + field);
      }
      accountCount = (state.accounts as unknown[]).length;
    } else {
      if (state.account !== null && !record(state.account))
        throw Error("Compte personnel invalide.");
      if (state.budgets !== undefined && !Array.isArray(state.budgets))
        throw Error("Budgets personnels invalides.");
      accountCount = state.account ? 1 : 0;
    }
  } else if (!record(payload.data) || !Array.isArray(payload.data.transactions)) {
    throw Error("Les données professionnelles sont incomplètes.");
  }
  const tx = scope === "professional"
    ? (payload.data as Record<string, unknown>).transactions
    : state!.transactions;
  return {
    scope,
    createdAt,
    revision: isNonNegativeInteger(payload.revision) ? payload.revision : undefined,
    householdId: typeof payload.householdId === "string" ? payload.householdId : undefined,
    operationCount: Array.isArray(tx) ? tx.length : null,
    accountCount,
    formatVersion: source.version,
    metadataProtected: source.version === 2,
  };
}
