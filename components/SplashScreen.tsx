import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0); // 0: items, 1: logo, 2: fadeout

  useEffect(() => {
    // Sequence timing
    // 1-8 Items appear every 150ms. (Total ~1.2s)
    // At 1.4s, show Logo.
    // At 2.8s, fade out.
    // At 3.3s, unmount.
    
    const timer1 = setTimeout(() => setStage(1), 1400); 
    const timer2 = setTimeout(() => setStage(2), 2800); 
    const timer3 = setTimeout(onComplete, 3300); 

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[200] bg-[#050505] flex flex-col items-center justify-center transition-opacity duration-500 ${stage === 2 ? 'opacity-0' : 'opacity-100'}`}>
      
      {/* The 8 Items Growing */}
      <div className="flex gap-2 mb-12 h-20 items-end">
        {[...Array(8)].map((_, i) => (
          <div 
            key={i}
            className={`
              w-8 h-12 rounded-md border-2 transform scale-0 animate-pop-in
              ${i < 4 ? 'border-indigo-500 bg-indigo-900/50 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'border-yellow-400 bg-yellow-900/50 shadow-[0_0_20px_rgba(250,204,21,0.6)]'}
            `}
            style={{ 
                animationDelay: `${i * 150}ms`, 
                animationFillMode: 'forwards' 
            }}
          />
        ))}
      </div>

      {/* Logo Reveal */}
      <div className={`relative flex flex-col items-center transition-all duration-700 transform ${stage >= 1 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-10'}`}>
          <h1 className="text-6xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 via-orange-500 to-red-600 drop-shadow-[0_0_25px_rgba(234,179,8,0.5)] leading-tight text-center" style={{ fontFamily: '"Inter", sans-serif' }}>
            STREAK<span className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">8</span>
          </h1>
          <div className="flex items-center gap-3 mt-4 text-yellow-200 uppercase tracking-[0.4em] text-sm font-bold animate-pulse justify-center">
            <Sparkles className="w-4 h-4" />
            <span>High Stakes Run</span>
            <Sparkles className="w-4 h-4" />
          </div>
      </div>
    </div>
  );
};

export default SplashScreen;