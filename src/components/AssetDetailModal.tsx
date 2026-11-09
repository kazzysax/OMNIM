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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] p-5 max-h-[88vh] flex flex-col shadow-2xl overflow-y-auto text-slate-900 border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider font-bold text-amber-900 px-2 py-0.5 rounded-full bg-amber-100">
              {asset.category}
            </span>
            <span className="text-xs text-slate-400 font-mono">{asset.chain}</span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero Section */}
        <div className="text-center my-4">
          <div
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl shadow-sm border border-slate-200/80 mb-3 bg-white overflow-hidden p-2"
            style={{ backgroundColor: `${asset.color}12` }}
          >
            {asset.logoUrl ? (
              <img 
                src={asset.logoUrl} 
                alt={asset.symbol} 
                className="w-full h-full object-contain rounded-full"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <span 
              className="items-center justify-center"
              style={{ display: asset.logoUrl ? 'none' : 'flex' }}
            >
              {asset.icon}
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-slate-900 flex items-center justify-center gap-1.5">
            <span>{asset.name}</span>
            {asset.isVerified && <ShieldCheck className="w-4 h-4 text-amber-500" />}
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{asset.symbol}</p>

          <div className="mt-2">
            <div className="text-3xl font-extrabold text-slate-900 font-mono">
              ${asset.priceUsd < 0.01 ? asset.priceUsd.toFixed(6) : asset.priceUsd.toFixed(2)}
            </div>
            <div className={`text-xs font-semibold mt-0.5 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
              {isPositive ? '▲ +' : '▼ '}{asset.change24h}% (24h)
            </div>
          </div>
        </div>

        {/* Balance Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 mb-3">
          <div className="text-xs text-slate-400 mb-1">Your Holdings</div>
          <div className="flex items-baseline justify-between">
            <div className="text-lg font-extrabold text-slate-900 font-mono">
              {asset.userBalance > 1000 ? asset.userBalance.toLocaleString() : asset.userBalance.toFixed(4)} {asset.symbol}
            </div>
            <div className="text-xs font-bold text-slate-600">
              ${holdingUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Asset Details */}
        <div className="space-y-2 text-xs mb-4">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="text-slate-400 mb-1 font-semibold">About</div>
            <p className="text-slate-700 leading-relaxed">{asset.description}</p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 font-mono">
            <div className="flex items-center justify-between text-slate-500">
              <span>Settlement Network</span>
              <span className="text-slate-900 font-sans font-medium">{asset.chain}</span>
            </div>

            <div className="flex items-center justify-between text-slate-500">
              <span>Verified Contract</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-800 text-[11px] font-semibold">
                  {asset.contractAddress.length > 16 
                    ? `${asset.contractAddress.slice(0, 8)}...${asset.contractAddress.slice(-6)}` 
                    : asset.contractAddress}
                </span>
                {asset.contractAddress.startsWith('0x') && (
                  <button
                    onClick={() => handleCopy(asset.contractAddress)}
                    className="p-1 rounded hover:bg-slate-200 text-slate-600"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-slate-500">
              <span>Decimals</span>
              <span className="text-slate-900">{asset.decimals}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-auto">
          <a
            href={asset.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Explorer</span>
          </a>

          <button
            onClick={() => {
              onClose();
              onOpenSwap(asset);
            }}
            className="flex-2 py-3 px-5 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Swap {asset.symbol}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
