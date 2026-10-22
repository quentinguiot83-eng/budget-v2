import type { Account } from "./engine";

/** Validate account labels without changing account identifiers or historical transactions. */
export function validateAccountName(
  proposed: string,
  accounts: readonly Pick<Account, "id" | "name">[],
  exceptId?: string,
): string {
  const name = proposed.trim().replace(/\s+/g, " ");
  if (!name) throw Error("Indiquez un nom pour ce compte.");
  if (name.length > 60) throw Error("Le nom du compte ne peut pas dépasser 60 caractères.");
  const normalized = name.toLocaleLowerCase("fr-FR");
  if (accounts.some(a => a.id !== exceptId &&
    a.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR") === normalized)) {
    throw Error("Un autre compte porte déjà ce nom. Choisissez un nom différent.");
  }
  return name;
}
