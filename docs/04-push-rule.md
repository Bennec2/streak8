# Push Rule (Ties)

## Design
When the drawn card has the same rank as the current card, the result is a
push: neither a win nor a loss.

## Mechanics
- The jackpot is halved and rounded down to the nearest $100
  (`floor(jackpot / 2 / 100) * 100`).
- The player advances to the next card immediately — a push never ends a round
  and never triggers a continue offer or game over.
- Applies identically in the qualifier and the Jackpot Run.
- Because tiers are percentages of the *current* jackpot, a push shrinks every
  remaining payout on the board; the per-slot potential-win readouts update
  live.

## Rationale
Ties are dead cards in higher/lower; halving the jackpot turns them into
meaningful events that deflate the run's stakes instead of just wasting a card.

## Open question
Is halving too punishing for a tie, or should pushes carry a smaller penalty
(e.g. −25%)?
