import React from 'react';
import { Card } from '../types';
import { HelpCircle } from 'lucide-react';

interface PlayingCardProps {
  card: Card | null;
  revealed: boolean;
  isNext?: boolean;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
  variant?: 'default' | 'jackpot' | 'gold';
  outcome?: 'neutral' | 'win' | 'loss';
  isFalling?: boolean;
}

const PlayingCard: React.FC<PlayingCardProps> = ({ 
  card, 
  revealed, 
  isNext = false, 
  size = 'md',
  highlight = false,
  variant = 'default',
  outcome = 'neutral',
  isFalling = false
}) => {
  
  // Standardized sizes
  const sizeClasses = {
    sm: 'w-16 h-24 text-lg',
    md: 'w-20 h-28 md:w-24 md:h-36 text-2xl',
    lg: 'w-32 h-48 text-4xl',
  };

  const getBorderClass = () => {
     if (!revealed) {
        // Back of card borders
        switch (variant) {
            case 'jackpot': return 'border-red-500/30';
            case 'gold': return 'border-yellow-300/50';
            default: return 'border-indigo-500/30'; // darker border for default
        }
     }

     // Revealed card borders based on outcome
     switch (outcome) {
        case 'win': return 'ring-4 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]';
        case 'loss': return 'ring-4 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
        default: 
            return highlight ? 'ring-4 ring-yellow-400 scale-105 z-10' : 'ring-1 ring-black/20';
     }
  };

  const baseClasses = `
    relative rounded-xl shadow-xl select-none transition-all duration-300
    ${sizeClasses[size]}
    ${getBorderClass()}
  `;

  const getBackClass = () => {
    switch (variant) {
      case 'jackpot': return 'card-back-jackpot';
      case 'gold': return 'card-back-gold';
      default: return 'card-back';
    }
  };

  // Render Card Back
  if (!revealed || !card) {
    return (
      <div className={`${baseClasses} ${getBackClass()} border-2 flex items-center justify-center overflow-hidden`}>
         {/* Center Question Mark Design */}
         <div className={`rounded-full flex items-center justify-center shadow-lg transform transition-transform duration-500
            ${size === 'sm' ? 'w-10 h-10' : 'w-14 h-14'}
            ${isNext ? 'bg-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'bg-white/90'}
         `}>
            <span className={`font-black font-serif text-slate-900 ${size === 'sm' ? 'text-2xl' : 'text-4xl'}`}>?</span>
         </div>
      </div>
    );
  }

  const isRed = card.color === 'red';
  const isJackpotWin = outcome === 'win' && (variant === 'jackpot' || variant === 'gold');

  // Adjust font sizes for corners based on card size
  const cornerSize = size === 'sm' ? 'text-xs' : 'text-base';
  const rankSize = size === 'sm' ? 'text-base' : 'text-xl';
  const centerSize = size === 'sm' ? 'text-4xl' : 'text-6xl';

  // Animation handling: If falling, use spin-fall, otherwise normal flip-in for reveal
  const animationClass = isFalling ? 'animate-spin-fall z-50' : 'animate-flip-in';

  return (
    <div className={`${baseClasses} bg-white ${isRed ? 'text-red-600' : 'text-slate-900'} ${animationClass} overflow-hidden`}>
      {/* Shimmer Effect for Jackpot Wins */}
      {isJackpotWin && (
        <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 animate-shimmer" />
            <div className="absolute inset-0 bg-yellow-400/10 mix-blend-overlay" />
        </div>
      )}

      {/* Top Left Corner */}
      <div className={`absolute top-1 left-1 flex flex-col items-center leading-none z-10 ${cornerSize}`}>
        <span className={`font-bold ${rankSize}`}>{card.rank}</span>
        <span>{card.suit}</span>
      </div>
      
      {/* Center Suit - Solid Color */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <span className={`${centerSize}`}>{card.suit}</span>
      </div>

      {/* Bottom Right Corner */}
      <div className={`absolute bottom-1 right-1 flex flex-col items-center leading-none transform rotate-180 z-10 ${cornerSize}`}>
        <span className={`font-bold ${rankSize}`}>{card.rank}</span>
        <span>{card.suit}</span>
      </div>
    </div>
  );
};

export default PlayingCard;