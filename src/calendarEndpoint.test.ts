import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import handler from "../api/calendar.ts";

test("feed endpoint handles revoked links, database failures, HEAD and restricted methods", async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.VITE_SUPABASE_URL, oldKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_URL = "https://database.invalid";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-key";
  let calls = 0, mode = "active";
  globalThis.fetch = (async (input: string | URL | Request, options?: RequestInit) => {
    if (String(input).startsWith("https://database.invalid")) {
      calls++;
      assert.equal(JSON.parse(String(options?.body)).p_token, "a".repeat(64));
      if (mode === "failure") return new Response("error", { status: 503 });
      return Response.json(mode === "revoked" ? null : { name: "Wimm", events: [] });
    }
    return originalFetch(input, options);
  }) as typeof fetch;
  const server = createServer((req, res) => { void handler(req, res); });
  try {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/calendar?token=${"a".repeat(64)}`;
    const active = await fetch(url);
    assert.equal(active.status, 200); assert.match(active.headers.get("content-type")!, /^text\/calendar/);
    assert.equal(active.headers.get("cache-control"), "private, no-store");
    assert.match(await active.text(), /BEGIN:VCALENDAR/);
    const head = await fetch(url, { method: "HEAD" }); assert.equal(head.status, 200); assert.equal(await head.text(), "");
    mode = "revoked"; assert.equal((await fetch(url)).status, 404);
    mode = "failure"; assert.equal((await fetch(url)).status, 503);
    const count = calls;
    assert.equal((await fetch(url.replace("a".repeat(64), "bad"))).status, 404);
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    assert.equal(calls, count);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY; else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});
