// Rule checks for the pro API. Run: node test/api.test.mjs
import assert from "node:assert/strict";
import { worker, env, db, seedForm, ingest, SITE_GBP, SITE_CLIENT, ai, stored, sent } from "./dev-server.mjs";
import { decide, reminderFor, sendReminders, brandEmail, tradeOf, AGREEMENT_VERSION } from "../src/worker.js";
import { readFileSync } from "node:fs";
import { parseForm } from "../src/worker.js";

const call = async (path, body, cookie) => {
  const r = await worker.fetch(new Request("http://x" + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: r.status, cookie: (r.headers.get("Set-Cookie") || "").split(";")[0], ...(await r.json()) };
};
const nextYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
// Builds the multipart upload. File text steers the stand-in AI: FAIL, UNSURE, EXPIRES yyyy-mm-dd, EIN 123456789.
const docs = (n, o = {}) => {
  const v = { legalName: "Test Pro " + n + " LLC", ein: "12-34567" + String(n).padStart(2, "0"), email: "pro" + n + "@example.com", docType: "City or county business license", insuranceExpires: nextYear, business: "license", insurance: "certificate EXPIRES " + nextYear, type: "application/pdf", ...o };
  const f = new FormData();
  for (const k of ["legalName", "ein", "email", "docType", "insuranceExpires"]) f.append(k, v[k]);
  if (v.business !== null) f.append("businessFile", new Blob([v.business], { type: v.type }), "a.pdf");
  if (v.insurance !== null) f.append("insuranceFile", new Blob([v.insurance], { type: "application/pdf" }), "b.pdf");
  return f;
};
const send = async (form, cookie) => {
  const r = await worker.fetch(new Request("http://x/api/pro/documents", { method: "POST", headers: { Cookie: cookie }, body: form }), env);
  return { status: r.status, ...(await r.json()) };
};
const ALL = "/api/pro/offers?market=all&trade=all";   // older checks look at every open lead
const signUp = async (n) => {
  const phone = "90155501" + String(n).padStart(2, "0");
  assert.equal((await call("/api/pro/join", { city: "Memphis", agree: "yes", business: "Test Pro " + n, phone, trade: "roofing", zip: "38103" })).next, "code");
  const v = await call("/api/pro/verify-code", { phone, code: "424242" }); assert.equal(v.status, 200);
  assert.equal((await send(docs(n), v.cookie)).pro.verified, true);
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
assert.equal((await call("/api/pro/join", { city: "Memphis", agree: "yes", business: "Outsider", phone: "9012223333" })).status, 403, "shadow mode blocks non-internal numbers");
assert.equal((await call("/api/pro/me")).status, 401);
const a = await signUp(1);
assert.equal((await call("/api/pro/join", { city: "Memphis", agree: "yes", business: "Dup", phone: "9015550101" })).status, 409);
assert.equal((await call("/api/pro/verify-code", { phone: "9015550101", code: "000000" })).status, 401, "wrong code refused");
const unverifiedPhone = "9015550150"; await call("/api/pro/join", { city: "Memphis", agree: "yes", business: "Unverified", phone: unverifiedPhone });
const u = await call("/api/pro/verify-code", { phone: unverifiedPhone, code: "424242" });
// an unverified pro can browse but not claim, and sees no owner details
seedForm(15); await ingest(env);
const browse = await call(ALL, null, u.cookie);
assert.equal(browse.status, 200); assert.equal(browse.canBuy, false); assert.ok(browse.offers.length > 0);
assert.ok(!JSON.stringify(browse.offers).match(/owner|Phone|example\.com/i), "browsing shows no owner details");
assert.equal((await call("/api/pro/buy", { leadId: browse.offers[0].id, kind: "shared" }, u.cookie)).status, 403, "cannot claim before verification");
// verification rules: EIN, document type, expiry, one account per EIN
assert.equal((await send(docs(50, { ein: "123-45-678" }), u.cookie)).status, 400, "8 digits is not an EIN");
assert.equal((await send(docs(50, { ein: "111111111" }), u.cookie)).status, 400);
assert.equal((await send(docs(50, { docType: "Business card" }), u.cookie)).status, 400, "document type must be on the list");
assert.equal((await send(docs(50, { insuranceExpires: "2020-01-01" }), u.cookie)).status, 400, "expired insurance refused");
assert.equal((await send(docs(50, { legalName: "" }), u.cookie)).status, 400);
assert.equal((await send(docs(1), u.cookie)).status, 409, "one account per EIN");
const uv = await send(docs(50), u.cookie);
assert.equal(uv.pro.verified, true); assert.equal(uv.pro.einLast4, "6750"); assert.ok(!JSON.stringify(uv).includes("123456750"), "full EIN never returned");
assert.equal((await call(ALL, null, u.cookie)).canBuy, true);
assert.ok([...stored.keys()].some((k) => k.endsWith("-business.pdf")) && [...stored.keys()].some((k) => k.endsWith("-insurance.pdf")), "both files are kept");
assert.equal(ai.last.headers["anthropic-version"], "2026-10-21"); assert.equal(ai.last.body.model, "claude-sonnet-5-5"); assert.ok(!ai.last.body.tool_choice, "no forced tool call: the live model refuses it"); assert.equal(ai.last.body.output_config.format.type, "json_schema");
// the AI check: fail, unsure, expired, EIN mismatch, AI down, daily limit, review request
const v2 = async (n) => { const phone = "90155501" + n; await call("/api/pro/join", { city: "Memphis", agree: "yes", business: "Check " + n, phone }); return (await call("/api/pro/verify-code", { phone, code: "424242" })).cookie; };
const c1 = await v2(60), before = sent.length;
assert.equal((await send(docs(60, { type: "text/plain" }), c1)).status, 400, "file type refused");
assert.equal((await send(docs(60, { email: "nope" }), c1)).status, 400, "email required");
assert.equal((await send(docs(60, { insurance: null }), c1)).status, 400, "both files required");
const failed = await send(docs(60, { business: "FAIL" }), c1);
assert.equal(failed.pro.verification, "Declined"); assert.equal(failed.pro.verified, false); assert.match(failed.pro.verificationReason, /wrong kind/); assert.equal(failed.pro.checksLeft, 2);
assert.equal(sent.length, before + 1); assert.equal(sent.at(-1).to, "pro60@example.com"); assert.equal(sent.at(-1).from.email, "support@hammerhound.com"); assert.match(sent.at(-1).text, /wrong kind/);
assert.equal((await call("/api/pro/buy", { leadId: browse.offers[0].id, kind: "shared" }, c1)).status, 403, "a failed check cannot buy");
const rev = await call("/api/pro/review", {}, c1); assert.equal(rev.pro.verification, "In review"); assert.equal((await call("/api/pro/review", {}, c1)).status, 409);
const expired = await send(docs(60, { insurance: "certificate EXPIRES 2021-03-01" }), c1); assert.equal(expired.pro.verification, "Declined"); assert.match(expired.pro.verificationReason, /expired/);
const passed = await send(docs(60), c1); assert.equal(passed.pro.verified, true); assert.equal(passed.pro.insuranceExpires, nextYear);
assert.equal((await send(docs(60), c1)).status, 429, "three checks a day");
const c2 = await v2(61);
// permissive: one unreadable document with one good one still passes, on the date the pro entered
const soft = await send(docs(61, { insurance: "UNSURE" }), c2); assert.equal(soft.pro.verified, true, "one unreadable file does not block a pro"); assert.equal(soft.pro.insuranceExpires, nextYear);
const c3 = await v2(62);
const both = await send(docs(62, { business: "UNSURE", insurance: "UNSURE" }), c3); assert.equal(both.pro.verification, "In review", "two unreadable files go to a person"); assert.match(sent.at(-1).subject, /closer look/);
const wrongEin = await send(docs(62, { business: "license EIN 999999999" }), c3); assert.equal(wrongEin.pro.verification, "Declined"); assert.match(wrongEin.pro.verificationReason, /EIN/);
// reliability: the check survives a refused option and a chatty reply, and falls back to the backup model
const c4 = await v2(63); ai.noSchema = true; ai.chatty = true; ai.models = [];
const fallback = await send(docs(63), c4); ai.noSchema = false; ai.chatty = false;
assert.equal(fallback.pro.verified, true, "a refused schema falls back to a plain JSON prompt"); assert.deepEqual(ai.models, ["claude-sonnet-5-5+schema", "claude-sonnet-5-5"]);
const c5 = await v2(64); ai.down = true; ai.models = []; const down = await send(docs(64), c5); ai.down = false;
assert.equal(down.pro.verification, "In review", "a full AI outage sends the documents to a person, never auto-passes"); assert.deepEqual(ai.models, ["claude-sonnet-5-5+schema", "claude-sonnet-5-5", "claude-haiku-5-5"]);
// the decision rules in code
const F = { ein: "123456789", insuranceExpiresEntered: nextYear };
assert.equal(decide({ business: { result: "pass" }, insurance: { result: "pass", expires: "" } }, F).expires, nextYear, "unreadable expiry falls back to the date entered");
assert.equal(decide({ business: { result: "pass" }, insurance: { result: "pass", expires: "2020-01-01" } }, F).status, "Declined", "expired insurance never passes");
assert.equal(decide({ business: { result: "pass", ein_on_document: "98-7654321" }, insurance: { result: "pass" } }, F).status, "Declined", "a wrong EIN never passes");
// copy follows the pro's phase: free leads only while they have some
const c6 = await v2(65); db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === "9015550165").fields["Free Leads Left"] = 0;
await send(docs(65, { business: "FAIL" }), c6); assert.ok(!/free lead/.test(sent.at(-1).text), "a pro with no free leads left is not promised any"); assert.match(sent.at(-1).text, /leads in your market/);
assert.match(sent.find((e) => e.to === "pro60@example.com" && /another look/.test(e.subject)).text, /Verified Pro badge and 3 free leads/);
// insurance expiry ends verification
db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === unverifiedPhone).fields["Insurance Expires"] = "2020-01-01";
const lapsed = await call("/api/pro/me", null, u.cookie); assert.equal(lapsed.pro.verified, false); assert.equal(lapsed.pro.verification, "Insurance expired");
assert.equal((await call("/api/pro/buy", { leadId: browse.offers[0].id, kind: "shared" }, u.cookie)).status, 403);

