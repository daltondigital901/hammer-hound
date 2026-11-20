# Notes for Claude sessions working in this repo

## Operations manual (living SOP) — keep it current
Google Doc "Dalton Enterprises Operations Manual (SOP & Training)", id 1V4TlTklW_rIW04U8wotZM2zcP2oK9aV3pK1ZUx14nQ4
(https://docs.google.com/document/d/1V4TlTklW_rIW04U8wotZM2zcP2oK9aV3pK1ZUx14nQ4/edit). Part 5 covers Hammer Hound.
Every change that alters how something works updates that section in the same session and adds a line to its Change log.

## Rules
- Lead credits always go back to the wallet, never to a card (Ryan 2026-11-20). Wallet money is not refunded to a card or paid out in cash, except where the law requires. Rules: src/credits.js; legal text: section 6 and 14.3 of site/src/legal/pro-agreement.md and terms.md.
- Changing either legal file: bump "Last updated" in both and AGREEMENT_VERSION in src/worker.js together.
- Tests: `node test/api.test.mjs` must pass; the deploy workflow runs it on every push to main.
