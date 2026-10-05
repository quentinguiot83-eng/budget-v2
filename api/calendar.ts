import type { IncomingMessage, ServerResponse } from "node:http";
import { calendarFeed, type CalendarFeed } from "../src/calendarFeed.ts";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const fail = (status: number, message: string) => { res.statusCode = status; res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.end(req.method === "HEAD" ? undefined : message); };
  if (req.method !== "GET" && req.method !== "HEAD") { res.setHeader("Allow", "GET, HEAD"); return fail(405, "Méthode non autorisée"); }
  const token = new URL(req.url ?? "/", "https://wimm.invalid").searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return fail(404, "Calendrier introuvable");
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail(503, "Calendrier momentanément indisponible");
  try {
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/budget_pro_calendar_feed", {
      method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ p_token: token }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return fail(503, "Calendrier momentanément indisponible");
    const feed = await response.json() as CalendarFeed | null;
    if (!feed) return fail(404, "Calendrier introuvable ou lien désactivé");
    const body = calendarFeed(feed);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="wimm-agenda.ics"');
    res.statusCode = 200;
    res.end(req.method === "HEAD" ? undefined : body);
  } catch { return fail(503, "Calendrier momentanément indisponible"); }
}