// offers hide the owner; buying reveals them
const offers = (await call(ALL, null, a)).offers; assert.equal(offers.length, 5);
assert.ok(!JSON.stringify(offers).match(/owner|Phone|example\.com/i), "offers carry no owner details");
const L = offers[0].id;
const first = await call("/api/pro/buy", { leadId: L, kind: "shared" }, a);
assert.equal(first.free, true); assert.equal(first.balance, 240); assert.equal(first.freeLeadsLeft, 2); assert.ok(first.lead.ownerPhone);
assert.equal((await call("/api/pro/buy", { leadId: L, kind: "shared" }, a)).status, 409, "cannot buy the same lead twice");
assert.equal((await call(ALL, null, a)).offers.length, 4);

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
const open = (await call(ALL, null, a)).offers;
await call("/api/pro/buy", { leadId: open[0].id, kind: "shared" }, a); await call("/api/pro/buy", { leadId: open[1].id, kind: "shared" }, a);
const paid = await call("/api/pro/buy", { leadId: open[2].id, kind: "shared" }, a); assert.equal(paid.free, false); assert.equal(paid.balance, 165);
const mine = (await call("/api/pro/leads", null, a)).leads; assert.equal(mine.length, 4);
assert.equal((await call("/api/pro/report", { purchaseId: mine[0].purchaseId, reason: "wrong number" }, a)).status, 200);
assert.equal((await call("/api/pro/report", { purchaseId: mine[0].purchaseId, reason: "again" }, a)).status, 409);
assert.equal((await call("/api/pro/report", { purchaseId: mine[0].purchaseId }, b)).status, 404, "cannot report another pro's lead");
// ---- sign-up agreement ----
assert.equal((await call("/api/pro/join", { business: "No Agree", phone: "9015550190", city: "Memphis" })).status, 400, "the Pro Agreement must be accepted");
assert.equal((await call("/api/pro/join", { business: "No City", phone: "9015550190", agree: "yes" })).status, 400, "a city is required");
assert.match(readFileSync(new URL("../site/src/legal/pro-agreement.md", import.meta.url), "utf8"), new RegExp("Last updated: " + AGREEMENT_VERSION), "the recorded version matches the published agreement");
const agreed = db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === "9015550101").fields.Agreement;
assert.match(agreed, new RegExp("^" + AGREEMENT_VERSION + " \\| \\d{4}-\\d{2}-\\d{2}T.* \\| "), "version, time and IP are recorded");
assert.match(readFileSync(new URL("../site/dist/pros/join/index.html", import.meta.url), "utf8"), /name="agree" value="yes" required[\s\S]*Agree and create account/, "the join page shows the agreement and the box");

