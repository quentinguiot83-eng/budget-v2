import { microLiberatoireRate, microSuggestedRate, type MicroFrequency, type MicroTaxMode } from "./proMicro";

/** Ce que l'assistant de démarrage Pro doit connaître de l'entreprise active. */
export type ProSetupSuite = {
  profile: { contributionRate: number; taxRate: number };
  transactions: unknown[];
  invoices: unknown[];
};

/**
 * L'assistant s'affiche tant que l'entreprise n'a ni taux enregistrés ni
 * activité : un compte déjà utilisé n'est jamais interrompu.
 */
export function proSetupNeeded(suite: ProSetupSuite): boolean {
  const noRates = !(suite.profile.contributionRate > 0) && !(suite.profile.taxRate > 0);
  return noRates && suite.transactions.length === 0 && suite.invoices.length === 0;
}

export type ProSetupActivity = {
  businessName: string;
  legalStatus: "micro" | "other";
  activityType: "service" | "commerce" | "liberal";
  /** Micro-entreprise : versement libératoire de l'impôt choisi. */
  liberatoire: boolean;
  frequency: MicroFrequency;
  /** Autre statut : taux saisis à la main (en %). */
  contributionRate: number;
  taxRate: number;
};

export type ProSetupProfile = {
  businessName: string; legalStatus: string; activityType: string;
  contributionRate: number; taxRate: number;
};

/**
 * Transforme les réponses de l'étape « Ton activité » en profil enregistrable
 * et en préférences Urssaf. Les taux micro sont les taux indicatifs de Wimm.
 */
export function proSetupProfile(a: ProSetupActivity): {
  profile: ProSetupProfile; taxMode: MicroTaxMode; frequency: MicroFrequency;
} {
  const businessName = a.businessName.trim();
  if (!businessName) throw Error("Indique le nom de ton activité.");
  if (businessName.length > 160) throw Error("Nom d’activité trop long.");
  if (a.legalStatus === "micro") {
    const contributionRate = microSuggestedRate(a.activityType);
    if (contributionRate === null) throw Error("Type d’activité invalide.");
    const taxRate = a.liberatoire ? microLiberatoireRate(a.activityType) ?? 0 : 0;
    return {
      profile: { businessName, legalStatus: "micro", activityType: a.activityType, contributionRate, taxRate },
      taxMode: a.liberatoire ? "liberatoire" : "none",
      frequency: a.frequency === "quarterly" ? "quarterly" : "monthly",
    };
  }
  const valid = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
  if (!valid(a.contributionRate) || !valid(a.taxRate))
    throw Error("Les taux doivent être compris entre 0 et 100 %.");
  if (a.contributionRate === 0 && a.taxRate === 0)
    throw Error("Indique au moins un taux de cotisations ou d’impôt.");
  return {
    profile: {
      businessName, legalStatus: "other", activityType: a.activityType,
      contributionRate: a.contributionRate, taxRate: a.taxRate,
    },
    taxMode: a.taxRate > 0 ? "estimate" : "none",
    frequency: a.frequency === "quarterly" ? "quarterly" : "monthly",
  };
}
