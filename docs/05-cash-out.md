# Cash Out & Continue Offer

## Cash out
- Available during PLAYING once `currentIndex ≥ 5` — i.e. from the 6th card
  onward, after at least the 25% tier is banked.
- Pays the tier of the last survived card: `winnings = tier(currentIndex − 1)`.
- Credits the balance immediately and ends the round as CASHED_OUT (emerald
  modal). A new round auto-starts after 2 seconds.
- Presented as the middle control button (purple CASHOUT), replacing the swap
  button once available.

## Continue offer (qualifier only)
- Triggered by a wrong guess on cards 1–4 when the balance is above $0.
- Offer: "Reduce Jackpot by 50% to continue?" Accept → jackpot halves (rounded
  down to $100s), play advances to the next card, phase returns to PLAYING.
  Decline ("Give Up") → GAMEOVER.
- Never offered in the Jackpot Run, and never when the balance is $0 or less.

## Design intent
Cash-out is the core risk/reward lever of the run: every survived tier raises
both the banked amount and the temptation to press on. The qualifier's continue
offer is a softer landing that keeps early rounds forgiving for players
building a bankroll.

## Open question
Should the continue offer cost scale (e.g. 50% the first time, 75% the second)
if a player keeps failing in the qualifier?
