import type { IncomingMessage, ServerResponse } from "node:http";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const module = await import("./push-handler.ts");
    return await module.default(req, res);
  } catch (error) {
    console.error("wimm_push_runtime_load_failed", error);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Type", "application/json");
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({
        error: "Le moteur de notifications n’a pas pu démarrer sur le serveur.",
        code: "push_runtime_load_error"
      }));
    }
  }
}
