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
| Source | Call Tracker rows that are a Form or an Email, marked Valid, with no Client Portfolio, from a site whose `Needs GBP?` is not a has-GBP value and whose `Active Clients` is 0. First run copies the last 30 days, then every minute copies anything newer |
| Never offered | Leads from sites with a GBP (live or suspended), leads assigned to a client, calls, spam |
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

## Pro verification

- **Browse before verifying.** Any signed-in pro can see open leads and prices. Owner details are never in an offer. Only a verified pro can claim, buy or get offers by text.
- **To verify:** legal business name, EIN (9 digits, one account per EIN, never a Social Security number), one proof of business from the accepted list in `DOC_TYPES` (`src/worker.js`), a certificate of insurance and its expiry date.
- **Verified Pro badge** shows on the account page and lapses on the insurance expiry date.
- **Document check.** `POST /api/pro/documents` (multipart) stores both files in the private R2 bucket `hammer-hound-docs` (binding `DOCS`), then has the AI read them.
  - **Three attempts:** `AI_MODEL` with a JSON schema, `AI_MODEL` with a plain JSON prompt, then `AI_MODEL_BACKUP`. Forced tool calls are not used: `claude-sonnet-5-5` rejects them.
  - **Permissive by design:** a pro is verified unless there is a clear problem. `decide()` hard-stops only on a wrong EIN, an expired proof of business or expired insurance, plus anything the model marks a clear fail (not a business document, blank, an unrelated business).
  - **In review** only when neither file could be read, or all three AI attempts failed. An outage never passes anyone.
- **Limits.** PDF, JPG, PNG or WebP, 5 MB each, 3 checks a day per account.
- **Emails.** `Declined` and `In review` send an email from `support@hammerhound.com` through the `EMAIL` binding (Cloudflare Email Sending). A failed email is logged and never blocks the check.
- **Review queue.** In the Pros table, filter `Verification` = `In review`. `Verification Detail` holds what the AI read. Set `Verification` to `Verified` (and `Verified At`) or `Declined` by hand.
- **Reminders and nudges.** `sendReminders()` runs hourly at :07 and sends only 8am to 6pm Central. `Reminder Stage` on the pro stops repeats.
  - Before expiry (30, 14, 7, 3 and 1 days out): renewal reminders. No sample leads, no unsubscribe link.
  - Expiry day, then 3, 7, 14 and 30 days after: nudges with up to 3 open leads (job and city only, owner details never included).
  - Failed check (2, 6 and 12 days after): nudges to finish verifying, with the same sample leads.
  - Nudges carry a "Stop these reminders" link (`Nudges Off`). Outside test accounts they are held until `MAILING_ADDRESS` is set in `wrangler.jsonc`.
  - `POST /api/admin/reminders` with `X-Admin-Key` runs it now; send `{"dry":true}` to list what would go without sending.
- **Not built yet:** the public "what Verified means" page, the downloadable badge.

## Pro portal

`/pros/app/` is one page drawn by `site/src/portal.js`. Bottom tab bar on phones, sidebar from 960px. Each section has its own address (`#home`, `#offers`, ...).

| Section | What it does | API |
| --- | --- | --- |
| Home | Next action, counts, wallet and verification at a glance | `/api/pro/offers`, `/api/pro/leads` |
| Leads | Open leads, filtered by market and trade. Defaults to the pro's own (`City`, `Trade`); `?market=all&trade=all` widens | `/api/pro/offers`, `/api/pro/buy` |
| My leads | Owner details, stage (New, Contacted, Quoted, Won, Lost), notes, bad-lead report | `/api/pro/leads`, `/api/pro/lead-status`, `/api/pro/report` |
| Wallet | Balance, activity, membership | `/api/pro/wallet`, `/api/pro/add-funds` |
| Verification | Verify, renew, download the Verified Pro badge | `/api/pro/documents`, `/api/pro/review` |
| Business profile | Name, email, market, trades | `/api/pro/profile` |
| Notifications | Text and email offers, pause, daily cap, quiet hours | `/api/pro/notifications` |
| Support | Tickets, stored in the `Tickets` table (`tblFDXXEvvlb6F8vN`). Answer by filling `Reply` and setting `Status` to Answered | `/api/pro/tickets` |
| Account | Agreement on record, sign out, close account | `/api/pro/close` |

- **Square is a placeholder.** `/api/pro/add-funds` has a marked spot for the Square charge. Until `SQUARE_ACCESS_TOKEN` is set, real accounts get "not switched on yet" and test accounts can add test funds. No saved card or auto-reload yet.
- **Stored but not yet acted on:** pause, daily cap, quiet hours, extra trades and email alerts are saved on the pro. Nothing sends offers yet, so nothing reads them.
- **Trade matching.** A lead's trade comes from keywords in its `Service` text (`TRADES` in `src/worker.js`). Unmatched leads show as "Other".
- **Pro Agreement.** `site/src/legal/pro-agreement.md`, shown in full on the join form with a required box. Acceptance is saved in `Agreement` as version, time and IP. Change `AGREEMENT_VERSION` in `src/worker.js` whenever the "Last updated" date changes; a test fails if they differ.

