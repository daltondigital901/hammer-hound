// Rule checks for the pro API. Run: node test/api.test.mjs
import assert from "node:assert/strict";
import { worker, env, db, seedForm, ingest, SITE_GBP, SITE_CLIENT, SITE_PROSPECT, ai, stored, sent, texts } from "./dev-server.mjs";
import { createHmac } from "node:crypto";
import { membershipOf, membershipNotice, decide, reminderFor, sendReminders, brandEmail, tradeOf, AGREEMENT_VERSION, alertPros, creditBacks, buildInvoice, sendInvoices, offerText } from "../src/worker.js";
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
  assert.equal((await call("/api/pro/join", { city: "Memphis", agree: "yes", email: "join@example.com", business: "Test Pro " + n, phone, trade: "roofing", zip: "38103" })).next, "code");
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
seedForm(4, { valid: false }); seedForm(5, { site: SITE_GBP }); seedForm(6, { site: SITE_CLIENT }); seedForm(7, { client: true }); seedForm(8, { site: null }); db.tblW1A0iKDAd111iI.at(-1).fields.fldfJJYK166eGNfxw = 7.5; seedForm(8, { site: SITE_PROSPECT });
const first1 = await ingest(env);
// sites with a GBP are copied for now; a site with a client or an open prospect is not
assert.equal(first1.copied, 4); assert.deepEqual(first1.skipped, { noSite: 1, gbp: 0, client: 1, prospect: 1 });
assert.equal(db.tblfA6ivDIlWVp4us.find((l) => l.fields["DD1 Call Number"] === 5).fields["Site GBP"], "Has One!"); assert.equal(db.tblfA6ivDIlWVp4us.find((l) => l.fields["DD1 Call Number"] === 1).fields["Site GBP"], "Yes - Not Requested Yet");
assert.equal((await ingest(env)).copied, 0, "does not copy the same lead twice");
seedForm(9); assert.equal((await ingest(env)).copied, 1, "picks up a new form");
{ const L0 = db.tblfA6ivDIlWVp4us; L0.splice(L0.findIndex((l) => l.fields["DD1 Call Number"] === 5), 1); }   // the later checks count the other three
const leads = db.tblfA6ivDIlWVp4us; assert.ok(leads.every((l) => l.fields.Test === true && l.fields.Rule === "v3"));
const mail = leads.find((l) => l.fields["Lead Source"].startsWith("Email")); assert.equal(mail.fields.Service, "Quote for a retaining wall"); assert.equal(mail.fields["Owner Phone"], "");

// gates
assert.equal((await call("/api/pro/join", { city: "Memphis", agree: "yes", email: "join@example.com", business: "Outsider", phone: "9012223333" })).status, 403, "shadow mode blocks non-internal numbers");
assert.equal((await call("/api/pro/me")).status, 401);
const a = await signUp(1);
assert.equal((await call("/api/pro/join", { city: "Memphis", agree: "yes", email: "join@example.com", business: "Dup", phone: "9015550101" })).status, 409);
assert.equal((await call("/api/pro/verify-code", { phone: "9015550101", code: "000000" })).status, 401, "wrong code refused");
const unverifiedPhone = "9015550150"; await call("/api/pro/join", { city: "Memphis", agree: "yes", email: "join@example.com", business: "Unverified", phone: unverifiedPhone });
const u = await call("/api/pro/verify-code", { phone: unverifiedPhone, code: "424242" });
// an unverified pro can browse but not claim, and sees no owner details
seedForm(15); await ingest(env);
const browse = await call(ALL, null, u.cookie);
assert.equal(browse.status, 200); assert.equal(browse.canBuy, false); assert.ok(browse.offers.length > 0);
assert.ok(!JSON.stringify(browse.offers).match(/ownerName|ownerPhone|ownerEmail|example\.com|555-?01\d\d|Sample Owner/i), "browsing shows no owner details");
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
const v2 = async (n) => { const phone = "90155501" + n; await call("/api/pro/join", { city: "Memphis", agree: "yes", email: "join@example.com", business: "Check " + n, phone }); return (await call("/api/pro/verify-code", { phone, code: "424242" })).cookie; };
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
const c6 = await v2(65); db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === "9015550165").fields["Welcome Credit"] = 0;
await send(docs(65, { business: "FAIL" }), c6); assert.ok(!/free lead/.test(sent.at(-1).text), "a pro with no welcome credit left is not promised any"); assert.match(sent.at(-1).text, /leads in your market/);
assert.match(sent.find((e) => e.to === "pro60@example.com" && /another look/.test(e.subject)).text, /Verified Pro badge and \$240 in free lead credit/);
// insurance expiry ends verification
db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === unverifiedPhone).fields["Insurance Expires"] = "2020-01-01";
const lapsed = await call("/api/pro/me", null, u.cookie); assert.equal(lapsed.pro.verified, false); assert.equal(lapsed.pro.verification, "Insurance expired");
assert.equal((await call("/api/pro/buy", { leadId: browse.offers[0].id, kind: "shared" }, u.cookie)).status, 403);

// offers hide the owner; buying reveals them
const offers = (await call(ALL, null, a)).offers; assert.equal(offers.length, 5);
assert.ok(!JSON.stringify(offers).match(/ownerName|ownerPhone|ownerEmail|example\.com|555-?01\d\d|Sample Owner/i), "offers carry no owner details");
const L = offers[0].id;
const first = await call("/api/pro/buy", { leadId: L, kind: "shared" }, a);
assert.equal(first.price, 75); assert.equal(first.creditUsed, 75); assert.equal(first.balanceBefore, 240); assert.equal(first.balance, 165, "every claim comes out of the wallet"); assert.equal(first.credit, 165); assert.ok(first.lead.ownerPhone);
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
const short = await call("/api/pro/buy", { leadId: L, kind: "shared" }, b); assert.equal(short.status, 402); assert.match(short.error, /wallet has \$15\.00\. Add a card to claim it/, "the $15 left after an exclusive is not enough for another lead");
for (const c of others) assert.equal((await call("/api/pro/buy", { leadId: L, kind: "shared" }, c)).status, 200);
assert.equal((await call("/api/pro/buy", { leadId: L, kind: "shared" }, await signUp(7))).status, 410, "sixth pro is refused");
assert.equal(leads.find((l) => l.id === L).fields.Status, "Sold out");

