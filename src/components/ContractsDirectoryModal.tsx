import React, { useState } from 'react';
import { Asset } from '../types';
import { X, ExternalLink, Copy, Check, ShieldCheck } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] p-5 max-h-[88vh] flex flex-col shadow-2xl overflow-y-auto text-slate-900 border border-slate-100">

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Verified Registry</h3>
              <p className="text-xs text-slate-400">On-Chain Asset Directory</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl my-3 border border-slate-200/50 overflow-x-auto no-scrollbar">
          {(['stocks', 'currencies', 'crypto', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${filter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              {tab === 'stocks' ? 'Stocks & Metals' : tab === 'currencies' ? 'Currencies' : tab === 'crypto' ? 'Crypto' : 'All'}
            </button>
          ))}
        </div>

        {/* Registry List */}
        <div className="space-y-2 mt-1">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full bg-white border border-slate-200/80 overflow-hidden p-1 flex items-center justify-center shrink-0 shadow-sm"
                    style={{ backgroundColor: `${asset.color}10` }}
                  >
                    {asset.logoUrl ? (
                      <img
                        src={asset.logoUrl}
                        alt={asset.symbol}
                        className="w-full h-full object-contain rounded-full"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-xs">{asset.icon}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-xs">{asset.name}</span>
                      <span className="text-amber-700 font-mono text-[10px] font-semibold">({asset.symbol})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {asset.chain} • Chain {asset.chainId}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={asset.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on Explorer"
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {asset.contractAddress.startsWith('0x') && (
                    <button
                      onClick={() => handleCopy(asset.id, asset.contractAddress)}
                      title="Copy Contract"
                      className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                    >
                      {copiedId === asset.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Address Display */}
              <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Contract:</span>
                <span className="text-slate-700 select-all truncate max-w-[200px] font-medium">
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
