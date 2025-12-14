export enum Suit {
  Hearts = '♥',
  Diamonds = '♦',
  Clubs = '♣',
  Spades = '♠',
}

export interface Card {
  suit: Suit;
  rank: string;
  value: number; // 2-14 (Ace high)
  color: 'red' | 'black';
  id: string;
}

export enum GamePhase {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  VICTORY = 'VICTORY',
  CASHED_OUT = 'CASHED_OUT',
  CONTINUE_OFFER = 'CONTINUE_OFFER',
}

export enum Guess {
  HIGHER = 'HIGHER',
  LOWER = 'LOWER',
}

export interface GameState {
  deck: Card[];
  baseCard: Card | null;
  boardCards: (Card | null)[]; // 8 slots
  currentIndex: number; // 0-7
  phase: GamePhase;
  jackpot: number;
  initialJackpot: number;
  balance: number;
  bet: number;
  history: string[]; // For log
  message: string;
}