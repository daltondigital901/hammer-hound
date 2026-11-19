// Local test rig: runs the Worker in Node against an in-memory stand-in for Airtable,
// seeded with made-up form leads. Usage: node test/dev-server.mjs [port]
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import worker, { ingest } from "../src/worker.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "site", "dist");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain" };

// ---- in-memory Airtable ----
export const db = { tblW1A0iKDAd111iI: [], tblfA6ivDIlWVp4us: [], tbl9bEGuy8DPkkee7: [], tblJnYLq2aCiCVU1C: [], tbl9olHmI5p746DOe: [] };
let seq = 0;
const rid = () => "rec" + String(++seq).padStart(14, "0");
const NUM = "fldfJJYK166eGNfxw";
// Two stand-in sites: one free to offer, one with a GBP.
export const SITE_FREE = "recSITEFREE0000000".slice(0, 17), SITE_GBP = "recSITEGBP00000000".slice(0, 17), SITE_CLIENT = "recSITECLIENT00000".slice(0, 17);
db.tbl9olHmI5p746DOe.push({ id: SITE_FREE, fields: { fldxjMNAdLglWFBLl: "Yes - Not Requested Yet", fldVIdJR2dkmKXRf0: 0 } }, { id: SITE_GBP, fields: { fldxjMNAdLglWFBLl: "Has One!", fldVIdJR2dkmKXRf0: 0 } }, { id: SITE_CLIENT, fields: { fldxjMNAdLglWFBLl: "Inactive", fldVIdJR2dkmKXRf0: 1 } });
export function seedForm(n, o = {}) {
  const email = o.kind === "Email";
  const details = email
    ? `New email lead:\nName: ${o.name || "Sample Owner " + n}\nEmail: owner${n}@example.com\nTo: hello@sample.example\nSubject: ${o.subject || "Quote for a retaining wall"}\nMessage: ${o.message || "Please send a quote."}`
    : `New website lead:\nName: ${o.name || "Sample Owner " + n}\nPhone: 90155501${String(n % 100).padStart(2, "0")}\nEmail: owner${n}@example.com\nCity: ${o.city || "Memphis"}\nService: ${o.service || "Roof Repair"}\nMessage: ${o.message || "Leak over the kitchen.\nNeed someone this week."}`;
  db.tblW1A0iKDAd111iI.push({ id: rid(), fields: { [NUM]: n, fldJmHzvV9WlWbPUH: email ? "Email" : "Form", fldqadMmvag7tK3U7: o.siteName || "Sample Roofing Site", fldiLbdgf1efaCUOf: o.site === null ? undefined : [o.site || SITE_FREE], fldZ3OCAkOMlzbwec: new Date().toISOString(), fldw8MWCtjotaU9Tw: "Organic",
    _valid: o.valid !== false, _client: !!o.client, _kind: o.kind || "Form", fldDI13VDK04kQnYK: details } });
}
function matches(table, rec, formula) {
  if (!formula) return true;
  const f = rec.fields; let m;
  if (table === "tblW1A0iKDAd111iI") {
    if (!formula.includes("{Form/Call}='Form'") || !formula.includes("{Form/Call}='Email'") || !formula.includes("{Client Portfolio}=BLANK()") || !formula.includes("{Valid/Spam}='✅ Valid'")) throw new Error("mock: Call Tracker filter is missing a required condition");
    if (!f._valid || f._client || !["Form", "Email"].includes(f._kind)) return false;
    m = formula.match(/\{Call Number\}>(\d+)/); return m ? Number(f[NUM]) > Number(m[1]) : true;
  }
  if (table === "tbl9olHmI5p746DOe") return formula.includes(`RECORD_ID()='${rec.id}'`);
  if ((m = formula.match(/^AND\(\{DD1 Call Number\}>0,\{Rule\}='(.*)'\)$/))) return f["DD1 Call Number"] > 0 && f.Rule === m[1];
  if ((m = formula.match(/^AND\(\{Source\}='DD1 form \(shadow\)',NOT\(\{Rule\}='(.*)'\)\)$/))) return f.Source === "DD1 form (shadow)" && f.Rule !== m[1];
  if ((m = formula.match(/^\{Mobile\}='(.*)'$/))) return f.Mobile === m[1];
  if ((m = formula.match(/^\{EIN\}='(.*)'$/))) return f.EIN === m[1];
  if ((m = formula.match(/^FIND\('(.*)',\{Purchase\}\)>0$/))) return String(f.Purchase).includes(m[1]);
  if (formula.startsWith("AND({Status}='Offered'")) return f.Status === "Offered" && new Date(f["Offer Ends At"]) > new Date();
  throw new Error("mock: unknown formula " + formula);
}
// ---- stand-in AI: decides from words inside the uploaded test files ----
export const ai = { calls: 0, down: false, last: null };
function aiMock(body, headers) {
  ai.calls++; ai.last = { body, headers };
  if (ai.down) return new Response("overloaded", { status: 529 });
  const docs = body.messages[0].content.filter((c) => c.source).map((c) => Buffer.from(c.source.data, "base64").toString());
  const read = (text, extra) => ({ result: /FAIL/.test(text) ? "fail" : /UNSURE/.test(text) ? "unsure" : "pass", reason_for_pro: /FAIL/.test(text) ? "This looks like the wrong kind of document." : /UNSURE/.test(text) ? "The photo is too blurry to read." : "", name_on_document: "Test Pro", expires: (text.match(/EXPIRES (\d{4}-\d{2}-\d{2})/) || [])[1] || "", ...extra });
  const input = { business: read(docs[0], { document_type_matches: true, ein_on_document: (docs[0].match(/EIN (\d{9})/) || [])[1] || "" }), insurance: read(docs[1], { shows_general_liability: true }) };
  return new Response(JSON.stringify({ content: [{ type: "tool_use", name: "report", input }] }), { status: 200 });
}
export const stored = new Map(), sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url || input);
  if (url.hostname === "ai.test") return aiMock(JSON.parse(init.body), init.headers);
  if (url.hostname !== "api.airtable.com") return realFetch(input, init);
  const [, , , table, id] = url.pathname.split("/");
  let rows = db[table]; const method = init.method || "GET"; const body = init.body ? JSON.parse(init.body) : null;
  const clean = (r) => ({ id: r.id, fields: Object.fromEntries(Object.entries(r.fields).filter(([k]) => !k.startsWith("_"))) });
  const ok = (d) => new Response(JSON.stringify(d), { status: 200 });
  if (method === "GET" && id) { const r = rows.find((x) => x.id === id); return r ? ok(clean(r)) : new Response("{}", { status: 404 }); }
  if (method === "GET") {
    let out = rows.filter((r) => matches(table, r, url.searchParams.get("filterByFormula")));
    const sf = url.searchParams.get("sort[0][field]"), dir = url.searchParams.get("sort[0][direction]") === "desc" ? -1 : 1;
    if (sf) { const key = sf === "Call Number" ? NUM : sf; out = [...out].sort((a, b) => (Number(a.fields[key]) - Number(b.fields[key]) || String(a.fields[key]).localeCompare(String(b.fields[key]))) * dir); }
    const max = Number(url.searchParams.get("maxRecords") || 100);
    return ok({ records: out.slice(0, max).map(clean) });
  }
  if (method === "POST") { const made = body.records.map((r) => ({ id: rid(), fields: { ...r.fields } })); rows.push(...made); return ok({ records: made.map(clean) }); }
  if (method === "PATCH") { const r = rows.find((x) => x.id === id); Object.assign(r.fields, body.fields); return ok(clean(r)); }
  if (method === "DELETE") { const ids = url.searchParams.getAll("records[]"); db[table] = rows.filter((r) => !ids.includes(r.id)); return ok({ records: ids.map((i) => ({ id: i, deleted: true })) }); }
  return new Response("{}", { status: 405 });
};