// $240 of welcome credit is three leads with $15 left; the fourth needs a top-up, then mixes credit and paid funds
seedForm(20); seedForm(21); seedForm(22); await ingest(env);
const open = (await call(ALL, null, a)).offers;
await call("/api/pro/buy", { leadId: open[0].id, kind: "shared" }, a); await call("/api/pro/buy", { leadId: open[1].id, kind: "shared" }, a);
assert.equal((await call("/api/pro/me", null, a)).pro.balance, 15, "three leads leave $15"); assert.equal((await call("/api/pro/me", null, a)).pro.credit, 15);
// ---- card on file, reloads and the ledger ----
const LG = db.tblZ2EIWCgOb36JR2, mineL = (id) => LG.filter((r) => r.fields["Pro ID"] === id), aId = db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === "9015550101").id;
assert.deepEqual(mineL(aId).map((r) => [r.fields.Type, r.fields.Amount, r.fields["Balance After"]]), [["Welcome credit", 240, 240], ["Lead", -75, 165], ["Lead", -75, 90], ["Lead", -75, 15]], "every movement is in the ledger");
const noCard = await call("/api/pro/buy", { leadId: open[2].id, kind: "shared", reload: true }, a);
assert.equal(noCard.status, 402); assert.equal(noCard.card, ""); assert.equal(noCard.short, 60); assert.equal(noCard.reloadAmount, 150); assert.match(noCard.error, /Add a card to claim it/);
assert.equal((await call("/api/pro/add-funds", { amount: 150 }, a)).status, 402, "no card, no top-up");
assert.equal((await call("/api/pro/reload-settings", { autoReload: true, reloadAmount: 150 }, a)).status, 400, "auto-reload needs a card");
assert.equal((await call("/api/pro/card", { action: "save" }, a)).pro.card, "Test card ending 4242");
const unconfirmed = await call("/api/pro/buy", { leadId: open[2].id, kind: "shared" }, a); assert.equal(unconfirmed.status, 402, "a card alone does not charge: the button must say so first"); assert.match(unconfirmed.error, /Reload \$150\.00 on Test card ending 4242/);
const mailsBefore = sent.length;
const paid = await call("/api/pro/buy", { leadId: open[2].id, kind: "shared", reload: true }, a);
assert.equal(paid.reloaded, 150); assert.equal(paid.creditUsed, 15); assert.equal(paid.paidUsed, 60); assert.equal(paid.balanceBefore, 15); assert.equal(paid.balance, 90); assert.equal(paid.credit, 0);
assert.equal(db.tblJnYLq2aCiCVU1C.at(-1).fields["Credit Used"], 15);
assert.deepEqual(mineL(aId).slice(-2).map((r) => [r.fields.Type, r.fields.Amount, r.fields["Balance After"], r.fields.Via]), [["Top-up", 150, 165, "Portal"], ["Lead", -75, 90, "Portal"]]);
assert.match(mineL(aId).at(-2).fields["Payment ID"], /^TEST-/); assert.match(sent[mailsBefore].subject, /Receipt: \$150\.00 added/);
assert.equal((await call("/api/pro/add-funds", { amount: 20 }, a)).status, 400); assert.equal((await call("/api/pro/add-funds", { amount: 300 }, a)).pro.balance, 390);
assert.equal((await call("/api/pro/reload-settings", { autoReload: true, reloadAmount: 150, monthlyLimit: 100 }, a)).status, 400, "the limit must cover one reload");
assert.equal((await call("/api/pro/reload-settings", { autoReload: true, reloadAmount: 150, monthlyLimit: 500 }, a)).pro.autoReload, true);
assert.match((await call("/api/pro/add-funds", { amount: 150 }, a)).error, /monthly limit of \$500\.00 \(\$450\.00 charged/, "the monthly limit stops a reload");
const walA = await call("/api/pro/wallet", null, a); assert.equal(walA.chargedThisMonth, 450); assert.equal(walA.card, "Test card ending 4242"); assert.equal(walA.rows[0].type, "Top-up"); assert.equal(walA.months.length, 1); assert.equal(walA.membership.inFreeYear, true);
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

// ---- every lead is in the uniform format before it is offered ----
{
  const { styleLeads, scrub, STYLE } = await import("../src/worker.js");
  const L = db.tblfA6ivDIlWVp4us;
  assert.ok(L.filter((l) => l.fields.Status !== "Rejected").every((l) => l.fields.Style === STYLE), "the writer runs with every copy");
  const shown = (await call(ALL, null, a)).offers;
  for (const o of shown) { assert.ok(o.job && o.place && o.tradeName, "job, place and trade on every lead"); for (const k of ["timing", "propertyType", "jobSize"]) assert.ok(typeof o[k] === "string" && o[k], k + " is always present"); assert.match(o.summary, /^The owner/); }
  assert.ok(!JSON.stringify(shown).match(/901-555-0100|owner1@example/), "contact details are cut from the summary in code");
  const mailLead = L.find((l) => String(l.fields["Lead Source"]).startsWith("Email")); assert.ok(!/^(fwd?|re):/i.test(mailLead.fields.Job)); assert.match(mailLead.fields.Lead, / · Baltimore, MD$/, "an email lead gets a job name and a place, not its subject line");
  // not a request for work: never offered
  seedForm(28, { service: "Roof Repair", message: "SPAM we offer SEO services" }); await ingest(env);
  const spam = L.find((l) => l.fields["DD1 Call Number"] === 28); assert.equal(spam.fields.Status, "Rejected"); assert.match(spam.fields.Qualified, /^No: vendor pitch/);
  assert.ok(!(await call(ALL, null, a)).offers.some((o) => o.id === spam.id));
  // a lead the writer has not reached is not offered
  L.push({ id: "recUNSTYLED0000001", fields: { Lead: "Fwd: raw subject", Service: "Fwd: raw subject", Status: "Offered", "Offer Ends At": new Date(Date.now() + 1e7).toISOString(), "Received At": new Date().toISOString(), Source: "DD1 form (shadow)", Rule: "v3" } });
  assert.ok(!(await call(ALL, null, a)).offers.some((o) => o.id === "recUNSTYLED0000001"), "raw leads are held back");
  ai.down = true; assert.equal((await styleLeads(env)).failed, 1); ai.down = false; assert.equal((await styleLeads(env)).styled, 1);
  assert.equal(scrub("Jane Doe at 746 Highland Springs Ct, 765-661-3431, jane@x.com wants brick fixed.", { "Owner Name": "Jane Doe" }), "The owner at [address removed], [removed], [removed] wants brick fixed.");
}

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
const got = await call("/api/pro/buy", { leadId: everything.offers[0].id, kind: "shared" }, m1); assert.equal(got.creditUsed, 75);
const pl = (await call("/api/pro/leads", null, m1)).leads[0]; assert.equal(pl.pipeline, "New");
assert.equal((await call("/api/pro/lead-status", { purchaseId: pl.purchaseId, pipeline: "Dancing" }, m1)).status, 400);
assert.equal((await call("/api/pro/lead-status", { purchaseId: pl.purchaseId, pipeline: "Quoted", notes: "Sent quote" }, m1)).status, 200);
assert.equal((await call("/api/pro/lead-status", { purchaseId: pl.purchaseId, pipeline: "Won" }, a)).status, 404, "cannot change another pro's lead");
const pl2 = (await call("/api/pro/leads", null, m1)).leads[0]; assert.equal(pl2.pipeline, "Quoted"); assert.equal(pl2.notes, "Sent quote");
const wal = await call("/api/pro/wallet", null, m1); assert.equal(wal.balance, 165); assert.equal(wal.credit, 165); assert.deepEqual(wal.rows.map((r) => [r.type, r.amount, r.creditPart]), [["Lead", -75, -75], ["Welcome credit", 240, 240]]); assert.equal(wal.cardsReady, false); assert.equal(wal.membership.fee, 300); assert.match(wal.membership.freeUntil, /^\d{4}-\d{2}-\d{2}$/);
db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === "9015550170").fields.Test = false;
assert.equal((await call("/api/pro/card", { action: "save" }, m1)).status, 503, "real accounts cannot save a card until Square is connected");
assert.equal((await call("/api/pro/tickets", { subject: "", message: "" }, m1)).status, 400);
assert.equal((await call("/api/pro/tickets", { topic: "Billing", subject: "Charge question", message: "Why was I charged?" }, m1)).status, 200);
assert.equal((await call("/api/pro/tickets", null, m1)).tickets[0].subject, "Charge question"); assert.equal((await call("/api/pro/tickets", null, a)).tickets.length, 0, "tickets are private to the pro");
assert.equal((await call("/api/pro/close", { confirm: "yes" }, m1)).status, 400); assert.equal((await call("/api/pro/close", { confirm: "CLOSE" }, m1)).status, 200);
assert.equal((await call("/api/pro/me", null, m1)).status, 401, "a closed account is signed out"); assert.equal((await call("/api/pro/sign-in", { phone: "9015550170" })).status, 403, "and cannot sign back in");

