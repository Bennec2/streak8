# Jackpot Run (Cards 5–8)

## Design
Cards 5–8 (board indexes 4–7) are the Jackpot Run: the high-stakes second half
of the board. Visually distinct — gold-trimmed panel, jackpot-variant card
faces (the 8th card renders in full gold), and a live per-slot potential-win
readout under each card.

## Tiered payouts
Each Jackpot Run card pays a fixed percentage of the current jackpot:

| Card | Board index | Payout |
|------|-------------|--------|
| 5th  | 4           | 25%    |
| 6th  | 5           | 50%    |
| 7th  | 6           | 75%    |
| 8th  | 7           | 100%   |

Formula: `tier = (index − 3) × 25%`. All payouts round down to the nearest
$100. At the $10,000 starting jackpot the tiers pay $2,500 / $5,000 / $7,500 /
$10,000. Each slot's readout recomputes live whenever the jackpot changes
(e.g. after a push halves it).

## Entering the run
Surviving the 4th card advances to index 4 and triggers the run's
presentation: the section label animates in, the jackpot readout pulses gold,
and the four run slots light up. Qualification rounds pay nothing — every
dollar is earned here.

## Cashing out
From the 6th card onward (currentIndex ≥ 5 — i.e. once the 25% tier is banked),
the player may cash out instead of guessing. Cash-out pays the tier of the
last survived card, credits the balance immediately, and ends the round as
CASHED_OUT.

## Losing in the run
A wrong guess during the Jackpot Run ends the round as GAMEOVER and **deducts**
the current tier's value from the balance (the balance may go negative, shown
in red). There is no continue offer in the run — the halve-the-jackpot
continue is qualifier-only.

## Victory
A correct guess on the 8th card wins 100% of the jackpot, credited to the
balance, and scales the next round's jackpot range up (min +$500, max +$1,000,
rounded to $100s).

## Open question
Should cash-out stay available on every Jackpot Run card from the 6th onward,
or should the 7th and 8th cards lock the player in for escalating risk?
