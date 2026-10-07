# Qualification Rounds (Cards 1–4)

## Design
Cards 1–4 (board indexes 0–3) are the Qualifier: a slate-themed panel where
the player must survive four correct predictions to unlock the Jackpot Run.
Qualification pays nothing — its only function is gating the money round.

## Rules
- Each card: predict HIGHER or LOWER vs the current card (base card for
  card 1).
- Correct → advance. Wrong → continue offer (below) or game over. Tie → push
  (jackpot halves, advance).
- The HIGHER button is disabled when the current card is an Ace
  ("Ace is High - Cannot go Higher"); LOWER is disabled on a 2
  ("2 is Low - Cannot go Lower").

## Continue offer
A wrong guess in the qualifier — only when the balance is above $0 — triggers
CONTINUE_OFFER: "Reduce Jackpot by 50% to continue?" Accept → the jackpot
halves (rounded down to $100s), play advances to the next card, and the phase
returns to PLAYING. Decline ("Give Up") → GAMEOVER and a new round starts.

## Base-card swap
Before the first guess (`currentIndex === 0`) the player may swap the dealt
base card for $100, deducted from the balance immediately. Requires balance ≥
$100 and replaces the base card with the next card from the deck. This is the
only paid pre-round decision, and only one swap is possible per round.

## Open question
Should the qualifier stay payout-free, or would small consolation payouts
(e.g. 5% / 10% tiers) make early exits feel better?
