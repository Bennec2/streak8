# UI/UX

## Screens & flow
1. **Splash screen** — 3-stage intro (~3.3s): board items appear one by one,
   logo reveals, fade out.
2. **Game screen** (single screen, no navigation):
   - Header: jackpot (trophy icon, gold, rolling number, pulses during the
     Jackpot Run) · balance (coin icon, emerald, red when negative, rolling
     number) · help button.
   - Base card row: vertical "Base Card" label; a "Highest" tag pulses if the
     base card is an Ace.
   - Qualifier panel (slate): slots 1–4 with neutral card backs.
   - Jackpot Run panel (gold): slots 5–8, each with a live potential-win
     readout; the 8th card uses the gold card variant.
   - Controls: circular 3D buttons — HIGHER (emerald, left), LOWER (red,
     right), and a middle context button (slate "SWAP $100" before the first
     guess → purple "CASHOUT" from the 6th card → dashed "VS" placeholder
     otherwise). Non-playing phases show one large amber START HAND button.
   - Phase modals: full-screen overlays — Victory (gold/trophy), Cashed Out
     (emerald/coins), Continue Offer (orange/alert with Continue / Give Up),
     Game Over (red/X).
   - Help modal: rules reference, opened from the header.

## Components
- `PlayingCard` — sm/md/lg sizes; default/jackpot/gold variants; win (emerald
  ring + glow) / loss (red ring + glow) outcomes; flip-in reveal, spin-fall on
  loss, shimmer sweep on jackpot wins; "?" medallion card back.
- `RollingNumber` — slot-machine roll animation on value changes (800ms,
  ±10% jitter, scale pop) using the shared currency formatter.
- `GameControls` — the circular 3D button cluster with arc text labels;
  disabled states gray out; the Ace/2 hint line reads "Ace is High - Cannot go
  Higher" / "2 is Low - Cannot go Lower".
- `SplashScreen` — staged intro sequence.

## Aesthetic
Neon casino: dark felt background, gold/emerald/red neon glows, heavy drop
shadows, gradient buttons.

## Open question
Does the neon-casino look match the intended App Store positioning, or should
the visual identity be revisited before screenshots?
