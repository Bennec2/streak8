# Edge Cases

## Handled
- **Ace as current card:** HIGHER is disabled with the hint "Ace is High -
  Cannot go Higher".
- **2 as current card:** LOWER is disabled with the hint "2 is Low - Cannot go
  Lower".
- **Empty/insolvent balance:** the continue offer requires balance > $0; the
  swap requires ≥ $100. Jackpot Run losses can drive the balance negative
  (displayed red) — there is no floor.
- **Tie on every card:** pushes halve the jackpot each time (rounded down to
  $100s). Across a push-heavy round the jackpot decays toward $0 but the round
  never ends because of pushes.
- **Deck exhaustion:** a round draws at most 9 cards (1 base + 8 board); a
  52-card deck cannot run out. Swap draws are guarded against an empty deck.
- **Double inputs:** guesses are ignored while a card animation is in flight.
- **Corrupt/missing storage:** the balance falls back to $0 if localStorage is
  unavailable or unparsable.

## Open question
Should a negative balance trigger any recovery mechanic (e.g. a free stake to
keep playing), or is the red negative purely informational?
