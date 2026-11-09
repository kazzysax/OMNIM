import React, { useState } from 'react';
import { Asset } from '../types';
import { X, ShieldCheck, Check } from 'lucide-react';

interface AssetSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  selectedAsset: Asset;
  onSelect: (asset: Asset) => void;
  title?: string;
  excludeAssetId?: string;
}

export const AssetSelectorModal: React.FC<AssetSelectorModalProps> = ({
  isOpen,
  onClose,
  assets,
  selectedAsset,
  onSelect,
  title = 'Select Asset',
  excludeAssetId,
}) => {
  const [activeTab, setActiveTab] = useState<'stocks' | 'crypto' | 'currencies'>('stocks');

  if (!isOpen) return null;

  const filteredAssets = assets
    .filter((a) => a.id !== excludeAssetId)
    .filter((a) => a.category === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] p-5 max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-200 text-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400">Mainnet catalog</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs: clean short names */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl my-3 border border-slate-200/50">
          <button
            onClick={() => setActiveTab('stocks')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
              activeTab === 'stocks'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Stocks
          </button>

          <button
            onClick={() => setActiveTab('crypto')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
              activeTab === 'crypto'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Crypto
          </button>

          <button
            onClick={() => setActiveTab('currencies')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
              activeTab === 'currencies'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Currencies
          </button>
        </div>

        {/* Asset List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1 py-1">
          {filteredAssets.map((asset) => {
            const isSelected = asset.id === selectedAsset.id;

            return (
              <button
                key={asset.id}
                onClick={() => {
                  onSelect(asset);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all text-left ${
                  isSelected
                    ? 'bg-amber-50/70 border border-amber-300/80 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100/80 border border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-slate-200/80 bg-white overflow-hidden p-1 shadow-sm"
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
                      className="text-base items-center justify-center"
                      style={{ display: asset.logoUrl ? 'none' : 'flex' }}
                    >
                      {asset.icon}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-sm">{asset.symbol}</span>
                      {asset.isVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700 font-mono font-medium">
                        {asset.chain}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate max-w-[170px]">
                      {asset.name}
                    </div>
                  </div>
                </div>

                <div className="text-right flex items-center gap-3">
                  <div>
                    {/* User's Balance: UPPER FIGURE & BLACK IN COLOUR */}
                    <div className="font-bold text-slate-900 text-xs font-mono">
                      {asset.userBalance > 0
                        ? `${asset.userBalance > 1000 ? asset.userBalance.toLocaleString() : asset.userBalance.toFixed(asset.userBalance > 10 ? 2 : 4)} ${asset.symbol}`
                        : '0'}
                    </div>
                    {/* Real-time Price: LOWER FIGURE & DAMPENED IN COLOUR */}
                    <div className="text-[11px] text-slate-400 font-medium">
                      ${asset.priceUsd < 0.01 ? asset.priceUsd.toFixed(6) : asset.priceUsd.toFixed(2)}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
