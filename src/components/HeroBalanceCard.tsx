import React from 'react';
import { WalletState } from '../types';
import { ArrowDownLeft, ArrowUpRight, Plus, ChevronDown, RotateCcw } from 'lucide-react';
import { Header } from './Header';

interface HeroBalanceCardProps {
  wallet: WalletState;
  totalBalanceUsd: number;
  /** Portfolio 24h change in USD and %, or null when no held asset has 24h data yet. */
  change24h: { usd: number; pct: number } | null;
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
  change24h,
  onOpenReceive,
  onOpenSend,
  onOpenSwap,
  onOpenWalletDetails,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <div className="mx-4 mt-2 mb-3 rounded-[36px] bg-[#1C1C1E] text-white shadow-xl overflow-hidden pb-5">
      {/* Integrated Top Row Header */}
      <Header onOpenWalletDetails={onOpenWalletDetails} />

      {/* Wallet Dropdown Selector */}
      <div className="flex justify-center mt-1 mb-2">
        <button
          onClick={onOpenWalletDetails}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <span>{wallet.evmAddress ? `${wallet.evmAddress.slice(0, 6)}…${wallet.evmAddress.slice(-4)}` : wallet.nimiqAddress ? `${wallet.nimiqAddress.slice(0, 9)}…` : 'Not connected'}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Big Hero Balance */}
      <div className="text-center my-1">
        <h1 className="text-4xl sm:text-[44px] font-bold tracking-tight text-white">
          ${totalBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h1>
        <div className="flex items-center justify-center gap-1.5 mt-1 text-xs font-medium text-slate-400">
          {change24h && change24h.usd !== 0 ? (
            <span className={change24h.usd > 0 ? 'text-emerald-400' : 'text-red-400'}>
              {change24h.usd > 0 ? '+' : '-'}${Math.abs(change24h.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' '}({change24h.pct > 0 ? '+' : ''}{change24h.pct.toFixed(2)}%) today
            </span>
          ) : (
            <span>Total balance</span>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh balances"
            className="p-1 -m-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RotateCcw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
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
