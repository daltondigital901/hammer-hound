// The pricing engine. Pure functions: no network, no clock, no storage. Everything it needs is passed in,
// and everything it decides is returned with its reasons, so any price can be explained and re-computed.
//
//   shared price = job value x rate                         what the work is worth to the pro
//                x size x timing x property x contact       what this particular request is worth
//                x market                                   how hard leads are to get, or to sell, here
//                then never under the cost floor, and inside the minimum and maximum, to the nearest $5
//   exclusive    = shared x exclusive multiple
//
// The age markdown for older leads is separate (worker.js priceOf): it is applied when a lead is shown or
// bought, on top of the price set here.

export const PRICING_VERSION = "p1";

export const PRICING = {
  // Base: a shared lead costs this share of what a typical major job in the trade is worth.
  rate: 0.03,
  defaultJobValue: 2500,
  // Typical major-job value by trade, from the DD1 Niche List field "Major Job Floor ($)" (November 2026).
  // Trades with no matching niche are absent and use defaultJobValue. The Pricing Trades table overrides these.
  jobValue: {
    roofing: 3000, "asphalt-paving": 3000, pavers: 3000, masonry: 2500, concrete: 2500, gutters: 1200, demolition: 2000,
    excavation: 3500, fencing: 2000, landscaping: 1500, flooring: 2000, painting: 1500, drywall: 800, remodeling: 3000,
  },
  // The request itself. Values the lead writer could not determine are neutral (1).
  size: { Small: 0.7, Medium: 1, Large: 1.5, "Not stated": 1 },
  timing: { Emergency: 1.25, "Within a week": 1.15, "Within a month": 1, Flexible: 0.85, "Not stated": 1 },
  property: { Business: 1.2, Home: 1, Rental: 1, "Not stated": 1 },
  // An invitation to bid goes to many subcontractors and is won on price, so it is worth less than an owner's request.
  // It replaces the property multiplier: a bid is always commercial, and that is already in this number.
  bid: 0.6,
  // Can the pro reach the owner? A phone number is what closes jobs.
  contact: { phone: 1, emailOnly: 0.6, none: 0.4 },
  address: 1.05,                       // a street address was given
  requestClamp: [0.4, 2.5],            // the request multipliers together stay inside this range
  // The market multiplier moves with sell-through: of the sales that were possible in the last 30 days, the share that happened.
  // "Possible" is one sale per spot, but never more spots than there are real pros to take them: a market with two pros
  // cannot fill five spots, and should not have its prices cut for failing to.
  market: {
    target: 0.4,                       // sell-through at which the price is right. Above it the price rises, below it falls.
    gain: 1,                           // how hard it reacts: +0.1 of sell-through over target adds 10 percent
    min: 0.75, max: 1.5,
    minLeads: 10,                      // fewer leads than this in 30 days, or no real pro: not enough data, stay at 1
    maxStep: 0.1,                      // the most it moves in one daily update
  },
  // Cost floor: one sale at the shared price must cover the cost of the lead plus this margin.
  margin: 0.5,
  exclusiveMultiple: 3,
  round: 5, min: 15, max: 400,
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const roundTo = (n, step) => Math.round(n / step) * step;
const r2 = (n) => Math.round(n * 100) / 100;
const pos = (n) => (Number(n) > 0 ? Number(n) : 0);

// lead:   { trade, size, timing, property, bid, hasPhone, hasEmail, hasAddress }
// trade:  the Pricing Trades row for the lead's trade, or null: { jobValue, ratePct, min, max }
// market: the Pricing Markets row for the lead's market and trade, or null: { manual, demand, costPerLead }
export function priceLead(lead, trade = null, market = null, cfg = PRICING) {
  const t = trade || {}, m = market || {};
  const jobValue = pos(t.jobValue) || cfg.jobValue[lead.trade] || cfg.defaultJobValue;
  const rate = pos(t.ratePct) ? pos(t.ratePct) / 100 : cfg.rate;
  const base = jobValue * rate;

  const f = {
    size: cfg.size[lead.size] ?? 1,
    timing: cfg.timing[lead.timing] ?? 1,
    property: lead.bid ? 1 : cfg.property[lead.property] ?? 1,
    bid: lead.bid ? cfg.bid : 1,
    contact: lead.hasPhone ? cfg.contact.phone : lead.hasEmail ? cfg.contact.emailOnly : cfg.contact.none,
    address: lead.hasAddress ? cfg.address : 1,
  };
  const requestRaw = f.size * f.timing * f.property * f.bid * f.contact * f.address;
  const request = clamp(requestRaw, cfg.requestClamp[0], cfg.requestClamp[1]);

  const marketX = pos(m.manual) ? pos(m.manual) : clamp(pos(m.demand) || 1, cfg.market.min, cfg.market.max);
  const raw = base * request * marketX;

  const lo = Math.max(cfg.min, pos(t.min)), hi = pos(t.max) || cfg.max;
  const costFloor = pos(m.costPerLead) ? pos(m.costPerLead) * (1 + cfg.margin) : 0;
  // The cost floor wins over the maximum: a lead is never sold for less than it cost plus the margin.
  let shared = clamp(roundTo(raw, cfg.round), lo, Math.max(lo, hi)), bound = raw < lo ? "minimum" : raw > hi ? "maximum" : "";
  if (costFloor > shared) { shared = Math.ceil(costFloor / cfg.round) * cfg.round; bound = "cost floor"; }
  const exclusive = roundTo(shared * cfg.exclusiveMultiple, cfg.round);

  return {
    shared, exclusive,
    basis: {
      v: PRICING_VERSION, trade: lead.trade, jobValue, jobValueFrom: pos(t.jobValue) ? "Pricing Trades" : cfg.jobValue[lead.trade] ? "Niche List default" : "default",
      rate: r2(rate), base: r2(base), factors: { ...f, request: r2(request), market: r2(marketX), marketFrom: pos(m.manual) ? "manual" : pos(m.demand) ? "demand" : "none" },
      raw: r2(raw), min: lo, max: hi, costFloor: r2(costFloor), bound,
      shared, exclusive,
    },
  };
}

// The market multiplier for one market and trade, from 30 days of real sales.
// stats: { leads, claims, pros, spots }   prev: yesterday's multiplier (1 if none)
export function demandMultiplier(stats, prev = 1, cfg = PRICING) {
  const k = cfg.market, last = pos(prev) || 1;
  if (!(stats.pros >= 1)) return { multiplier: 1, sellThrough: 0, note: "No real verified pro here yet" };
  const possible = stats.leads * Math.max(1, Math.min(stats.spots, stats.pros));
  if (!(stats.leads >= k.minLeads)) return { multiplier: 1, sellThrough: stats.leads ? r2(clamp(stats.claims / possible, 0, 1)) : 0, note: `Only ${stats.leads} leads in 30 days (needs ${k.minLeads})` };
  const sellThrough = clamp(stats.claims / possible, 0, 1);
  const want = clamp(1 + k.gain * (sellThrough - k.target), k.min, k.max);
  const multiplier = r2(clamp(want, last - k.maxStep, last + k.maxStep));
  return { multiplier, sellThrough: r2(sellThrough), note: `${Math.round(sellThrough * 100)}% of possible sales made against a ${Math.round(k.target * 100)}% target${multiplier !== r2(want) ? `, moving toward ${r2(want)}` : ""}` };
}

// A few plain words for the pro: what made this lead cost more or less than the trade's usual price.
export function priceReasons(basis) {
  if (!basis || !basis.factors) return [];
  const f = basis.factors, out = [];
  if (f.bid < 1) out.push("bid invitation");
  if (f.size > 1) out.push("large job"); else if (f.size < 1) out.push("small job");
  if (f.timing >= 1.25) out.push("emergency"); else if (f.timing > 1) out.push("wants it within a week"); else if (f.timing < 1) out.push("flexible timing");
  if (f.property > 1) out.push("business property");
  if (f.contact < 1) out.push("no phone number given");
  if (f.market > 1) out.push("high demand here"); else if (f.market < 1) out.push("low demand here");
  return out;
}
