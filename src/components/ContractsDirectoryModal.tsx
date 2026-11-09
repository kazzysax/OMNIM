import React, { useState } from 'react';
import { Asset } from '../types';
import { X, ExternalLink, Copy, Check, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ContractsDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
}

export const ContractsDirectoryModal: React.FC<ContractsDirectoryModalProps> = ({
  isOpen,
  onClose,
  assets,
}) => {
  const [filter, setFilter] = useState<'all' | 'stocks' | 'currencies' | 'crypto'>('stocks');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filtered = filter === 'all' ? assets : assets.filter((a) => a.category === filter);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#121318] border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-5 max-h-[90vh] flex flex-col shadow-2xl overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#E5B887]/15 text-[#E5B887] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Verified Mainnet Registry</h3>
              <p className="text-xs text-slate-400">Pre-vetted BEP-20 contracts on BNB Smart Chain</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#1A1C24] rounded-2xl my-3 border border-white/5 overflow-x-auto">
          {(['stocks', 'currencies', 'crypto', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${filter === tab
                ? 'bg-gradient-to-r from-[#B88755] to-[#E5B887] text-black shadow-md shadow-[#E5B887]/20 font-extrabold'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              {tab === 'stocks' ? '📈 Stocks & Commodities (BNB, 12)' : tab === 'currencies' ? '💱 Currencies' : tab === 'crypto' ? '🌐 Crypto' : 'All'}
            </button>
          ))}
        </div>

        {/* Registry List */}
        <div className="space-y-2 mt-1">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="p-3 rounded-2xl bg-[#161820] border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#1A1C24] border border-white/10 overflow-hidden p-1 flex items-center justify-center shrink-0">
                    {asset.logoUrl ? (
                      <img src={asset.logoUrl} alt={asset.symbol} className="w-full h-full object-contain rounded-md" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-base">{asset.icon}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs">{asset.name}</span>
                      <span className="text-[#E5B887] font-mono text-[10px] font-semibold">({asset.symbol})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {asset.chain} • Chain ID {asset.chainId}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={asset.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on Block Explorer"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {asset.contractAddress.startsWith('0x') && (
                    <button
                      onClick={() => handleCopy(asset.id, asset.contractAddress)}
                      title="Copy Contract Address"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                    >
                      {copiedId === asset.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Address Display */}
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500">Contract:</span>
                <span className="text-slate-300 select-all truncate max-w-[280px]">
                  {asset.contractAddress}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

