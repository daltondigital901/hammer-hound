// Static site generator for hammerhound.com. No dependencies.
// Usage: node site/build.mjs   ->  writes site/dist
import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { site, reviews, tradeGroups, trades, popular, faqs, guides, nextGuide, guideCategories } from "./src/data.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "dist");
const YEAR = new Date().getFullYear();
const TAG = site.tagline;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hash = (f) => createHash("sha1").update(readFileSync(join(SRC, f))).digest("hex").slice(0, 8);
const V = { css: hash("styles.css"), js: hash("app.js") };
const fmtDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtDay = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// ---------- icons ----------
const IC = {
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  doc: '<path d="M7 3h7l4 4v14H7V3z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.500 2 8 6"/>',
};
const icon = (n, size = 20) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
const star = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.600L12 17.600l-5.900 3.100 1.200-6.600L2.500 9.500l6.600-.9L12 2.500z"/></svg>';

// ---------- shared pieces ----------
const logo = (dark, withTag) => `<a class="logo" href="/" aria-label="${esc(site.name)} home">
  <img src="/assets/img/${dark ? "badge-on-dark" : "badge"}.png" alt="" width="${dark ? 41 : 40}" height="48">
  <span class="logo-text"><img class="wordmark" src="/assets/img/wordmark-${dark ? "white" : "black"}.svg" alt="${esc(site.name)}" width="135" height="19">${withTag ? `<span class="tagline tagline--xs">${esc(TAG)}</span>` : ""}</span>
</a>`;

const header = (current) => `<header class="site-header">
  <div class="wrap header-row">
    ${logo(false, true)}
    <nav class="nav" aria-label="Main">
      <a href="/how-it-works/"${current === "how" ? ' aria-current="page"' : ""}>How it works</a>
      <a href="/cost-guides/"${current === "guides" ? ' aria-current="page"' : ""}>Cost guides</a>
      <a href="/contact/"${current === "contact" ? ' aria-current="page"' : ""}>Contact</a>
      <a class="btn btn--outline btn--sm" href="/pros/">For pros</a>
    </nav>
    <div class="nav-mobile">
      <a class="nav-pros" href="/pros/">For pros</a>
      <button class="icon-btn" type="button" data-menu-toggle aria-expanded="false" aria-controls="mobile-menu" aria-label="Menu">${icon("menu", 24)}</button>
    </div>
  </div>
  <div class="mobile-menu" id="mobile-menu" hidden>
    <a href="/request/">Start a request</a>
    <a href="/how-it-works/">How it works</a>
    <a href="/trades/">All trades</a>
    <a href="/cost-guides/">Cost guides</a>
    <a href="/contact/">Contact</a>
    <a href="/pros/">For pros</a>
    <a href="/pros/sign-in/">Pro sign in</a>
  </div>
</header>`;

const flowHeader = (rightLabel, rightHref) => `<header class="site-header">
  <div class="wrap header-row">
    ${logo(false, true)}
    <a class="link-quiet" href="${rightHref}">${esc(rightLabel)}</a>
  </div>
</header>`;

const hazard = '<div class="hazard" aria-hidden="true"></div>';
const copyright = `&copy; <span data-year>${YEAR}</span> ${esc(site.name)}. All rights reserved.`;
const legalLinks = `<a href="/terms/">Terms of Use</a><span aria-hidden="true">&middot;</span><a href="/privacy/">Privacy Policy</a><span aria-hidden="true">&middot;</span><a href="/sms-policy/">SMS Policy</a><span aria-hidden="true">&middot;</span><a href="/contact/">Contact</a>`;

const footerFull = () => `${hazard}<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      ${logo(true, false)}
      <p class="tagline tagline--sm">${esc(TAG)}</p>
      <p>Find a local pro for any job. Free for property owners.</p>
    </div>
    <div><h2>Property owners</h2><a href="/how-it-works/">How it works</a><a href="/trades/">All trades</a><a href="/cost-guides/">Cost guides</a><a href="/request/">Start a request</a></div>
    <div><h2>Pros</h2><a href="/pros/">Join as a pro</a><a href="/pros/sign-in/">Pro sign in</a></div>
    <div><h2>Company</h2><a href="/contact/">Contact</a><a href="/terms/">Terms of Use</a><a href="/privacy/">Privacy Policy</a><a href="/sms-policy/">SMS Policy</a></div>
  </div>
  <div class="wrap footer-bar"><p>${copyright}</p><p class="footer-links">${legalLinks}</p></div>
</footer>`;

const footerSlim = () => `${hazard}<footer class="site-footer site-footer--slim">
  <div class="wrap footer-bar"><p>${copyright}</p><p class="tagline tagline--sm">${esc(TAG)}</p><p class="footer-links">${legalLinks}</p></div>
</footer>`;

const placeholderNote = (text) => (site.launched ? "" : `<p class="placeholder-note">${esc(text)}</p>`);
const checks = (items, cls = "") => `<ul class="checks ${cls}">${items.map((t) => `<li>${icon("check", 18)}<span>${esc(t)}</span></li>`).join("")}</ul>`;

const quoteBar = (o = {}) => `<form class="quote-bar" action="/request/" method="get">
  ${o.trade ? `<input type="hidden" name="trade" value="${esc(o.trade)}">` : `<label class="field field--icon"><span class="sr-only">What do you need done?</span>${icon("search")}<input type="text" name="job" placeholder="What do you need done?" autocomplete="off"></label>`}
  <label class="field field--icon field--zip"><span class="sr-only">ZIP code</span>${icon("pin")}<input type="text" name="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="ZIP code" autocomplete="postal-code"></label>
  <button class="btn btn--yellow" type="submit">Get free quotes</button>
</form>`;

const guideCard = (g, i) => `<a class="card guide-card" href="/cost-guides/${g.slug}/" data-guide data-category="${esc(g.category)}" data-text="${esc((g.title + " " + g.category + " " + g.crumb).toLowerCase())}">
  <img src="/assets/img/${g.image}" alt="" width="960" height="645" loading="lazy">
  <div class="guide-card-body">
    <p class="chips"><span class="chip">${esc(g.category)}</span>${i === 0 ? '<span class="chip chip--yellow">New this week</span>' : ""}</p>
    <h3>${esc(g.title)}</h3>
    <p class="typical">Typical: ${esc(g.typical)}</p>
    <p class="meta">${fmtDate(g.date)} &middot; ${g.minutes} min read</p>
    <span class="link-more">Read ${icon("chevron", 16)}</span>
  </div>
</a>`;

