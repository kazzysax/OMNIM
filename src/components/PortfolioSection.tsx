import React, { useState } from 'react';
import { Asset } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface PortfolioSectionProps {
  assets: Asset[];
  onSelectAssetForSwap: (asset: Asset) => void;
}

export const PortfolioSection: React.FC<PortfolioSectionProps> = ({
  assets,
  onSelectAssetForSwap,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const tetherAsset = assets.find((a) => a.symbol === 'USDT') || assets[0];
  const ethAsset = assets.find((a) => a.symbol === 'ETH') || assets[1];
  const btcAsset = assets.find((a) => a.symbol === 'WBTC') || assets[2];
  const nimAsset = assets.find((a) => a.symbol === 'NIM') || assets[3];

  const extendedAssets = assets.filter(
    (a) => a.id !== tetherAsset.id && a.id !== ethAsset.id && a.id !== btcAsset.id && a.id !== nimAsset.id
  );

  return (
    <div className="px-5 pt-1 pb-36 text-slate-900">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-bold text-slate-900 tracking-tight">Portfolio</h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <span>View all</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar mb-3">
        <div
          onClick={() => onSelectAssetForSwap(nimAsset)}
          className="w-32 h-[72px] rounded-2xl bg-[#1C1C1E] text-white p-2.5 flex flex-col justify-between shrink-0 shadow-sm cursor-pointer hover:bg-[#252528] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-[#E5B887]/20 p-0.5">
              {nimAsset?.logoUrl ? (
                <img src={nimAsset.logoUrl} alt="NIM" className="w-full h-full object-contain rounded-full" />
              ) : (
                <span className="text-[10px]">⚡</span>
              )}
            </div>
            <svg width="60" height="18" className="overflow-visible opacity-90">
              <polyline
                fill="none"
                stroke="#E5B887"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="0,14 10,10 20,12 30,6 40,9 50,4 60,7"
              />
            </svg>
          </div>
          <div>
            <div className="font-bold text-xs">${((nimAsset?.userBalance || 0) * (nimAsset?.priceUsd || 0)).toFixed(2)}</div>
            <div className="text-[10px] text-slate-400">{(nimAsset?.userBalance || 0).toFixed(2)} NIM</div>
          </div>
        </div>

        <div
          onClick={() => onSelectAssetForSwap(btcAsset)}
          className="h-[72px] rounded-2xl bg-white border border-slate-100 p-2.5 px-3 flex items-center gap-2.5 shrink-0 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[#F7931A]/10 border border-slate-100 flex items-center justify-center overflow-hidden p-1 shrink-0">
            {btcAsset.logoUrl ? (
              <img src={btcAsset.logoUrl} alt="BTC" className="w-full h-full object-contain rounded-full" />
            ) : (
              <span className="font-bold text-sm text-[#F7931A]">₿</span>
            )}
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900">Bitcoin</div>
            <div className="text-[10px] text-slate-500">{btcAsset.userBalance} WBTC</div>
          </div>
          <div className="ml-3 font-bold text-xs text-slate-900">
            ${(btcAsset.userBalance * btcAsset.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div
          onClick={() => onSelectAssetForSwap(tetherAsset)}
          className="rounded-2xl bg-white border border-slate-100 p-3.5 flex items-center justify-between shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#26A17B]/10 border border-slate-100 flex items-center justify-center overflow-hidden p-1 shrink-0">
              {tetherAsset.logoUrl ? (
                <img src={tetherAsset.logoUrl} alt="USDT" className="w-full h-full object-contain rounded-full" />
              ) : (
                <span className="font-bold text-base text-[#26A17B]">₮</span>
              )}
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900">Tether</div>
              <div className="text-[11px] text-slate-500">100.0 USDT</div>
            </div>
          </div>
          <div className="font-bold text-xs text-slate-900">
            $1,908
          </div>
        </div>

        <div
          onClick={() => onSelectAssetForSwap(ethAsset)}
          className="rounded-2xl bg-white border border-slate-100 p-3.5 flex items-center justify-between shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-900/5 border border-slate-100 flex items-center justify-center overflow-hidden p-1 shrink-0">
              {ethAsset.logoUrl ? (
                <img src={ethAsset.logoUrl} alt="ETH" className="w-full h-full object-contain rounded-full" />
              ) : (
                <svg width="14" height="20" viewBox="0 0 784 1277" fill="none" className="text-slate-900">
                  <path d="M392.07 0L383.5 29.11V874.74L392.07 883.31L784.13 651.54L392.07 0Z" fill="currentColor" fillOpacity="0.8" />
                  <path d="M392.07 0L0 651.54L392.07 883.31V472.93V0Z" fill="currentColor" />
                  <path d="M392.07 956.17L386.72 962.69V1271.8L392.07 1277.01L784.37 724.89L392.07 956.17Z" fill="currentColor" fillOpacity="0.8" />
                  <path d="M392.07 1277.01V956.17L0 724.89L392.07 1277.01Z" fill="currentColor" />
                </svg>
              )}
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900">Ethereum</div>
              <div className="text-[11px] text-slate-500">1.278 ETH</div>
            </div>
          </div>
          <div className="font-bold text-xs text-slate-900">
            $2,374
          </div>
        </div>

        {isExpanded && (
          <div className="pt-1 space-y-2 animate-in fade-in duration-200">
            {extendedAssets.map((asset) => {
              const holdingUsd = asset.userBalance * asset.priceUsd;
              return (
                <div
                  key={asset.id}
                  onClick={() => onSelectAssetForSwap(asset)}
                  className="rounded-2xl bg-white border border-slate-100 p-3.5 flex items-center justify-between shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border border-slate-100/80 bg-white overflow-hidden p-1 shadow-sm"
                      style={{ backgroundColor: `${asset.color}15` }}
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
                        className="text-sm items-center justify-center"
                        style={{ display: asset.logoUrl ? 'none' : 'flex' }}
                      >
                        {asset.icon}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900">{asset.name}</span>
                        {asset.chainId === 56 && (
                          <span className="text-[9px] font-bold px-1 rounded bg-[#F3BA2F]/20 text-[#B88755]">
                            BNB
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {asset.userBalance > 1000 ? asset.userBalance.toLocaleString() : asset.userBalance.toFixed(2)} {asset.symbol}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xs text-slate-900">
                      ${holdingUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ${asset.priceUsd < 0.01 ? asset.priceUsd.toFixed(5) : asset.priceUsd.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
