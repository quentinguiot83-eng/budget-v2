import { verifyIntegrityExport, type VerifiedBackup } from "./secureExport";

export type ImportContext = {
  householdId: string;
  isOwner: boolean;
  personalRevision: number | null;
};

export type RestoreCandidate = {
  verified: VerifiedBackup;
  backup: Record<string, unknown>;
  scope: "household" | "personal";
};

/**
 * Read and validate a candidate entirely in memory.
 * This function performs NO network calls and NO database writes.
 * The SQL RPC must independently re-check household, owner and revision.
 */
export async function inspectRestoreCandidate(
  json: string,
  context: ImportContext,
): Promise<RestoreCandidate> {
  const verified = await verifyIntegrityExport(json);
  if (verified.scope === "professional")
    throw Error("La restauration des données professionnelles n’est pas encore disponible.");
  if (!verified.householdId || verified.householdId !== context.householdId)
    throw Error("La sauvegarde appartient à un autre foyer. Aucune restauration possible.");
  if (verified.scope === "household" && !context.isOwner)
    throw Error("Seul le propriétaire peut restaurer une sauvegarde du foyer.");
  if (verified.scope === "personal" && context.personalRevision === null)
    throw Error("Votre compte personnel doit être chargé avant la restauration.");

  // verifyIntegrityExport has already checked the entire envelope and schema.
  const backup = JSON.parse(json) as Record<string, unknown>;
  return { verified, backup, scope: verified.scope };
}

export function restorePreviewCounts(candidate: RestoreCandidate, current: number) {
  const old = candidate.verified.operationCount ?? 0;
  return { current, file: old, difference: old - current };
}