// ---- auto-reload, credit back, text-to-claim, lead alerts, invoices ----
{
  const P = db.tbl9bEGuy8DPkkee7, LD = db.tblfA6ivDIlWVp4us, PU = db.tblJnYLq2aCiCVU1C, find = (mob) => P.find((p) => p.fields.Mobile === mob);
  // auto-reload keeps a lead's worth in the wallet without being asked
  const r1 = await signUp(80); await call("/api/pro/card", { action: "save" }, r1); await call("/api/pro/reload-settings", { autoReload: true, reloadAmount: 150 }, r1);
  seedForm(50, { service: "Roof Repair", city: "Memphis" }); seedForm(51, { service: "Roof Repair", city: "Memphis" }); seedForm(52, { service: "Roof Repair", city: "Memphis" }); seedForm(53, { service: "Roof Repair", city: "Memphis" }); await ingest(env);
  const four = (await call(ALL, null, r1)).offers.slice(0, 4);
  for (const o of four.slice(0, 2)) await call("/api/pro/buy", { leadId: o.id, kind: "shared" }, r1);
  const third = await call("/api/pro/buy", { leadId: four[2].id, kind: "shared" }, r1); assert.equal(third.autoReloaded, 150, "below a lead's price after the third claim, the wallet reloads itself"); assert.equal(third.balance, 165);
  // an approved bad-lead report puts the money straight back
  const pur = PU.at(-1), before = find("9015550180").fields.Balance, m0 = sent.length; pur.fields["Review Status"] = "Approved";
  assert.equal(await creditBacks(env), 1); assert.equal(find("9015550180").fields.Balance, before + 75); assert.equal(pur.fields.Credited, true); assert.equal(await creditBacks(env), 0, "credited once");
  assert.match(sent[m0].subject, /\$75\.00 is back in your wallet/); assert.equal(db.tblZ2EIWCgOb36JR2.at(-1).fields.Type, "Credit back");

  // lead alerts: a text and an email to the pro whose market and trade match, and nobody else
  Object.assign(env, { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "tok", TWILIO_FROM: "+19015550000" });
  for (const l of LD) l.fields.Alerted = "old";
  const real = { id: "recREALPRO00000001", fields: { "Business Name": "Real Roofing", Mobile: "9012223333", Email: "real@example.com", Trade: "roofing", City: "memphis", Verification: "Verified", "Text Offers": true, "Email Offers": true, Balance: 15, "Welcome Credit": 15, Card: "Visa ending 1111", "Card Token": "TEST", Test: true, "Created At": new Date().toISOString() } };
  const other = { id: "recOTHERPRO0000001", fields: { "Business Name": "Other Fence", Mobile: "9014445555", Email: "other@example.com", Trade: "fencing", City: "Memphis", Verification: "Verified", "Text Offers": true, "Email Offers": true, Balance: 240 } };
  P.push(real, other);
  seedForm(60, { service: "Roof Repair", city: "Memphis" }); await ingest(env);
  const fresh = LD.at(-1), t0 = texts.length, e0 = sent.length, al = await alertPros(env);
  assert.equal(al.leads, 1); const toReal = texts.slice(t0); assert.equal(toReal.length, 1, "only the matching pro with a real number is texted"); assert.equal(toReal[0].to, "+19012223333");
  assert.match(toReal[0].body, /New ROOFING lead in Memphis, TN\. Roof Repair\. Size: Small\. .*\$75 from your wallet; if it is short we charge Visa ending 1111\. Reply YES to claim, ONLY for exclusive \(\$225\)\. Reply STOP/);
  assert.ok(!/Sample Owner|owner\d+@|555-?01\d\d/.test(toReal[0].body), "the text carries no owner details");
  assert.ok(sent.slice(e0).some((e) => e.to === "real@example.com" && /New roofing lead in Memphis, TN/.test(e.subject)) && !sent.slice(e0).some((e) => e.to === "other@example.com"));
  assert.equal(real.fields["Last Offer"].split("|")[0], fresh.id); assert.match(fresh.fields.Alerted, / \| \d+$/); assert.equal((await alertPros(env)).leads, 0, "a lead is announced once");
  // reply YES: claimed, and the card on file covers the short wallet
  const sms = async (from, body, sign = true) => {
    const url = "https://hammerhound.com/api/sms/inbound", p = { Body: body, From: from, To: "+19015550000" };
    const sig = createHmac("sha1", "tok").update(url + Object.keys(p).sort().map((k) => k + p[k]).join("")).digest("base64");
    const r = await worker.fetch(new Request(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": sign ? sig : "nope" }, body: new URLSearchParams(p) }), env);
    return { status: r.status, text: await r.text() };
  };
  assert.equal((await sms("+19012223333", "YES", false)).status, 403, "an unsigned text is refused");
  const yes = await sms("+19012223333", " yes ");
  for (const part of [/claimed\. Roof Repair, Memphis, TN\./, /OWNER: Sample Owner 60/, /PHONE: \(901\) 555-0160/, /EMAIL: owner60@example\.com/, /Timing: Within a week\. Property: Home\. Size: Small\./, /JOB: The owner wants roof repair/, /THEIR WORDS: Leak over the kitchen\. Need someone this week\./, /Call now\./]) assert.match(yes.text, part, "the YES reply carries the whole lead");
  assert.equal(real.fields.Balance, 90); assert.deepEqual(db.tblZ2EIWCgOb36JR2.slice(-2).map((r) => [r.fields.Type, r.fields.Via]), [["Top-up", "Text"], ["Lead", "Text"]]);
  { const again = (await sms("+19012223333", "YES")).text; assert.match(again, /already claimed by Real Roofing\. No charge\. Here are the details\./); assert.match(again, /OWNER: Sample Owner 60/); }
  assert.match((await sms("+19012223333", "balance")).text, /wallet has \$90\.00/); assert.match((await sms("+19019990000", "YES")).text, /not on a pro account/);
  assert.ok(!/\$\d/.test(yes.text), "the lead text shows no charge and no wallet balance");
  assert.match(sent.at(-1).subject, /Receipt: \$150\.00 added/, "the card charge is confirmed by an emailed receipt instead");
  // top up by text: the menu, then a numbered reply
  assert.match((await sms("+19012223333", "2")).text, /to top up, reply TOPUP/, "a bare number does nothing until a menu has been sent");
  const menu = await sms("+19012223333", "topup"); assert.match(menu.text, /Reply 1 to add \$150, 2 for \$300, 3 for \$600\. It is charged to Visa ending 1111/); assert.ok(!/90/.test(menu.text), "the menu never states the balance");
  const picked = await sms("+19012223333", "2"); assert.match(picked.text, /done\. \$300 added to your wallet from Visa ending 1111/); assert.equal(real.fields.Balance, 390);
  assert.deepEqual([db.tblZ2EIWCgOb36JR2.at(-1).fields.Type, db.tblZ2EIWCgOb36JR2.at(-1).fields.Amount, db.tblZ2EIWCgOb36JR2.at(-1).fields.Via], ["Top-up", 300, "Text"]);
  assert.match((await sms("+19012223333", "2")).text, /to top up, reply TOPUP/, "the menu is used once");
  assert.match((await sms("+19012223333", "TOPUP 600")).text, /\$600 added/); assert.equal(real.fields.Balance, 990);
  assert.match((await sms("+19012223333", "TOPUP 37")).text, /pick an amount/, "only the listed amounts");
  // a claim that leaves the wallet low sends the lead, then the menu as a second text
  real.fields.Balance = 80; real.fields["Welcome Credit"] = 0; real.fields["Text State"] = "";
  seedForm(61, { service: "Roof Repair", city: "Memphis" }); await ingest(env); await alertPros(env);
  const low = await sms("+19012223333", "YES"); assert.equal((low.text.match(/<Message>/g) || []).length, 2); assert.match(low.text, /your wallet is running low\. Reply 1 to add \$150/); assert.match(real.fields["Text State"], /^topup\|/);
  assert.match((await sms("+19012223333", "1")).text, /\$150 added/); assert.equal(real.fields.Balance, 155);
  const cardless = { ...real.fields, Card: "", "Card Token": "" }; real.fields.Card = ""; assert.match((await sms("+19012223333", "TOPUP")).text, /Add a card and top up at hammerhound\.com/); real.fields.Card = "Visa ending 1111";
  await sms("+19012223333", "STOP"); assert.equal(real.fields["Text Offers"], false, "STOP turns text offers off");
  assert.match(offerText({ Trade: "roofing", City: "Memphis", State: "TN", Job: "Roof Repair", "Shared Price": 75, "Exclusive Price": 225 }, {}), /\$75 from your wallet\. Reply YES/, "no card, no mention of a charge");

  // monthly invoice: totals from the ledger, a real PDF, emailed once
  const month = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }).slice(0, 7), proA = find("9015550101");
  const inv = await buildInvoice(env, proA, month);
  assert.match(inv.number, /^HH-\d{6}-[A-Z0-9]{5}$/); assert.deepEqual([inv.totals.opening, inv.totals.added, inv.totals.charged, inv.totals.leadCount, inv.totals.leadsTotal, inv.totals.creditUsed, inv.totals.closing], [0, 690, 450, 4, 300, 240, 390]);
  assert.equal(await buildInvoice(env, proA, "2020-01"), null, "no activity, no invoice");
  const pdf = await worker.fetch(new Request("http://x/api/pro/invoice?month=" + month, { headers: { Cookie: a } }), env);
  assert.equal(pdf.headers.get("Content-Type"), "application/pdf"); const bytes = new Uint8Array(await pdf.arrayBuffer()); assert.equal(String.fromCharCode(...bytes.slice(0, 5)), "%PDF-"); assert.ok(bytes.length > 3000);
  assert.equal((await worker.fetch(new Request("http://x/api/pro/invoice?month=" + month), env)).status, 401, "invoices are private");
  proA.fields.Email = "a@example.com"; const i0 = sent.length, run = await sendInvoices(env, { month });
  const mail = sent.slice(i0).find((e) => e.to === "a@example.com"); assert.ok(run.sent >= 1 && mail); assert.match(mail.subject, /Your Hammer Hound invoice for/);
  assert.equal(mail.attachments[0].type, "application/pdf"); assert.ok(mail.attachments[0].content.startsWith("JVBERi0"), "the PDF is attached"); assert.match(mail.html, /hammer hound/);
  assert.ok(stored.has(`invoices/${proA.id}/${month}.pdf`)); assert.equal(proA.fields["Last Invoice"], month);
  const again = await sendInvoices(env, { month }); assert.ok(!again.list.some((x) => x.pro === proA.fields["Business Name"] && again.sent), "the same invoice is not emailed twice");
  assert.equal((await call("/api/admin/invoices", { dry: true }, null)).status, 401);
  for (const p of [real, other]) P.splice(P.indexOf(p), 1);
}

