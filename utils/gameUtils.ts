import { Card, Suit } from '../types';

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  const suits = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
  
  suits.forEach(suit => {
    RANKS.forEach(rank => {
      deck.push({
        suit,
        rank,
        value: VALUES[rank],
        color: (suit === Suit.Hearts || suit === Suit.Diamonds) ? 'red' : 'black',
        id: `${rank}-${suit}-${Math.random().toString(36).substr(2, 9)}`
      });
    });
  });
  
  return shuffleDeck(deck);
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const formatCurrency = (amount: number): string => {
  // If amount exceeds 4 numbers (>= 10,000), use compact notation (e.g., 10K)
  if (Math.abs(amount) >= 10000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  // Otherwise use standard formatting (e.g., $1,500)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};