# Balance & Persistence

## Balance
- The player's bankroll, shown in the header with a coin icon. New players
  start at $0.
- Credited on victory (full jackpot) and cash-out (banked tier). Debited on
  Jackpot Run losses (current tier value) and base-card swaps ($100).
- May go negative — displayed in red. A zero or negative balance disables the
  qualifier continue offer and the $100 swap.

## Persistence
- Stored in `localStorage` under the key `hl_jackpot_balance`, written on every
  change and read on app mount (falls back to $0 if missing or unparsable).
- Survives sessions and rounds: the meta-game is bankroll growth over time, not
  per-round results.

## Open question
Should there be a bankroll reset option in settings, or a "season" reset to
keep long-term balances meaningful?