// ---- membership: first year free, then renews; notices 35, 18 and 3 days before every charge ----
{
  const F = (o) => ({ Email: "m@example.com", "Business Name": "Member Co", "Created At": "2026-03-10T15:00:00.000Z", ...o });
  assert.deepEqual(membershipOf(F(), "2026-11-19"), { fee: 300, freeUntil: "2027-03-10", inFreeYear: true, renews: "2027-03-10", first: true });
  assert.deepEqual([membershipOf(F(), "2027-03-11").renews, membershipOf(F(), "2027-03-11").inFreeYear, membershipOf(F(), "2029-01-01").renews], ["2028-03-10", false, "2029-03-10"], "it renews every year");
  const st = (now) => (membershipNotice(F(), now) || {}).stage;
  // 2027-03-10 is the first charge: 35 days before is Feb 3, 18 days before is Feb 20, 3 days before is Mar 7
  assert.deepEqual(["2027-02-02", "2027-02-03", "2027-02-07", "2027-02-08", "2027-02-19", "2027-02-20", "2027-02-23", "2027-02-24", "2027-03-06", "2027-03-07", "2027-03-10", "2027-03-11"].map(st),
    [undefined, "m35", "m35", undefined, undefined, "m18", "m18", undefined, undefined, "m3", "m3", undefined], "a late notice still lands inside its window, never outside it");
  for (const [now, lo, hi] of [["2027-02-03", 30, 40], ["2027-02-07", 30, 40], ["2027-02-20", 15, 21], ["2027-02-23", 15, 21]]) { const n = membershipNotice(F(), now); assert.ok(n.left >= lo && n.left <= hi, now); }
  assert.equal(membershipNotice(F({ "Closed At": "2027-01-01" }), "2027-02-03"), null, "a closed account gets no renewal notice"); assert.equal(membershipNotice(F({ Email: "" }), "2027-02-03"), null);
  const P = db.tbl9bEGuy8DPkkee7, keep = P.map((p) => p.fields.Email); for (const p of P) p.fields.Email = "";
  const member = { id: "recMEMBER000000001", fields: F({ Card: "Visa ending 1111", Verification: "Not started" }) }; P.push(member);
  const m0 = sent.length, run = await sendReminders(env, { now: "2027-02-03" }); assert.equal(run.membership, 1);
  const mail = sent[m0]; assert.match(mail.subject, /membership renews on March 10, 2027 for \$300/); assert.match(mail.text, /free. It ends on March 10, 2027/);
  assert.match(mail.text, /renews automatically for 12 months and \$300 is charged to Visa ending 1111\. It renews every year on that date until you cancel/); assert.match(mail.text, /To cancel and avoid the charge, close your account before March 10, 2027/); assert.match(mail.text, /no fee to cancel/);
  assert.ok(!/unsubscribe/.test(mail.html), "an account notice has no unsubscribe link");
  assert.equal((await sendReminders(env, { now: "2027-02-04" })).membership, 0, "the same notice is not sent twice"); assert.equal((await sendReminders(env, { now: "2027-02-20" })).membership, 1); assert.equal((await sendReminders(env, { now: "2027-03-08" })).membership, 1);
  P.splice(P.indexOf(member), 1); P.forEach((p, i) => { p.fields.Email = keep[i]; });
  // sign-up: email required, and the terms are confirmed in writing
  assert.equal((await call("/api/pro/join", { business: "No Email", phone: "9015550189", city: "Memphis", agree: "yes" })).status, 400);
  const ack = sent.find((e) => /Welcome to Hammer Hound: your membership terms/.test(e.subject)); assert.ok(ack); assert.match(ack.text, /renews automatically for 12 months and \$300 is charged/); assert.match(ack.text, /To cancel at any time/);
}