## Uniform leads

Every lead is rewritten by the AI into one format before any pro sees it (`styleLeads()` in `src/worker.js`, run with every copy, 6 leads a minute, newest first).

- **Fields, always in this order:** `Job` (2 to 5 words), `Trade`, `City` and `State`, `Timing`, `Property Type`, `Job Size`, `Summary`. Anything the owner did not say reads "Not stated". The writer is told never to add a detail that is not in the request.
- **Held back until written.** Open leads require `Style` = `v2`. A raw form or email subject is never shown.
- **Not a request for work** (vendor pitch, job application, spam): `Qualified` = "No: reason", `Status` = `Rejected`, never offered.
- **No owner details before purchase.** The summary is checked in code as well: emails, phone numbers, the owner's name and street addresses are cut (`scrub()`).
- **After purchase** the pro sees the same block, then the owner's contact details, the job address if given, and the owner's own words.
- To change the format, edit `LEAD_RULES` and bump `STYLE`; every lead is rewritten on the next runs.

## Welcome credit

- Every new pro starts with `WELCOME_CREDIT` ($240) in the wallet: `Balance` 240 and `Welcome Credit` 240. At $75 a lead that is 3 leads with $15 left, which is not enough for a fourth.
- Every claim deducts from `Balance`. `Welcome Credit` is spent before paid funds, and each purchase records `Credit Used`.
- `Free Leads Left` is no longer used. New accounts get 0.
- The portal shows a toast on each claim and counts the header balance down. When the balance is below the lead price the toast and the Wallet ask for a top-up.

## Wallet, reloads, text-to-claim and invoices

- **Ledger** (`tblZ2EIWCgOb36JR2`): one row per movement of money (welcome credit, top-up, lead, credit back). The wallet page and invoices are built from it.
- **Card on file.** `chargeCard()` in `src/worker.js` is the one place a card is charged. **It is a placeholder for Square.** Until `SQUARE_ACCESS_TOKEN` is set and the call is written, only a test account's "test card" charges (nothing real). Real accounts are told card payments are not on yet.
- **Claim and reload.** If the wallet is short and a card is on file, the claim button reads "Claim lead · $75 · reloads $150" and does both. The API charges only when the request carries `reload: true` or the pro turned on auto-reload.
- **Auto-reload** tops the wallet up after a claim leaves it below one lead's price. `Monthly Limit` caps card charges per calendar month.
- **Text-to-claim.** `alertPros()` texts and emails verified pros whose market and trade match a newly opened lead (respecting pause, daily cap and quiet hours, Central time). A reply of YES or ONLY to `POST /api/sms/inbound` claims the last lead sent; the card on file covers a short wallet. Needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, and the Twilio number's inbound webhook set to `https://hammerhound.com/api/sms/inbound`. Requests are checked against Twilio's signature.
- **Top up by text.** A claim that leaves less than one lead's price sends a menu: reply 1, 2 or 3 to add $150, $300 or $600 from the card on file. `TOPUP` sends the menu on request; `TOPUP 300` does it in one message. A bare number only counts for 24 hours after a menu (`Text State`). The lead text itself never shows a charge or a balance; card charges are confirmed by an emailed receipt.
- **Credit back.** Set a purchase's `Review Status` to `Approved` in Airtable and the price returns to the wallet within a minute, with an email. `Credited` is ticked so it happens once.
- **Invoices.** `src/pdf.js` writes a branded PDF with no libraries. On the 1st to 3rd of each month each pro with activity is emailed last month's invoice; a copy goes to R2 at `invoices/<pro>/<YYYY-MM>.pdf`. Pros can open any month from the wallet (`GET /api/pro/invoice?month=YYYY-MM`). `POST /api/admin/invoices` with `X-Admin-Key` runs it by hand; `{"dry":true}` lists without sending, `{"month":"2026-11"}` picks the month.
- **Membership.** Free for the first year from `Created At`, then $300 a year. The wallet shows the date. The charge itself is not built: it needs Square.

## Declined cards, sign-in limits, market requests

