// Writes the Worker's secrets to secrets.json for `wrangler secret bulk`.
// Stops with a clear message if a repository secret is missing or empty.
import { writeFileSync } from "node:fs";
const names = ["AIRTABLE_TOKEN", "SESSION_SECRET", "TEST_CODE", "ADMIN_KEY"];
const missing = names.filter((n) => !process.env[n]);
if (missing.length) {
  console.error("Missing or empty repository secret(s): " + missing.join(", "));
  process.exit(1);
}
// Optional: set when present, skipped when not.
const optional = ["ANTHROPIC_API_KEY"].filter((n) => process.env[n]);
const all = [...names, ...optional];
writeFileSync("secrets.json", JSON.stringify(Object.fromEntries(all.map((n) => [n, process.env[n]]))));
console.log("Wrote " + all.length + " secrets." + (optional.length ? "" : " ANTHROPIC_API_KEY is not set, so documents will wait for a person."));
