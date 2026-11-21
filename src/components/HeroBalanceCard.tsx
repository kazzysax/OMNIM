import React from 'react';
import { WalletState } from '../types';
import { ArrowDownLeft, ArrowUpRight, Plus, ChevronDown, RotateCcw } from 'lucide-react';

interface HeroBalanceCardProps {
  wallet: WalletState;
  totalBalanceUsd: number;
  onOpenReceive: () => void;
  onOpenSend: () => void;
  onOpenSwap: () => void;
  onOpenWalletDetails: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const HeroBalanceCard: React.FC<HeroBalanceCardProps> = ({
  wallet,
  totalBalanceUsd,
  onOpenReceive,
  onOpenSend,
  onOpenSwap,
  onOpenWalletDetails,
  onRefresh,
  isRefreshing,
}) => {
  const balanceText = `$${totalBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="mx-4 mt-3 mb-4 rounded-[36px] bg-[#1C1C1E] text-white shadow-xl overflow-hidden flex flex-col justify-between min-h-[33vh] max-h-[380px] px-5 pt-7 pb-6">
      {/* Wallet Dropdown Selector */}
      <div className="flex justify-center">
        <button
          onClick={onOpenWalletDetails}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <span>{wallet.nimiqAddress ? `${wallet.nimiqAddress.slice(0, 6)}...` : wallet.evmAddress ? `${wallet.evmAddress.slice(0, 6)}...${wallet.evmAddress.slice(-4)}` : 'Wallet 1'}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Big Hero Balance */}
      <div className="text-center flex-1 flex flex-col items-center justify-center py-3">
        <h1 className={`${balanceText.length > 11 ? 'text-[38px]' : balanceText.length > 9 ? 'text-[44px]' : 'text-[52px]'} leading-none font-bold tracking-tight text-white`}>
          {balanceText}
        </h1>
        <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-slate-400 font-medium">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh on-chain balances"
            className="p-1 -m-1 hover:text-slate-300 transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-transform ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-center gap-4">
        {/* Receive Pill Button */}
        <button
          onClick={onOpenReceive}
          className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#2C2C2E] hover:bg-[#38383A] active:scale-95 text-white text-sm font-semibold transition-all shadow-sm"
        >
          <ArrowDownLeft className="w-4 h-4 stroke-[2]" />
          <span>Receive</span>
        </button>

        {/* Central Swap Plus Button */}
        <button
          onClick={onOpenSwap}
          title="Swap Assets"
          className="w-14 h-14 rounded-full bg-[#2C2C2E] hover:bg-[#38383A] active:scale-90 text-white flex items-center justify-center text-xl transition-all shadow-sm"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Send Pill Button */}
        <button
          onClick={onOpenSend}
          className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-[#2C2C2E] hover:bg-[#38383A] active:scale-95 text-white text-sm font-semibold transition-all shadow-sm"
        >
          <ArrowUpRight className="w-4 h-4 stroke-[2]" />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};
