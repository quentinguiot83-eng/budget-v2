import type { IncomingMessage, ServerResponse } from "node:http";
import pushHandler from "./push-handler.ts";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // Keep the server handler statically imported so Vercel bundles its transitive modules.
    // A runtime .ts import can fail after deployment even when the local tests pass.
    return await pushHandler(req, res);
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
