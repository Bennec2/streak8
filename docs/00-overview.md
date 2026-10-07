# Overview

## What Streak8 is
Streak8 is a casino-style higher/lower card game. The player is dealt a base
card and predicts whether each next card will be HIGHER or LOWER, advancing
across an 8-card board. Survive the first 4 cards (the Qualifier) to enter the
high-stakes Jackpot Run (cards 5–8), where every card pays a tiered share of a
$10,000 jackpot.

Tagline: "golden run revisited."

## Design pillars
- **One decision per card.** Higher or lower — no other input. Every round is
  8 decisions.
- **Two-act structure.** Cards 1–4 are survival with no payout; cards 5–8 are
  where money is won or lost.
- **Escalating tension.** Payouts grow 25% → 50% → 75% → 100% of the jackpot,
  and cashing out is always tempting.
- **Forgiving qualifier, brutal run.** A wrong guess in the qualifier offers a
  second chance (halve the jackpot to continue); a wrong guess in the Jackpot
  Run costs real money.

## Tech
Vite + React 19 + TypeScript single-page app. Game state lives in `App.tsx`;
card/deck logic in `utils/gameUtils.ts`; presentation in `components/`.
Balance persists in `localStorage` under the key `hl_jackpot_balance`.

## Open question
Should v1 stay a pure solo higher/lower game, or is there a second mode
(e.g. timed streaks, a daily jackpot) on the roadmap?
