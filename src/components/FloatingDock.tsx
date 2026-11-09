import React from 'react';
import { Wallet, CircleDollarSign, User } from 'lucide-react';

export type ActiveTab = 'dashboard' | 'swap' | 'profile';

interface FloatingDockProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenSwap: () => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  activeTab,
  onTabChange,
  onOpenSwap,
}) => {
  return (
    <div className="fixed bottom-[max(20px,calc(14px+env(safe-area-inset-bottom)))] left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <nav className="flex items-center gap-7 px-7 py-3 rounded-full bg-[#1C1C1E] shadow-2xl shadow-black/50 border border-white/10">
        <button
          onClick={() => onTabChange('dashboard')}
          title="Wallet"
          className={`p-1.5 rounded-full transition-all active:scale-90 ${
            activeTab === 'dashboard'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wallet className="w-5 h-5 stroke-[2]" />
        </button>

        <button
          onClick={onOpenSwap}
          title="Swap"
          className={`p-1.5 rounded-full transition-all active:scale-90 ${
            activeTab === 'swap'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CircleDollarSign className="w-5 h-5 stroke-[2]" />
        </button>

        <button
          onClick={() => onTabChange('profile')}
          title="Account"
          className={`p-1.5 rounded-full transition-all active:scale-90 ${
            activeTab === 'profile'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <User className="w-5 h-5 stroke-[2]" />
        </button>
      </nav>
    </div>
  );
};

