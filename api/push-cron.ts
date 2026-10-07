import type { IncomingMessage, ServerResponse } from "node:http";
import handler from "./push.ts";

export default async function cron(req: IncomingMessage, res: ServerResponse) {
  req.url = "/api/push?action=cron";
  return handler(req, res);
}
