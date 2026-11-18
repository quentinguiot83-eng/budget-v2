// Messages renvoyés par la base Supabase (encore au « vous ») reformulés au
// « tu » avant d'être affichés. La base n'est pas modifiée : seul le texte change.

const CONFLICT_SAVE = "Le foyer vient d’être modifié sur un autre appareil. Wimm a rechargé les données : réessaie.";

const MESSAGES: Record<string, string> = {
  "CONFLICT: données modifiées par un autre appareil. Actualisez avant de réessayer": CONFLICT_SAVE,
  "CONFLICT: actualisez avant de réessayer": CONFLICT_SAVE,
  "CONFLICT: votre foyer a été modifié. Actualisez avant de restaurer":
    "Le foyer vient d’être modifié sur un autre appareil. Wimm a rechargé les données : relance la restauration.",
  "CONFLICT: votre compte privé a été modifié. Actualisez avant de restaurer":
    "Ton compte perso vient d’être modifié sur un autre appareil. Wimm a rechargé les données : relance la restauration.",
  "Vous avez déjà un foyer": "Tu as déjà un foyer.",
  "Quittez votre foyer avant de rejoindre un autre foyer": "Quitte ton foyer avant d’en rejoindre un autre.",
  "Activez d’abord les notifications Wimm sur cet appareil": "Active d’abord les notifications Wimm sur cet appareil.",
  "Les notifications de cet appareil sont liées à un autre compte. Désactivez-les depuis ce compte avant de changer":
    "Les notifications de cet appareil sont liées à un autre compte. Désactive-les depuis ce compte avant de changer.",
  "Choisissez un client": "Choisis un client.",
  "Ajoutez au moins une ligne": "Ajoute au moins une ligne.",
  "Choisissez un compte courant de destination": "Choisis le compte courant de destination.",
  "Choisissez le compte personnel destinataire": "Choisis le compte perso destinataire.",
  "Configurez les taux de cotisations ou d’impôt avant de verser un revenu":
    "Configure les taux de cotisations ou d’impôt avant de verser un revenu.",
  "Seul un brouillon non émis peut être supprimé. Archivez cette facture pour la conserver":
    "Seul un brouillon non émis peut être supprimé. Archive cette facture pour la conserver.",
  "Vous devez conserver au moins une entreprise": "Tu dois garder au moins une entreprise.",
  "Cette entreprise contient des données. Supprimez ou transférez d’abord ses éléments":
    "Cette entreprise contient des données. Supprime ou transfère d’abord ses éléments.",
  "Choisissez archiver ou restaurer": "Choisis archiver ou restaurer.",
};

const key = (message: string) => message.trim().replace(/'/g, "’").replace(/\.$/, "");
const KNOWN = new Map(Object.entries(MESSAGES).map(([from, to]) => [key(from), to]));

/** Texte à afficher pour un message de la base ; un message inconnu reste tel quel. */
export function friendlyDbMessage(message: string): string {
  return KNOWN.get(key(message)) ?? message;
}

/** Erreur de la base, avec le texte reformulé et l'indication de conflit conservée. */
export class DbError extends Error {
  readonly conflict: boolean;
  constructor(raw: string) {
    super(friendlyDbMessage(raw));
    this.name = "DbError";
    this.conflict = raw.includes("CONFLICT");
  }
}

/** Vrai si l'enregistrement a été refusé parce qu'un autre appareil a modifié les données. */
export const isConflict = (e: unknown) =>
  e instanceof DbError ? e.conflict : e instanceof Error && e.message.includes("CONFLICT");
