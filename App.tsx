import React, { useState, useEffect, useCallback } from 'react';
import { Card, GamePhase, GameState, Guess } from './types';
import { createDeck, formatCurrency } from './utils/gameUtils';
import PlayingCard from './components/PlayingCard';
import GameControls from './components/GameControls';
import RollingNumber from './components/RollingNumber';
import SplashScreen from './components/SplashScreen';
import { Coins, Trophy, Info, Sparkles, X, HelpCircle, RotateCcw, Play, AlertTriangle } from 'lucide-react';

// Constants
const TOTAL_CARDS = 8;
const INITIAL_MIN_JACKPOT = 10000; // Start exactly at 10k
const INITIAL_MAX_JACKPOT = 10000;
const SWAP_COST = 100;
const STORAGE_KEY = 'hl_jackpot_balance';

// Helper to ensure numbers are always in 100s
const roundTo100 = (num: number) => Math.floor(num / 100) * 100;

// Modal Component
const GameMessageModal: React.FC<{ 
  message: string; 
  phase: GamePhase; 
  onContinue: () => void; 
  onNewHand: () => void;
  subMessage?: string;
}> = ({ message, phase, onContinue, onNewHand, subMessage }) => {
  if (phase === GamePhase.PLAYING || phase === GamePhase.IDLE) return null;

  const isContinueOffer = phase === GamePhase.CONTINUE_OFFER;
  const isVictory = phase === GamePhase.VICTORY;
  const isCashedOut = phase === GamePhase.CASHED_OUT;
  const isGameOver = phase === GamePhase.GAMEOVER;

  let neonClass = '';
  let textGradient = 'bg-white';
  let icon = null;

  if (isVictory) {
      neonClass = 'shadow-[0_0_50px_rgba(250,204,21,0.5),inset_0_0_20px_rgba(250,204,21,0.2)]';
      textGradient = 'from-yellow-200 to-yellow-500';
      icon = <Trophy className="w-20 h-20 text-yellow-400 mb-4 animate-bounce-small drop-shadow-[0_0_25px_rgba(250,204,21,0.8)]" />;
  } else if (isCashedOut) {
      neonClass = 'shadow-[0_0_50px_rgba(16,185,129,0.5),inset_0_0_20px_rgba(16,185,129,0.2)]';
      textGradient = 'from-emerald-200 to-emerald-500';
      icon = <Coins className="w-20 h-20 text-emerald-400 mb-4 drop-shadow-[0_0_25px_rgba(16,185,129,0.8)]" />;
  } else if (isContinueOffer) {
      neonClass = 'shadow-[0_0_50px_rgba(249,115,22,0.5),inset_0_0_20px_rgba(249,115,22,0.2)]';
      textGradient = 'from-orange-200 to-orange-500';
      icon = <AlertTriangle className="w-16 h-16 text-orange-500 mb-4 drop-shadow-[0_0_25px_rgba(249,115,22,0.8)]" />;
  } else if (isGameOver) {
      neonClass = 'shadow-[0_0_50px_rgba(239,68,68,0.5),inset_0_0_20px_rgba(239,68,68,0.2)]';
      textGradient = 'from-red-200 to-red-500';
      icon = <X className="w-20 h-20 text-red-500 mb-4 drop-shadow-[0_0_25px_rgba(239,68,68,0.8)]" />;
  }

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500">
      <div className={`
        relative w-full max-w-sm p-10 rounded-[3rem] flex flex-col items-center text-center
        bg-transparent
        ${neonClass}
        shadow-[inset_0_0_60px_rgba(0,0,0,1)]
        transform transition-all scale-100
      `}>
        {icon}
        
        {/* Title */}
        <h2 className={`text-5xl font-black casino-font tracking-wider text-transparent bg-clip-text bg-gradient-to-b ${textGradient} drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] uppercase`}>
          {message}
        </h2>

        {/* Sub Message */}
        {subMessage && (
           <div className="mt-6">
             <p className={`text-xl font-bold font-mono tracking-tight ${isGameOver ? 'text-red-400' : isVictory ? 'text-yellow-400' : 'text-slate-300'} drop-shadow-md`}>
               {subMessage}
             </p>
           </div>
        )}

        {/* Actions */}
        {isContinueOffer ? (
          <div className="flex gap-4 w-full mt-10">
             <button
               onClick={onContinue}
               className="flex-1 py-4 rounded-2xl font-black text-white bg-black/40 shadow-[0_0_15px_rgba(249,115,22,0.5)] active:scale-95 transition-all border border-orange-500/50 hover:bg-orange-500/20 flex items-center justify-center gap-2 uppercase tracking-wider text-sm group"
             >
               <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform" /> Continue
             </button>
             <button
               onClick={onNewHand}
               className="flex-1 py-4 rounded-2xl font-black text-slate-400 bg-black/40 shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95 transition-all border border-white/10 hover:bg-white/5 uppercase tracking-wider text-sm"
             >
               Give Up
             </button>
          </div>
        ) : (
             <div className="mt-10 flex flex-col items-center gap-3">
                <div className="text-xs text-white/30 uppercase tracking-[0.3em] font-bold">Next Hand Starting</div>
                <div className="flex gap-3">
                   <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                   <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                   <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce"></div>
                </div>
             </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- State ---
  const [showSplash, setShowSplash] = useState(true);
  const [deck, setDeck] = useState<Card[]>([]);
  const [baseCard, setBaseCard] = useState<Card | null>(null);
  const [boardCards, setBoardCards] = useState<(Card | null)[]>(Array(TOTAL_CARDS).fill(null));
  const [currentIndex, setCurrentIndex] = useState(0); // 0 to 7
  const [phase, setPhase] = useState<GamePhase>(GamePhase.IDLE);
  const [jackpot, setJackpot] = useState(0);
  
  // Initialize balance from localStorage
  const [balance, setBalance] = useState(() => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? parseInt(saved, 10) : 0;
    } catch (e) {
        return 0;
    }
  });

  const [message, setMessage] = useState("");
  const [subMessage, setSubMessage] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [animateJackpotLabel, setAnimateJackpotLabel] = useState(false);
  const [fallingCardIndex, setFallingCardIndex] = useState<number | null>(null);
  
  // Jackpot Scaling State
  const [jackpotRange, setJackpotRange] = useState({ min: INITIAL_MIN_JACKPOT, max: INITIAL_MAX_JACKPOT });

  // --- Effects ---
  
  // Persist balance
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, balance.toString());
  }, [balance]);

  // On Mount: Generate initial jackpot display
  useEffect(() => {
    setJackpot(generateRandomJackpot());
  }, []); 

  // Trigger animation when entering Jackpot Run (Index 4)
  useEffect(() => {
    if (currentIndex === 4 && phase === GamePhase.PLAYING) {
        setAnimateJackpotLabel(true);
        const t = setTimeout(() => setAnimateJackpotLabel(false), 1000);
        return () => clearTimeout(t);
    }
  }, [currentIndex, phase]);

  // Auto-reset Effect for outcomes
  useEffect(() => {
    if (phase === GamePhase.GAMEOVER || phase === GamePhase.VICTORY || phase === GamePhase.CASHED_OUT) {
      const timer = setTimeout(() => {
        startRound();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // --- Helpers ---
  const generateRandomJackpot = useCallback(() => {
    const raw = Math.floor(Math.random() * (jackpotRange.max - jackpotRange.min + 1)) + jackpotRange.min;
    return roundTo100(raw);
  }, [jackpotRange]);

  const getTierEarnings = (index: number, currentJackpot: number) => {
    // Indexes 0-3 are qualification rounds
    if (index < 4) return 0;
    const percentage = (index - 3) * 0.25; // index 4 (5th card) = 1 * 0.25 = 25%
    return roundTo100(currentJackpot * percentage);
  };

  const startRound = useCallback(() => {
    const newDeck = createDeck();
    const newBase = newDeck.pop()!;
    // Always generate a fresh jackpot for a new round
    const newJackpot = generateRandomJackpot();
    
    setDeck(newDeck);
    setBaseCard(newBase);
    setBoardCards(Array(TOTAL_CARDS).fill(null));
    setCurrentIndex(0);
    setPhase(GamePhase.PLAYING);
    setJackpot(newJackpot);
    setMessage("");
    setSubMessage("");
    setFallingCardIndex(null);
    setIsProcessing(false);
  }, [generateRandomJackpot]);

  const changeBaseCard = useCallback(() => {
    if (balance < SWAP_COST || phase !== GamePhase.PLAYING || currentIndex !== 0 || isProcessing) return;

    setBalance(prev => prev - SWAP_COST);
    const newDeck = [...deck];
    if (newDeck.length === 0) return;
    
    const newBase = newDeck.pop()!;
    setDeck(newDeck);
    setBaseCard(newBase);
  }, [balance, phase, currentIndex, deck, isProcessing]);

  const handleGuess = useCallback((guess: Guess) => {
    if (phase !== GamePhase.PLAYING || isProcessing) return;
    
    const nextCard = deck[deck.length - 1]; // Peek
    const newDeck = [...deck];
    const drawnCard = newDeck.pop()!;
    
    const currentCard = currentIndex === 0 ? baseCard! : boardCards[currentIndex - 1]!;
    
    // Determine outcome
    const isHigher = drawnCard.value > currentCard.value;
    const isLower = drawnCard.value < currentCard.value;
    const isPush = drawnCard.value === currentCard.value;
    
    // Update board immediately
    const newBoard = [...boardCards];
    newBoard[currentIndex] = drawnCard;
    setBoardCards(newBoard);
    setDeck(newDeck);

    if (isPush) {
      // Reduce by 50% and round to 100
      const nextJackpot = roundTo100(jackpot / 2);
      setJackpot(nextJackpot);
      if (currentIndex === TOTAL_CARDS - 1) {
        // A push on the final card still clears the whole board: victory at
        // the halved jackpot. (Otherwise the board index would run past the
        // last slot and the round could never end.)
        setIsProcessing(true);
        setTimeout(() => {
          setIsProcessing(false);
          setPhase(GamePhase.VICTORY);
          setBalance(prev => prev + nextJackpot);
          setMessage("JACKPOT!");
          setSubMessage(`You won ${formatCurrency(nextJackpot)}`);

          // Increase jackpot range for next round
          setJackpotRange(prev => ({
            min: roundTo100(prev.min + 500),
            max: roundTo100(prev.max + 1000)
          }));
        }, 1500);
      } else {
        setCurrentIndex(prev => prev + 1);
        // Pushes continue immediately
      }
    } else {
      const guessedCorrectly = (guess === Guess.HIGHER && isHigher) || (guess === Guess.LOWER && isLower);
      const isJackpotRun = currentIndex >= 4;

      if (guessedCorrectly) {
        if (currentIndex === TOTAL_CARDS - 1) {
          // Won the last card (8th)
          // Add delay to show the card before victory popup
          setIsProcessing(true);
          setTimeout(() => {
             setIsProcessing(false);
             setPhase(GamePhase.VICTORY);
             setBalance(prev => prev + jackpot);
             setMessage("JACKPOT!");
             setSubMessage(`You won ${formatCurrency(jackpot)}`);
             
             // Increase jackpot range for next round, keeping min/max cleanly on 100s if desired
             setJackpotRange(prev => ({
               min: roundTo100(prev.min + 500),
               max: roundTo100(prev.max + 1000)
             }));
          }, 1500);

        } else {
          setCurrentIndex(prev => prev + 1);
        }
      } else {
        // Wrong Guess: Show card, Trigger "Fall" animation
        setFallingCardIndex(currentIndex);
        setIsProcessing(true);
        
        // Wait 2s (allows flip and fall animation to play completely) before popup
        setTimeout(() => {
            setIsProcessing(false);
            if (balance > 0 && !isJackpotRun) {
                setPhase(GamePhase.CONTINUE_OFFER);
                setMessage("Wrong Guess!");
                setSubMessage(`Reduce Jackpot by 50% to continue?`);
            } else {
                // Determine loss amount if in Jackpot Run
                let lossMessage = `It was ${isHigher ? 'Higher' : 'Lower'}`;
                if (isJackpotRun) {
                    const amountLost = getTierEarnings(currentIndex, jackpot);
                    setBalance(prev => prev - amountLost);
                    lossMessage = `Lost ${formatCurrency(amountLost)}`;
                }

                setPhase(GamePhase.GAMEOVER);
                setMessage("Game Over");
                setSubMessage(lossMessage);
                
                setJackpotRange(prev => ({
                    min: Math.max(1000, roundTo100(prev.min - 500)),
                    max: Math.max(2000, roundTo100(prev.max - 1000))
                }));
            }
        }, 2000);
      }
    }
  }, [boardCards, currentIndex, deck, baseCard, jackpot, phase, balance, isProcessing]);

  const handleContinue = useCallback(() => {
    if (phase !== GamePhase.CONTINUE_OFFER) return;

    // Reduce by 50% and round to 100
    const nextJackpot = roundTo100(jackpot / 2);
    setJackpot(nextJackpot);
    
    // Reset falling card state so it renders correctly if we revisit it (though we move to next)
    // Actually we move to next card after continue
    setFallingCardIndex(null);
    setPhase(GamePhase.PLAYING);
    setCurrentIndex(prev => prev + 1);
  }, [phase, jackpot]);

  const handleCashOut = useCallback(() => {
    const lastSuccessIndex = currentIndex - 1;
    const winnings = getTierEarnings(lastSuccessIndex, jackpot);
    
    setBalance(prev => prev + winnings);
    setPhase(GamePhase.CASHED_OUT);
    setMessage("Cashed Out!");
    setSubMessage(`You won ${formatCurrency(winnings)}`);
    // Auto reset handled by useEffect
  }, [currentIndex, jackpot]);

  // --- Derived State ---
  const canCashOut = phase === GamePhase.PLAYING && currentIndex >= 5; 
  const isJackpotRun = currentIndex >= 4;
  const canChangeBase = phase === GamePhase.PLAYING && currentIndex === 0 && balance >= SWAP_COST;
  const currentCard = phase === GamePhase.PLAYING 
      ? (currentIndex === 0 ? baseCard : boardCards[currentIndex - 1]) 
      : null;

  return (
    <div className="h-screen bg-felt bg-cover flex flex-col items-center py-4 px-2 text-white font-sans overflow-hidden relative">
      
      {/* Splash Screen */}
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

      {/* Messages Popup */}
      <GameMessageModal 
         message={message} 
         subMessage={subMessage}
         phase={phase} 
         onContinue={handleContinue} 
         onNewHand={startRound} 
      />

      {/* Header / Stats */}
      <header className="w-full max-w-4xl flex justify-between items-center gap-4 mb-2 shrink-0 px-2">
        
        {/* Jackpot Box - Floating, unified font */}
        <div className="flex items-center gap-3 group relative px-2">
           <div className="bg-gradient-to-br from-yellow-400 to-amber-600 p-2 rounded-full shadow-lg z-10">
             <Trophy className="w-4 h-4 text-white" />
           </div>
           <span className={`text-2xl font-bold font-sans ${phase === GamePhase.PLAYING && isJackpotRun ? 'animate-pulse text-yellow-300' : 'text-yellow-400'}`}>
              <RollingNumber value={jackpot} />
           </span>
        </div>

        {/* Balance Box & Help - Floating, unified font */}
        <div className="flex items-center gap-2">
             <div className="flex items-center gap-2 px-2">
                <div className="bg-emerald-600 p-2 rounded-full shadow-lg">
                   <Coins className="w-4 h-4 text-white" />
                </div>
                <span className={`text-2xl font-bold font-sans ${balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    <RollingNumber value={balance} />
                </span>
            </div>

            <button 
                onClick={() => setShowHelp(true)}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Help"
            >
                <HelpCircle className="w-6 h-6" />
            </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 w-full max-w-4xl flex flex-col items-center justify-start gap-2 relative z-0 min-h-0 overflow-hidden">
        
        {/* Base Card Row (Centered & Vertical Label) */}
        <div className="flex flex-row items-center justify-center gap-4 z-10 animate-in fade-in slide-in-from-top-4 duration-500 py-2">
             <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold uppercase tracking-[0.2em] bg-black/40 py-3 px-1 rounded-full backdrop-blur-sm border border-white/10 text-white/80 shadow-sm">Base Card</span>
             <div className="relative">
                <PlayingCard 
                    card={baseCard} 
                    revealed={!!baseCard} 
                    size="sm"
                    highlight={phase === GamePhase.PLAYING && currentIndex === 0}
                />
                {baseCard?.rank === 'A' && (
                    <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-yellow-500 whitespace-nowrap animate-pulse">Highest</span>
                )}
            </div>
        </div>

        {/* Board Grid Container */}
        <div className="w-full max-w-3xl px-4 flex-1 flex flex-col justify-center gap-4">
              
              {/* --- Row 1: Qualifier (Cards 1-4) --- */}
              <div className="relative border-4 border-slate-900 rounded-3xl p-4 bg-slate-900/30 shadow-inner">
                  <span className="absolute -top-3 left-6 bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-slate-600 z-10 shadow-lg">
                      Qualifier Round
                  </span>
                  <div className="grid grid-cols-4 gap-2 sm:gap-4 justify-items-center">
                    {Array.from({ length: 4 }).map((_, i) => {
                        let outcome: 'neutral' | 'win' | 'loss' = 'neutral';
                        if (boardCards[i]) {
                           if (i < currentIndex) outcome = 'win';
                           if (i === currentIndex && (phase === GamePhase.GAMEOVER || phase === GamePhase.CONTINUE_OFFER)) outcome = 'loss';
                        }
                        
                        // Check if this card is currently falling
                        const isFalling = fallingCardIndex === i;

                        return (
                            <div key={`phase1-${i}`} className="flex flex-col items-center gap-2 relative">
                                <span className="text-[10px] font-bold text-slate-500">#{i + 1}</span>
                                <PlayingCard 
                                    card={boardCards[i]} 
                                    revealed={!!boardCards[i]}
                                    isNext={phase === GamePhase.PLAYING && currentIndex === i}
                                    size="sm"
                                    highlight={phase === GamePhase.PLAYING && currentIndex === i + 1}
                                    outcome={outcome}
                                    isFalling={isFalling}
                                />
                            </div>
                        );
                    })}
                  </div>
              </div>

              {/* --- Row 2: Jackpot Run (Cards 5-8) --- */}
              <div className="relative border-4 border-yellow-500/50 rounded-3xl p-4 bg-gradient-to-br from-yellow-900/20 to-black/40 shadow-[0_0_20px_rgba(234,179,8,0.1)]">
                  <span className={`absolute -top-3 left-6 bg-gradient-to-r from-yellow-700 to-yellow-600 text-white text-xs font-black uppercase tracking-widest px-4 py-1 rounded-full border border-yellow-400 shadow-lg flex items-center gap-2 z-10 ${animateJackpotLabel ? 'animate-slide-x' : ''}`}>
                      <Sparkles className="w-3 h-3 text-yellow-200" /> Jackpot Run
                  </span>
                  
                  <div className="grid grid-cols-4 gap-2 sm:gap-4 justify-items-center pt-2">
                   {Array.from({ length: 4 }).map((_, i) => {
                        const slotIndex = i + 4;
                        const tierPercent = (i + 1) * 25;
                        const potentialWin = roundTo100(jackpot * (tierPercent / 100));
                        const isNext = currentIndex === slotIndex;
                        const isCompleted = slotIndex < currentIndex;
                        
                        let cardVariant: 'default' | 'jackpot' | 'gold' = 'jackpot';
                        if (i === 3) cardVariant = 'gold';

                        let outcome: 'neutral' | 'win' | 'loss' = 'neutral';
                        if (boardCards[slotIndex]) {
                            if (slotIndex < currentIndex) outcome = 'win';
                            if (slotIndex === currentIndex && (phase === GamePhase.GAMEOVER)) outcome = 'loss';
                        }
                        
                        const isFalling = fallingCardIndex === slotIndex;

                        return (
                            <div key={`phase2-${i}`} className="flex flex-col items-center gap-2 relative group">
                                <div className={`relative rounded-xl p-1 transition-all duration-500 ${
                                isNext ? 'bg-yellow-500/30 animate-pulse' : 
                                isCompleted ? 'bg-yellow-500/10' : ''
                                }`}>
                                    <PlayingCard 
                                        card={boardCards[slotIndex]} 
                                        revealed={!!boardCards[slotIndex]}
                                        isNext={isNext && phase === GamePhase.PLAYING}
                                        size="sm"
                                        variant={cardVariant}
                                        outcome={outcome}
                                        isFalling={isFalling}
                                    />
                                </div>
                                <div className={`
                                    px-2 py-1 rounded-lg border-2 text-sm sm:text-base font-black font-mono tracking-tight drop-shadow-md min-w-[4rem] text-center
                                    bg-black text-yellow-400 shadow-[0_0_10px_rgba(0,0,0,0.5)]
                                    ${isNext ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)] scale-110' : 
                                      isCompleted ? 'border-yellow-500/50 opacity-60' : 
                                      'border-white/10'}
                                    transition-all duration-300
                                `}>
                                    <RollingNumber value={potentialWin} className="drop-shadow-sm" />
                                </div>
                            </div>
                        );
                  })}
                  </div>
              </div>
        </div>

      </main>

      {/* Controls Container */}
      <GameControls 
          phase={phase}
          onGuess={handleGuess}
          onCashOut={handleCashOut}
          onStart={startRound}
          onChangeBase={changeBaseCard}
          canChangeBase={canChangeBase}
          canCashOut={canCashOut}
          betAmount={0}
          jackpotValue={jackpot}
          isJackpotRun={isJackpotRun}
          disabled={isProcessing}
          disableHigher={currentCard?.rank === 'A'}
          disableLower={currentCard?.rank === '2'}
      />

      {/* Help Modal */}
      {showHelp && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1a1a1a] shadow-[10px_10px_20px_#0e0e0e,-10px_-10px_20px_#262626] border border-white/5 rounded-2xl max-w-md w-full p-6 relative">
                <button 
                    onClick={() => setShowHelp(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    <X className="w-6 h-6" />
                </button>
                
                <div className="flex items-center gap-3 mb-6">
                    <Info className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]" />
                    <h2 className="text-xl font-bold font-serif text-white">How to Play</h2>
                </div>

                <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                    <p>
                        Guess if the next card is <strong className="text-emerald-400">Higher</strong> or <strong className="text-red-400">Lower</strong> than the current one.
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Survive the first 4 cards (Qualifier) to enter the <strong className="text-yellow-400">Jackpot Run</strong>.</li>
                        <li>In Qualifier, you can use Balance to <strong className="text-orange-400">Continue</strong> if you fail.</li>
                        <li>In <strong className="text-yellow-400">Jackpot Run</strong>, any mistake ends the game immediately!</li>
                        <li>You can <strong className="text-purple-400">Cash Out</strong> safely after any win in the Jackpot Run.</li>
                    </ul>
                    <p className="pt-2 border-t border-white/10 mt-4 text-xs text-slate-500">
                        Tip: You can change the starting Base Card for $100.
                    </p>
                </div>

                <button 
                    onClick={() => setShowHelp(false)}
                    className="w-full mt-8 py-3 bg-[#151515] hover:bg-[#202020] shadow-[5px_5px_10px_#0e0e0e,-5px_-5px_10px_#262626] active:shadow-[inset_5px_5px_10px_#0e0e0e,inset_-5px_-5px_10px_#262626] rounded-lg font-bold transition-all text-slate-300"
                >
                    Got it
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