- **Declined card.** `topUp()` records `Pending Reload` (amount, lead, kind, time), emails "Your card was declined" with a one-hour link that signs the pro in and opens the wallet (`GET /api/pro/link?t=`), and texts the same link. Saving a working card within 48 hours runs the reload and claims the lead if it is still open. Test accounts can save "a test card that declines" to try it.
- **Sign-in limits.** Five wrong codes, or five codes requested, locks an account for the rest of the hour (`Sign-in Guard`).
- **Unsubscribe** now turns off lead alert emails as well as nudges. Receipts and renewal notices still send.
- **Lead writer** marks a lead `failed 1` to `failed 3` when the AI cannot rewrite it and stops after three, so one bad lead cannot spend AI calls every minute. Clear `Style` to retry.
- **Market requests.** When a pro's market and trade show no open leads, a button records the request in `Market Requests` (`tbl315ujQMh1PHOi8`), once per pro, market and trade.

## Hot leads, older leads, bid invitations

- **Age comes from when the owner sent the request** (`Received At`), not when it was copied. Hot for 72 hours (`HOT_HOURS`), then an older lead until it is 7 days old (`LEAD_DAYS`), then closed. Open leads has a tab for each. Text and email alerts only go out for hot leads.
- **Bid invitations** from contractors and agencies are accepted. The writer marks them `request_type: bid` and the title is forced to "<Scope> Bid Invitation"; the summary starts "A contractor is inviting bids". Format `v2` re-writes every open lead and re-checks leads the writer rejected under `v1`.

## Older leads are marked down

`priceOf()` is the one place a lead's price is worked out, for the card and for the charge. Hot leads are full price. Past 72 hours the price is a percent of the hot price by day: `AGED_PRICING` = `50,40,30,20` (day 3, 4, 5, 6), rounded to the nearest $5, never under $10. At $75 / $225 that is $40 / $115, $30 / $90, $25 / $70, $15 / $45. The purchase row stores the price paid.

## Admin panel

`/admin/` (not indexed). Step 1: Today numbers, the queues that need a person, and where pros asked for more leads.

- **Sign-in.** With `ACCESS_TEAM` and `ACCESS_AUD` set in `wrangler.jsonc`, the Worker only accepts requests carrying a valid Cloudflare Access token (`Cf-Access-Jwt-Assertion`, RS256, checked against the team's public keys, audience and expiry). With them empty, `ADMIN_KEY` (20 characters or more) signs in and sets a 12-hour cookie.
- **Access setup.** Zero Trust → Access → Applications → Add → Self-hosted. Add two paths on `hammerhound.com`: `admin` and `api/admin`. Policy: Allow, Emails, your address. Then put the team name (the part before `.cloudflareaccess.com`) in `ACCESS_TEAM` and the application's Audience (AUD) tag in `ACCESS_AUD`.
- **API.** `GET /api/admin/overview[?real=1]`, `GET /api/admin/doc?key=pros/...`, `POST /api/admin/verify {proId, decision: approve|decline, expires, reason}`, `POST /api/admin/report {purchaseId, decision: approve|deny, reason}`, `POST /api/admin/ticket {ticketId, reply}`.
- **Not in it yet.** Property owner details never appear in step 1. Leads, Pros, Money, Messages and Settings screens are later steps.

## Which Dalton Digital leads are copied (rule v3)

A valid form or email, not assigned to a client, on a site with `Active Clients` = 0 (`fldVIdJR2dkmKXRf0`) and `Open Prospects` = 0 (`fldCTOMq0Mk1jUb3S`). Sites with a GBP are included for now. Each lead stores the site's `Needs GBP?` value in `Site GBP` (`fld9ylese5Vwa3twG`). To stop copying GBP sites later, set `EXCLUDE_GBP_SITES` to `"true"` in `wrangler.jsonc`. Changing the rule version removes unbought leads copied under the old rule and copies the last `BACKFILL_DAYS` days again.

## Second audit fixes

- `list()` now follows Airtable's `offset`. Before, every list stopped at 100 rows whatever `maxRecords` said, which would have cut off reminders, renewal notices, invoices, alerts and the admin counts past 100 pros or rows.
- Open leads loads up to 1,000 (it was capped at 100; a week of leads from all unsold sites is already more than that).
- The lead writer does not count an AI outage (every lead in the run failed, or a 429, 5xx or timeout) as one of a lead's three tries.
- The three every-minute jobs (copy, alerts, credit-backs) run independently.
- "New lead" alerts only go out for leads received in the last `ALERT_HOURS` (12).
- Any successful reload clears a reload left waiting by a declined card.
- A DD1 row with no created time can no longer stop the copy.

## Older leads need a card; welcome credit is for hot leads

Older leads (3 to 7 days) are left out of `/api/pro/offers` until the pro has a card on file (`olderShown`), and `purchase()` refuses them without one. Welcome credit only pays for hot leads: an older lead is paid from the pro's own funds (balance minus welcome credit), reloading the card if those are short. Pro Agreement 5.3 says the same.