const stepList = (steps) => `<ol class="steps">${steps.map(([t, d], i) => `<li><span class="step-num">${i + 1}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join("")}</ol>`;

// ---------- page shell ----------
const pages = [];
function page({ path, title, desc, body, current, noindex, chrome = "site", footer = "slim", jsonld, bodyClass = "", script = "" }) {
  const canonical = site.url + path;
  const robots = !site.launched || noindex ? '<meta name="robots" content="noindex, nofollow">' : "";
  const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ""}
${robots}
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1D2125">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
${desc ? `<meta property="og:description" content="${esc(desc)}">` : ""}
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${site.url}/og-image-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/assets/fonts/archivo-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/styles.css?v=${V.css}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
${chrome === "site" ? header(current) : chrome}
<main id="main">
${body}
</main>
${footer === "full" ? footerFull() : footer === "slim" ? footerSlim() : `<p class="mini-legal">${copyright}</p>`}
<script>window.HH=${JSON.stringify({ endpoints: site.endpoints })};</script>
<script src="/assets/app.js?v=${V.js}" defer></script>${script ? `\n<script src="/assets/${script}?v=${hash(script)}" defer></script>` : ""}
</body>
</html>
`;
  pages.push({ path, html: head, noindex: !!noindex });
}

const D = (s) => `${s} ${TAG}`;

// ---------- home ----------
page({
  path: "/",
  title: `${site.name} | ${TAG}`,
  desc: D("Tell us the job and hear from up to 5 verified local pros. Free for property owners."),
  footer: "full",
  jsonld: { "@context": "https://schema.org", "@type": "Organization", name: site.name, legalName: site.legalName, url: site.url, logo: site.url + "/android-chrome-512x512.png", slogan: TAG },
  body: `
<section class="hero">
  <div class="hero-copy">
    <div class="hero-inner">
      <h1>Find a local pro for any job.</h1>
      <p class="lead">Describe the job once. You choose how many pros call, from one to five.</p>
      ${quoteBar()}
      ${checks(["Free for property owners", "You choose 1 to 5 pros", "Never sold to call lists"], "checks--row checks--yellow")}
    </div>
  </div>
  <div class="hero-photo"><img src="/assets/img/hero.jpg" alt="A contractor in a hard hat talking with a homeowner in her driveway" width="1536" height="1024" fetchpriority="high"></div>
</section>
${hazard}

<section class="section">
  <div class="wrap">
    <div class="section-head"><h2>What property owners say</h2><p class="chips"><span class="chip chip--green">${icon("shield", 16)} License on file</span><span class="chip chip--green">${icon("check", 16)} Insured</span></p></div>
    <div class="grid grid--3">
      ${reviews.map((r) => `<figure class="card review"><div class="stars" aria-label="5 out of 5 stars">${star.repeat(5)}</div><blockquote>&ldquo;${esc(r.quote)}&rdquo;</blockquote><figcaption>${esc(r.who)} &middot; ${esc(r.job)}</figcaption></figure>`).join("")}
    </div>
    ${placeholderNote("Sample reviews and badges. Placeholders until real reviews and license checks exist.")}
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    <div class="section-head"><h2>Popular jobs</h2><a class="link-more" href="/trades/">See all trades ${icon("chevron", 16)}</a></div>
    <div class="grid grid--4 tiles">
      ${popular.map((t) => `<a class="tile" href="/trades/${t.slug}/"><span><strong>${esc(t.short || t.name)}</strong><small>${esc(t.blurb)}</small></span>${icon("chevron", 18)}</a>`).join("")}
    </div>
  </div>
</section>

<section class="section section--concrete">
  <div class="wrap">
    <h2>How it works</h2>
    ${stepList([
      ["Tell us the job", "A few questions about the work, the address and your timing. About two minutes."],
      ["Pick how many pros", "One call, or up to five quotes to compare. You set the number."],
      ["Pros call you", "Local pros who want the job get your request right away and call you."],
    ])}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <p class="chips"><span class="chip chip--yellow">New every week</span></p>
    <div class="section-head"><div><h2>Cost guides</h2><p class="sub">Know what a job should cost before the first pro calls. One new guide every Monday.</p></div><a class="link-more" href="/cost-guides/">See all guides ${icon("chevron", 16)}</a></div>
    <div class="grid grid--3">${guides.slice(0, 6).map(guideCard).join("")}</div>
    ${placeholderNote("Price ranges are placeholders, not real cost data.")}
  </div>
</section>

<section class="pro-band">
  <div class="wrap pro-band-row">
    <div><h2>Are you a contractor?</h2><p>Get job leads by text and buy only the ones you want. Your first 3 are free.</p></div>
    <a class="btn btn--yellow" href="/pros/">Join as a pro</a>
  </div>
</section>`,
});

