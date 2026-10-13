import type { IncomingMessage, ServerResponse } from "node:http";
import pushHandler from "../server-dist/serverPushHandler.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
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
        code: "push_runtime_load_error",
        diagnostic: { name: error instanceof Error ? error.name : "UnknownError", code: typeof error === "object" && error !== null && "code" in error ? String(error.code).slice(0, 80) : "unknown" }
      }));
    }
  }
}
