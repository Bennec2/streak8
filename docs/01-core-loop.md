# Core Loop

## The loop
1. Round starts: a freshly shuffled 52-card deck is created, one card is dealt
   as the base card, and a new jackpot (starting at $10,000) is generated.
2. The player predicts HIGHER or LOWER against the current card (the base card
   for card 1, the previous board card after that).
3. The next card is revealed:
   - Correct → advance to the next slot.
   - Wrong → qualifier: continue offer or game over; Jackpot Run: game over
     with the current tier deducted from the balance.
   - Tie (same rank) → push: the jackpot halves, the player advances with no
     other penalty.
4. The round ends in VICTORY (all 8 survived), CASHED_OUT, or GAMEOVER. Two
   seconds later a new round auto-starts.

## Win / lose
- **Victory:** correct guess on the 8th card → win 100% of the jackpot.
- **Cash out:** available from the 6th card onward → bank the last survived
  tier and end the round.
- **Game over:** wrong guess with no continue available → round ends; in the
  Jackpot Run the current tier is deducted from the balance.

## Session shape
Rounds are fast — 8 decisions each. The balance persists across rounds and
sessions via localStorage, so the meta-game is growing the bankroll over many
rounds. The jackpot range scales up after victories and down after game-overs,
creating a difficulty and economy arc across sessions.

## Open question
Is 8 cards the right round length, or should a future mode offer shorter or
longer boards?
