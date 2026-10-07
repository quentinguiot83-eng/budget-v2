import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Méthode non autorisée" }));
    return;
  }

  const publicKey = process.env.WIMM_VAPID_PUBLIC_KEY || null;
  const ready = !!(
    publicKey &&
    process.env.WIMM_VAPID_PRIVATE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.VITE_SUPABASE_URL &&
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY &&
    process.env.CRON_SECRET
  );

  res.statusCode = 200;
  res.end(JSON.stringify({ ready, publicKey }));
}