// ---------- how it works ----------
page({
  path: "/how-it-works/",
  title: `How It Works | ${site.name}`,
  desc: D("Tell us the job, pick how many pros call, and compare quotes. Free for owners."),
  current: "how",
  footer: "full",
  body: `
<section class="page-hero page-hero--yellow">
  <div class="wrap">
    <h1>One request. You decide who calls.</h1>
    <p class="lead">Free for property owners, for any trade and any size of job.</p>
    <a class="btn btn--black" href="/request/">Start a request</a>
  </div>
</section>
${hazard}
<section class="section">
  <div class="wrap">
    <p class="eyebrow">For property owners</p>
    ${stepList([
      ["Tell us the job", "Describe it in your own words and answer a few questions about the property, size, budget and timing. It takes about two minutes, and any trade is fine."],
      ["Pick how many pros", "Choose one call, or up to five quotes to compare. That number is the most pros who will ever get your details for this request."],
      ["Pros call you", "Local pros who want the job take your request and call you. Your status page shows who accepted and when."],
      ["You pick a pro", "Compare quotes and hire who you like, or no one. You can stop more calls from your status page at any time."],
    ])}
    <div class="callout">${icon("shield", 24)}<div><h3>Your number is not sold to a call list</h3><p>It goes only to the pros who take your request, up to the number you picked. No one else gets it.</p></div></div>
  </div>
</section>
<section class="section section--dark">
  <div class="wrap">
    <p class="eyebrow eyebrow--yellow">For pros</p>
    <div class="section-head"><h2>Your first 3 leads are free. After that you buy only the leads you want.</h2><a class="btn btn--yellow" href="/pros/">Join as a pro</a></div>
    ${stepList([
      ["Get offers by text", "See the trade, the area and the job size before you spend anything."],
      ["Buy only what you want", "Reply YES to buy a lead from your balance. Take it exclusive if no one else has bought."],
      ["Call the owner", "Full contact details arrive in seconds, so you can call while the owner is still thinking about the job."],
    ])}
  </div>
</section>
<section class="section">
  <div class="wrap wrap--narrow">
    <h2>Common questions</h2>
    <p class="sub">Still stuck? <a href="/contact/">Chat with support from the Contact page.</a></p>
    <div class="faq">${faqs.map((f) => `<details><summary>${esc(f.q)}${icon("chevron", 18)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
  </div>
</section>`,
});

// ---------- trades ----------
page({
  path: "/trades/",
  title: `Find a Local Pro for Any Job | ${site.name}`,
  desc: D("Concrete, roofing, paving, fencing and more. Pick a trade and get quotes."),
  body: `
<section class="page-hero">
  <div class="wrap">
    <h1>All trades</h1>
    <p class="lead">Pick the kind of work and get quotes from local pros. Free for property owners.</p>
    <label class="field field--icon field--search"><span class="sr-only">Search trades</span>${icon("search")}<input type="search" placeholder="Search, like &quot;retaining wall&quot;" data-filter="[data-trade]" data-filter-group="[data-trade-group]"></label>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap">
    ${tradeGroups.map((g) => `<div class="trade-group" data-trade-group><h2>${esc(g.name)}</h2><div class="grid grid--4 tiles">${g.trades.map((t) => `<a class="tile" href="/trades/${t.slug}/" data-trade data-text="${esc((t.name + " " + t.blurb + " " + t.jobs.join(" ")).toLowerCase())}"><span><strong>${esc(t.name)}</strong><small>${esc(t.blurb)}</small></span>${icon("chevron", 18)}</a>`).join("")}</div></div>`).join("")}
    <p class="empty" data-filter-empty hidden>No trade matches that. Describe your job instead and we will match it to the right pros.</p>
    <div class="callout callout--yellow"><div><h3>Do not see your job?</h3><p>Describe it in your own words and we will match it to the right pros.</p></div><a class="btn btn--black" href="/request/?trade=other">Describe my job</a></div>
  </div>
</section>`,
});

for (const t of trades) {
  const g = guides.find((x) => x.trade === t.slug);
  const lower = t.name.toLowerCase();
  page({
    path: `/trades/${t.slug}/`,
    title: `${t.name} Pros Near You | ${site.name}`,
    desc: D(`Get quotes from verified local ${lower} pros. Free for property owners.`),
    body: `
<section class="page-hero page-hero--dark">
  <div class="wrap">
    <p class="crumbs"><a href="/trades/">All trades</a> <span aria-hidden="true">&rsaquo;</span> ${esc(t.name)}</p>
    <h1>Get quotes from local ${esc(lower)} pros.</h1>
    <p class="lead">${esc(t.blurb)}. Describe the job once and choose how many pros call, from one to five.</p>
    ${quoteBar({ trade: t.slug })}
    ${checks(["Free for property owners", "You choose 1 to 5 pros", "Never sold to call lists"], "checks--row checks--yellow")}
  </div>
</section>
${hazard}
<section class="section">
  <div class="wrap">
    <h2>What kind of ${esc(lower)} job?</h2>
    <div class="chip-links">${t.jobs.map((j) => `<a class="chip chip--link" href="/request/?trade=${t.slug}&amp;type=${encodeURIComponent(j)}">${esc(j)}</a>`).join("")}</div>
  </div>
</section>
<section class="section section--concrete">
  <div class="wrap">
    <h2>How it works</h2>
    ${stepList([
      ["Tell us the job", "A few questions about the work, the address and your timing. About two minutes."],
      ["Pick how many pros", "One call, or up to five quotes to compare. You set the number."],
      ["Pros call you", `Local ${lower} pros who want the job get your request right away and call you.`],
    ])}
  </div>
</section>
${g ? `<section class="section"><div class="wrap"><div class="section-head"><h2>Know the cost first</h2><a class="link-more" href="/cost-guides/">See all guides ${icon("chevron", 16)}</a></div><div class="grid grid--3">${guideCard(g, -1)}</div>${placeholderNote("Price ranges are placeholders, not real cost data.")}</div></section>` : ""}`,
  });
}

// ---------- cost guides ----------
const [featured, ...restGuides] = guides;
page({
  path: "/cost-guides/",
  title: `Home Project Cost Guides | ${site.name}`,
  desc: D("What common jobs cost before the first pro calls. New guide every Monday."),
  current: "guides",
  body: `
<section class="page-hero">
  <div class="wrap">
    <p class="chips"><span class="chip chip--yellow">New every Monday</span></p>
    <h1>Cost guides</h1>
    <p class="lead">What common jobs cost, in plain English, so you know a fair quote when you hear one.</p>
    <label class="field field--icon field--search"><span class="sr-only">Search guides</span>${icon("search")}<input type="search" placeholder="Search guides, like &quot;fence&quot; or &quot;water heater&quot;" data-filter="[data-guide]"></label>
    <div class="chip-links" role="group" aria-label="Filter by trade"><button class="chip chip--link is-on" type="button" data-category-btn="">All</button>${guideCategories.map((c) => `<button class="chip chip--link" type="button" data-category-btn="${esc(c)}">${esc(c)}</button>`).join("")}</div>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap">
    <a class="card guide-feature" href="/cost-guides/${featured.slug}/" data-guide data-category="${esc(featured.category)}" data-text="${esc((featured.title + " " + featured.category).toLowerCase())}">
      <img src="/assets/img/${featured.image}" alt="" width="960" height="645">
      <div class="guide-card-body">
        <p class="chips"><span class="chip">${esc(featured.category)}</span><span class="chip chip--yellow">New this week</span></p>
        <h2>${esc(featured.title)}</h2>
        <p class="typical">Typical: ${esc(featured.typical)}</p>
        <p>${esc(featured.summary)}</p>
        <p class="meta">${fmtDate(featured.date)} &middot; ${featured.minutes} min read</p>
        <span class="btn btn--yellow">Read the guide</span>
      </div>
    </a>
    <h2 class="mt">Latest guides</h2>
    <div class="grid grid--3">
      ${restGuides.map((g) => guideCard(g, -1)).join("")}
      <div class="card guide-next"><p class="chips"><span class="chip">Coming ${fmtDay(nextGuide.date)}</span></p><h3>${esc(nextGuide.title)}</h3><p class="meta">A new guide is published every Monday.</p></div>
    </div>
    <p class="empty" data-filter-empty hidden>No guide matches that yet. A new one is published every Monday.</p>
    ${placeholderNote("Price ranges are placeholders, not real cost data.")}
  </div>
</section>
<section class="pro-band pro-band--yellow">
  <div class="wrap pro-band-row"><div><h2>Skip the math. Get real quotes.</h2><p>Free for property owners. You choose how many pros call.</p></div><a class="btn btn--black" href="/request/">Get free quotes</a></div>
</section>`,
});

guides.forEach((g, gi) => {
  const more = guides.filter((x) => x.slug !== g.slug).slice(0, 3);
  page({
    path: `/cost-guides/${g.slug}/`,
    title: `${g.title} | ${site.name}`,
    desc: D(`${g.summary}`.length <= 100 ? g.summary : `Typical: ${g.typical}.`),
    current: "guides",
    jsonld: { "@context": "https://schema.org", "@type": "Article", headline: g.title, datePublished: g.date, dateModified: g.date, image: `${site.url}/assets/img/${g.image}`, publisher: { "@type": "Organization", name: site.name } },
    body: `
<article class="article">
  <div class="wrap article-grid">
    <div class="article-main">
      <p class="crumbs"><a href="/cost-guides/">Cost guides</a> <span aria-hidden="true">&rsaquo;</span> ${esc(g.category)} <span aria-hidden="true">&rsaquo;</span> ${esc(g.crumb)}</p>
      ${gi === 0 ? '<p class="chips"><span class="chip chip--yellow">New this week</span></p>' : ""}
      <h1>${esc(g.title)}</h1>
      <p class="meta">Updated ${fmtDate(g.date)} &middot; ${g.minutes} min read</p>
      <div class="stats">${g.stats.map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>
      ${placeholderNote("All figures on this page are placeholders, not real cost data.")}
      <img class="article-photo" src="/assets/img/${g.image}" alt="" width="960" height="645">
      <p class="article-intro">${esc(g.intro)}</p>
      <h2>${esc(g.tableTitle)}</h2>
      <div class="table-wrap"><table><thead><tr>${g.tableHead.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${g.tableRows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <h2>What changes the price</h2>
      <dl class="factors">${g.factors.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      <div class="callout callout--yellow"><div><h3>See what it costs at your address</h3><p>Free quotes from local ${esc(g.pros)}. You choose how many call.</p></div><a class="btn btn--black" href="/request/?trade=${g.trade}">Get free quotes</a></div>
    </div>
    <aside class="article-side">
      <div class="card side-card">
        <h2>${esc(g.cta)}</h2>
        <form action="/request/" method="get" class="stack"><input type="hidden" name="trade" value="${g.trade}">
          <label class="label" for="side-zip">ZIP code</label>
          <label class="field field--icon">${icon("pin")}<input id="side-zip" type="text" name="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="ZIP code" autocomplete="postal-code"></label>
          <button class="btn btn--yellow btn--block" type="submit">Get free quotes</button>
        </form>
        ${checks(["Free for property owners", "You choose 1 to 5 pros", "About two minutes"])}
      </div>
    </aside>
  </div>
  <div class="wrap"><h2 class="mt">More cost guides</h2><div class="grid grid--3">${more.map((m) => guideCard(m, -1)).join("")}</div></div>
</article>`,
  });
});

// ---------- contact ----------
page({
  path: "/contact/",
  title: `Contact | ${site.name}`,
  desc: D(`Questions about a request or a lead? Reach ${site.name} support.`),
  current: "contact",
  footer: "full",
  body: `
<section class="page-hero">
  <div class="wrap"><h1>Contact us</h1><p class="lead">Chat is the fastest way to reach us. Every message opens a ticket so nothing gets lost.</p></div>
</section>
<section class="section section--tight">
  <div class="wrap contact-grid">
    <form class="card form" data-form="contact" novalidate>
      <h2>Send a message</h2>
      <fieldset><legend class="label">I am a</legend><div class="choice-row">
        ${["Property owner", "Pro", "Someone else"].map((r, i) => `<label class="choice"><input type="radio" name="role" value="${r}"${i === 0 ? " checked" : ""}><span>${r}</span></label>`).join("")}
      </div></fieldset>
      <div class="form-row">
        <div><label class="label" for="c-name">Name</label><input class="input" id="c-name" name="name" type="text" placeholder="Your name" autocomplete="name" required></div>
        <div><label class="label" for="c-email">Email</label><input class="input" id="c-email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required></div>
      </div>
      <label class="label" for="c-topic">What is this about?</label>
      <select class="input" id="c-topic" name="topic">${["My request", "A pro who called me", "Stop calls or texts", "Privacy or my data", "Something else"].map((o) => `<option>${o}</option>`).join("")}</select>
      <label class="label" for="c-msg">Message</label>
      <textarea class="input" id="c-msg" name="message" rows="5" placeholder="Tell us what happened and we will take it from there." required></textarea>
      <p class="form-status" data-status role="status" hidden></p>
      <button class="btn btn--yellow" type="submit">Send message</button>
      <p class="meta">We reply by email within 1 business day.</p>
    </form>
    <div class="stack">
      <div class="card side-card">${icon("chat", 24)}<h2>Chat with support</h2><p>Answers right away for common questions, and a ticket for anything else.</p><button class="btn btn--black" type="button" data-chat>Start a chat</button><p class="form-status" data-chat-status role="status" hidden></p></div>
      <div class="card side-card">${icon("user", 24)}<h2>Already a pro?</h2><p>Sign in and use Support so the ticket is attached to your account and the lead in question.</p><a class="btn btn--outline" href="/pros/sign-in/">Pro sign in</a></div>
      <div class="card side-card">${icon("doc", 24)}<h2>Legal and privacy requests</h2><p>Choose &ldquo;Privacy or my data&rdquo; in the form to ask for a copy of your data or to have it deleted.</p><p><a href="/terms/">Terms of Use</a> &middot; <a href="/privacy/">Privacy Policy</a></p></div>
    </div>
  </div>
</section>`,
});

// ---------- legal ----------
function md(src) {
  const inline = (s) => esc(s.replace(/\\\[/g, "[").replace(/\\\]/g, "]")).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const lines = src.split("\n");
  let html = "", updated = "", toc = [], i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim() || l.startsWith("## ")) { i++; continue; }
    if (l.startsWith("Last updated:")) { updated = l.replace("Last updated:", "").trim(); i++; continue; }
    if (l.startsWith("### ")) { const t = l.slice(4); const id = "s" + (toc.length + 1); toc.push([id, t]); html += `<h2 id="${id}">${inline(t)}</h2>`; i++; continue; }
    if (l.startsWith("|")) {
      const rows = []; while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim())); i++; }
      const [h, , ...b] = rows;
      html += `<div class="table-wrap"><table><thead><tr>${h.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${b.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      continue;
    }
    if (l.startsWith("- ")) { html += "<ul>"; while (i < lines.length && lines[i].startsWith("- ")) { html += `<li>${inline(lines[i].slice(2))}</li>`; i++; } html += "</ul>"; continue; }
    html += `<p>${inline(l)}</p>`; i++;
  }
  return { html, updated, toc };
}
for (const [file, path, name] of [["terms.md", "/terms/", "Terms of Use"], ["privacy.md", "/privacy/", "Privacy Policy"], ["sms.md", "/sms-policy/", "SMS Policy"]]) {
  const { html, updated, toc } = md(readFileSync(join(SRC, "legal", file), "utf8"));
  page({
    path,
    title: `${name} | ${site.name}`,
    desc: D(`${name} for ${site.name}.`),
    body: `
<section class="page-hero">
  <div class="wrap"><h1>${name}</h1><p class="meta">Last updated ${esc(updated)}${site.launched ? "" : " &middot; Draft text, pending attorney review"}</p>
  <p class="chip-links"><a class="chip chip--link${path === "/terms/" ? " is-on" : ""}" href="/terms/">Terms of Use</a><a class="chip chip--link${path === "/privacy/" ? " is-on" : ""}" href="/privacy/">Privacy Policy</a><a class="chip chip--link${path === "/sms-policy/" ? " is-on" : ""}" href="/sms-policy/">SMS Policy</a></p></div>
</section>
<section class="section section--tight">
  <div class="wrap legal-grid">
    <nav class="legal-toc" aria-label="On this page"><h2>On this page</h2>${toc.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join("")}</nav>
    <div class="prose">${html}</div>
  </div>
</section>`,
  });
}

// ---------- request flow ----------
const reqTrades = [...popular.map((t) => ({ slug: t.slug, name: t.short || t.name })), { slug: "other", name: "Something else" }];
const optGroup = (name, legend, opts, hint) => `<fieldset data-group="${name}"><legend>${esc(legend)}</legend><div class="option-grid${hint ? " option-grid--tall" : ""}">${opts.map((o) => { const [label, sub] = Array.isArray(o) ? o : [o]; return `<label class="option"><input type="radio" name="${name}" value="${esc(label)}"><span><strong>${esc(label)}</strong>${sub ? `<small>${esc(sub)}</small>` : ""}</span></label>`; }).join("")}</div></fieldset>`;
page({
  path: "/request/",
  title: `Start a Request | ${site.name}`,
  noindex: true,
  chrome: flowHeader("Save and exit", "/"),
  footer: "none",
  bodyClass: "flow",
  body: `
<div class="wrap flow-grid" data-request data-trades='${esc(JSON.stringify(Object.fromEntries(trades.map((t) => [t.slug, { name: t.short || t.name, jobs: t.jobs }]))))}'>
  <form class="flow-main" novalidate>
    <div class="progress" aria-hidden="true"><span data-progress style="width:25%"></span></div>
    <p class="eyebrow" data-step-label>Step 1 of 4</p>

    <section data-step="1">
      <h1>What do you need done?</h1>
      <p class="sub">Pick a trade to start. No typing needed.</p>
      <fieldset data-group="trade"><legend class="sr-only">Trade</legend><div class="option-grid option-grid--3">${reqTrades.map((t) => `<label class="option"><input type="radio" name="trade" value="${t.slug}"><span><strong>${esc(t.name)}</strong></span></label>`).join("")}</div>
      <p class="meta">Need a different trade? <a href="/trades/">See all trades.</a></p></fieldset>
      <fieldset data-group="type" data-type-block hidden><legend data-type-legend>What kind of job?</legend><div class="chip-links" data-type-options></div></fieldset>
      <label class="label" for="r-details">Add details <span data-details-optional>(optional)</span></label>
      <textarea class="input" id="r-details" name="details" rows="3" placeholder="Anything a pro should know"></textarea>
    </section>

    <section data-step="2" hidden>
      <h1>Tell us about the job</h1>
      <p class="sub">Rough answers are fine. Pros will confirm on the call.</p>
      ${optGroup("property", "What kind of property?", ["Home", "Business", "Rental"])}
      ${optGroup("size", "How big is the job?", [["Small repair", "A fix or patch"], ["One area", "A driveway, a room, one side of a roof"], ["Whole property", "Everything, or a new build"]], true)}
      ${optGroup("budget", "Do you have a budget in mind?", ["Under $5,000", "$5,000 to $10,000", "$10,000 to $25,000", "Over $25,000", "Not sure"])}
      ${optGroup("timing", "When do you want it done?", ["As soon as possible", "Within 2 weeks", "Within a month", "Just planning"])}
    </section>

    <section data-step="3" hidden>
      <h1>How many pros should call you?</h1>
      <p class="sub">More pros means more quotes to compare. Fewer means fewer calls.</p>
      <fieldset data-group="pros"><legend class="sr-only">Number of pros</legend><div class="option-grid option-grid--tall option-grid--1">
        <label class="option"><input type="radio" name="pros" value="1"><span><strong>1 pro</strong><small>One call. The fastest way to get started.</small></span></label>
        <label class="option"><input type="radio" name="pros" value="3" checked><span><strong>Up to 3 pros</strong><small>A few quotes to compare.</small></span></label>
        <label class="option"><input type="radio" name="pros" value="5"><span><strong>Up to 5 pros</strong><small>The widest range of prices.</small></span></label>
      </div></fieldset>
      <p class="note">${icon("shield", 18)} This is the most pros who will ever get your details for this request.</p>
    </section>

    <section data-step="4" hidden>
      <h1>Last step: where is the job, and how do pros reach you?</h1>
      <label class="label" for="r-address">Job address</label>
      <input class="input" id="r-address" name="address" type="text" placeholder="Street address" autocomplete="street-address" required>
      <div class="form-row">
        <div><label class="label" for="r-zip">ZIP code</label><input class="input" id="r-zip" name="zip" type="text" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="ZIP code" autocomplete="postal-code" required></div>
        <div><label class="label" for="r-name">Your name</label><input class="input" id="r-name" name="name" type="text" placeholder="Your name" autocomplete="name" required></div>
      </div>
      <label class="label" for="r-phone">Mobile number</label>
      <input class="input" id="r-phone" name="phone" type="tel" placeholder="(555) 555-0100" autocomplete="tel" required>
      <label class="consent"><input type="checkbox" name="consent" value="yes" required><span>I agree that ${esc(site.name)} and <span data-consent-pros>up to 3 pros</span> who take my request may call and text me at this number about it, using automated technology and artificial or prerecorded voice. This includes a recorded confirmation call from an AI assistant. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to opt out. See the <a href="/terms/" target="_blank" rel="noopener">Terms of Use</a>, <a href="/privacy/" target="_blank" rel="noopener">Privacy Policy</a> and <a href="/sms-policy/" target="_blank" rel="noopener">SMS Policy</a>.</span></label>
    </section>

    <p class="form-status" data-status role="alert" hidden></p>
    <div class="flow-actions"><button class="btn btn--outline" type="button" data-back hidden>Back</button><button class="btn btn--yellow" type="button" data-next>Next</button></div>
  </form>

  <aside class="flow-side">
    <div class="card side-card"><h2>Your request so far</h2><ul class="summary" data-summary><li class="meta">Pick a trade to start.</li></ul></div>
    <div class="card side-card side-card--quiet">${checks(["Free for property owners"])}<p class="meta">Your number goes only to the pros who take your request.</p></div>
    <div class="card side-card side-card--quiet" data-next-info hidden><h2>What happens next</h2><p>Our AI assistant calls you${site.confirmationCallNumber ? ` from ${esc(site.confirmationCallNumber)}` : ""} to confirm. Then your request goes to pros.</p></div>
  </aside>
</div>`,
});

// ---------- pros ----------
const proBullets = ["Every job is confirmed by phone before you see it", "Buy as many as you want. No cap, no minimum", "Wrong number or fake request? Credit or refund"];
page({
  path: "/pros/",
  title: `Contractor Leads by Text | ${site.name}`,
  desc: D("Phone-confirmed local jobs sent by text. Buy only the leads you want."),
  footer: "full",
  body: `
<section class="page-hero page-hero--dark">
  <div class="wrap">
    <p class="eyebrow eyebrow--yellow">For pros</p>
    <h1>Leads by text. Buy only the ones you want.</h1>
    <p class="lead">Every job is confirmed by phone before you see it. Your first 3 leads are free.</p>
    <p class="btn-row"><a class="btn btn--yellow" href="/pros/join/">Join as a pro</a><a class="btn btn--ghost" href="/pros/sign-in/">Pro sign in</a></p>
    ${checks(proBullets, "checks--yellow")}
  </div>
</section>
${hazard}
<section class="section">
  <div class="wrap">
    <h2>How it works for pros</h2>
    ${stepList([
      ["Get offers by text", "See the trade, the area and the job size before you spend anything."],
      ["Buy only what you want", "Reply YES to buy a lead from your balance. Take it exclusive if no one else has bought."],
      ["Call the owner", "Full contact details arrive in seconds, so you can call while the owner is still thinking about the job."],
    ])}
  </div>
</section>
<section class="section section--concrete">
  <div class="wrap">
    <h2>What you should know before you join</h2>
    <div class="grid grid--3">
      <div class="card info-card">${icon("doc", 24)}<h3>Verify once</h3><p>Create an account and upload proof of business and proof of insurance. You get leads, including your 3 free ones, once both pass.</p></div>
      <div class="card info-card">${icon("bolt", 24)}<h3>Pay from a balance</h3><p>Leads are paid from a prepaid balance. Auto-refill is optional and you can turn it off at any time.</p></div>
      <div class="card info-card">${icon("user", 24)}<h3>Shared or exclusive</h3><p>An owner picks 1 to 5 pros, so a lead goes to 5 pros at most. If no one has bought it yet, you can take it exclusive.</p></div>
      <div class="card info-card">${icon("shield", 24)}<h3>Bad lead? Credit or refund</h3><p>Wrong number, duplicate or not a real request: report it and choose a credit to your balance or a refund to your card.</p></div>
      <div class="card info-card">${icon("phone", 24)}<h3>Confirmed by phone</h3><p>Every request gets a recorded confirmation call before it is offered to you, including requests sent through a form.</p></div>
      <div class="card info-card">${icon("chat", 24)}<h3>Support by chat</h3><p>Chat opens a ticket on your account, attached to the lead in question.</p></div>
    </div>
  </div>
</section>
<section class="pro-band pro-band--yellow">
  <div class="wrap pro-band-row"><div><h2>Your first 3 leads are free.</h2><p>After that you buy only the leads you want.</p></div><a class="btn btn--black" href="/pros/join/">Join as a pro</a></div>
</section>`,
});


// ---------- pro ads landing page ----------
const feeOffer = (dark) => `<div class="fee-offer${dark ? " fee-offer--dark" : ""}">
  <span class="chip chip--yellow">Limited-time offer</span>
  <p class="fee-line"><span class="fee-was"><span class="sr-only">Was </span>$300</span><span class="fee-now"><span class="sr-only">now </span>$0</span></p>
  <p class="fee-text">Annual membership fee waived</p>
  <p class="fee-fine">Waived for now. We give notice before it starts. See the <a href="/terms/">Terms of Use</a>.</p>
</div>`;
const landingHeader = `<header class="site-header">
  <div class="wrap header-row">
    ${logo(false, true)}
    <div class="header-actions"><a class="link-quiet" href="/pros/sign-in/">Pro sign in</a><a class="btn btn--yellow btn--sm" href="/pros/join/">Get 3 free leads</a></div>
  </div>
</header>`;
const fixes = [
  ["Leads with wrong numbers, or that were never real", "Every lead is confirmed by phone first", "We call every property owner and confirm the job before it is offered to you, including requests that came through a form. If a lead still turns out to be a wrong number, a duplicate or not a real request, you choose a credit or a refund."],
  ["The same lead sold to a dozen contractors", "Five pros at most, or just you", "The owner picks how many pros can call, from 1 to 5. That is the limit. If no one has bought a lead yet, you can take it exclusive and it is sold to nobody else."],
  ["Paying for jobs you would never have taken", "See the job before you spend a dollar", "Each offer shows the trade, the area, the job size and the price. Reply YES to the ones you want and ignore the rest. You are never charged for a lead you did not choose."],
  ["Not enough work coming in", "Every job in your area, as many as you want", "You get a text the moment a job in your trades and service area is confirmed. Buy one or buy them all. There is no cap. We cannot promise how many jobs your area produces, but you will be offered every one."],
  ["Paying every month whether the phone rings or not", "You pay for leads, not for waiting", "Leads come out of a balance you load yourself, and you spend it only on leads you choose. There is no minimum purchase and auto-refill is optional. The $300 annual membership fee is waived for now."],
  ["By the time you call, they have hired someone else", "Details in seconds", "Reply YES and the owner's name, number, address and job notes arrive by text right away, while the owner is still expecting calls."],
];
const proFaqs = [
  ["How much does a lead cost?", "It depends on the trade, the market and the size of the job. The price is in every offer before you buy, so you always know what you are paying."],
  ["How many leads will I get?", "As many as you want to buy. There is no cap and no minimum. How many are offered depends on how many property owners in your service area ask for your trade."],
  ["Are the leads exclusive?", "They are shared with up to 5 pros, because the owner chooses how many can call. If no one has bought a lead yet, you can buy it exclusive at the exclusive price shown."],
  ["What counts as a bad lead?", "A wrong or disconnected number, a duplicate of a lead you already bought from us, a request that was not real, or a job outside your trades or service area. Report it within the window in the Terms and choose a credit or a refund. An owner who does not pick up, hires someone else or changes their mind is not a bad lead."],
  ["What do I need to get my 3 free leads?", "Create an account, then upload proof of your business and proof of insurance. Your free leads unlock when both pass."],
  ["Is there a membership fee?", "Membership is $300 a year, and that fee is waived for now while Hammer Hound launches. We will give you notice before it starts, and you can close your account before then without paying it."],
  ["What am I agreeing to?", "The Terms of Use, which cover leads, balances, the membership fee and refunds. There is no minimum purchase, and you can close your account at any time."],
];
page({
  path: "/pros/leads/",
  title: `Contractor Leads That Are Real Jobs | ${site.name}`,
  desc: D("Phone-confirmed jobs by text. Buy as many as you want. Membership fee waived. First 3 free."),
  noindex: true,
  chrome: landingHeader,
  bodyClass: "landing",
  body: `
<section class="page-hero page-hero--dark lp-hero">
  <div class="wrap lp-hero-grid">
    <div>
      <p class="eyebrow eyebrow--yellow">For contractors</p>
      <h1>Real jobs, confirmed by phone. Buy as many as you want.</h1>
      <p class="lead">Done paying for wrong numbers and tire-kickers? We call every property owner before you ever see the lead. You see the job, then decide.</p>
      ${feeOffer(true)}
      <form class="lp-form" action="/pros/join/" method="get" data-hero-cta>
        <label><span class="sr-only">Your trade</span><select class="input" name="trade" required><option value="">Your trade</option>${trades.map((t) => `<option value="${t.slug}">${esc(t.name)}</option>`).join("")}</select></label>
        <label><span class="sr-only">Business ZIP code</span><input class="input" type="text" name="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="Business ZIP code" autocomplete="postal-code"></label>
        <button class="btn btn--yellow btn--lg" type="submit">Get my 3 free leads</button>
      </form>
      <p class="lp-micro">Two minutes to create your account. Free leads unlock once your business and insurance documents pass.</p>
      ${checks(["Every job confirmed by phone", "No cap, no minimum", "Bad lead? Credit or refund"], "checks--row checks--yellow")}
    </div>
    <div class="sms" aria-label="Sample lead offer by text">
      <p class="sms-from"><img src="/assets/img/badge.png" alt="" width="33" height="40"><span><strong>${esc(site.name)}</strong><small>Text message</small></span></p>
      <p class="sms-in">${esc(site.name)}: New ROOFING lead in your area. Roof leak repair. Job size under $5,000. Owner confirmed by phone. Reply YES to buy, ONLY for exclusive. Ends in 10 min.</p>
      <p class="sms-out">YES</p>
      <p class="sms-in">${esc(site.name)}: Bought. Owner name, phone, address and job notes follow.</p>
      <p class="sms-note">Sample messages. The price is shown in every real offer.</p>
    </div>
  </div>
</section>
${hazard}
<section class="section">
  <div class="wrap">
    <h2>The lead problems you already know, and what we do about each one</h2>
    <div class="grid grid--3 fixes">
      ${fixes.map(([prob, fix, body]) => `<div class="card fix"><p class="fix-problem">${icon("close", 16)}<span><span class="sr-only">Problem: </span>${esc(prob)}</span></p><h3>${esc(fix)}</h3><p>${esc(body)}</p></div>`).join("")}
    </div>
    <p class="btn-row btn-row--center"><a class="btn btn--black btn--lg" href="/pros/join/">Get my 3 free leads</a></p>
  </div>
</section>
<section class="section section--dark">
  <div class="wrap trust-grid">
    <div>
      <p class="eyebrow eyebrow--yellow">Why you can trust the lead</p>
      <h2>We do the checking before you pay, and we put the refund rule in writing.</h2>
      <ul class="trust-list">
        <li>${icon("phone", 22)}<div><h3>We call the owner first</h3><p>A recorded call confirms the job, the address and the timing before any pro is offered the lead.</p></div></li>
        <li>${icon("doc", 22)}<div><h3>The rule is in the Terms</h3><p>Wrong number, duplicate, not a real request or outside your area: credit or refund, your choice. It is the <a href="/terms/">Lead Credit Policy</a>, not a sales promise.</p></div></li>
        <li>${icon("user", 22)}<div><h3>A person, if you ask</h3><p>We review the confirmation call to decide a bad-lead report. If you disagree with the result, ask for a person to review it.</p></div></li>
        <li>${icon("chat", 22)}<div><h3>Support tied to your account</h3><p>Chat opens a ticket attached to your account and to the lead in question, so you never explain it twice.</p></div></li>
      </ul>
      <p class="lp-micro">${esc(site.name)} is a trade name of ${esc(site.legalName)}. Read the <a href="/terms/">Terms of Use</a>, <a href="/privacy/">Privacy Policy</a> and <a href="/sms-policy/">SMS Policy</a>.</p>
    </div>
    <div class="card lead-card">
      <p class="chips"><span class="chip chip--green">${icon("check", 16)} Owner confirmed by phone</span></p>
      <h3>What you get when you buy a lead</h3>
      ${checks(["Owner's name and mobile number", "Job address", "Trade and type of job", "Job size, budget range and timing", "The owner's own notes about the job"])}
      <a class="btn btn--yellow btn--block" href="/pros/join/">Get my 3 free leads</a>
    </div>
  </div>
</section>
<section class="section section--concrete">
  <div class="wrap">
    <h2>How it works</h2>
    ${stepList([
      ["Create your account and verify", "Tell us your trade and ZIP code, then upload proof of business and proof of insurance. Your 3 free leads unlock when both pass."],
      ["Get offers by text", "Each offer shows the trade, the area, the job size and the price. No contact details yet, and no charge."],
      ["Reply YES and call", "The lead comes out of your balance and the owner's details arrive in seconds. Call while they are expecting you."],
    ])}
    <p class="btn-row"><a class="btn btn--black btn--lg" href="/pros/join/">Get my 3 free leads</a></p>
  </div>
</section>
<section class="section">
  <div class="wrap wrap--narrow">
    <h2>Straight answers</h2>
    <div class="faq">${proFaqs.map(([q, a]) => `<details><summary>${esc(q)}${icon("chevron", 18)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
  </div>
</section>
<section class="pro-band pro-band--yellow" data-final-cta>
  <div class="wrap pro-band-row"><div><h2>Your first 3 leads are free.</h2><p>See the quality for yourself before you load a dollar.</p>${feeOffer(false)}</div><a class="btn btn--black btn--lg" href="/pros/join/">Create my pro account</a></div>
</section>
<div class="sticky-cta" data-sticky-cta hidden><a class="btn btn--yellow btn--block" href="/pros/join/">Get my 3 free leads</a></div>`,
});

const splitShell = (left, right) => `<div class="split"><div class="split-dark"><div class="split-inner">${logo(true, true)}${left}</div></div><div class="split-light"><div class="split-inner">${right}</div></div></div>${hazard}`;
page({
  path: "/pros/join/",
  title: `Join as a Pro | ${site.name}`,
  desc: D("Create your pro account, verify your business and get your first 3 leads free."),
  chrome: "", footer: "none", bodyClass: "bare",
  body: splitShell(
    `<h1>Your first 3 leads are free.</h1>${feeOffer(true)}${checks(proBullets, "checks--yellow")}`,
    `<form class="form" data-form="proJoin" novalidate>
      <h2>Create your pro account</h2>
      <p class="sub">Create your account, then upload proof of business and insurance. Your free leads unlock when both pass.</p>
      <label class="label" for="j-biz">Business name</label><input class="input" id="j-biz" name="business" type="text" placeholder="Business name" autocomplete="organization" required>
      <label class="label" for="j-phone">Mobile number</label><input class="input" id="j-phone" name="phone" type="tel" placeholder="(555) 555-0100" autocomplete="tel" required>
      <div class="form-row">
        <div><label class="label" for="j-trade">Main trade</label><select class="input" id="j-trade" name="trade" required><option value="">Choose a trade</option>${trades.map((t) => `<option value="${t.slug}">${esc(t.name)}</option>`).join("")}</select></div>
        <div><label class="label" for="j-zip">Business ZIP code</label><input class="input" id="j-zip" name="zip" type="text" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="ZIP code" autocomplete="postal-code" required></div>
      </div>
      <p class="meta">We set you up for that trade within 25 miles of your ZIP code. You can change both later.</p>
      <label class="consent"><input type="checkbox" name="sms" value="yes"><span>Text me lead offers at this number. Recurring automated messages; frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase. See the <a href="/sms-policy/" target="_blank" rel="noopener">SMS Policy</a>.</span></label>
      <p class="form-status" data-status role="status" hidden></p>
      <button class="btn btn--yellow btn--block" type="submit">Create account and verify</button>
      <p class="meta">By creating an account you agree to the <a href="/terms/">Terms of Use</a> and <a href="/privacy/">Privacy Policy</a>. Already a pro? <a href="/pros/sign-in/">Sign in</a></p>
    </form>`
  ),
});
page({
  path: "/pros/sign-in/",
  title: `Pro Sign In | ${site.name}`,
  noindex: true,
  chrome: "", footer: "none", bodyClass: "bare",
  body: splitShell(
    `<h1>Leads by text. Buy only the ones you want.</h1>${checks(proBullets, "checks--yellow")}`,
    `<form class="form" data-form="proSignIn" novalidate>
      <h2 class="h1">Sign in</h2>
      <p class="sub">Enter your mobile number and we will text you a 6-digit code. No password.</p>
      <label class="label" for="s-phone">Mobile number</label><input class="input" id="s-phone" name="phone" type="tel" placeholder="(555) 555-0100" autocomplete="tel" required>
      <p class="form-status" data-status role="status" hidden></p>
      <button class="btn btn--yellow btn--block" type="submit">Text me a code</button>
      <p class="meta">New here? <a href="/pros/join/"><strong>Join as a pro</strong></a></p>
    </form>`
  ),
});

// ---------- pro portal (app shell; everything inside is drawn by portal.js from the API) ----------
page({
  path: "/pros/app/",
  title: `Pro Portal | ${site.name}`,
  noindex: true,
  chrome: `<header class="site-header site-header--dark"><div class="wrap header-row">${logo(true, true)}<div class="header-actions"><span class="chip chip--black" data-balance hidden></span><button class="btn btn--ghost btn--sm" type="button" data-signout hidden>Sign out</button></div></div></header>${hazard}`,
  footer: "none", bodyClass: "flow portal", script: "portal.js",
  body: `<div class="wrap portal-wrap" data-portal><p class="meta">Loading your account.</p></div>`,
});

// ---------- 404 ----------
page({
  path: "/404.html",
  title: `Page Not Found | ${site.name}`,
  noindex: true,
  body: `
${hazard}
<section class="nf">
  <div class="wrap nf-row">
    <div class="nf-art" aria-hidden="true"><span>4</span><svg viewBox="0 0 160 180" width="160" height="180"><path d="M62 8h36l34 140H28L62 8z" fill="#F15A22"/><path d="M52 50h56l8 30H44l8-30zM38 108h84l8 30H30l8-30z" fill="#fff"/><rect x="4" y="148" width="152" height="24" rx="6" fill="#1D2125"/></svg><span>4</span></div>
    <div>
      <p class="chips"><span class="chip chip--black">Error 404 &middot; Road closed</span></p>
      <h1>This page is still under construction.</h1>
      <p class="lead">We checked the plans, the permit office and behind the drywall. There is nothing at this address. The link may be old, or the page was torn out.</p>
      <p class="btn-row"><a class="btn btn--black" href="/">Take the detour home</a><a class="btn btn--white" href="/request/">Start a request</a></p>
    </div>
  </div>
</section>
${hazard}
<section class="section">
  <div class="wrap">
    <h2>Pages that are actually built</h2>
    <p class="sub">Pick a trade and get quotes from local pros.</p>
    <div class="chip-links">${popular.map((t) => `<a class="chip chip--link chip--lg" href="/trades/${t.slug}/">${esc(t.short || t.name)} ${icon("chevron", 16)}</a>`).join("")}</div>
    <p class="link-row"><a class="link-more" href="/how-it-works/">How it works ${icon("chevron", 16)}</a><a class="link-more" href="/cost-guides/">Cost guides ${icon("chevron", 16)}</a><a class="link-more" href="/contact/">Contact support ${icon("chevron", 16)}</a></p>
  </div>
</section>`,
});

// ---------- write ----------
rmSync(OUT, { recursive: true, force: true });
for (const p of pages) {
  const file = p.path.endsWith(".html") ? join(OUT, p.path) : join(OUT, p.path, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, p.html);
}
mkdirSync(join(OUT, "assets"), { recursive: true });
for (const f of ["styles.css", "app.js", "portal.js"]) cpSync(join(SRC, f), join(OUT, "assets", f));
cpSync(join(SRC, "img"), join(OUT, "assets", "img"), { recursive: true });
cpSync(join(SRC, "fonts"), join(OUT, "assets", "fonts"), { recursive: true });
for (const f of readdirSync(join(SRC, "static"))) cpSync(join(SRC, "static", f), join(OUT, f));

const indexable = pages.filter((p) => !p.noindex && !p.path.endsWith(".html"));
writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((p) => `  <url><loc>${site.url}${p.path}</loc></url>`).join("\n")}\n</urlset>\n`);
writeFileSync(join(OUT, "robots.txt"), site.launched ? `User-agent: *\nAllow: /\nDisallow: /request/\nDisallow: /pros/sign-in/\n\nSitemap: ${site.url}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n");
writeFileSync(join(OUT, "_headers"), "/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n");

// ---------- brand checks: fail the build if a page drifts ----------
const problems = [];
for (const p of pages) {
  if (!p.html.includes(TAG)) problems.push(`${p.path}: tagline missing`);
  if (/\bBrand\b|Hammerhound|HammerHound|Hammer hound/.test(p.html.replace(/hammerhound\.com/g, ""))) problems.push(`${p.path}: brand name written wrong`);
  const d = (p.html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (!p.noindex && (!d || !d.endsWith(TAG) || d.length > 155)) problems.push(`${p.path}: meta description must end with the tagline and be 155 characters or fewer (${d ? d.length : 0})`);
  if (!p.html.includes("data-year")) problems.push(`${p.path}: copyright year not dynamic`);
}
if (problems.length) { console.error("Brand check failed:\n" + problems.join("\n")); process.exit(1); }
console.log(`Built ${pages.length} pages to site/dist (launched: ${site.launched})`);
