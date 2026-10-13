import type { IncomingMessage, ServerResponse } from "node:http";

export default async function cron(req: IncomingMessage, res: ServerResponse) {
  req.url = "/api/push?action=cron";
  try {
    const { default: handler } = await import("./push.ts");
    return await handler(req, res);
  } catch (error) {
    console.error("wimm_push_cron_runtime_load_failed", error);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "private, no-store");
    }
    if (!res.writableEnded) res.end(JSON.stringify({
      code: "push_cron_runtime_load_error",
      diagnostic: { name: error instanceof Error ? error.name : "UnknownError", code: typeof error === "object" && error !== null && "code" in error ? String(error.code).slice(0, 80) : "unknown" },
    }));
  }
}
