import React from 'react';
import { Bell } from 'lucide-react';

interface HeaderProps {
  onOpenWalletDetails?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenWalletDetails }) => {
  return (
    <header className="flex items-center justify-between px-5 pt-3 pb-1">
      {/* Left: Avatar with OMNIM Logo */}
      <div 
        onClick={onOpenWalletDetails}
        className="w-10 h-10 rounded-full overflow-hidden cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-md bg-black border border-white/10"
      >
        <img 
          src="/omnim-logo.jpg" 
          alt="OMNIM Logo" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Right: Clean Bell Icon */}
      <button 
        className="w-10 h-10 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-sm"
      >
        <Bell className="w-4 h-4 stroke-[2]" />
      </button>
    </header>
  );
};
