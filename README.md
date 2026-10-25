# streak8 — web version (NOT the Chrome extension)

A regular, browser-playable copy of streak8, built from the Chrome
extension source (v1.6.2) without touching the extension itself.
No live URL yet and the NTH STAR website's streak8 Play link is
unchanged — Cleveland decides the live/website step after this report.

## Play
Open `index.html` from any static host (or a local static server).
No build step, no framework, no remote code beyond the Firebase
leaderboard calls below.

## Rules (identical to the extension)
- Higher-or-lower, 8 cards: cards 1–4 Qualifier, 5–8 Jackpot Run
  at 25% / 50% / 75% / 100% of the $10,000 jackpot.
- Push (tie) halves the jackpot and continues.
- $100 base-card swap before the first guess.
- Cash out from card 6 onward.
- All 8 cards wins the full jackpot.
- Local top-10 bankroll-peak leaderboard (localStorage).
- Global leaderboard on Firebase project streak8-25e33 (see below).

## What changed vs the extension (web copy only)
- REMOVED: `manifest.json` and `background.js` (extension-only:
  toolbar action, tabs, service worker). No extension entry point.
- REMOVED: all `chrome.*` API use. `js/streak8-ui.js` storage is
  localStorage-only (the extension already had a localStorage
  fallback; the web copy drops the chrome branch entirely).
- ADAPTED: `js/streak8-firebase.js` — the extension stored its
  anonymous-auth tokens and peak in chrome.storage.local with NO
  fallback, so on the web auth would not persist and every
  submission would mint a fresh uid. The web copy uses a
  localStorage-backed store with the same callback shape and the
  same keys (`s8_fb_auth`, `s8_last_peak`), so the uid is stable
  per browser. REST calls, project, and field set are unchanged.
- ADDED: return-to-NTH-STAR bar above the header, visible during
  gameplay: `<a href="https://nthstargames.com">← NTH STAR</a>`
  (same tab). Mid-game return loses the in-progress hand; balance,
  leaderboard name and local stats persist in localStorage.
- ADDED: favicon (`icons/icon128.png`).
- NOT copied: `preview/` screenshots (not needed to play).

## Leaderboard gap (pre-existing, not web-specific)
Global writes still depend on the Firebase console rules: the
updated `firestore.rules` (with `currentBalance`) must be pasted
in Firebase Console → Firestore → Rules → Publish, or writes are
rejected and the v1.6.1 legacy fallback (without currentBalance)
applies. Local board works regardless; global calls never throw
into the game. This is the same gap the extension already has —
do not "fix" it by editing the extension.

## Local verification (2026-10-25)
- `node --check` passes on all three JS files.
- Core tiers verified in Node: 25% = $2,500, 50% = $5,000,
  100% = $10,000; 8-slot round, $10,000 jackpot.
- Local static server: index, core, UI, Firebase, CSS all HTTP 200;
  return link present in served HTML; every DOM id the UI script
  looks up exists in index.html (54/54).
- NOT done: in-browser playthrough (click Higher/Lower, swap,
  cash out, jackpot win, leaderboard submit) — that needs a live
  browser pass, still owed before any live deployment.

## What a live step would need (for Cleveland's decision)
1. Deploy this folder as a static site (Vercel static project,
   GitHub Pages, or similar) — no build, no env vars.
2. Only then change the NTH STAR website's streak8 entry in
   `site/lib/games.js` from the Chrome Web Store URL to the new
   web URL, and redeploy the website.
3. Optionally paste the Firebase rules (above) so the global
   board writes with the currentBalance field.
