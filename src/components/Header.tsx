import React from 'react';

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

    </header>
  );
};
