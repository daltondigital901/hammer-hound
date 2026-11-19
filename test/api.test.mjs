// Rule checks for the pro API. Run: node test/api.test.mjs
import assert from "node:assert/strict";
import { worker, env, db, seedForm, ingest, SITE_GBP, SITE_CLIENT } from "./dev-server.mjs";
import { parseForm } from "../src/worker.js";

const call = async (path, body, cookie) => {
  const r = await worker.fetch(new Request("http://x" + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: r.status, cookie: (r.headers.get("Set-Cookie") || "").split(";")[0], ...(await r.json()) };
};
const signUp = async (n) => {
  const phone = "90155501" + String(n).padStart(2, "0");
  assert.equal((await call("/api/pro/join", { business: "Test Pro " + n, phone, trade: "roofing", zip: "38103" })).next, "code");
  const v = await call("/api/pro/verify-code", { phone, code: "424242" }); assert.equal(v.status, 200);
  assert.equal((await call("/api/pro/documents", { businessFile: "a.pdf", insuranceFile: "b.pdf" }, v.cookie)).pro.verification, "Verified");
  return v.cookie;
};

// form parsing and ingest
assert.deepEqual(parseForm("New website lead:\nName: A B\nPhone: 9015550100\nEmail: a@example.com\nCity: Memphis\nService: Roof Repair\nMessage: line one\nline two"), { Message: "line one\nline two", Name: "A B", Phone: "9015550100", Email: "a@example.com", City: "Memphis", Service: "Roof Repair" });
// an old-rule lead is removed before anything is copied
db.tblfA6ivDIlWVp4us.push({ id: "recOLDRULE00000001", fields: { Lead: "old", Source: "DD1 form (shadow)", "DD1 Call Number": 999, Status: "Offered", "Offer Ends At": new Date(Date.now() + 1e7).toISOString() } });
assert.deepEqual(await ingest(env), { purged: 1, copied: 0 }, "old-rule leads are purged first");
assert.equal(db.tblfA6ivDIlWVp4us.length, 0);

// only valid forms and emails from sites with no GBP and no client are copied
for (let n = 1; n <= 2; n++) seedForm(n);
seedForm(3, { kind: "Email", subject: "Quote for a retaining wall" });
seedForm(4, { valid: false }); seedForm(5, { site: SITE_GBP }); seedForm(6, { site: SITE_CLIENT }); seedForm(7, { client: true }); seedForm(8, { site: null });
const first1 = await ingest(env);
assert.equal(first1.copied, 3); assert.deepEqual(first1.skipped, { noSite: 1, gbp: 1, client: 1 });
assert.equal((await ingest(env)).copied, 0, "does not copy the same lead twice");
seedForm(9); assert.equal((await ingest(env)).copied, 1, "picks up a new form");
const leads = db.tblfA6ivDIlWVp4us; assert.ok(leads.every((l) => l.fields.Test === true && l.fields.Rule === "v2"));
const mail = leads.find((l) => l.fields["Lead Source"].startsWith("Email")); assert.equal(mail.fields.Service, "Quote for a retaining wall"); assert.equal(mail.fields["Owner Phone"], "");

// gates
assert.equal((await call("/api/pro/join", { business: "Outsider", phone: "9012223333" })).status, 403, "shadow mode blocks non-internal numbers");
assert.equal((await call("/api/pro/me")).status, 401);
const a = await signUp(1);
assert.equal((await call("/api/pro/join", { business: "Dup", phone: "9015550101" })).status, 409);
assert.equal((await call("/api/pro/verify-code", { phone: "9015550101", code: "000000" })).status, 401, "wrong code refused");
const unverifiedPhone = "9015550150"; await call("/api/pro/join", { business: "Unverified", phone: unverifiedPhone });
const u = await call("/api/pro/verify-code", { phone: unverifiedPhone, code: "424242" });
assert.equal((await call("/api/pro/offers", null, u.cookie)).status, 403, "no offers before verification");

// offers hide the owner; buying reveals them
const offers = (await call("/api/pro/offers", null, a)).offers; assert.equal(offers.length, 4);
assert.ok(!JSON.stringify(offers).match(/owner|Phone|example\.com/i), "offers carry no owner details");
const L = offers[0].id;
const first = await call("/api/pro/buy", { leadId: L, kind: "shared" }, a);
assert.equal(first.free, true); assert.equal(first.balance, 240); assert.equal(first.freeLeadsLeft, 2); assert.ok(first.lead.ownerPhone);
assert.equal((await call("/api/pro/buy", { leadId: L, kind: "shared" }, a)).status, 409, "cannot buy the same lead twice");
assert.equal((await call("/api/pro/offers", null, a)).offers.length, 3);

// exclusive only while nobody has bought
const b = await signUp(2);
assert.equal((await call("/api/pro/buy", { leadId: L, kind: "exclusive" }, b)).status, 409);
const L2 = offers[1].id;
const ex = await call("/api/pro/buy", { leadId: L2, kind: "exclusive" }, b); assert.equal(ex.price, 225); assert.equal(ex.balance, 15);
assert.equal((await call("/api/pro/buy", { leadId: L2, kind: "shared" }, a)).status, 410, "exclusive lead is closed to others");
assert.equal((await call("/api/pro/buy", { leadId: offers[2].id, kind: "exclusive" }, b)).status, 402, "balance too low");

// five pros at most
const others = []; for (let n = 3; n <= 6; n++) others.push(await signUp(n));
for (const c of [b, ...others.slice(0, 3)]) assert.equal((await call("/api/pro/buy", { leadId: L, kind: "shared" }, c)).status, 200);
assert.equal((await call("/api/pro/buy", { leadId: L, kind: "shared" }, others[3])).status, 410, "sixth pro is refused");
assert.equal(leads.find((l) => l.id === L).fields.Status, "Sold out");

// paid purchase after free leads run out, my leads, bad-lead report
seedForm(20); seedForm(21); seedForm(22); await ingest(env);
const open = (await call("/api/pro/offers", null, a)).offers;
await call("/api/pro/buy", { leadId: open[0].id, kind: "shared" }, a); await call("/api/pro/buy", { leadId: open[1].id, kind: "shared" }, a);
const paid = await call("/api/pro/buy", { leadId: open[2].id, kind: "shared" }, a); assert.equal(paid.free, false); assert.equal(paid.balance, 165);
const mine = (await call("/api/pro/leads", null, a)).leads; assert.equal(mine.length, 4);
assert.equal((await call("/api/pro/report", { purchaseId: mine[0].purchaseId, reason: "wrong number" }, a)).status, 200);
assert.equal((await call("/api/pro/report", { purchaseId: mine[0].purchaseId, reason: "again" }, a)).status, 409);
assert.equal((await call("/api/pro/report", { purchaseId: mine[0].purchaseId }, b)).status, 404, "cannot report another pro's lead");
assert.equal((await call("/api/admin/ingest", {}, null)).status, 401);
const noSecrets = await worker.fetch(new Request("http://x/api/pro/me"), { ASSETS: env.ASSETS }); assert.equal(noSecrets.status, 503);
console.log("All API checks passed.");