// ---- markets and trades ----
assert.deepEqual(["Roof leak repair", "Driveway Replacement", "Asphalt driveway", "Water Heater", "Fence Install", "Quote for a retaining wall", "Mystery"].map(tradeOf), ["roofing", "concrete", "asphalt-paving", "water-heaters", "fencing", "masonry", "other"]);
seedForm(30, { service: "Roof Repair", city: "Memphis" }); seedForm(31, { service: "Fence Install", city: "Memphis" }); seedForm(32, { service: "Roof Repair", city: "Nashville" }); await ingest(env);
const m1 = await signUp(70);   // trade roofing, city Memphis
const mineOnly = await call("/api/pro/offers", null, m1);
assert.equal(mineOnly.filters.market, "Memphis"); assert.equal(mineOnly.filters.trade, "roofing"); assert.ok(mineOnly.offers.length > 0 && mineOnly.offers.every((o) => o.city === "Memphis" && o.trade === "roofing"), "defaults to the pro's market and trade");
const nash = await call("/api/pro/offers?market=Nashville&trade=all", null, m1); assert.ok(nash.offers.length > 0 && nash.offers.every((o) => o.city === "Nashville"), "another market can be picked");
const everything = await call("/api/pro/offers?market=all&trade=all", null, m1); assert.equal(everything.offers.length, everything.filters.total); assert.ok(everything.filters.markets.some((k) => k.name === "Nashville") && everything.filters.trades.some((k) => k.slug === "fencing"));
assert.ok(!JSON.stringify(everything).match(/owner\d|9015550\d{3}@|Sample Owner/), "filters never expose owner details");

