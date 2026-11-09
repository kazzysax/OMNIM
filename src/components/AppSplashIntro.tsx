import React, { useState, useEffect } from 'react';
import { OmnimLogoAnimation } from './OmnimLogoAnimation';

interface AppSplashIntroProps {
  onFinish?: () => void;
}

export const AppSplashIntro: React.FC<AppSplashIntroProps> = ({ onFinish }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Start fade out after the logo finishes drawing (~1.4s)
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 1400);

    // Completely unmount after fade transition (~1.8s)
    const finishTimer = setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, 1800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsFading(true);
    setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, 200);
  };

  return (
    <div
      onClick={handleDismiss}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#090A0D] text-white cursor-pointer select-none transition-all duration-400 ease-out ${
        isFading ? 'opacity-0 scale-[1.03] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle background ambient glow */}
      <div className="absolute w-72 h-72 rounded-full bg-[#E5B887]/10 blur-[90px] pointer-events-none" />

      {/* Drawing Logo Animation */}
      <div className="relative z-10 flex flex-col items-center">
        <OmnimLogoAnimation mode="draw-once" size={100} showGlow={true} />

        {/* Branding title & subtitle that fade in gracefully */}
        <div 
          className="mt-6 text-center space-y-1.5"
          style={{ animation: 'omnimFadeShimmer 0.8s ease-out 0.4s both' }}
        >
          <h1 className="text-2xl font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-[#FCE1C9] via-[#E5B887] to-[#BA8356]">
            OMNIM
          </h1>
          <p className="text-[11px] font-medium tracking-widest uppercase text-slate-400">
            Universal Asset Gateway
          </p>
        </div>
      </div>

      {/* Tap hint */}
      <div 
        className="absolute bottom-10 text-[10px] text-slate-500 tracking-wider font-mono opacity-60"
        style={{ animation: 'omnimFadeShimmer 0.8s ease-out 0.8s both' }}
      >
        TAP TO ENTER
      </div>
    </div>
  );
};

