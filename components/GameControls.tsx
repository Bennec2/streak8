import React from 'react';
import { ArrowUp, ArrowDown, HandCoins, Play, RefreshCw, X } from 'lucide-react';
import { GamePhase, Guess } from '../types';

interface GameControlsProps {
  phase: GamePhase;
  onGuess: (guess: Guess) => void;
  onCashOut: () => void;
  onStart: () => void;
  onChangeBase?: () => void;
  onContinue?: () => void;
  canChangeBase?: boolean;
  canCashOut: boolean;
  betAmount: number;
  jackpotValue: number;
  isJackpotRun: boolean;
  disabled?: boolean;
  disableHigher?: boolean;
  disableLower?: boolean;
}

const Circular3DButton: React.FC<{
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    color: 'emerald' | 'red' | 'purple' | 'slate' | 'amber';
    disabled?: boolean;
    size?: 'md' | 'lg';
}> = ({ onClick, icon, label, color, disabled, size = 'md' }) => {
    
    const colorStyles = {
        emerald: {
            bg: 'bg-gradient-to-b from-emerald-400 to-emerald-600',
            shadow: 'shadow-[0_6px_0_#065f46,0_10px_10px_rgba(0,0,0,0.4)]',
            active: 'active:shadow-[0_0px_0_#065f46,0_0px_0px_rgba(0,0,0,0.4)]',
            text: 'fill-emerald-100'
        },
        red: {
            bg: 'bg-gradient-to-b from-red-400 to-red-600',
            shadow: 'shadow-[0_6px_0_#991b1b,0_10px_10px_rgba(0,0,0,0.4)]',
            active: 'active:shadow-[0_0px_0_#991b1b,0_0px_0px_rgba(0,0,0,0.4)]',
            text: 'fill-red-100'
        },
        purple: {
            bg: 'bg-gradient-to-b from-purple-400 to-purple-600',
            shadow: 'shadow-[0_6px_0_#581c87,0_10px_10px_rgba(0,0,0,0.4)]',
            active: 'active:shadow-[0_0px_0_#581c87,0_0px_0px_rgba(0,0,0,0.4)]',
            text: 'fill-purple-100'
        },
        slate: {
            bg: 'bg-gradient-to-b from-slate-500 to-slate-700',
            shadow: 'shadow-[0_6px_0_#1e293b,0_10px_10px_rgba(0,0,0,0.4)]',
            active: 'active:shadow-[0_0px_0_#1e293b,0_0px_0px_rgba(0,0,0,0.4)]',
            text: 'fill-slate-200'
        },
        amber: {
            bg: 'bg-gradient-to-b from-amber-400 to-orange-600',
            shadow: 'shadow-[0_6px_0_#9a3412,0_10px_10px_rgba(0,0,0,0.4)]',
            active: 'active:shadow-[0_0px_0_#9a3412,0_0px_0px_rgba(0,0,0,0.4)]',
            text: 'fill-amber-100'
        }
    };

    const styles = colorStyles[color];
    const baseSize = size === 'lg' ? 'w-24 h-24' : 'w-20 h-20';
    
    // SVG Path calculation for arc text
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                relative rounded-full flex items-center justify-center transition-all duration-100
                ${baseSize}
                ${styles.bg}
                ${!disabled ? styles.shadow : ''}
                ${!disabled ? 'active:translate-y-[6px]' : 'opacity-50 grayscale cursor-not-allowed translate-y-[6px]'}
                ${styles.active}
            `}
        >
            {/* Circular Text Label */}
            <div className="absolute inset-0 pointer-events-none">
                 <svg viewBox="0 0 100 100" className="w-full h-full animate-in fade-in">
                    <path id="textCurve" d="M 12,50 A 38,38 0 0,1 88,50" fill="transparent" />
                    <text width="100" className={`text-[11px] font-bold uppercase tracking-widest ${styles.text}`} textAnchor="middle">
                        <textPath xlinkHref="#textCurve" startOffset="50%">
                            {label}
                        </textPath>
                    </text>
                 </svg>
            </div>

            <div className="relative z-10 text-white drop-shadow-md">
                {icon}
            </div>
        </button>
    );
}

const GameControls: React.FC<GameControlsProps> = ({
  phase,
  onGuess,
  onCashOut,
  onStart,
  onChangeBase,
  canChangeBase,
  canCashOut,
  disabled = false,
  disableHigher = false,
  disableLower = false,
}) => {
  
  // Removed bg-black/20 backdrop-blur-sm, made transparent
  const containerClasses = "w-full bg-transparent p-4 shrink-0 mt-auto z-40";
  const disabledClasses = disabled ? "opacity-50 pointer-events-none" : "";

  // Start Hand State
  if (phase !== GamePhase.PLAYING) {
     if (phase === GamePhase.IDLE || phase === GamePhase.GAMEOVER || phase === GamePhase.VICTORY || phase === GamePhase.CASHED_OUT) {
        return (
            <div className={containerClasses}>
                <div className="flex justify-center pb-2">
                    <Circular3DButton 
                        onClick={onStart}
                        icon={<Play className="w-10 h-10 fill-white" />}
                        label="START HAND"
                        color="amber"
                        size="lg"
                        disabled={disabled}
                    />
                </div>
            </div>
        );
     }
     return <div className={containerClasses + " opacity-0 pointer-events-none"} />;
  }

  return (
    <div className={`${containerClasses} ${disabledClasses}`}>
       
       <div className="flex items-center justify-center gap-6 sm:gap-10 pb-2">
            
            {/* Higher Button */}
            <Circular3DButton 
                onClick={() => onGuess(Guess.HIGHER)}
                icon={<ArrowUp className="w-8 h-8 stroke-[3]" />}
                label="HIGHER"
                color="emerald"
                disabled={disabled || disableHigher}
            />

            {/* Middle Action: Swap or Cashout */}
            <div className="flex flex-col items-center justify-center w-20">
                {canCashOut ? (
                    <Circular3DButton 
                        onClick={onCashOut}
                        icon={<HandCoins className="w-8 h-8 stroke-[2]" />}
                        label="CASHOUT"
                        color="purple"
                        disabled={disabled}
                    />
                ) : canChangeBase && onChangeBase ? (
                     <Circular3DButton 
                        onClick={onChangeBase}
                        icon={<RefreshCw className="w-6 h-6 stroke-[2]" />}
                        label="SWAP $100"
                        color="slate"
                        disabled={disabled}
                    />
                ) : (
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                        <span className="text-white/20 text-xs font-bold">VS</span>
                    </div>
                )}
            </div>

            {/* Lower Button */}
            <Circular3DButton 
                onClick={() => onGuess(Guess.LOWER)}
                icon={<ArrowDown className="w-8 h-8 stroke-[3]" />}
                label="LOWER"
                color="red"
                disabled={disabled || disableLower}
            />
       </div>
       
       {/* Helper for Disabled State */}
       {(disableHigher || disableLower) && !disabled && (
           <div className="text-center text-xs text-orange-400 font-bold mt-2 animate-pulse">
               {disableHigher ? "Ace is High - Cannot go Higher" : "2 is Low - Cannot go Lower"}
           </div>
       )}

    </div>
  );
};

export default GameControls;