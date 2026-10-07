# Base-Card Swap

## Design
Before the first guess of a round, the player may swap the dealt base card for
a new one at a fixed cost of $100.

## Rules
- Available only when `phase === PLAYING`, `currentIndex === 0`, and
  `balance ≥ $100`.
- The $100 is deducted from the balance immediately; the replacement card is
  drawn from the top of the remaining deck.
- One swap per round — the button only exists before the first guess.
- Shown as the middle control button (slate "SWAP $100") while cash-out is not
  yet available.

## Strategy
Swapping is for bad starting cards: a base Ace can only go lower and a base 2
can only go higher, so both are coin flips the player might prefer to reroll.
Mid cards (7–9) are the worst swap candidates since both directions are live.

## Open question
Is $100 the right price, or should the swap cost scale with the current
jackpot?
