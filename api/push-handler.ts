import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pushAlerts, validPushEndpoint, type DueInvoice } from "../src/pushAlerts.ts";
import type { State } from "../src/engine.ts";

type PushSubscriptionData = { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } };
type Device = { id: string; userId: string; subscription: PushSubscriptionData; budgets: boolean; dues: boolean; state: State; invoices: DueInvoice[] };
function equal(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", "application/json");
  const respond = (status: number, data: object) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  const query = new URL(req.url || "/", "https://wimm.invalid").searchParams;
  const action = query.get("action") || "config";
  const publicKey = process.env.WIMM_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WIMM_VAPID_PRIVATE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const ready = !!(publicKey && privateKey && serviceKey && url && anonKey && process.env.CRON_SECRET);
  if (action === "config" && req.method === "GET") return respond(200, { ready, publicKey: ready ? publicKey : null });
  if (!["test", "dispatch", "cron"].includes(action)) return respond(404, { error: "Action introuvable" });
  if (req.method !== (action === "cron" ? "GET" : "POST")) return respond(405, { error: "Méthode non autorisée" });
  if (!ready) return respond(503, { error: "Les notifications téléphone ne sont pas encore activées sur le serveur." });
  const authorization = req.headers.authorization || "";
  let userId: string | null = null;
  try {
    if (action === "cron") {
      if (!equal(authorization, `Bearer ${process.env.CRON_SECRET}`)) return respond(401, { error: "Accès refusé" });
    } else {
      if (!authorization.startsWith("Bearer ")) return respond(401, { error: "Connexion requise" });
      const auth = await fetch(url + "/auth/v1/user", { headers: { apikey: anonKey!, Authorization: authorization }, signal: AbortSignal.timeout(10000) });
      if (!auth.ok) return respond(401, { error: "Connexion requise" });
      userId = (await auth.json()).id;
      if (!userId) return respond(401, { error: "Connexion requise" });
    }
    const db = async (name: string, args: object) => {
      const result = await fetch(url + "/rest/v1/rpc/" + name, { method: "POST", headers: {
        apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json",
      }, body: JSON.stringify(args), signal: AbortSignal.timeout(10000) });
      if (!result.ok) throw Error("push_database_error");
      return result.json();
    };
    const devices = await db("budget_push_context", { p_user: userId }) as Device[];
    // web-push is CommonJS. Load it dynamically so Vercel's ESM runtime does not
    // fail while evaluating the serverless function before the handler runs.
    const webPushModule = await import("web-push");
    const webpush = webPushModule.default ?? webPushModule;
    webpush.setVapidDetails(process.env.WIMM_VAPID_SUBJECT || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "wimm.invalid"}`, publicKey!, privateKey!);
    let sent = 0, failed = 0;
    const queue = devices.filter(d => action !== "test" || d.userId === userId && d.id === query.get("device"));
    // Bound parallel requests; SQL leases prevent simultaneous dispatches from duplicating alerts.
    for (let start = 0; start < queue.length; start += 5) {
      await Promise.all(queue.slice(start, start + 5).map(async d => {
        if (!validPushEndpoint(d.subscription.endpoint)) return;
        let alerts = action === "test" ? [{ key: `test:${Math.floor(Date.now() / 60000)}`, kind: "test", title: "Notifications Wimm activées", body: "Ton téléphone est prêt à recevoir les alertes Wimm.", url: "/" }]
          : pushAlerts(d.state, d.invoices).filter(a => a.kind === "budgets" ? d.budgets : d.dues);
        const claimed: typeof alerts = [];
        for (const a of alerts) {
          if (await db("budget_push_claim", { p_id: d.id, p_key: a.key })) claimed.push(a);
          if (claimed.length >= 50) break;
        }
        if (!claimed.length) return;
        const first = claimed[0];
        const payload = claimed.length === 1 ? { ...first, tag: first.key } : {
          title: `${claimed.length} alertes Wimm`, body: claimed.slice(0, 3).map(a => a.body).join(" ") + (claimed.length > 3 ? " Ouvre Wimm pour voir les autres." : ""),
          url: claimed.every(a => a.kind === "dues" && a.url === "/?screen=calendar") ? "/?screen=calendar" : "/?screen=home", tag: "wimm-alerts",
        };
        try {
          await webpush.sendNotification(d.subscription, JSON.stringify(payload), { TTL: 86400, timeout: 10000 });
          await db("budget_push_finish", { p_id: d.id, p_keys: claimed.map(a => a.key), p_success: true });
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await db("budget_push_expire", { p_id: d.id });
          else await db("budget_push_finish", { p_id: d.id, p_keys: claimed.map(a => a.key), p_success: false });
          failed++;
          console.error("wimm_push_delivery_failed", { status: status || "internal" });
        }
      }));
    }
    return respond(200, { sent, failed });
  } catch {
    console.error("wimm_push_dispatch_failed");
    return respond(503, { error: "Envoi momentanément indisponible. Réessaie dans quelques instants." });
  }
}