export const env = {
  AIRTABLE_TOKEN: "test", SESSION_SECRET: "local-test-secret", TEST_CODE: "424242", ADMIN_KEY: "admin", SHADOW_MODE: "true",
  SHADOW_SHARED_PRICE: "75", SHADOW_EXCLUSIVE_PRICE: "225", SHADOW_MAX_PROS: "5", SHADOW_OFFER_HOURS: "24", TEST_BALANCE: "240",
  ANTHROPIC_API_KEY: "test-key", ANTHROPIC_API: "https://ai.test/v1/messages",
  DOCS: { put: async (k, v, o) => { stored.set(k, { size: v.byteLength, ...o }); } },
  EMAIL: { send: async (msg) => { sent.push(msg); return { messageId: "m" + sent.length }; } },
  ASSETS: { fetch: async (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname); let file = join(DIST, p);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return new Response(readFileSync(join(DIST, "404.html")), { status: 404, headers: { "Content-Type": "text/html" } });
    return new Response(readFileSync(file), { headers: { "Content-Type": TYPES[extname(file)] || "application/octet-stream" } });
  } },
};
export { worker, ingest };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (let n = 1; n <= 8; n++) seedForm(n, { service: ["Roof Repair", "Driveway Replacement", "Fence Install", "Water Heater"][n % 4], city: ["Memphis", "Germantown", "Bartlett"][n % 3] });
  seedForm(9, { valid: false }); seedForm(10, { site: SITE_GBP }); seedForm(11, { kind: "Email" });
  console.log("ingest:", await ingest(env));
  const port = Number(process.argv[2] || 8790);
  http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  }).listen(port, () => console.log("http://localhost:" + port));
}
