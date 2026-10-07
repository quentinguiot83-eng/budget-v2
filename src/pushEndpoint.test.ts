import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import webpush from "web-push";
import handler from "../api/push.ts";
import { emptyState } from "./engine.ts";

test("push endpoint protects cron, verifies sessions, limits tests to the device owner, and removes expired subscriptions", async () => {
  const keys = webpush.generateVAPIDKeys();
  const names = ["WIMM_VAPID_PUBLIC_KEY", "WIMM_VAPID_PRIVATE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "CRON_SECRET"];
  const previous = names.map(n => process.env[n]);
  const values = [keys.publicKey, keys.privateKey, "private-service-key", "https://db.example", "public-anon", "private-cron-key"];
  names.forEach((n, i) => process.env[n] = values[i]);
  const calls: { url: string; body?: Record<string, unknown> }[] = [];
  const device = { id: "my-device", userId: "user", subscription: { endpoint: "https://web.push.apple.com/test", keys: { p256dh: "key", auth: "key" } }, budgets: true, dues: true, state: emptyState(), invoices: [] };
  mock.method(globalThis, "fetch", async (input: string, options: RequestInit) => {
    const body = options?.body ? JSON.parse(String(options.body)) : undefined;
    calls.push({ url: String(input), body });
    if (String(input).endsWith("/auth/v1/user")) return Response.json({ id: "user" });
    if (String(input).endsWith("budget_push_context")) return Response.json([device, { ...device, id: "other-device", userId: "other-user" }]);
    if (String(input).endsWith("budget_push_claim")) return Response.json(true);
    return Response.json({});
  });
  const delivery = mock.method(webpush, "sendNotification", async () => ({ statusCode: 201, body: "", headers: {} }));
  async function request(action: string, method = "POST", authorization?: string) {
    let responseBody = "";
    const res = { statusCode: 200, setHeader() {}, end(body: string) { responseBody = body; } };
    await handler({ method, url: `/api/push?action=${action}`, headers: { authorization } } as IncomingMessage, res as unknown as ServerResponse);
    return { status: res.statusCode, body: JSON.parse(responseBody) };
  }
  try {
    const config = await request("config", "GET");
    assert.equal(config.body.publicKey, keys.publicKey);
    assert.equal(JSON.stringify(config.body).includes(keys.privateKey), false);
    assert.equal((await request("cron", "GET", "Bearer wrong")).status, 401);
    assert.equal(calls.length, 0);
    assert.equal((await request("dispatch")).status, 401);
    assert.equal((await request("test&device=other-device", "POST", "Bearer user-token")).body.sent, 0);
    assert.equal(delivery.mock.callCount(), 0);
    assert.equal((await request("test&device=my-device", "POST", "Bearer user-token")).body.sent, 1);
    assert.equal(delivery.mock.callCount(), 1);
    assert.equal(calls.find(c => c.url.endsWith("budget_push_context"))?.body?.p_user, "user");
    delivery.mock.mockImplementation(async () => { throw Object.assign(Error("Expired"), { statusCode: 410 }); });
    assert.equal((await request("test&device=my-device", "POST", "Bearer user-token")).body.failed, 1);
    assert.ok(calls.some(c => c.url.endsWith("budget_push_expire") && c.body?.p_id === "my-device"));
  } finally {
    mock.restoreAll();
    names.forEach((n, i) => { if (previous[i] === undefined) delete process.env[n]; else process.env[n] = previous[i]; });
  }
});
