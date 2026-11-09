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

  // Mini Sparkline SVG Generator
  const renderSparkline = (data?: number[], change24h: number = 0, width = 54, height = 22) => {
    const isPositive = change24h >= 0;
    let pointsData = data && data.length >= 2 ? [...data] : [];

    if (pointsData.length < 2) {
      if (isPositive) {
        pointsData = [10, 11, 10.5, 12, 11.8, 13, 14];
      } else {
        pointsData = [14, 13, 13.5, 12, 12.2, 11, 10];
      }
    }

    const min = Math.min(...pointsData);
    const max = Math.max(...pointsData);
    const range = max - min || 1;
    const padding = 2;
    const usableHeight = height - padding * 2;

    const points = pointsData
      .map((val, idx) => {
        const x = (idx / (pointsData.length - 1)) * width;
        const y = height - padding - ((val - min) / range) * usableHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const strokeColor = isPositive ? '#10B981' : '#EF4444';

    return (
      <svg width={width} height={height} className="overflow-visible shrink-0">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

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

      {/* Top Horizontal Row: NIM & Featured Bitcoin Bar */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar mb-3">
        {/* Nimiq Card */}
        <div
          onClick={() => onSelectAssetForSwap(nimAsset)}
          className="w-36 h-[72px] rounded-2xl bg-[#1C1C1E] text-white p-2.5 flex flex-col justify-between shrink-0 shadow-sm cursor-pointer hover:bg-[#252528] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-[#E5B887]/20 p-0.5">
              {nimAsset?.logoUrl ? (
                <img src={nimAsset.logoUrl} alt="NIM" className="w-full h-full object-contain rounded-full" />
              ) : (
                <span className="text-[10px]">⚡</span>
              )}
            </div>
            {renderSparkline(nimAsset?.sparkline, nimAsset?.change24h || 0, 48, 18)}
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="font-bold text-xs">
                ${((nimAsset?.userBalance || 0) * (nimAsset?.priceUsd || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {(nimAsset?.userBalance || 0) > 0 ? (nimAsset?.userBalance || 0).toFixed(2) : '0.00'} NIM
              </div>
            </div>
            <div className={`text-[10px] font-semibold ${(nimAsset?.change24h || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(nimAsset?.change24h || 0) >= 0 ? '+' : ''}{(nimAsset?.change24h || 0).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Bitcoin Bar with Small Line Chart, 24h Change & Profit/Loss */}
        <div
          onClick={() => onSelectAssetForSwap(btcAsset)}
          className="h-[72px] rounded-2xl bg-white border border-slate-100 p-2.5 px-3 flex items-center gap-3 shrink-0 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors min-w-[220px]"
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
            <div className="text-[10px] text-slate-500 font-mono">
              {btcAsset.userBalance > 0
                ? (btcAsset.userBalance > 10 ? btcAsset.userBalance.toFixed(2) : btcAsset.userBalance.toFixed(4))
                : '0.00'}{' '}
              WBTC
            </div>
          </div>

          {/* Small Line Chart (Sparkline) */}
          <div className="mx-1">
            {renderSparkline(btcAsset.sparkline, btcAsset.change24h, 54, 22)}
          </div>

          {/* Right: Real Value & 24h Change / Profit or Loss */}
          <div className="text-right ml-auto">
            <div className="font-bold text-xs text-slate-900">
              ${(btcAsset.userBalance * btcAsset.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div
              className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${
                btcAsset.change24h >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              <span>{btcAsset.change24h >= 0 ? '+' : ''}{btcAsset.change24h.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Asset List Rows */}
      <div className="space-y-2">
        {/* Tether */}
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
              <div className="text-[11px] text-slate-500 font-mono">
                {tetherAsset.userBalance > 0
                  ? (tetherAsset.userBalance > 1000 ? tetherAsset.userBalance.toLocaleString() : tetherAsset.userBalance.toFixed(2))
                  : '0.00'}{' '}
                USDT
              </div>
            </div>
          </div>

          {/* Small Line Chart */}
          <div className="mx-2">
            {renderSparkline(tetherAsset.sparkline, tetherAsset.change24h, 54, 22)}
          </div>

          <div className="text-right">
            <div className="font-bold text-xs text-slate-900">
              ${(tetherAsset.userBalance * tetherAsset.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div
              className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${
                tetherAsset.change24h >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              <span>{tetherAsset.change24h >= 0 ? '+' : ''}{tetherAsset.change24h.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* Ethereum */}
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
              <div className="text-[11px] text-slate-500 font-mono">
                {ethAsset.userBalance > 0
                  ? (ethAsset.userBalance > 10 ? ethAsset.userBalance.toFixed(2) : ethAsset.userBalance.toFixed(4))
                  : '0.00'}{' '}
                ETH
              </div>
            </div>
          </div>

          {/* Small Line Chart */}
          <div className="mx-2">
            {renderSparkline(ethAsset.sparkline, ethAsset.change24h, 54, 22)}
          </div>

          <div className="text-right">
            <div className="font-bold text-xs text-slate-900">
              ${(ethAsset.userBalance * ethAsset.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div
              className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${
                ethAsset.change24h >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              <span>{ethAsset.change24h >= 0 ? '+' : ''}{ethAsset.change24h.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* Extended Assets on View All */}
        {isExpanded && (
          <div className="pt-1 space-y-2 animate-in fade-in duration-200">
            {extendedAssets.map((asset) => {
              const holdingUsd = asset.userBalance * asset.priceUsd;
              const isPositive = asset.change24h >= 0;
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
                        {asset.chainId === 137 && (
                          <span className="text-[9px] font-bold px-1 rounded bg-[#8247E5]/20 text-[#8247E5]">
                            POL
                          </span>
                        )}
                        {asset.chainId === 8453 && (
                          <span className="text-[9px] font-bold px-1 rounded bg-[#0052FF]/20 text-[#0052FF]">
                            BASE
                          </span>
                        )}
                        {asset.chainId === 42161 && (
                          <span className="text-[9px] font-bold px-1 rounded bg-[#28A0F0]/20 text-[#28A0F0]">
                            ARB
                          </span>
                        )}
                        {asset.chainId === 43114 && (
                          <span className="text-[9px] font-bold px-1 rounded bg-[#E84142]/20 text-[#E84142]">
                            AVAX
                          </span>
                        )}
                        {asset.chainId === 10 && (
                          <span className="text-[9px] font-bold px-1 rounded bg-[#FF0420]/20 text-[#FF0420]">
                            OP
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {asset.userBalance > 0
                          ? (asset.userBalance > 1000 ? asset.userBalance.toLocaleString() : asset.userBalance.toFixed(asset.userBalance > 10 ? 2 : 4))
                          : '0.00'}{' '}
                        {asset.symbol}
                      </div>
                    </div>
                  </div>

                  {/* Sparkline chart */}
                  <div className="mx-2">
                    {renderSparkline(asset.sparkline, asset.change24h, 54, 22)}
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-xs text-slate-900">
                      ${holdingUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div
                      className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${
                        isPositive ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      <span>{isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%</span>
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
