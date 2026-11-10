import React from 'react';
import { WalletState } from '../types';
import { ArrowDownLeft, ArrowUpRight, Plus, ChevronDown, RotateCcw } from 'lucide-react';
import { Header } from './Header';

interface HeroBalanceCardProps {
  wallet: WalletState;
  totalBalanceUsd: number;
  nimBalance: number;
  onOpenReceive: () => void;
  onOpenSend: () => void;
  onOpenSwap: () => void;
  onOpenWalletDetails: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onConnectEvm?: () => void;
}

export const HeroBalanceCard: React.FC<HeroBalanceCardProps> = ({
  wallet,
  totalBalanceUsd,
  nimBalance,
  onOpenReceive,
  onOpenSend,
  onOpenSwap,
  onOpenWalletDetails,
  onRefresh,
  isRefreshing,
  onConnectEvm,
}) => {
  return (
    <div className="mx-4 mt-2 mb-3 rounded-[36px] bg-[#1C1C1E] text-white shadow-xl overflow-hidden pb-5">
      {/* Integrated Top Row Header */}
      <Header onOpenWalletDetails={onOpenWalletDetails} />

      {/* Wallet Dropdown Selector */}
      <div className="flex items-center justify-center gap-2 mt-1 mb-2">
        <button
          onClick={onOpenWalletDetails}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <span>{wallet.nimiqAddress ? `${wallet.nimiqAddress.slice(0, 6)}...` : wallet.evmAddress ? `${wallet.evmAddress.slice(0, 6)}...${wallet.evmAddress.slice(-4)}` : 'Wallet 1'}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {!wallet.evmAddress && onConnectEvm && (
          <button
            onClick={onConnectEvm}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold hover:bg-amber-500/30 active:scale-95 transition-all shadow-sm"
          >
            <span>+ Connect EVM</span>
          </button>
        )}
      </div>

      {/* Big Hero Balance */}
      <div className="text-center my-1">
        <h1 className="text-4xl sm:text-[44px] font-bold tracking-tight text-white">
          ${totalBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h1>
        <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-slate-400 font-medium">
          <span>{nimBalance > 0 ? nimBalance.toFixed(2) : '0.00'} NIM</span>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh on-chain balances"
            className="p-1 -m-1 hover:text-slate-300 transition-colors"
          >
            <RotateCcw className={`w-3 h-3 text-slate-500 hover:text-slate-300 transition-transform ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-center gap-3.5 mt-5 mb-2">
        {/* Receive Pill Button */}
        <button
          onClick={onOpenReceive}
          className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-full bg-[#2C2C2E] hover:bg-[#38383A] active:scale-95 text-white text-xs font-semibold transition-all shadow-sm"
        >
          <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2]" />
          <span>Receive</span>
        </button>

        {/* Central Swap Plus Button */}
        <button
          onClick={onOpenSwap}
          title="Swap Assets"
          className="w-12 h-12 rounded-full bg-[#2C2C2E] hover:bg-[#38383A] active:scale-90 text-white flex items-center justify-center text-xl transition-all shadow-sm"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Send Pill Button */}
        <button
          onClick={onOpenSend}
          className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-full bg-[#2C2C2E] hover:bg-[#38383A] active:scale-95 text-white text-xs font-semibold transition-all shadow-sm"
        >
          <ArrowUpRight className="w-3.5 h-3.5 stroke-[2]" />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};
