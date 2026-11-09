import React, { useState } from 'react';
import { Asset } from '../types';
import { X, ExternalLink, Copy, Check, ShieldCheck, ArrowRightLeft } from 'lucide-react';

interface AssetDetailModalProps {
  asset: Asset | null;
  onClose: () => void;
  onOpenSwap: (asset: Asset) => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ asset, onClose, onOpenSwap }) => {
  const [copied, setCopied] = useState(false);

  if (!asset) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPositive = asset.change24h >= 0;
  const holdingUsd = asset.userBalance * asset.priceUsd;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#121318] border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-5 max-h-[88vh] flex flex-col shadow-2xl overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-bold text-[#E5B887] px-2 py-0.5 rounded bg-[#E5B887]/15">
              {asset.category}
            </span>
            <span className="text-xs text-slate-400 font-mono">{asset.chain}</span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero Section */}
        <div className="text-center my-4">
          <div
            className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-3xl shadow-xl border border-white/10 mb-3 bg-[#1A1C24] overflow-hidden p-2.5"
            style={{ backgroundColor: `${asset.color}25` }}
          >
            {asset.logoUrl ? (
              <img 
                src={asset.logoUrl} 
                alt={asset.symbol} 
                className="w-full h-full object-contain rounded-xl"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <span>{asset.icon}</span>
            )}
          </div>

          <h3 className="text-xl font-extrabold text-white flex items-center justify-center gap-1.5">
            <span>{asset.name}</span>
            {asset.isVerified && <ShieldCheck className="w-4 h-4 text-[#E5B887]" />}
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{asset.symbol}</p>

          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white font-mono">
              ${asset.priceUsd < 0.01 ? asset.priceUsd.toFixed(6) : asset.priceUsd.toFixed(2)}
            </div>
            <div className={`text-xs font-semibold mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '▲ +' : '▼ '}{asset.change24h}% (24h)
            </div>
          </div>
        </div>

        {/* Balance Card */}
        <div className="p-4 rounded-2xl bg-[#181922] border border-white/5 mb-3">
          <div className="text-xs text-slate-400 mb-1">Your Holdings</div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-extrabold text-white font-mono">
              {asset.userBalance > 1000 ? asset.userBalance.toLocaleString() : asset.userBalance.toFixed(4)} {asset.symbol}
            </div>
            <div className="text-sm font-bold text-slate-300">
              ${holdingUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Asset Details */}
        <div className="space-y-2 text-xs mb-4">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-slate-400 mb-1">About</div>
            <p className="text-slate-200 leading-relaxed">{asset.description}</p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span>Settlement Network</span>
              <span className="text-white font-sans">{asset.chain} (Chain ID: {asset.chainId})</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Verified Contract</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#E5B887] text-[11px]">
                  {asset.contractAddress.length > 16 
                    ? `${asset.contractAddress.slice(0, 8)}...${asset.contractAddress.slice(-6)}` 
                    : asset.contractAddress}
                </span>
                {asset.contractAddress.startsWith('0x') && (
                  <button
                    onClick={() => handleCopy(asset.contractAddress)}
                    className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Decimals</span>
              <span className="text-white">{asset.decimals}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-auto">
          <a
            href={asset.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 px-3 rounded-2xl bg-[#1A1C24] hover:bg-[#222530] border border-white/10 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Explorer</span>
          </a>

          <button
            onClick={() => {
              onClose();
              onOpenSwap(asset);
            }}
            className="flex-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-[#B88755] to-[#E5B887] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#E5B887]/20 active:scale-95 transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Swap {asset.symbol}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

