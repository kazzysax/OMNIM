import React from 'react';
import { Asset } from '../types';
import { TrendingUp, TrendingDown, ArrowLeftRight, ExternalLink, ShieldCheck } from 'lucide-react';

interface AssetCardProps {
  asset: Asset;
  onSwapAsset: (asset: Asset) => void;
  onViewDetails: (asset: Asset) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, onSwapAsset, onViewDetails }) => {
  const isPositive = asset.change24h >= 0;
  const holdingUsd = asset.userBalance * asset.priceUsd;

  // Mini Sparkline SVG Generator
  const renderSparkline = () => {
    if (!asset.sparkline || asset.sparkline.length < 2) return null;
    const min = Math.min(...asset.sparkline);
    const max = Math.max(...asset.sparkline);
    const range = max - min || 1;
    const width = 60;
    const height = 24;

    const points = asset.sparkline
      .map((val, idx) => {
        const x = (idx / (asset.sparkline!.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const strokeColor = isPositive ? '#10B981' : '#EF4444';

    return (
      <svg width={width} height={height} className="overflow-visible hidden sm:block">
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
    <div 
      onClick={() => onViewDetails(asset)}
      className="group relative flex items-center justify-between p-3.5 rounded-2xl bg-[#14151B] hover:bg-[#1A1C24] border border-white/5 hover:border-[#E5B887]/30 transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.99]"
    >
      {/* Left: Icon & Info */}
      <div className="flex items-center gap-3">
        <div 
          className="relative w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-white/10 bg-[#1A1C24] overflow-hidden p-1.5"
          style={{ backgroundColor: `${asset.color}15` }}
        >
          {asset.logoUrl ? (
            <img 
              src={asset.logoUrl} 
              alt={asset.symbol} 
              className="w-full h-full object-contain rounded-lg"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span>{asset.icon}</span>
          )}

          {asset.chainId === 56 && (
            <span 
              title="BNB Smart Chain" 
              className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded bg-[#F3BA2F] text-black border border-black/50"
            >
              BNB
            </span>
          )}
          {asset.chainId === 137 && (
            <span 
              title="Polygon" 
              className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded bg-[#8247E5] text-white border border-black/50"
            >
              POL
            </span>
          )}
          {asset.chainId === 8453 && (
            <span 
              title="Base" 
              className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded bg-[#0052FF] text-white border border-black/50"
            >
              BASE
            </span>
          )}
          {asset.chainId === 1 && (
            <span 
              title="Ethereum" 
              className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded bg-[#627EEA] text-white border border-black/50"
            >
              ETH
            </span>
          )}
          {asset.chainId === 42161 && (
            <span 
              title="Arbitrum" 
              className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded bg-[#28A0F0] text-white border border-black/50"
            >
              ARB
            </span>
          )}
          {asset.chainId === 0 && (
            <span 
              title="Nimiq Network" 
              className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded bg-[#E5B887] text-black border border-black/50"
            >
              NIM
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-sm group-hover:text-[#E5B887] transition-colors">
              {asset.symbol}
            </span>
            {asset.isVerified && (
              <ShieldCheck className="w-3.5 h-3.5 text-[#E5B887]" title="Verified Contract" />
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-medium">
              ${asset.priceUsd < 0.01 ? asset.priceUsd.toFixed(6) : asset.priceUsd.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
            <span className="truncate max-w-[130px]">{asset.name}</span>
          </div>
        </div>
      </div>

      {/* Middle: Sparkline */}
      <div className="mx-2">
        {renderSparkline()}
      </div>

      {/* Right: Balance & Value */}
      <div className="text-right">
        <div className="font-bold text-white text-sm">
          ${holdingUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
          <span>
            {asset.userBalance > 1000 
              ? asset.userBalance.toLocaleString() 
              : asset.userBalance.toFixed(asset.userBalance > 10 ? 2 : 4)}{' '}
            {asset.symbol}
          </span>
          <span className={`text-[10px] font-semibold flex items-center ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{asset.change24h}%
          </span>
        </div>
      </div>
    </div>
  );
};