// ---- audit fixes: sign-in limits, declined cards, unsubscribe, writer retries, market requests ----
{
  const P = db.tbl9bEGuy8DPkkee7, find = (mob) => P.find((p) => p.fields.Mobile === mob);
  // five wrong codes lock the account for the hour, even against the right code
  await call("/api/pro/join", { city: "Memphis", agree: "yes", email: "g@example.com", business: "Guarded", phone: "9015550183" });
  for (let i = 0; i < 5; i++) assert.equal((await call("/api/pro/verify-code", { phone: "9015550183", code: "000000" })).status, 401);
  assert.equal((await call("/api/pro/verify-code", { phone: "9015550183", code: "424242" })).status, 429, "locked after five wrong codes");
  assert.equal((await call("/api/pro/sign-in", { phone: "9015550183" })).status, 429);
  find("9015550183").fields["Sign-in Guard"] = ""; for (let i = 0; i < 5; i++) assert.equal((await call("/api/pro/sign-in", { phone: "9015550183" })).status, 200);
  assert.equal((await call("/api/pro/sign-in", { phone: "9015550183" })).status, 429, "five codes an hour at most");

  // a declined card: nothing charged, a link to fix it, and the lead is claimed once a working card is saved
  const dc = await signUp(84), dp = find("9015550184"); dp.fields.Balance = 15; dp.fields["Welcome Credit"] = 15;
  seedForm(70, { service: "Roof Repair", city: "Memphis" }); await ingest(env);
  const target = (await call(ALL, null, dc)).offers[0], led = db.tblZ2EIWCgOb36JR2.length, m0 = sent.length;
  assert.equal((await call("/api/pro/card", { action: "save", decline: true }, dc)).pro.card, "Test card ending 0002");
  const dec = await call("/api/pro/buy", { leadId: target.id, kind: "shared", reload: true }, dc);
  assert.equal(dec.status, 402); assert.equal(dec.declined, true); assert.match(dec.error, /was declined, so this lead is not yours yet/); assert.equal(dp.fields.Balance, 15, "nothing was charged or added"); assert.equal(db.tblZ2EIWCgOb36JR2.length, led);
  assert.match(dp.fields["Pending Reload"], new RegExp("^150\\|" + target.id + "\\|shared\\|"));
  const mail = sent.slice(m0).find((e) => e.subject === "Your card was declined"); assert.ok(mail); const link = mail.html.match(/https:\/\/hammerhound\.com(\/api\/pro\/link\?t=[^"]+)/)[1];
  assert.equal((await call("/api/pro/wallet", null, dc)).pending.amount, 150);
  const viaLink = await worker.fetch(new Request("http://x" + link), env); assert.equal(viaLink.status, 302); assert.equal(viaLink.headers.get("Location"), "/pros/app/#wallet"); assert.match(viaLink.headers.get("Set-Cookie"), /^hh_s=rec/, "the link signs the pro in");
  assert.equal((await worker.fetch(new Request("http://x" + link.slice(0, -3) + "abc"), env)).headers.get("Location"), "/pros/sign-in/", "a tampered link does not sign anyone in");
  const fixed = await call("/api/pro/card", { action: "save" }, dc);
  assert.equal(fixed.reloaded, 150); assert.equal(fixed.claimed.lead.id, target.id, "the lead is claimed as soon as the card works"); assert.equal(fixed.pro.balance, 90); assert.equal(dp.fields["Pending Reload"], "");
  assert.deepEqual(db.tblZ2EIWCgOb36JR2.slice(-2).map((r) => r.fields.Type), ["Top-up", "Lead"]);
  // by text: the reply carries the link
  Object.assign(env, { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "tok", TWILIO_FROM: "+19015550000" });
  const tp = { id: "recTEXTDECLINE0001", fields: { "Business Name": "Text Decline", Mobile: "9013334444", Email: "td@example.com", Trade: "roofing", City: "Memphis", Verification: "Verified", "Text Offers": true, Balance: 0, Card: "Test card ending 0002", "Card Token": "TEST-DECLINE", Test: true, "Created At": new Date().toISOString() } }; P.push(tp);
  seedForm(71, { service: "Roof Repair", city: "Memphis" }); await ingest(env); tp.fields["Last Offer"] = db.tblfA6ivDIlWVp4us.at(-1).id + "|x";
  const sms = async (body) => { const url = "https://hammerhound.com/api/sms/inbound", p = { Body: body, From: "+19013334444" }; const r = await worker.fetch(new Request(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": createHmac("sha1", "tok").update(url + Object.keys(p).sort().map((k) => k + p[k]).join("")).digest("base64") }, body: new URLSearchParams(p) }), env); return r.text(); };
  assert.match(await sms("YES"), /your card was declined, so that lead is not yours yet\. Update it here and we reload and claim it for you: https:\/\/hammerhound\.com\/api\/pro\/link\?t=rec/);
  assert.match(await sms("TOPUP 300"), /card was declined, so nothing was added\. Update it here and we finish the \$300 top-up/); P.splice(P.indexOf(tp), 1);

  // the lead writer stops after three failed runs on the same lead
  const { styleLeads } = await import("../src/worker.js"), LD = db.tblfA6ivDIlWVp4us;
  LD.push({ id: "recSTUCKLEAD000001", fields: { Lead: "raw", Service: "raw", Message: "UNWRITABLE", Status: "Offered", "Received At": new Date().toISOString() } });
  for (let i = 0; i < 3; i++) await styleLeads(env); const calls = ai.calls; await styleLeads(env);
  assert.equal(LD.at(-1).fields.Style, "failed 3"); assert.equal(ai.calls, calls, "no more AI calls are spent on it");
  // an AI outage is not counted against the leads waiting: they are written when it comes back
  LD.push({ id: "recOUTAGELEAD00001", fields: { Lead: "raw", Service: "Roof Repair", Message: "Leak.", Status: "Offered", "Received At": new Date().toISOString() } }, { id: "recOUTAGELEAD00002", fields: { Lead: "raw", Service: "Roof Repair", Message: "Leak.", Status: "Offered", "Received At": new Date().toISOString() } });
  ai.down = true; for (let i = 0; i < 4; i++) assert.equal((await styleLeads(env)).outage, true); ai.down = false;
  assert.equal(LD.at(-1).fields.Style, undefined); await styleLeads(env); assert.equal(LD.at(-1).fields.Style, "v2"); assert.equal(LD.at(-2).fields.Style, "v2");

  // "I want more leads here": recorded once per pro, market and trade
  const MR = db.tbl315ujQMh1PHOi8;
  assert.equal((await call("/api/pro/market-request", { market: "all", trade: "roofing" }, dc)).status, 400);
  assert.equal((await call("/api/pro/market-request", { market: "Tupelo", trade: "roofing", total: 12 }, dc)).status, 200); await call("/api/pro/market-request", { market: "tupelo", trade: "roofing" }, dc);
  assert.equal(MR.length, 1); assert.deepEqual([MR[0].fields.Request, MR[0].fields.Market, MR[0].fields.Trade, MR[0].fields["Open Leads Then"], MR[0].fields.Verified], ["Roofing · Tupelo", "Tupelo", "roofing", 12, true]);
  assert.equal((await call("/api/pro/market-request", { market: "Tupelo", trade: "roofing" }, null)).status, 401);
}

// ---- second audit: paging past 100 rows, and a reload settling a declined one ----
{
  const { creditBacks } = await import("../src/worker.js"), PU = db.tblJnYLq2aCiCVU1C, P = db.tbl9bEGuy8DPkkee7, before = PU.length;
  // 130 approved reports for one pro: every one is found, though Airtable hands back 100 rows a call
  const pp = { id: "recPAGINGPRO000001".slice(0, 17), fields: { "Business Name": "Paging Pro", Email: "pg@example.com", Balance: 0, Test: true } }; P.push(pp);
  for (let i = 0; i < 130; i++) PU.push({ id: "recPG" + String(i).padStart(12, "0"), fields: { Purchase: `recNOLEAD${String(i).padStart(8, "0")}:${pp.id}`, Price: 1, "Review Status": "Approved", Kind: "Shared" } });
  const { default: w } = await import("../src/worker.js");
  let total = 0; for (let i = 0; i < 8 && total < 130; i++) total += await creditBacks(env);
  assert.equal(total, 130); assert.equal(pp.fields.Balance, 130);
  const adminCookie = (await (async () => { const r = await worker.fetch(new Request("https://hammerhound.com/api/admin/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: env.ADMIN_KEY }) }), env); return (r.headers.get("Set-Cookie") || "").split(";")[0]; })());
  const ov = await (await worker.fetch(new Request("https://hammerhound.com/api/admin/overview", { headers: { Cookie: adminCookie } }), env)).json();
  assert.ok(ov.stats.pros.total === P.length, "the admin overview counts every pro");
  PU.splice(before, 130); P.splice(P.indexOf(pp), 1); db.tblZ2EIWCgOb36JR2 = db.tblZ2EIWCgOb36JR2.filter((r) => r.fields["Pro ID"] !== pp.id);
  // a reload that succeeds clears one left waiting by a declined card, so saving a card later cannot charge twice
  const c2 = await signUp(88), p2 = P.find((p) => p.fields.Mobile === "9015550188");
  await call("/api/pro/card", { action: "save" }, c2); p2.fields["Pending Reload"] = `150|||${new Date().toISOString()}`;
  assert.equal((await call("/api/pro/add-funds", { amount: 150 }, c2)).status, 200); assert.equal(p2.fields["Pending Reload"], "");
  const bal2 = p2.fields.Balance; assert.equal((await call("/api/pro/card", { action: "save" }, c2)).reloaded, 0); assert.equal(p2.fields.Balance, bal2);
}

// ---- hot leads, older leads, and bid invitations ----
{
  const LD = db.tblfA6ivDIlWVp4us, c = await signUp(85), hrs = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const mk = (id, h, extra = {}) => { LD.push({ id, fields: { Lead: "Age Test · Memphis, TN", Job: "Age Test", Trade: "roofing", City: "Memphis", State: "TN", Status: "Offered", Style: "v2", Qualified: "Yes", "Received At": hrs(h), "Shared Price": 75, "Exclusive Price": 225, "Max Pros": 5, Alerted: "x", ...extra } }); return id; };
  const hot = mk("recAGEHOT00000001", 71), old = mk("recAGEOLD00000001", 73), week = mk("recAGEWEEK0000001", 7 * 24 - 1), gone = mk("recAGEGONE0000001", 7 * 24 + 1);
  // older leads are hidden until a card is on file, and cannot be claimed without one
  { const v = await call(ALL, null, c); assert.equal(v.olderShown, false); assert.equal(v.older, 0); assert.ok(v.offers.every((o) => o.hot)); assert.ok(v.offers.find((o) => o.id === hot));
    const blocked = await call("/api/pro/buy", { leadId: old, kind: "shared" }, c); assert.equal(blocked.status, 403); assert.match(blocked.error, /Add a card/); }
  const meP = db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === "9015550185"); await call("/api/pro/card", { action: "save" }, c);
  const r = await call(ALL, null, c), by = (id) => r.offers.find((o) => o.id === id); assert.equal(r.olderShown, true);
  assert.equal(by(hot).hot, true, "under 72 hours is hot"); assert.equal(by(old).hot, false, "past 72 hours is an older lead"); assert.equal(by(week).hot, false); assert.equal(by(gone), undefined, "a week old is closed");
  assert.equal(r.hot + r.older, r.offers.length); assert.equal(r.hotHours, 72); assert.equal(r.leadDays, 7);
  assert.equal((await call("/api/pro/buy", { leadId: gone, kind: "shared" }, c)).status, 410); // older leads are marked down by age: 50, 40, 30, 20 percent of the hot price, to the nearest $5
  const d5 = mk("recAGEDAY50000001", 5 * 24 + 1);
  { const v = (await call(ALL, null, c)).offers, g = (id) => v.find((o) => o.id === id);
    assert.deepEqual([g(hot).sharedPrice, g(hot).percentOff], [75, 0]); assert.deepEqual([g(old).sharedPrice, g(old).exclusivePrice, g(old).fullPrice, g(old).percentOff], [40, 115, 75, 50]);
    assert.deepEqual([g(d5).sharedPrice, g(d5).exclusivePrice], [25, 70]); assert.deepEqual([g(week).sharedPrice, g(week).exclusivePrice, g(week).percentOff], [15, 45, 80]); }
  // welcome credit does not pay for an older lead: with $240 of credit and no funds of their own, the card is charged
  const need = await call("/api/pro/buy", { leadId: old, kind: "shared" }, c); assert.equal(need.status, 402); assert.match(need.error, /\$0\.00 of your own funds\. Welcome credit is for hot leads only/); assert.equal(need.reloadAmount, 150);
  const paid = await call("/api/pro/buy", { leadId: old, kind: "shared", reload: true }, c); assert.equal(paid.status, 200, "older leads can still be claimed"); assert.equal(paid.price, 40, "and the marked-down price is what is charged");
  assert.equal(paid.creditUsed, 0); assert.equal(paid.reloaded, 150); assert.equal(meP.fields.Balance, 350); assert.equal(meP.fields["Welcome Credit"], 240, "welcome credit is untouched");
  const hotBuy = await call("/api/pro/buy", { leadId: hot, kind: "shared" }, c); assert.equal(hotBuy.creditUsed, 75, "and still pays for a hot lead");
  // text and email alerts only go out for hot leads
  const { alertPros, styleLeads } = await import("../src/worker.js");
  for (const l of LD) l.fields.Alerted = "x"; LD.find((l) => l.id === week).fields.Alerted = ""; assert.equal((await alertPros(env)).leads, 0);
  // a bid invitation is accepted and always titled "<Scope> Bid Invitation"
  seedForm(72, { kind: "Email", subject: "Fwd: ITB - Demolition Sub Bid Request", message: "Invitation to bid on the demolition package. Bids due Friday." }); await ingest(env);
  const bid = LD.at(-1).fields; assert.equal(bid.Status, "Offered"); assert.match(bid.Job, /^Demolition Bid Invitation$/); assert.doesNotMatch(bid.Job, /Request|Subcontractor|Fwd|ITB/); assert.equal(bid["Property Type"], "Business");
  assert.equal((await call(ALL, null, c)).offers.find((o) => o.job === bid.Job).bid, true);
  // leads the writer rejected under the old rules are looked at again; ones a person rejected are not
  LD.push({ id: "recREJWRITER00001", fields: { Lead: "x", Service: "Fwd: ITB Park Restroom Bid", Message: "Invitation to bid.", Status: "Rejected", Style: "v1", Qualified: "No: Bid invitation from general contractor", "Received At": hrs(5) } }, { id: "recREJPERSON00001", fields: { Lead: "x", Service: "ITB", Message: "Invitation to bid.", Status: "Rejected", Style: "v1", "Received At": hrs(5) } });
  await styleLeads(env);
  assert.equal(LD.find((l) => l.id === "recREJWRITER00001").fields.Status, "Offered"); assert.match(LD.find((l) => l.id === "recREJWRITER00001").fields.Job, /Park Restroom Bid Invitation$/); assert.equal(LD.find((l) => l.id === "recREJPERSON00001").fields.Status, "Rejected");
}

// ---- admin panel ----
{
  const P = db.tbl9bEGuy8DPkkee7, PU = db.tblJnYLq2aCiCVU1C, T = db.tblFDXXEvvlb6F8vN;
  const adm = async (path, body, cookie, headers = {}) => { const r = await worker.fetch(new Request("https://hammerhound.com" + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }), env); const ct = r.headers.get("Content-Type") || ""; return { status: r.status, cookie: (r.headers.get("Set-Cookie") || "").split(";")[0], type: ct, ...(ct.includes("json") ? await r.json() : {}) }; };
  // closed without a sign-in; a wrong key is refused; a forged cookie is refused
  assert.equal((await adm("/api/admin/overview")).status, 401); assert.equal((await adm("/api/admin/verify", { proId: P[0].id, decision: "approve" })).status, 401);
  assert.equal((await adm("/api/admin/sign-in", { key: "nope" })).status, 401);
  assert.equal((await adm("/api/admin/overview", null, `hh_a=${Date.now() + 1e6}.${"a".repeat(64)}`)).status, 401);
  const A = (await adm("/api/admin/sign-in", { key: env.ADMIN_KEY })).cookie; assert.match(A, /^hh_a=\d+\.[a-f0-9]{64}$/);
  // set up one of each queue item
  const c = await signUp(86), me = P.find((p) => p.fields.Mobile === "9015550186"), other = (await call("/api/pro/join", { city: "Memphis", agree: "yes", email: "rev@example.com", business: "Needs Review LLC", phone: "9015550187" }), P.find((p) => p.fields.Mobile === "9015550187"));
  Object.assign(other.fields, { Verification: "In review", "Verification Reason": "Both documents were unreadable.", "Proof of Business File": `pros/${other.id}/1-business.pdf`, "Insurance File": `pros/${other.id}/1-insurance.pdf`, EIN: "123456789" });
  await env.DOCS.put(`pros/${other.id}/1-business.pdf`, new TextEncoder().encode("%PDF-test"), { httpMetadata: { contentType: "application/pdf" } });
  seedForm(73, { service: "Roof Repair", city: "Memphis" }); await ingest(env);
  const lead = (await call(ALL, null, c)).offers.find((o) => o.hot); const got = await call("/api/pro/buy", { leadId: lead.id, kind: "shared" }, c); assert.equal(got.status, 200);
  const mineP = PU.find((p) => p.fields.Purchase === `${lead.id}:${me.id}`); await call("/api/pro/report", { purchaseId: mineP.id, reason: "Number is disconnected." }, c);
  await call("/api/pro/tickets", { subject: "Card question", message: "When can I add a card?", topic: "Billing" }, c);
  await call("/api/pro/market-request", { market: "Olive Branch", trade: "roofing" }, c);
  const o = await adm("/api/admin/overview", null, A);
  assert.equal(o.status, 200); assert.equal(o.who, "key");
  assert.ok(o.stats.pros.today >= 2); assert.ok(o.stats.claims.today >= 1); assert.ok(o.stats.leadSales.today >= 75); assert.equal(o.stats.leadsOpen.hot + o.stats.leadsOpen.older > 0, true);
  const v = o.queues.verifications.find((q) => q.id === other.id); assert.ok(v); assert.equal(v.files.length, 2); assert.equal(v.reason, "Both documents were unreadable.");
  const rp = o.queues.reports.find((q) => q.purchaseId === mineP.id); assert.equal(rp.reason, "Number is disconnected."); assert.equal(rp.price, 75);
  const tk = o.queues.tickets.find((q) => q.subject === "Card question"); assert.ok(tk);
  assert.ok(o.marketRequests.find((g) => g.market === "Olive Branch" && g.trade === "Roofing" && g.pros === 1 && g.openNow === 0)); assert.ok(o.marketRequests.find((g) => g.market === "Tupelo"));
  assert.doesNotMatch(JSON.stringify(o), /Owner Phone|owner\d+@example\.com/, "no property owner details in the overview");
  assert.equal((await adm("/api/admin/overview?real=1", null, A)).stats.pros.total, P.filter((p) => !p.fields.Test).length, "hiding test accounts leaves only real ones");
  // documents: only a signed-in admin, only keys under pros/
  const doc = await worker.fetch(new Request("https://hammerhound.com/api/admin/doc?key=" + encodeURIComponent(v.files[0].key), { headers: { Cookie: A } }), env); assert.equal(doc.status, 200); assert.equal(doc.headers.get("Content-Type"), "application/pdf");
  assert.equal((await adm("/api/admin/doc?key=" + encodeURIComponent(v.files[0].key))).status, 401); assert.equal((await adm("/api/admin/doc?key=invoices/x/2026-11.pdf", null, A)).status, 404);
  // verification: approve needs a future expiry; decline needs a reason; both email the pro
  assert.equal((await adm("/api/admin/verify", { proId: other.id, decision: "approve" }, A)).status, 400);
  assert.equal((await adm("/api/admin/verify", { proId: other.id, decision: "decline" }, A)).status, 400);
  let n = sent.length; assert.equal((await adm("/api/admin/verify", { proId: other.id, decision: "approve", expires: "2027-12-01" }, A)).status, 200);
  assert.equal(other.fields.Verification, "Verified"); assert.equal(other.fields["Insurance Expires"], "2027-12-01"); assert.match(other.fields["Verification Detail"], /^Approved by a person \(key\)/); assert.ok(sent.length > n);
  assert.equal((await adm("/api/admin/verify", { proId: other.id, decision: "decline", reason: "Certificate is cut off." }, A)).status, 200); assert.equal(other.fields.Verification, "Declined"); assert.equal(other.fields["Verification Reason"], "Certificate is cut off.");
  // bad-lead report: approving puts the price back at once, and it cannot be handled twice
  const bal = me.fields.Balance; assert.equal((await adm("/api/admin/report", { purchaseId: mineP.id, decision: "approve" }, A)).status, 200);
  assert.equal(me.fields.Balance, bal + 75); assert.equal(mineP.fields.Credited, true); assert.equal((await adm("/api/admin/report", { purchaseId: mineP.id, decision: "deny" }, A)).status, 409);
  // ticket: the reply is saved, the ticket closes, and the pro sees it
  assert.equal((await adm("/api/admin/ticket", { ticketId: tk.id, reply: "" }, A)).status, 400); assert.equal((await adm("/api/admin/ticket", { ticketId: tk.id, reply: "Cards open with Square soon." }, A)).status, 200);
  assert.equal((await call("/api/pro/tickets", null, c)).tickets.find((t) => t.id === tk.id).reply, "Cards open with Square soon.");
  const after = await adm("/api/admin/overview", null, A); assert.equal(after.queues.reports.filter((q) => q.purchaseId === mineP.id).length + after.queues.tickets.filter((q) => q.id === tk.id).length + after.queues.verifications.filter((q) => q.id === other.id).length, 0);
  assert.equal((await adm("/api/admin/sign-out", {}, A)).cookie, "hh_a=");
  // Cloudflare Access: once configured, only a token signed by the team's key gets in, and the admin key no longer does
  const { generateKeyPairSync, createSign } = await import("node:crypto"), { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" }, enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = (claims, key = privateKey) => { const body = enc({ alg: "RS256", kid: "k1" }) + "." + enc(claims); return body + "." + createSign("RSA-SHA256").update(body).sign(key).toString("base64url"); };
  Object.assign(env, { ACCESS_TEAM: "daltontest", ACCESS_AUD: "aud123", ACCESS_CERTS: "data:application/json," + encodeURIComponent(JSON.stringify({ keys: [jwk] })) });
  const good = { iss: "https://daltontest.cloudflareaccess.com", aud: ["aud123"], exp: Math.floor(Date.now() / 1000) + 600, email: "owner@example.com" }, hdr = (t) => ({ "Cf-Access-Jwt-Assertion": t });
  assert.equal((await adm("/api/admin/overview", null, null, hdr(token(good)))).who, "owner@example.com");
  assert.equal((await adm("/api/admin/overview", null, A)).status, 401, "the key cookie stops working once Access is on"); assert.equal((await adm("/api/admin/sign-in", { key: env.ADMIN_KEY })).status, 400);
  assert.equal((await adm("/api/admin/overview", null, null, hdr(token({ ...good, aud: ["other"] })))).status, 401); assert.equal((await adm("/api/admin/overview", null, null, hdr(token({ ...good, exp: 1 })))).status, 401);
  assert.equal((await adm("/api/admin/overview", null, null, hdr(token(good, generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey)))).status, 401, "a token signed by another key is refused");
  delete env.ACCESS_TEAM; delete env.ACCESS_AUD; delete env.ACCESS_CERTS;
}

// ---- team members: invite, pay authority with a double confirm, claims by text ----
{
  Object.assign(env, { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "tok", TWILIO_FROM: "+19015550000" });
  const P = db.tbl9bEGuy8DPkkee7, T = db.tblAxauFF33UVS2gV, LOG = db.tblTYo9QOk8hTwQad, LD = db.tblfA6ivDIlWVp4us, PU = db.tblJnYLq2aCiCVU1C, { alertPros } = await import("../src/worker.js");
  const sms = async (from, body) => { const url = "https://hammerhound.com/api/sms/inbound", p = { Body: body, From: from }; const r = await worker.fetch(new Request(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": createHmac("sha1", "tok").update(url + Object.keys(p).sort().map((k) => k + p[k]).join("")).digest("base64") }, body: new URLSearchParams(p) }), env); return r.text(); };
  const c = await signUp(91), me = P.find((p) => p.fields.Mobile === "9015550191"), acts = () => LOG.filter((r) => r.fields["Account ID"] === me.id).map((r) => r.fields.Action);
  // before anyone can be added: the owner's acknowledgment, recorded with the version, time and IP address
  assert.equal((await call("/api/pro/team", null, c)).ack, false); assert.equal((await call("/api/pro/team/add", { name: "Dana", phone: "9017771111" }, c)).status, 403, "no team before the acknowledgment");
  assert.equal((await call("/api/pro/team/ack", {}, c)).status, 400); assert.equal((await call("/api/pro/team/ack", { agree: "yes" }, c)).ack, true);
  assert.match(me.fields["Team Ack"], /^November 19, 2026 \| 20\d\d-.* \| /); assert.equal(acts().at(-1), "Team turned on");
  // adding: a name and a number nobody else uses; the invite goes out by text
  assert.equal((await call("/api/pro/team/add", { name: "", phone: "9017771111" }, c)).status, 400); assert.equal((await call("/api/pro/team/add", { name: "Me", phone: "9015550191" }, c)).status, 409);
  const t0 = texts.length, added = await call("/api/pro/team/add", { name: "Dana", phone: "(901) 777-1111" }, c); assert.equal(added.members.length, 1); assert.equal(added.max, 5);
  const dana = T.at(-1); assert.deepEqual([dana.fields["Gets Texts"], dana.fields["Can Pay"], dana.fields.Portal], [true, false, false]);
  assert.equal(texts[t0].to, "+19017771111"); assert.match(texts[t0].body, /Test Pro 91 added you to their account to get lead texts\. Reply YES to accept/); assert.deepEqual(acts().slice(-2), ["Added", "Invited"]);
  assert.equal((await call("/api/pro/team/add", { name: "Dana again", phone: "9017771111" }, c)).status, 409, "one number, one account");
  // pay authority cannot be given before the person accepts, and the invite is accepted from their own phone
  assert.equal((await call("/api/pro/team/authority", { memberId: dana.id, on: true, confirm: "yes" }, c)).status, 409);
  assert.match(await sms("+19017771111", "hello"), /Reply YES to get lead texts/); assert.match(await sms("+19017771111", "Yes"), /you're in\. You'll get lead texts for Test Pro 91/); assert.ok(dana.fields["Opted In At"]); assert.equal(acts().at(-1), "Opted in");
  // a new lead is texted to the member; without pay authority a YES only asks the owner
  for (const l of LD) l.fields.Alerted = "x"; seedForm(74, { service: "Roof Repair", city: "Memphis" }); await ingest(env); const lead = LD.at(-1), t1 = texts.length; await alertPros(env);
  const toDana = texts.slice(t1).find((m) => m.to === "+19017771111"); assert.match(toDana.body, /New ROOFING lead in Memphis, TN.*Reply YES to ask Test Pro 91 to claim it/); assert.ok(!/\$75/.test(toDana.body)); assert.equal(dana.fields["Last Offer"].split("|")[0], lead.id);
  const m0 = sent.length, bal0 = me.fields.Balance; assert.match(await sms("+19017771111", "YES"), /you cannot claim leads by text on this account\. We told Test Pro 91/); assert.equal(me.fields.Balance, bal0); assert.ok(sent.slice(m0).some((e) => e.subject === "Dana wants a lead"));
  // the double confirm: on screen, then a code texted to the owner. Both are needed, and a wrong code grants nothing
  assert.equal((await call("/api/pro/team/authority", { memberId: dana.id, on: true }, c)).status, 400, "the first confirmation is required");
  const step = await call("/api/pro/team/authority", { memberId: dana.id, on: true, confirm: "yes" }, c); assert.equal(step.next, "code"); assert.equal(dana.fields["Can Pay"], false);
  assert.equal((await call("/api/pro/team/authority", { memberId: dana.id, on: true, confirm: "yes", code: "111111" }, c)).status, 401); assert.equal(dana.fields["Can Pay"], false);
  assert.equal((await call("/api/pro/team/authority", { memberId: dana.id, on: true, code: "424242" }, c)).status, 400, "a code alone is not enough");
  const m1 = sent.length, granted = await call("/api/pro/team/authority", { memberId: dana.id, on: true, confirm: "yes", code: "424242" }, c);
  assert.equal(granted.members[0].canPay, true); assert.ok(granted.members[0].payGrantedAt); assert.match(dana.fields["Pay Granted By"], /^Owner · \(901\) 555-0191$/);
  const grantRow = LOG.at(-1).fields; assert.equal(grantRow.Action, "Pay authority granted"); assert.ok(grantRow.At && grantRow.IP && grantRow.Agreement); assert.match(grantRow.Detail, /Confirmed twice/);
  assert.ok(sent.slice(m1).some((e) => /Dana can now claim and pay for leads by text/.test(e.subject) && /responsible for every charge/.test(e.html)));
  // now a YES claims it: the full details go to the person who claimed, and the claim is recorded against them
  const m2 = sent.length, claim = await sms("+19017771111", "YES"); assert.match(claim, /claimed\. Roof Repair, Memphis, TN\.\nOWNER: Sample Owner 74\nPHONE: \(901\) 555-0174/); assert.ok(!/\$\d/.test(claim));
  assert.equal(me.fields.Balance, bal0 - 75); const buyRow = PU.find((p) => p.fields.Purchase === `${lead.id}:${me.id}`); assert.equal(buyRow.fields["Claimed By"], "Dana · (901) 777-1111");
  assert.equal(db.tblZ2EIWCgOb36JR2.filter((r) => r.fields["Pro ID"] === me.id).at(-1).fields.By, "Dana · (901) 777-1111"); assert.ok(sent.slice(m2).some((e) => e.subject === "Dana claimed a lead" && e.to === me.fields.Email));
  assert.equal((await call("/api/pro/leads", null, c)).leads.find((l) => l.id === lead.id).claimedBy, "Dana");
  // a second person on the team, and the owner, see who claimed it and the details, with no second charge
  await call("/api/pro/team/add", { name: "Eli", phone: "9017772222" }, c); const eli = T.at(-1); await sms("+19017772222", "YES"); eli.fields["Last Offer"] = lead.id + "|x";
  const second = await sms("+19017772222", "YES"); assert.match(second, /already claimed by Dana\. No charge\. Here are the details\. Roof Repair, Memphis, TN\.\nOWNER: Sample Owner 74/); assert.equal(me.fields.Balance, bal0 - 75);
  assert.equal(PU.filter((p) => p.fields.Purchase === `${lead.id}:${me.id}`).length, 1);
  // the owner's daily limit for a member
  assert.equal((await call("/api/pro/team/update", { memberId: dana.id, getsTexts: true, portal: false, dailyCap: 5 }, c)).status, 400);
  assert.equal((await call("/api/pro/team/update", { memberId: dana.id, getsTexts: true, portal: false, dailyCap: 100 }, c)).members[0].dailyCap, 100); assert.equal(acts().at(-1), "Settings changed");
  seedForm(75, { service: "Roof Repair", city: "Memphis" }); await ingest(env); dana.fields["Last Offer"] = LD.at(-1).id + "|x";
  assert.match(await sms("+19017771111", "YES"), /would pass your daily limit of \$100 \(\$75\.00 claimed today\)/); assert.equal(me.fields.Balance, bal0 - 75);
  // turning it off is one step, takes effect at once, and is logged
  assert.equal((await call("/api/pro/team/authority", { memberId: dana.id, on: false }, c)).members[0].canPay, false); assert.equal(acts().at(-1), "Pay authority revoked"); assert.ok(dana.fields["Pay Revoked At"]);
  assert.match(await sms("+19017771111", "YES"), /you cannot claim leads by text/);
  // STOP from the member's phone stops their texts only
  assert.match(await sms("+19017771111", "STOP"), /<Response><\/Response>/); assert.equal(dana.fields["Gets Texts"], false); assert.equal(acts().at(-1), "Opted out");
  // signing in: only when the owner switched it on, and a member cannot reach money, settings or the team
  await call("/api/pro/team/add", { name: "Sam", phone: "9015550177" }, c); const sam = T.at(-1);
  assert.equal((await call("/api/pro/team/invite", { memberId: sam.id }, c)).status, 503); assert.equal((await call("/api/pro/team/test-optin", { memberId: sam.id }, c)).members.find((m) => m.id === sam.id).optedInAt !== "", true);
  assert.equal((await call("/api/pro/sign-in", { phone: "9015550177" })).status, 404);
  await call("/api/pro/team/update", { memberId: sam.id, getsTexts: true, portal: true, dailyCap: "" }, c);
  assert.equal((await call("/api/pro/sign-in", { phone: "9015550177" })).status, 200); const sv = await call("/api/pro/verify-code", { phone: "9015550177", code: "424242" }); assert.equal(sv.status, 200); assert.equal(sv.pro.member.name, "Sam"); assert.equal(sv.pro.business, "Test Pro 91");
  const sc = sv.cookie; assert.equal((await call("/api/pro/me", null, sc)).pro.member.canPay, false); assert.equal((await call(ALL, null, sc)).status, 200); assert.equal((await call("/api/pro/leads", null, sc)).status, 200);
  for (const path of ["/api/pro/wallet", "/api/pro/team"]) assert.equal((await call(path, null, sc)).status, 403);
  for (const [path, body] of [["/api/pro/card", { action: "save" }], ["/api/pro/add-funds", { amount: 150 }], ["/api/pro/team/authority", { memberId: sam.id, on: true, confirm: "yes", code: "424242" }], ["/api/pro/close", { confirm: "CLOSE" }], ["/api/pro/notifications", {}]]) assert.equal((await call(path, body, sc)).status, 403, path + " is owner only");
  assert.equal((await call("/api/pro/buy", { leadId: LD.at(-1).id, kind: "shared" }, sc)).status, 403, "no pay authority, no claim in the portal either"); assert.equal(sam.fields["Can Pay"], false);
  await call("/api/pro/team/update", { memberId: sam.id, getsTexts: true, portal: false, dailyCap: "" }, c); assert.equal((await call("/api/pro/me", null, sc)).status, 401, "switching sign-in off ends the member's session");
  // five at most; removing frees the number and ends everything for that person
  await call("/api/pro/team/add", { name: "Four", phone: "9017773333" }, c); await call("/api/pro/team/add", { name: "Five", phone: "9017774444" }, c);
  assert.equal((await call("/api/pro/team/add", { name: "Six", phone: "9017775555" }, c)).status, 400);
  const left = await call("/api/pro/team/remove", { memberId: dana.id }, c); assert.equal(left.members.length, 4); assert.ok(dana.fields["Removed At"]); assert.match(await sms("+19017771111", "YES"), /this number is not on a pro account/);
  assert.ok((await call("/api/pro/team", null, c)).log.length >= 10);
}

// ---- first-time tour: shown until the person finishes or skips it, per person ----
{
  const c = await signUp(92), me0 = await call("/api/pro/me", null, c);
  assert.equal(me0.pro.tourSeen, false); assert.deepEqual([me0.tour.shared, me0.tour.exclusive, me0.tour.maxPros, me0.tour.welcome, me0.tour.hotHours, me0.tour.leadDays], [75, 225, 5, 240, 72, 7]); assert.equal(typeof me0.tour.textsLive, "boolean");
  assert.equal((await call("/api/pro/tour", {}, c)).ok, true); assert.equal((await call("/api/pro/me", null, c)).pro.tourSeen, true);
  const first = db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === "9015550192").fields["Tour Seen At"]; await call("/api/pro/tour", {}, c);
  assert.equal(db.tbl9bEGuy8DPkkee7.find((p) => p.fields.Mobile === "9015550192").fields["Tour Seen At"], first, "the first time is kept");
  assert.equal((await call("/api/pro/tour", {}, null)).status, 401);
  // a team member has their own tour, separate from the owner's
  await call("/api/pro/team/ack", { agree: "yes" }, c); await call("/api/pro/team/add", { name: "Tess", phone: "9015550178" }, c); const tess = db.tblAxauFF33UVS2gV.at(-1);
  await call("/api/pro/team/update", { memberId: tess.id, getsTexts: true, portal: true, dailyCap: "" }, c); await call("/api/pro/sign-in", { phone: "9015550178" });
  const tv = await call("/api/pro/verify-code", { phone: "9015550178", code: "424242" }); assert.equal(tv.pro.tourSeen, false, "the owner finishing the tour does not finish it for the member");
  await call("/api/pro/tour", {}, tv.cookie); assert.ok(tess.fields["Tour Seen At"]); assert.equal((await call("/api/pro/me", null, tv.cookie)).pro.tourSeen, true);
}

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
assert.match(await (await worker.fetch(new Request("http://x" + link.pathname + link.search), env)).text(), /will not send/); assert.equal(pb.fields["Nudges Off"], true); assert.equal(pb.fields["Email Offers"], false, "unsubscribing also stops lead alert emails");
pb.fields["Insurance Expires"] = soon(-8); assert.equal((await sendReminders(env)).sent, 0, "unsubscribed pros get no more nudges");
assert.equal((await call("/api/admin/reminders", { dry: true }, null)).status, 401);
assert.equal((await call("/api/admin/ingest", {}, null)).status, 401);
const noSecrets = await worker.fetch(new Request("http://x/api/pro/me"), { ASSETS: env.ASSETS }); assert.equal(noSecrets.status, 503);
console.log("All API checks passed.");
