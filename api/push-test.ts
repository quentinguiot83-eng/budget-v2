import type { IncomingMessage, ServerResponse } from "node:http";

type Device = {
  id: string;
  userId: string;
  subscription: { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } };
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", "application/json");
  const respond = (status: number, data: object) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  if (req.method !== "POST") return respond(405, { error: "Méthode non autorisée" });

  const publicKey = process.env.WIMM_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WIMM_VAPID_PRIVATE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!publicKey || !privateKey || !serviceKey || !url || !anonKey) {
    return respond(503, { error: "Configuration serveur incomplète.", code: "push_config_missing" });
  }

  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return respond(401, { error: "Connexion requise" });

  try {
    const auth = await fetch(url + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: authorization },
      signal: AbortSignal.timeout(10000),
    });
    if (!auth.ok) return respond(401, { error: "Connexion requise" });
    const userId = (await auth.json()).id as string | undefined;
    if (!userId) return respond(401, { error: "Connexion requise" });

    const deviceId = new URL(req.url || "/", "https://wimm.invalid").searchParams.get("device");
    if (!deviceId) return respond(400, { error: "Appareil introuvable. Enregistre à nouveau tes choix.", code: "push_device_missing" });

    const context = await fetch(url + "/rest/v1/rpc/budget_push_context", {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user: userId }),
      signal: AbortSignal.timeout(10000),
    });
    if (!context.ok) return respond(503, { error: "Impossible de lire l’appareil enregistré.", code: "push_context_error" });
    const devices = await context.json() as Device[];
    const device = devices.find(d => d.id === deviceId && d.userId === userId);
    if (!device) return respond(404, { error: "Appareil introuvable. Enregistre à nouveau tes choix.", code: "push_device_not_found" });

    let webpush: any;
    try {
      const module = await import("web-push");
      webpush = module.default ?? module;
    } catch {
      return respond(503, { error: "Le module d’envoi push n’est pas disponible sur Vercel.", code: "web_push_import_error" });
    }

    try {
      webpush.setVapidDetails(
        process.env.WIMM_VAPID_SUBJECT || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "wimm-budget.vercel.app"}`,
        publicKey,
        privateKey,
      );
    } catch {
      return respond(503, { error: "Les clés VAPID du serveur sont invalides.", code: "vapid_config_error" });
    }

    try {
      await webpush.sendNotification(
        device.subscription,
        JSON.stringify({
          title: "Notifications Wimm activées",
          body: "Ton téléphone est prêt à recevoir les alertes Wimm.",
          url: "/",
          tag: "wimm-test",
        }),
        { TTL: 3600, timeout: 10000 },
      );
      return respond(200, { sent: 1, failed: 0 });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      console.error("wimm_push_test_delivery_failed", { status: status || "internal" });
      return respond(503, {
        error: status === 404 || status === 410
          ? "L’abonnement de cet iPhone a expiré. Désactive puis réactive les notifications."
          : "Apple n’a pas accepté la notification de test.",
        code: status ? `push_service_${status}` : "push_delivery_error",
      });
    }
  } catch {
    return respond(503, { error: "Le test de notification est momentanément indisponible.", code: "push_test_internal_error" });
  }
}