// ---- profile, notifications, pipeline, wallet, tickets, closing ----
assert.equal((await call("/api/pro/profile", { business: "New Name", city: "Nashville", zip: "37201", trade: "nope" }, m1)).status, 400);
const prof = await call("/api/pro/profile", { business: "New Name", city: "Nashville", zip: "37201", trade: "fencing", extraTrades: ["roofing", "fencing", "bogus"] }, m1);
assert.equal(prof.pro.city, "Nashville"); assert.equal(prof.pro.trade, "fencing"); assert.deepEqual(prof.pro.extraTrades, ["roofing"]);
assert.equal((await call("/api/pro/offers", null, m1)).filters.market, "Nashville", "the default market follows the profile");
assert.equal((await call("/api/pro/notifications", { quietStart: "21:00" }, m1)).status, 400);
const noti = await call("/api/pro/notifications", { textOffers: true, emailOffers: false, paused: true, dailyCap: "5", quietStart: "21:00", quietEnd: "07:00" }, m1);
assert.equal(noti.pro.paused, true); assert.equal(noti.pro.dailyCap, 5); assert.equal(noti.pro.quietHours, "21:00-07:00");
const got = await call("/api/pro/buy", { leadId: everything.offers[0].id, kind: "shared" }, m1); assert.equal(got.free, true);
const pl = (await call("/api/pro/leads", null, m1)).leads[0]; assert.equal(pl.pipeline, "New");
assert.equal((await call("/api/pro/lead-status", { purchaseId: pl.purchaseId, pipeline: "Dancing" }, m1)).status, 400);
assert.equal((await call("/api/pro/lead-status", { purchaseId: pl.purchaseId, pipeline: "Quoted", notes: "Sent quote" }, m1)).status, 200);
assert.equal((await call("/api/pro/lead-status", { purchaseId: pl.purchaseId, pipeline: "Won" }, a)).status, 404, "cannot change another pro's lead");
const pl2 = (await call("/api/pro/leads", null, m1)).leads[0]; assert.equal(pl2.pipeline, "Quoted"); assert.equal(pl2.notes, "Sent quote");
const wal = await call("/api/pro/wallet", null, m1); assert.equal(wal.balance, 240); assert.equal(wal.rows.length, 1); assert.equal(wal.cardsReady, false); assert.equal(wal.membership.waived, true);
assert.equal((await call("/api/pro/add-funds", { amount: 7 }, m1)).status, 400); assert.equal((await call("/api/pro/add-funds", { amount: 100 }, m1)).pro.balance, 340, "test accounts can add test funds");
db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === "9015550170").fields.Test = false;
assert.equal((await call("/api/pro/add-funds", { amount: 100 }, m1)).status, 503, "real accounts cannot add funds until Square is connected");
assert.equal((await call("/api/pro/tickets", { subject: "", message: "" }, m1)).status, 400);
assert.equal((await call("/api/pro/tickets", { topic: "Billing", subject: "Charge question", message: "Why was I charged?" }, m1)).status, 200);
assert.equal((await call("/api/pro/tickets", null, m1)).tickets[0].subject, "Charge question"); assert.equal((await call("/api/pro/tickets", null, a)).tickets.length, 0, "tickets are private to the pro");
assert.equal((await call("/api/pro/close", { confirm: "yes" }, m1)).status, 400); assert.equal((await call("/api/pro/close", { confirm: "CLOSE" }, m1)).status, 200);
assert.equal((await call("/api/pro/me", null, m1)).status, 401, "a closed account is signed out"); assert.equal((await call("/api/pro/sign-in", { phone: "9015550170" })).status, 403, "and cannot sign back in");

