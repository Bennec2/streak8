# Jackpot Generation & Scaling

## Base jackpot
Every round starts with a freshly generated jackpot. The initial range is
fixed at exactly $10,000 (`min = max = 10000`); the generator supports a
min/max range and rounds to $100s, so future tuning can widen it without code
changes.

## Scaling across rounds
The jackpot range adapts to performance:
- **Victory:** range shifts up — min +$500, max +$1,000 (rounded to $100s).
- **Game over (no continue taken):** range shifts down — min −$500 (floor
  $1,000), max −$1,000 (floor $2,000).
- Cash-outs and qualifier continues leave the range unchanged.

## Presentation
Amounts ≥ $10,000 render in compact form ($10K); smaller amounts render in full
($9,500). The jackpot readout uses a rolling-number animation on every change
and pulses gold while the Jackpot Run is active.

## Open question
Should the jackpot range also respond to cash-outs (e.g. shrink slightly when
players bank early), or stay purely win/loss driven?
