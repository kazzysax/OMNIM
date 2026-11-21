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
  const [whole, cents] = totalBalanceUsd
    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split('.');
  const size = whole.length > 9 ? 'text-[34px]' : whole.length > 6 ? 'text-[40px]' : 'text-[46px]';
  const walletLabel = wallet.nimiqAddress
    ? `${wallet.nimiqAddress.slice(0, 9)}…`
    : wallet.evmAddress
      ? `${wallet.evmAddress.slice(0, 6)}…${wallet.evmAddress.slice(-4)}`
      : 'Wallet 1';

  const actions = [
    { label: 'Receive', icon: ArrowDownLeft, onClick: onOpenReceive },
    { label: 'Swap', icon: Plus, onClick: onOpenSwap },
    { label: 'Send', icon: ArrowUpRight, onClick: onOpenSend },
  ];

  return (
    <div className="relative mx-4 mt-3 mb-5 rounded-[32px] bg-[#1C1C1E] text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] overflow-hidden min-h-[30vh] flex flex-col px-6 pt-5 pb-6">
      {/* Soft top highlight for depth */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.06] to-transparent" />

      {/* Wallet selector */}
      <div className="relative flex justify-center">
        <button
          onClick={onOpenWalletDetails}
          className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{walletLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Balance */}
      <div className="relative flex-1 flex flex-col items-center justify-center pt-5 pb-7">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          <span>Total balance</span>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh balances"
            aria-label="Refresh balances"
            className="p-1 -m-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RotateCcw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-omnim-gold' : ''}`} />
          </button>
        </div>
        <h1 className={`${size} mt-2 font-semibold tracking-tight leading-none tabular-nums`}>
          <span className="text-slate-400 font-medium mr-0.5">$</span>
          {whole}
          <span className="text-slate-500">.{cents}</span>
        </h1>
      </div>

      {/* Actions: three equal columns */}
      <div className="relative grid grid-cols-3 gap-3 mt-1">
        {actions.map(({ label, icon: Icon, onClick }) => (
          <button key={label} onClick={onClick} className="group flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <span
              className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-colors ${
                label === 'Swap'
                  ? 'bg-gradient-to-br from-omnim-goldLight to-omnim-goldDark text-black'
                  : 'bg-white/[0.08] text-white group-hover:bg-white/[0.14]'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={label === 'Swap' ? 2.5 : 2} />
            </span>
            <span className="text-xs font-medium text-slate-300">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