// ---- insurance reminders and nudges ----
const R = (f, now) => (reminderFor({ Email: "a@b.co", Verification: "Verified", ...f }, now) || {}).stage;
assert.equal(R({ "Insurance Expires": "2027-03-31" }, "2027-02-01"), undefined, "nothing more than 30 days out");
assert.deepEqual(["2027-03-01", "2027-03-17", "2027-03-24", "2027-03-28", "2027-03-30", "2027-03-31", "2027-04-03", "2027-04-07", "2027-04-14", "2027-04-30"].map((n) => R({ "Insurance Expires": "2027-03-31" }, n)),
  ["pre30", "pre14", "pre7", "pre3", "pre1", "exp0", "post3", "post7", "post14", "post30"]);
assert.equal(R({ "Insurance Expires": "2027-03-31" }, "2027-06-01"), undefined, "nudges stop after 45 days");
assert.equal(R({ Verification: "Declined", "Checks Day": "2027-03-01" }, "2027-03-02"), undefined); assert.equal(R({ Verification: "Declined", "Checks Day": "2027-03-01" }, "2027-03-04"), "fail2");
assert.equal(reminderFor({ Verification: "Verified", "Insurance Expires": "2027-03-31" }, "2027-03-30"), null, "no email address, no reminder");
const P = db.tbl9bEGuy8DPkkee7, soon = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
for (const p of P) p.fields.Email = "";   // quiet everyone, then set up three cases
const [pa, pb, pc] = P; Object.assign(pa.fields, { Email: "renew@example.com", Verification: "Verified", "Insurance Expires": soon(10) });
Object.assign(pb.fields, { Email: "lapsed@example.com", Verification: "Verified", "Insurance Expires": soon(-4) });
Object.assign(pc.fields, { Email: "real@example.com", Verification: "Verified", "Insurance Expires": soon(-4), Test: false });
assert.equal((await sendReminders(env, { dry: true })).due, 2); const mark = sent.length;
const run = await sendReminders(env); assert.equal(run.sent, 2); assert.equal(run.held, 1, "a nudge to a real pro waits for a mailing address");
const renew = sent.slice(mark).find((e) => e.to === "renew@example.com"), lapsedMail = sent.slice(mark).find((e) => e.to === "lapsed@example.com");
assert.match(renew.subject, /expires in 10 days/); assert.ok(!renew.html.includes("locked"), "a renewal reminder carries no sample leads"); assert.ok(!renew.html.includes("unsubscribe?"));
assert.match(lapsedMail.subject, /badge is still paused/); assert.match(lapsedMail.html, /Owner name, phone and address locked/); assert.match(lapsedMail.html, /api\/unsubscribe\?p=rec/);
assert.ok(!lapsedMail.html.match(/owner\d+@example\.com|90155501\d\d|Sample Owner/), "sample leads carry no owner details"); assert.ok(lapsedMail.html.includes("hammer hound") && lapsedMail.html.includes("Tracked Down"));
assert.equal((await sendReminders(env)).sent, 0, "the same reminder is not sent twice");
const link = new URL(lapsedMail.html.match(/https:\/\/hammerhound\.com\/api\/unsubscribe[^"]+/)[0].replace(/&amp;/g, "&"));
assert.match(await (await worker.fetch(new Request("http://x" + link.pathname + "?p=" + link.searchParams.get("p") + "&s=bad"), env)).text(), /not valid/);
assert.match(await (await worker.fetch(new Request("http://x" + link.pathname + link.search), env)).text(), /will not send/); assert.equal(pb.fields["Nudges Off"], true);
pb.fields["Insurance Expires"] = soon(-8); assert.equal((await sendReminders(env)).sent, 0, "unsubscribed pros get no more nudges");
assert.equal((await call("/api/admin/reminders", { dry: true }, null)).status, 401);
assert.equal((await call("/api/admin/ingest", {}, null)).status, 401);
const noSecrets = await worker.fetch(new Request("http://x/api/pro/me"), { ASSETS: env.ASSETS }); assert.equal(noSecrets.status, 503);
console.log("All API checks passed.");
