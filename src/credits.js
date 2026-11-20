// Lead credit policy (doc "Hammer Hound — Lead Quality & Credit Policy", Ryan 2026-11-20).
// A pro reports a bought lead with one reason. The records decide: approve, deny, or send it to a person.
// Approved credits ALWAYS go back to the wallet. Nothing is ever refunded to a card (Ryan 2026-11-20).

export const REASONS = {
  wrong_number: "Wrong or disconnected number",
  not_real: "Not a real request",
  wrong_trade: "Wrong trade",
  outside_area: "Outside my area",
  duplicate: "Duplicate of a lead I already bought",
  older_than_shown: "Older than the offer showed",
};
export const REPORT_DAYS = 7, WRONG_NUMBER_HOURS = 72, CALLS_NEEDED = 2, CALL_GAP_HOURS = 2, CALL_WINDOW_HOURS = 48;
export const RATE_WATCH = 0.2, RATE_CEILING = 0.35, RATE_MIN_PURCHASES = 10, RATE_LAST = 20;
export const NOTE_REQUIRED = new Set(["not_real", "wrong_trade"]);
const CLOSED_PIPELINE = new Set(["Contacted", "Quoted", "Won"]);

export const parseCalls = (v) => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
export const parseSnap = (v) => { try { return JSON.parse(v || "null"); } catch { return null; } };

// Calls that count as proof for a wrong number: made within 48 h of buying, and two of them at least 2 h apart.
export function callsProve(calls, boughtAt) {
  const t0 = Date.parse(boughtAt), ts = calls.map((c) => Date.parse(c.at)).filter((t) => t >= t0 && t - t0 <= CALL_WINDOW_HOURS * 3600e3).sort((a, b) => a - b);
  return ts.length >= CALLS_NEEDED && ts[ts.length - 1] - ts[0] >= CALL_GAP_HOURS * 3600e3;
}

// Can this pro report this lead now? Returns an error the pro reads, or "" when the report is allowed.
export function reportBlock({ reason, note, boughtAt, pipeline, reviewStatus, calls, hasEvidence, now = Date.now() }) {
  if ((reviewStatus || "None") !== "None") return "This lead has already been reported.";
  if (!REASONS[reason]) return "Pick the reason that fits.";
  const hours = (now - Date.parse(boughtAt)) / 3600e3;
  if (hours > REPORT_DAYS * 24) return `Leads can be reported for ${REPORT_DAYS} days after you buy them. This one is past that.`;
  if (CLOSED_PIPELINE.has(pipeline)) return `You marked this lead ${pipeline}, so it reached the owner and cannot be credited.`;
  if (NOTE_REQUIRED.has(reason) && String(note || "").trim().length < 10) return "Tell us in a sentence what happened.";
  if (reason === "wrong_number") {
    if (hours > WRONG_NUMBER_HOURS) return `A wrong number must be reported within ${WRONG_NUMBER_HOURS} hours of buying.`;
    if (!callsProve(calls, boughtAt) && !hasEvidence) return `Call the owner at least ${CALLS_NEEDED} times, ${CALL_GAP_HOURS} hours apart, with the Call button (or attach a screenshot of your call log), then report it.`;
  }
  return "";
}

// The decision. Facts are gathered by the worker; this function only reads them.
// status: "Approved" | "Denied" | "Needs person". reason: one sentence the pro reads.
export function decideCredit(f) {
  const out = (status, reason) => ({ status, reason });
  // A person looks at every report from an account whose recent credit rate is high.
  if (f.rate && f.rate.n >= RATE_MIN_PURCHASES) {
    const r = f.rate.credited / f.rate.n;
    if (r > RATE_CEILING) return out("Needs person", `More than ${Math.round(RATE_CEILING * 100)}% of your recent leads were credited, so a person reviews each of your reports.`);
    if (r > RATE_WATCH) return out("Needs person", "A person is reviewing this report.");
  }
  switch (f.reason) {
    case "wrong_number":
      if (f.othersReached) return out("Denied", "Another pro who bought this lead reached the owner at this number.");
      if (f.line === "inactive") return out("Approved", "The number is not in service.");
      return out("Needs person", f.line === "active" ? "The number shows as active, so a person will check your calls." : "We could not check the line, so a person will check your calls.");
    case "not_real":
      if (f.othersReached) return out("Denied", "Another pro who bought this lead reached the owner about this job.");
      if (f.ai === "no") return out("Approved", "The request does not ask for work to be done.");
      return out("Needs person", "A person will read the request and your note.");
    case "wrong_trade":
      if (f.ai === "no") return out("Approved", `The job is not ${f.tradeName ? f.tradeName.toLowerCase() + " " : ""}work.`);
      return out("Needs person", "A person will compare the job with the trade it was sold under.");
    case "outside_area":
      if (f.outside === true) return out("Approved", `${f.place || "The job"} was outside your service area when you bought it.`);
      if (f.outside === false) return out("Denied", `${f.place || "The job"} was inside your service area when you bought it.`);
      return out("Needs person", "We could not place the job on a map, so a person will check it.");
    case "duplicate":
      return f.dupOf ? out("Approved", `You bought the same person and job on ${f.dupOf}.`) : out("Denied", "We found no other lead with this phone number and trade sold to you in the last 30 days.");
    case "older_than_shown":
      return f.olderBy > 1 ? out("Approved", `The request came in ${Math.round(f.olderBy)} hours earlier than the offer showed.`) : out("Denied", "The offer showed the time the request came in.");
    default:
      return out("Needs person", "A person will review this report.");
  }
}

export const RATE = (purchases, exceptId) => {
  const last = purchases.filter((p) => p.id !== exceptId).sort((a, b) => String(b.fields["Bought At"]).localeCompare(String(a.fields["Bought At"]))).slice(0, RATE_LAST);
  return { n: last.length, credited: last.filter((p) => p.fields["Review Status"] === "Approved").length };
};
