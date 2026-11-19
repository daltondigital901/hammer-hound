# Hammer Hound

Two-sided lead marketplace connecting property owners with local pros.
Hammer Hound is a trade name (DBA) of Dalton Enterprises LLC. This repository is kept separate from Dalton Digital.

**Real Jobs. Local Pros. Tracked Down.**

- Site: https://hammerhound.com
- Design: https://www.figma.com/design/YWfM8ar3BZxQvAcwRikYgB

## Contents

| Folder | What it holds |
| --- | --- |
| `brand/` | Logo, wordmark, lockups, favicon set, share image and usage rules. See `brand/README.md` |
| `site/` | The public website: source in `site/src`, generator in `site/build.mjs` |
| `src/worker.js` | The engine: pro API (join, sign-in, verify, offers, buy, my leads, report) and the shadow copy of Dalton Digital form leads |
| `test/` | Local test rig with a stand-in database, and the API rule checks |
| `wrangler.jsonc` | Cloudflare Worker config: serves `site/dist`, runs `src/worker.js`, cron every minute |

## The site

A static site with no dependencies. `site/build.mjs` reads `site/src/data.mjs` and writes 43 pages to `site/dist`.

```
npm run build      # build to site/dist
npm run preview    # build, then serve locally with wrangler
npm run deploy     # build, then deploy the Worker "hammer-hound"
```

Pages: home, how it works, all trades plus one page per trade, cost guides index plus one page per guide,
contact, Terms of Use, Privacy Policy, SMS Policy, the 4-step request form, the pro landing page, pro join,
pro sign-in and the 404 page.

### What to edit

Everything editable is in `site/src/data.mjs`:

| Setting | What it does |
| --- | --- |
| `site.launched` | `false` marks every page noindex and blocks crawlers in robots.txt. Set to `true` at launch |
| `site.endpoints` | Where the request, contact, pro join and pro sign-in forms post. Empty means the form says Hammer Hound is not open yet and sends nothing |
| `site.confirmationCallNumber` | The number the confirmation call comes from, shown on the last request step |
| `reviews` | PLACEHOLDER reviews, labelled as samples on the page |
| `guides` | PLACEHOLDER cost guides. Every price is a stand-in. Add one entry per new Monday guide |
| `tradeGroups` | Trades and their job types. Adding a trade adds its page and its request options |

Policy text is in `site/src/legal/*.md`. The "Last updated" line in each file is what the page shows.

### Brand checks

The build fails if any page is missing the tagline, spells the brand wrong, has a meta description that
does not end with the tagline or runs past 155 characters, or has a copyright year that is not dynamic.

### Before launch

1. Replace the placeholder reviews and cost guide prices, then set `site.launched` to `true`.
2. Fill `site.endpoints` once the lead engine accepts requests.
3. Fill the bracketed items in the policies (mailing address, day counts, retention periods).
4. Replace the stand-in photos in `site/src/img` (AI-generated; some show real equipment brand marks).

## Shadow test (internal only)

The Worker copies valid form leads from the Dalton Digital Call Tracker into the Hammer Hound base
(`app0PSwGlQyC6q7FW`) and offers them in the pro portal at `/pros/app/`. Nothing is sent to owners,
no pro outside the team can join, no card is charged, and Retell is not used.

| What | How it works in shadow mode |
| --- | --- |
| Source | Call Tracker rows where Form/Call is Form and Valid/Spam is Valid. First run copies the last 30 days, then every minute copies anything newer |
| Who can join | Test numbers in the form (xxx) 555-01xx, plus any real numbers listed in `INTERNAL_PHONES` |
| Sign-in code | Test numbers use the `TEST_CODE` secret. Real numbers need the Twilio secrets |
| Verification | Test accounts pass as soon as two documents are chosen. Files are not stored and the AI check is not built |
| Prices | Flat test prices from `wrangler.jsonc`: $75 shared, $225 exclusive. Not real pricing |
| Balance | Test accounts start with a $240 test balance and 3 free leads |
| Offer window | 24 hours instead of 10 minutes, so there is time to test |

Deploys run from GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`. The workflow
builds the site, runs the API checks, deploys the Worker and copies its secrets from GitHub. Repository
secrets it needs: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `AIRTABLE_TOKEN`, `SESSION_SECRET`,
`TEST_CODE`, `ADMIN_KEY`.

```
node test/api.test.mjs        # rule checks against the stand-in database
node test/dev-server.mjs      # full site and portal on http://localhost:8790, test code 424242
```

Not built yet: document storage and the AI document check, text offers and YES replies, card payments,
the pricing engine, the owner request form's endpoint, and bad-lead scoring.
