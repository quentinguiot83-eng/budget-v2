import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, month, today, shiftMonth, type Account } from "./engine.ts";
import { pushAlerts, validPushEndpoint } from "./pushAlerts.ts";

function fixture() {
  const s = emptyState();
  const a: Account = { id: "current", name: "Courant", opening: 0, date: "2020-01-01", group: "current", rate: 0, cap: 0, capType: "balance", contributed: 0, relay: "", allocation: 0 };
  s.accounts = [a, { ...a, id: "private", group: "personal" }];
  s.categories = [{ id: "food", name: "Courses", icon: "", budgets: { "2020-01": 40000 } }];
  return s;
}
test("push budgets share the app calculation and have stable category/month identities", () => {
  const s = fixture();
  s.transactions = [{ id: "food", type: "expense", amount: 42000, date: today(), account: "current", category: "food", description: "Courses" }];
  const alert = pushAlerts(s)[0];
  assert.equal(alert.key, `budget:${month()}:food`);
  assert.equal(alert.kind, "budgets");
  assert.ok(alert.body.includes("20,00"));
  s.transactions[0].amount = 45000;
  assert.equal(pushAlerts(s)[0].key, alert.key);
  s.transactions[0].amount = 40000;
  assert.equal(pushAlerts(s).length, 0);
  s.transactions[0].amount = 45000; s.transactions[0].account = "private";
  assert.equal(pushAlerts(s).length, 0);
});
test("due reminders exclude paid, cancelled and personal entries; include invoices still unpaid", () => {
  const s = fixture();
  const start = `${shiftMonth(month(), -1)}-01`;
  s.rules = [{ id: "rent", name: "Loyer", kind: "fixed", account: "current", category: "food", amount: 10000, start, interval: 1, count: 0 },
    { id: "personal", name: "Privé", kind: "fixed", account: "private", category: "food", amount: 1000, start, interval: 1, count: 0 }];
  s.cancelled = [`rent:${month()}-01`];
  assert.equal(pushAlerts(s).length, 1);
  s.transactions.push({ id: "paid", type: "expense", date: start, amount: 10000, account: "current", dueKey: `rent:${start}`, description: "Payé" });
  assert.equal(pushAlerts(s).length, 0);
  const invoice = { id: "inv", number: "FAC-1", dueDate: today(), status: "sent", businessName: "Fujikent" };
  assert.equal(pushAlerts(s, [invoice]).length, 1);
  assert.equal(pushAlerts(s, [{ ...invoice, status: "paid" }]).length, 0);
});
test("push destinations reject private networks, credentials and spoofed hostnames", () => {
  for (const good of ["https://web.push.apple.com/Qabc", "https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc"]) assert.ok(validPushEndpoint(good));
  for (const bad of ["http://web.push.apple.com/a", "https://127.0.0.1/a", "https://web.push.apple.com.attacker.example/a", "https://user:pass@web.push.apple.com/a", "https://web.push.apple.com:8443/a", "not a URL"]) assert.equal(validPushEndpoint(bad), false);
});
