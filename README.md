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
| `wrangler.jsonc` | Cloudflare Worker config that serves `site/dist` |

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
