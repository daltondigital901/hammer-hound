// Hammer Hound engine: serves the static site and the pro API, and copies
// Dalton Digital form leads into the Hammer Hound base for shadow testing.
// No Retell, no texting of real pros, no card charges: shadow mode is internal only.

const DD1 = {
  base: "appJk4lKvNbCgCS51",
  callTracker: "tblW1A0iKDAd111iI",
  siteList: "tbl9olHmI5p746DOe",
  f: { number: "fldfJJYK166eGNfxw", kind: "fldJmHzvV9WlWbPUH", site: "fldqadMmvag7tK3U7", siteLink: "fldiLbdgf1efaCUOf", details: "fldDI13VDK04kQnYK", created: "fldZ3OCAkOMlzbwec", source: "fldw8MWCtjotaU9Tw" },
  s: { gbp: "fldxjMNAdLglWFBLl", activeClients: "fldVIdJR2dkmKXRf0" },
};
// "Needs GBP?" values that mean the site has a Google Business Profile, live or suspended.
// Leads from these sites are never offered: GBP leads cannot be sold.
const HAS_GBP = new Set(["Has One!", "Has One - Needs Final Owner Confirmed", "Has One - Needs Owner Transferred", "Has One, Doesn't Need Reviews", "First Suspension Appeal", "Second Suspension Appeal", "Suspended", "Soft Suspension", "Needs deletion"]);
const RULE = "v2";
const HH = { base: "app0PSwGlQyC6q7FW", leads: "tblfA6ivDIlWVp4us", pros: "tbl9bEGuy8DPkkee7", purchases: "tblJnYLq2aCiCVU1C" };
const NOT_OPEN = "Hammer Hound is not open yet, so nothing was sent. Check back soon.";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
const fail = (status, error) => json({ error }, status);
const num = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : d);
const digits = (p) => String(p || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
// 555-01xx numbers are reserved for fiction, so they can never belong to a real person.
const isTestPhone = (p) => /^\d{3}55501\d{2}$/.test(p);

// ---------- Airtable ----------
async function at(env, base, table, { method = "GET", query, body, id } = {}) {
  const url = new URL(`${env.AIRTABLE_API || "https://api.airtable.com"}/v0/${base}/${table}${id ? "/" + id : ""}`);
  for (const [k, v] of Object.entries(query || {})) for (const x of [].concat(v)) url.searchParams.append(k, x);
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Airtable ${method} ${table} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}
const list = async (env, base, table, query) => (await at(env, base, table, { query })).records;
const create = async (env, table, fields) => (await at(env, HH.base, table, { method: "POST", body: { records: [{ fields }], typecast: true } })).records[0];
const update = (env, table, id, fields) => at(env, HH.base, table, { method: "PATCH", id, body: { fields, typecast: true } });

// ---------- shadow ingest: Dalton Digital form leads -> Hammer Hound Leads ----------
export function parseForm(details) {
  const out = {};
  const text = String(details || "");
  const msg = text.match(/^Message:\s*([\s\S]*)$/m);
  if (msg) out.Message = msg[1].trim();
  for (const line of text.split("\n")) {
    const m = line.match(/^(Name|Phone|Email|City|Service|Services|Subject):\s*(.*)$/);
    if (m && !(m[1] in out)) out[m[1] === "Services" ? "Service" : m[1]] = m[2].trim();
  }
  return out;
}

const selectName = (v) => (v && v.name) || v || "";

// Removes shadow leads copied under an older rule, unless a pro has already bought them.
async function purgeOldRule(env) {
  const old = await list(env, HH.base, HH.leads, { filterByFormula: `AND({Source}='DD1 form (shadow)',NOT({Rule}='${RULE}'))`, pageSize: 100, maxRecords: 200, "fields[]": ["Lead"] });
  if (!old.length) return 0;
  const bought = new Set((await list(env, HH.base, HH.purchases, { pageSize: 100, maxRecords: 1000, "fields[]": ["Purchase"] })).map((p) => String(p.fields.Purchase).split(":")[0]));
  const ids = old.map((r) => r.id).filter((id) => !bought.has(id));
  for (let i = 0; i < ids.length; i += 10) await at(env, HH.base, HH.leads, { method: "DELETE", query: { "records[]": ids.slice(i, i + 10) } });
  // Kept because bought: stamp them so they are not looked at again.
  for (const r of old.filter((x) => bought.has(x.id))) await update(env, HH.leads, r.id, { Rule: "kept-bought" });
  return ids.length;
}

// Copies Dalton Digital leads that are free to offer: a valid form or email, on a site with
// no GBP and no active client, that was not assigned to a client.
export async function ingest(env) {
  const purged = await purgeOldRule(env);
  if (purged) return { purged, copied: 0 };

  const newest = await list(env, HH.base, HH.leads, { "sort[0][field]": "DD1 Call Number", "sort[0][direction]": "desc", maxRecords: 1, "fields[]": ["DD1 Call Number"], filterByFormula: `AND({DD1 Call Number}>0,{Rule}='${RULE}')` });
  const last = newest.length ? newest[0].fields["DD1 Call Number"] : 0;
  // First run copies the last BACKFILL_DAYS days; after that, only rows newer than the last one copied.
  const window = last ? `{Call Number}>${last}` : `IS_AFTER({Created Time},DATEADD(NOW(),-${num(env.BACKFILL_DAYS, 30)},'days'))`;
  const query = {
    filterByFormula: `AND(OR({Form/Call}='Form',{Form/Call}='Email'),{Valid/Spam}='✅ Valid',{Client Portfolio}=BLANK(),${window})`,
    "sort[0][field]": "Call Number", "sort[0][direction]": "asc", pageSize: 100, returnFieldsByFieldId: "true", "fields[]": Object.values(DD1.f),
  };
  const rows = [];
  for (let page = 0, offset; page < 8; page++) {
    const r = await at(env, DD1.base, DD1.callTracker, { query: offset ? { ...query, offset } : query });
    rows.push(...r.records);
    if (!(offset = r.offset)) break;
  }

  // Look up each row's site once: GBP status and whether it has an active client.
  const siteIds = [...new Set(rows.map((r) => (r.fields[DD1.f.siteLink] || [])[0]).filter(Boolean))];
  const sites = {};
  for (let i = 0; i < siteIds.length; i += 40) {
    const found = await list(env, DD1.base, DD1.siteList, { filterByFormula: `OR(${siteIds.slice(i, i + 40).map((id) => `RECORD_ID()='${id}'`).join(",")})`, pageSize: 100, returnFieldsByFieldId: "true", "fields[]": Object.values(DD1.s) });
    for (const x of found) sites[x.id] = x.fields;
  }
  const skipped = { noSite: 0, gbp: 0, client: 0 };
  const eligible = rows.filter((r) => {
    const site = sites[(r.fields[DD1.f.siteLink] || [])[0]];
    if (!site) { skipped.noSite++; return false; }
    if (HAS_GBP.has(selectName(site[DD1.s.gbp]))) { skipped.gbp++; return false; }
    if ((site[DD1.s.activeClients] || 0) > 0) { skipped.client++; return false; }
    return true;
  });

  const ends = new Date(Date.now() + num(env.SHADOW_OFFER_HOURS, 24) * 3600e3).toISOString();
  const records = eligible.map((r) => {
    const c = r.fields, f = parseForm(c[DD1.f.details]), email = selectName(c[DD1.f.kind]) === "Email";
    const what = f.Service || (email ? f.Subject : "") || "Job";
    return { fields: {
      Lead: `${what} · ${f.City || c[DD1.f.site] || "Unknown area"}`.slice(0, 200),
      "DD1 Call Number": Number(c[DD1.f.number]), Source: "DD1 form (shadow)", Rule: RULE, Test: true, Status: "Offered",
      "Owner Name": f.Name || "", "Owner Phone": digits(f.Phone), "Owner Email": f.Email || "", City: f.City || "", Service: what.slice(0, 200),
      Message: (f.Message || "").slice(0, 5000), "Site Name": c[DD1.f.site] || "", "Lead Source": `${email ? "Email" : "Form"} · ${selectName(c[DD1.f.source]) || "Unknown"}`,
      "Received At": c[DD1.f.created], "Max Pros": num(env.SHADOW_MAX_PROS, 5),
      "Shared Price": num(env.SHADOW_SHARED_PRICE, 75), "Exclusive Price": num(env.SHADOW_EXCLUSIVE_PRICE, 225), "Offer Ends At": ends,
    } };
  });
  for (let i = 0; i < records.length; i += 10) await at(env, HH.base, HH.leads, { method: "POST", body: { records: records.slice(i, i + 10), typecast: true } });
  return { copied: records.length, scanned: rows.length, skipped, after: last };
}

// ---------- sessions and sign-in codes ----------
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const codeFor = async (env, phone, step) => String(parseInt((await hmac(env.SESSION_SECRET, `code:${phone}:${step}`)).slice(0, 8), 16) % 1e6).padStart(6, "0");
async function codeOk(env, phone, code) {
  if (isTestPhone(phone)) return !!env.TEST_CODE && code === env.TEST_CODE;
  const step = Math.floor(Date.now() / 600e3);
  return code === (await codeFor(env, phone, step)) || code === (await codeFor(env, phone, step - 1));
}
async function sendCode(env, phone) {
  if (isTestPhone(phone)) return env.TEST_CODE ? { sent: "test" } : { error: "Test sign-in is off: the TEST_CODE secret is not set." };
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) return { error: "Texting is not set up yet, so a code cannot be sent to a real number. Use a test account." };
  const code = await codeFor(env, phone, Math.floor(Date.now() / 600e3));
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST", headers: { Authorization: "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: "+1" + phone, From: env.TWILIO_FROM, Body: `Hammer Hound: your sign-in code is ${code}. It expires in 10 minutes.` }),
  });
  return r.ok ? { sent: "text" } : { error: "The code could not be texted. Try again." };
}
async function sessionCookie(env, proId) {
  const exp = Date.now() + 30 * 864e5, body = `${proId}.${exp}`;
  return `hh_s=${body}.${await hmac(env.SESSION_SECRET, body)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}
async function currentPro(env, request) {
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)hh_s=([^;]+)/);
  if (!m) return null;
  const [id, exp, sig] = m[1].split(".");
  if (!id || !exp || Number(exp) < Date.now() || sig !== (await hmac(env.SESSION_SECRET, `${id}.${exp}`))) return null;
  try { return await at(env, HH.base, HH.pros, { id }); } catch { return null; }
}
const proByPhone = async (env, phone) => (await list(env, HH.base, HH.pros, { filterByFormula: `{Mobile}='${esc(phone)}'`, maxRecords: 1 }))[0] || null;
const internal = (env, phone) => isTestPhone(phone) || String(env.INTERNAL_PHONES || "").split(",").map(digits).includes(phone);
const proView = (p) => ({ business: p.fields["Business Name"], mobile: p.fields.Mobile, trade: p.fields.Trade || "", zip: p.fields.ZIP || "", test: !!p.fields.Test, verification: p.fields.Verification || "Not started", balance: p.fields.Balance || 0, freeLeadsLeft: p.fields["Free Leads Left"] || 0 });

// ---------- leads ----------
const purchasesFor = (env, key) => list(env, HH.base, HH.purchases, { filterByFormula: `FIND('${esc(key)}',{Purchase})>0`, pageSize: 100 });
const offerView = (l, taken, exclusiveTaken) => ({
  id: l.id, title: l.fields.Lead, service: l.fields.Service || "", city: l.fields.City || "", receivedAt: l.fields["Received At"], endsAt: l.fields["Offer Ends At"],
  sharedPrice: l.fields["Shared Price"], exclusivePrice: l.fields["Exclusive Price"], maxPros: l.fields["Max Pros"], spotsTaken: taken, exclusiveAvailable: taken === 0 && !exclusiveTaken,
});
const leadView = (l) => ({ id: l.id, title: l.fields.Lead, service: l.fields.Service || "", city: l.fields.City || "", ownerName: l.fields["Owner Name"] || "", ownerPhone: l.fields["Owner Phone"] || "", ownerEmail: l.fields["Owner Email"] || "", message: l.fields.Message || "", receivedAt: l.fields["Received At"] });

async function buy(env, pro, { leadId, kind }) {
  if (pro.fields.Verification !== "Verified") return fail(403, "Verify your business before buying leads.");
  if (!/^rec[A-Za-z0-9]{14}$/.test(leadId || "") || !["shared", "exclusive"].includes(kind)) return fail(400, "That offer is not valid.");
  let lead;
  try { lead = await at(env, HH.base, HH.leads, { id: leadId }); } catch { return fail(404, "That offer no longer exists."); }
  const bought = await purchasesFor(env, leadId);
  if (bought.some((p) => p.fields.Purchase.endsWith(pro.id))) return fail(409, "You already have this lead. It is in My leads.");
  if (lead.fields.Status !== "Offered" || new Date(lead.fields["Offer Ends At"]) < new Date()) return fail(410, "This offer has ended.");
  if (bought.some((p) => p.fields.Kind === "Exclusive")) return fail(410, "Another pro took this lead exclusive.");
  if (kind === "exclusive" && bought.length) return fail(409, "Exclusive is gone because another pro has already bought this lead.");
  if (bought.length >= lead.fields["Max Pros"]) return fail(410, "All spots on this lead are taken.");

  const free = kind === "shared" && (pro.fields["Free Leads Left"] || 0) > 0;
  const price = free ? 0 : kind === "exclusive" ? lead.fields["Exclusive Price"] : lead.fields["Shared Price"];
  const balance = pro.fields.Balance || 0;
  if (price > balance) return fail(402, `Your balance is $${balance.toFixed(2)} and this lead is $${price.toFixed(2)}. Add funds to buy it.`);

  await create(env, HH.purchases, { Purchase: `${leadId}:${pro.id}`, Lead: [leadId], Pro: [pro.id], Kind: free ? "Free" : kind === "exclusive" ? "Exclusive" : "Shared", Price: price, "Bought At": new Date().toISOString(), Test: !!pro.fields.Test || !!lead.fields.Test, "Review Status": "None" });
  await update(env, HH.pros, pro.id, free ? { "Free Leads Left": pro.fields["Free Leads Left"] - 1 } : { Balance: Math.round((balance - price) * 100) / 100 });
  if (kind === "exclusive") await update(env, HH.leads, leadId, { Status: "Exclusive" });
  else if (bought.length + 1 >= lead.fields["Max Pros"]) await update(env, HH.leads, leadId, { Status: "Sold out" });
  return json({ lead: leadView(lead), price, free, balance: free ? balance : Math.round((balance - price) * 100) / 100, freeLeadsLeft: (pro.fields["Free Leads Left"] || 0) - (free ? 1 : 0) });
}

// ---------- API ----------
async function api(request, env, path) {
  if (!env.AIRTABLE_TOKEN || !env.SESSION_SECRET) return fail(503, NOT_OPEN);
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};

  if (path === "/api/admin/ingest" && request.method === "POST") {
    if (!env.ADMIN_KEY || request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) return fail(401, "Not allowed.");
    // The key holder is the operator, so a failure is returned in full instead of a generic message.
    try { return json(await ingest(env)); } catch (e) { return json({ error: String(e && e.message || e) }, 500); }
  }

  if (path === "/api/pro/join" && request.method === "POST") {
    const phone = digits(body.phone), business = String(body.business || "").trim().slice(0, 120);
    if (phone.length !== 10 || !business) return fail(400, "Enter your business name and a 10-digit mobile number.");
    if (env.SHADOW_MODE === "true" && !internal(env, phone)) return fail(403, NOT_OPEN);
    if (await proByPhone(env, phone)) return fail(409, "That number already has an account. Sign in instead.");
    const sent = await sendCode(env, phone);
    if (sent.error) return fail(503, sent.error);
    const test = env.SHADOW_MODE === "true";
    await create(env, HH.pros, { "Business Name": business, Mobile: phone, Trade: String(body.trade || "").slice(0, 60), ZIP: String(body.zip || "").slice(0, 5), Test: test, Verification: "Not started", Balance: test ? num(env.TEST_BALANCE, 240) : 0, "Free Leads Left": 3, "Text Offers": body.sms === "yes", "Created At": new Date().toISOString() });
    return json({ next: "code", phone, sent: sent.sent });
  }
  if (path === "/api/pro/sign-in" && request.method === "POST") {
    const phone = digits(body.phone);
    if (phone.length !== 10) return fail(400, "Enter a 10-digit mobile number.");
    if (!(await proByPhone(env, phone))) return fail(404, "No account uses that number. Join as a pro first.");
    const sent = await sendCode(env, phone);
    return sent.error ? fail(503, sent.error) : json({ next: "code", phone, sent: sent.sent });
  }
  if (path === "/api/pro/verify-code" && request.method === "POST") {
    const phone = digits(body.phone), pro = phone.length === 10 ? await proByPhone(env, phone) : null;
    if (!pro || !(await codeOk(env, phone, String(body.code || "").trim()))) return fail(401, "That code is not right. Check it and try again.");
    return json({ ok: true, pro: proView(pro) }, 200, { "Set-Cookie": await sessionCookie(env, pro.id) });
  }
  if (path === "/api/pro/sign-out" && request.method === "POST") return json({ ok: true }, 200, { "Set-Cookie": "hh_s=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });

  const pro = await currentPro(env, request);
  if (!pro) return fail(401, "Sign in to continue.");

  if (path === "/api/pro/me") return json({ pro: proView(pro) });
  if (path === "/api/pro/documents" && request.method === "POST") {
    const business = String(body.businessFile || "").slice(0, 200), insurance = String(body.insuranceFile || "").slice(0, 200);
    if (!business || !insurance) return fail(400, "Choose both documents: proof of business and proof of insurance.");
    // Document storage and the AI check are not built yet. Test accounts pass at once so the
    // rest of the flow can be tested; any other account waits as Pending.
    const fields = { "Proof of Business File": business, "Insurance File": insurance, Verification: pro.fields.Test ? "Verified" : "Pending" };
    if (pro.fields.Test) fields["Verified At"] = new Date().toISOString();
    const saved = await update(env, HH.pros, pro.id, fields);
    return json({ pro: proView(saved) });
  }
  if (path === "/api/pro/offers") {
    if (pro.fields.Verification !== "Verified") return fail(403, "Verify your business to see offers.");
    const [leads, mine, all] = await Promise.all([
      list(env, HH.base, HH.leads, { filterByFormula: "AND({Status}='Offered',IS_AFTER({Offer Ends At},NOW()))", "sort[0][field]": "Received At", "sort[0][direction]": "desc", pageSize: 50, maxRecords: 50 }),
      purchasesFor(env, pro.id),
      list(env, HH.base, HH.purchases, { "sort[0][field]": "Bought At", "sort[0][direction]": "desc", pageSize: 100, maxRecords: 500, "fields[]": ["Purchase", "Kind"] }),
    ]);
    const mineIds = new Set(mine.map((p) => p.fields.Purchase.split(":")[0]));
    const count = {}, excl = {};
    for (const p of all) { const id = p.fields.Purchase.split(":")[0]; count[id] = (count[id] || 0) + 1; if (p.fields.Kind === "Exclusive") excl[id] = true; }
    return json({ offers: leads.filter((l) => !mineIds.has(l.id)).map((l) => offerView(l, count[l.id] || 0, !!excl[l.id])), pro: proView(pro) });
  }
  if (path === "/api/pro/buy" && request.method === "POST") return buy(env, pro, body);
  if (path === "/api/pro/leads") {
    const mine = await purchasesFor(env, pro.id);
    const out = [];
    for (const p of mine.sort((a, b) => String(b.fields["Bought At"]).localeCompare(String(a.fields["Bought At"]))).slice(0, 40)) {
      const lead = await at(env, HH.base, HH.leads, { id: p.fields.Purchase.split(":")[0] }).catch(() => null);
      if (lead) out.push({ purchaseId: p.id, kind: p.fields.Kind, price: p.fields.Price || 0, boughtAt: p.fields["Bought At"], review: p.fields["Review Status"] || "None", ...leadView(lead) });
    }
    return json({ leads: out, pro: proView(pro) });
  }
  if (path === "/api/pro/report" && request.method === "POST") {
    const mine = await purchasesFor(env, pro.id), p = mine.find((x) => x.id === body.purchaseId);
    if (!p) return fail(404, "That lead is not in your account.");
    if ((p.fields["Review Status"] || "None") !== "None") return fail(409, "This lead has already been reported.");
    await update(env, HH.purchases, p.id, { "Review Status": "Reported", "Review Reason": String(body.reason || "").slice(0, 1000) });
    return json({ ok: true });
  }
  return fail(404, "Not found.");
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/")) {
      try { return await api(request, env, path); } catch (e) { console.error(e); return fail(500, "Something went wrong on our side. Try again."); }
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    if (env.SHADOW_MODE !== "true") return;
    if (!env.AIRTABLE_TOKEN) { console.error("ingest skipped: AIRTABLE_TOKEN is not set"); return; }
    ctx.waitUntil(ingest(env).then((r) => console.log("ingest", JSON.stringify(r)), (e) => console.error("ingest failed:", String(e && e.message || e))));
  },
};
