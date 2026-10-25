/* streak8 core — pure game logic, no DOM.
 * Faithful port of the rules in github.com/Bennec2/streak8 (App.tsx + docs/).
 * Works in a browser (window.Streak8) and in Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Streak8 = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const VALUES = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14 };
  const SUITS = [
    { symbol: "\u2665", name: "Hearts", color: "red" },
    { symbol: "\u2666", name: "Diamonds", color: "red" },
    { symbol: "\u2663", name: "Clubs", color: "black" },
    { symbol: "\u2660", name: "Spades", color: "black" },
  ];

  const TOTAL_CARDS = 8;
  const SWAP_COST = 100;
  const INITIAL_JACKPOT_RANGE = { min: 10000, max: 10000 };

  function roundTo100(num) {
    return Math.floor(num / 100) * 100;
  }

  function formatCurrency(amount) {
    if (Math.abs(amount) >= 10000) {
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency: "USD",
        notation: "compact", maximumFractionDigits: 1,
      }).format(amount);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", maximumFractionDigits: 0,
    }).format(amount);
  }

  function shuffle(array, rand) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function createDeck(rand) {
    rand = rand || Math.random;
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          suit: suit.symbol,
          suitName: suit.name,
          rank: rank,
          value: VALUES[rank],
          color: suit.color,
          id: rank + suit.symbol + "-" + Math.floor(rand() * 1e9).toString(36),
        });
      }
    }
    return shuffle(deck, rand);
  }

  // Jackpot for a new round, drawn from the current range, rounded to $100s.
  function generateJackpot(range, rand) {
    rand = rand || Math.random;
    const raw = Math.floor(rand() * (range.max - range.min + 1)) + range.min;
    return roundTo100(raw);
  }

  // Payout tier for a board slot: indexes 0-3 (qualifier) pay nothing;
  // index 4 -> 25%, 5 -> 50%, 6 -> 75%, 7 -> 100% of the current jackpot.
  function tierFor(index, jackpot) {
    if (index < 4) return 0;
    return roundTo100(jackpot * (index - 3) * 0.25);
  }

  // Fresh round state. Cards draw off the end of `deck` (pop).
  function newRound(balance, range, rand) {
    rand = rand || Math.random;
    const deck = createDeck(rand);
    const baseCard = deck.pop();
    return {
      deck: deck,
      baseCard: baseCard,
      board: new Array(TOTAL_CARDS).fill(null),
      index: 0,            // next slot to fill, 0..7
      jackpot: generateJackpot(range, rand),
      balance: balance,
      swapped: false,
    };
  }

  // Apply a guess. Returns { state, outcome } where outcome is one of:
  // 'correct' | 'push' | 'victory' | 'continue-offer' | 'gameover'.
  // On 'victory', result.winnings = jackpot. On jackpot-run 'gameover',
  // result.loss = deducted tier. Mutates a copy, never the input.
  function applyGuess(prev, guess, rand) {
    rand = rand || Math.random;
    const state = {
      deck: prev.deck.slice(),
      baseCard: prev.baseCard,
      board: prev.board.slice(),
      index: prev.index,
      jackpot: prev.jackpot,
      balance: prev.balance,
      swapped: prev.swapped,
    };
    const drawn = state.deck.pop();
    const current = state.index === 0 ? state.baseCard : state.board[state.index - 1];
    state.board[state.index] = drawn;

    if (drawn.value === current.value) {
      // Push: the jackpot halves (to $100s) and the player advances with no other penalty.
      state.jackpot = roundTo100(state.jackpot / 2);
      if (state.index === TOTAL_CARDS - 1) {
        // A push on the final card still clears the whole board: victory at the halved jackpot.
        // (Without this, the index would run past the last slot and the round could never end.)
        state.balance += state.jackpot;
        return { state: state, outcome: "victory", card: drawn, winnings: state.jackpot };
      }
      state.index += 1;
      return { state: state, outcome: "push", card: drawn };
    }

    const correct =
      (guess === "higher" && drawn.value > current.value) ||
      (guess === "lower" && drawn.value < current.value);

    if (correct) {
      if (state.index === TOTAL_CARDS - 1) {
        state.balance += state.jackpot;
        return { state: state, outcome: "victory", card: drawn, winnings: state.jackpot };
      }
      state.index += 1;
      return { state: state, outcome: "correct", card: drawn };
    }

    // Wrong guess.
    const isJackpotRun = state.index >= 4;
    if (state.balance > 0 && !isJackpotRun) {
      return { state: state, outcome: "continue-offer", card: drawn };
    }
    let loss = 0;
    if (isJackpotRun) {
      loss = tierFor(state.index, state.jackpot);
      state.balance -= loss;
    }
    return {
      state: state, outcome: "gameover", card: drawn,
      loss: loss, wasHigher: drawn.value > current.value,
    };
  }

  // Accept the qualifier continue offer: jackpot halves, advance one slot.
  function applyContinue(prev) {
    const state = Object.assign({}, prev, {
      deck: prev.deck.slice(), board: prev.board.slice(),
    });
    state.jackpot = roundTo100(state.jackpot / 2);
    state.index += 1;
    return state;
  }

  // Cash out from the 6th card onward: bank the last survived tier.
  function applyCashOut(prev) {
    const state = Object.assign({}, prev, {
      deck: prev.deck.slice(), board: prev.board.slice(),
    });
    const winnings = tierFor(state.index - 1, state.jackpot);
    state.balance += winnings;
    return { state: state, winnings: winnings };
  }

  // Swap the base card before the first guess ($100).
  function applySwap(prev) {
    const state = Object.assign({}, prev, {
      deck: prev.deck.slice(), board: prev.board.slice(),
    });
    state.balance -= SWAP_COST;
    state.baseCard = state.deck.pop();
    state.swapped = true;
    return state;
  }

  function canSwap(state) {
    return state.index === 0 && state.balance >= SWAP_COST && !state.swapped;
  }

  function canCashOut(state) {
    return state.index >= 5;
  }

  // Jackpot range scaling across rounds.
  function nextRange(range, result) {
    if (result === "victory") {
      return {
        min: roundTo100(range.min + 500),
        max: roundTo100(range.max + 1000),
      };
    }
    if (result === "gameover") {
      return {
        min: Math.max(1000, roundTo100(range.min - 500)),
        max: Math.max(2000, roundTo100(range.max - 1000)),
      };
    }
    return { min: range.min, max: range.max };
  }

  // Leaderboard name identity (v1.6.2). Names are compared squashed —
  // lowercase, letters/digits only — so lookalikes ("A l e x", "alex!",
  // "ALEX") count as the same name.
  function squashName(n) {
    return String(n == null ? "" : n).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // entries: [{ id, name }] from the global board; myUid: this player's
  // leaderboard document id (their own entry never blocks them).
  // True when a DIFFERENT player already uses the candidate name.
  function nameTakenIn(entries, candidate, myUid) {
    var key = squashName(candidate);
    if (key.length < 2 || !entries) return false;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e || e.id === myUid) continue;
      if (squashName(e.name) === key) return true;
    }
    return false;
  }

  // Country from browser locales (v1.6.2): the region subtag of the first
  // locale that carries an accepted one, e.g. "en-CA" -> "CA",
  // "zh-Hant-TW" -> "TW". locales: BCP-47 strings; validCodes: accepted
  // alpha-2 codes. Null when no locale yields an accepted country.
  function countryFromLocales(locales, validCodes) {
    if (!locales || !validCodes) return null;
    var valid = {};
    for (var i = 0; i < validCodes.length; i++) valid[String(validCodes[i]).toUpperCase()] = true;
    for (var j = 0; j < locales.length; j++) {
      var parts = String(locales[j] || "").split(/[-_]/);
      // parts[0] is the language; a region is any later 2-letter subtag.
      for (var k = 1; k < parts.length; k++) {
        if (/^[A-Za-z]{2}$/.test(parts[k])) {
          var code = parts[k].toUpperCase();
          if (valid[code]) return code;
          break; // first region-like subtag decides for this locale
        }
      }
    }
    return null;
  }

  return {
    RANKS: RANKS, VALUES: VALUES, SUITS: SUITS,
    TOTAL_CARDS: TOTAL_CARDS, SWAP_COST: SWAP_COST,
    INITIAL_JACKPOT_RANGE: INITIAL_JACKPOT_RANGE,
    roundTo100: roundTo100, formatCurrency: formatCurrency,
    createDeck: createDeck, generateJackpot: generateJackpot,
    tierFor: tierFor, newRound: newRound,
    applyGuess: applyGuess, applyContinue: applyContinue,
    applyCashOut: applyCashOut, applySwap: applySwap,
    canSwap: canSwap, canCashOut: canCashOut,
    nextRange: nextRange,
    squashName: squashName, nameTakenIn: nameTakenIn,
    countryFromLocales: countryFromLocales,
  };
});
