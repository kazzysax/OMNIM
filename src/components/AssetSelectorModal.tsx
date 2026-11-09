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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#121318] border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-5 max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400">Curated & verified Mainnet catalog</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#1A1C24] rounded-2xl my-3.5 border border-white/5">
          <button
            onClick={() => setActiveTab('stocks')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${activeTab === 'stocks'
              ? 'bg-gradient-to-r from-[#B88755] to-[#E5B887] text-black shadow-md shadow-[#E5B887]/20 font-extrabold'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            📈 Stocks & Commodities (BNB)
          </button>

          <button
            onClick={() => setActiveTab('crypto')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${activeTab === 'crypto'
              ? 'bg-gradient-to-r from-[#B88755] to-[#E5B887] text-black shadow-md shadow-[#E5B887]/20 font-extrabold'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            🌐 Crypto (EVM)
          </button>

          <button
            onClick={() => setActiveTab('currencies')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${activeTab === 'currencies'
              ? 'bg-gradient-to-r from-[#B88755] to-[#E5B887] text-black shadow-md shadow-[#E5B887]/20 font-extrabold'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            💱 Currencies
          </button>
        </div>

        {/* Explanatory banner */}
        <div className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-slate-400 mb-2 flex items-center justify-between">
          <span>
            {activeTab === 'stocks' && 'Verified 10 Stocks + Gold & Silver on BNB Chain (BEP-20)'}
            {activeTab === 'crypto' && 'Curated EVM Cryptocurrencies & Native Nimiq'}
            {activeTab === 'currencies' && 'Regulated On-Chain Fiat Currencies (EUR / GBP / USD)'}
          </span>
          <span className="font-semibold text-[#E5B887]">{filteredAssets.length} assets</span>
        </div>

        {/* Asset List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 -mr-1 py-1">
          {filteredAssets.map((asset) => {
            const isSelected = asset.id === selectedAsset.id;

            return (
              <button
                key={asset.id}
                onClick={() => {
                  onSelect(asset);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all text-left ${isSelected
                  ? 'bg-[#E5B887]/10 border border-[#E5B887]/40'
                  : 'bg-[#181920] hover:bg-[#20222C] border border-white/5'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner border border-white/10 bg-[#1A1C24] overflow-hidden p-1.5"
                    style={{ backgroundColor: `${asset.color}25` }}
                  >
                    {asset.logoUrl ? (
                      <img
                        src={asset.logoUrl}
                        alt={asset.symbol}
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span>{asset.icon}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-sm">{asset.symbol}</span>
                      {asset.isVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-[#E5B887]" />
                      )}
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 font-mono">
                        {asset.chain}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate max-w-[170px]">
                      {asset.name}
                    </div>
                  </div>
                </div>

                <div className="text-right flex items-center gap-3">
                  <div>
                    <div className="font-semibold text-white text-xs">
                      ${asset.priceUsd < 0.01 ? asset.priceUsd.toFixed(6) : asset.priceUsd.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {asset.userBalance > 0
                        ? `${asset.userBalance > 1000 ? asset.userBalance.toLocaleString() : asset.userBalance.toFixed(2)} ${asset.symbol}`
                        : '0'}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-[#E5B887] text-black flex items-center justify-center">
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
