# Deck & Cards

## Deck
- Standard 52-card deck, freshly created and Fisher-Yates shuffled at the start
  of every round.
- Ranks 2–10, J, Q, K, A with values 2–14 (Ace high). Suits ♥ ♦ ♣ ♠;
  Hearts/Diamonds render red, Clubs/Spades render black.
- Each card gets a unique id (rank + suit + random suffix).
- Draws come off the top of the deck array; the deck is never reshuffled
  mid-round — at most 9 cards are ever needed (1 base + 8 board), so a 52-card
  deck cannot run out.

## Card model
`{ suit, rank, value (2–14), color ('red' | 'black'), id }`

## Guessing math
Only rank value matters; suits are cosmetic. Higher/lower is strictly by value
— equal values are pushes, never wins or losses.

## Open question
Should suits ever matter (e.g. a suit-matching side bet), or stay purely
cosmetic?
