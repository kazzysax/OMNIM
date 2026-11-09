import React, { useState, useMemo } from 'react';
import { Asset } from '../types';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';

interface PortfolioSectionProps {
  assets: Asset[];
  discoveredAssets?: Asset[];
  onSelectAssetForSwap: (asset: Asset) => void;
}

export const PortfolioSection: React.FC<PortfolioSectionProps> = ({
  assets,
  discoveredAssets = [],
  onSelectAssetForSwap,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Merge predefined assets and discovered assets
  const discoveredIds = useMemo(() => new Set(discoveredAssets.map((a) => a.id)), [discoveredAssets]);
  const allDisplayAssets = useMemo(() => {
    const merged = [...assets];
    for (const da of discoveredAssets) {
      if (!merged.some((a) => a.id === da.id)) {
        merged.push(da);
      }
    }
    return merged;
  }, [assets, discoveredAssets]);

  const nimAsset = allDisplayAssets.find((a) => a.symbol === 'NIM') || allDisplayAssets[0];

  // All assets that have an active balance (> 0)
  const holdings = useMemo(() => {
    return allDisplayAssets
      .filter((a) => a.userBalance > 0)
      .sort((a, b) => {
        const valA = a.userBalance * a.priceUsd;
        const valB = b.userBalance * b.priceUsd;
        return valB - valA;
      });
  }, [allDisplayAssets]);

  // Assets with 0 balance for the market/explore section
  const marketAssets = useMemo(() => {
    const holdingIds = new Set(holdings.map((h) => h.id));
    return allDisplayAssets.filter((a) => !holdingIds.has(a.id) && a.id !== nimAsset?.id);
  }, [allDisplayAssets, holdings, nimAsset]);

  // Calculate Whole Portfolio 24h Profit / Loss
  const { total24hPnlUsd, total24hPnlPercent } = useMemo(() => {
    const totalCurrentVal = holdings.reduce((sum, a) => sum + a.userBalance * a.priceUsd, 0);

    if (totalCurrentVal <= 0) {
      return { total24hPnlUsd: 0, total24hPnlPercent: 0 };
    }

    const pnlUsd = holdings.reduce((sum, a) => {
      const currentVal = a.userBalance * a.priceUsd;
      const yesterdayPrice = a.priceUsd / (1 + (a.change24h || 0) / 100);
      const yesterdayVal = a.userBalance * yesterdayPrice;
      return sum + (currentVal - yesterdayVal);
    }, 0);

    const yesterdayTotal = totalCurrentVal - pnlUsd;
    const pnlPercent = yesterdayTotal > 0 ? (pnlUsd / yesterdayTotal) * 100 : 0;

    return {
      total24hPnlUsd: pnlUsd,
      total24hPnlPercent: pnlPercent,
    };
  }, [holdings]);

  const isPnlPositive = total24hPnlUsd >= 0;

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

  // Render combined portfolio sparkline for the 24h P&L card
  const renderPortfolioSparkline = () => {
    if (holdings.length === 0) {
      return renderSparkline(undefined, 0, 48, 18);
    }
    const withSparkline = holdings.filter((h) => h.sparkline && h.sparkline.length >= 2);
    if (withSparkline.length === 0) {
      return renderSparkline(undefined, total24hPnlUsd, 48, 18);
    }
    const maxLen = Math.max(...withSparkline.map((h) => h.sparkline!.length));
    const aggregated: number[] = [];
    for (let i = 0; i < maxLen; i++) {
      let sum = 0;
      for (const h of withSparkline) {
        const sl = h.sparkline!;
        const idx = Math.min(Math.floor((i / maxLen) * sl.length), sl.length - 1);
        const ratio = sl[sl.length - 1] > 0 ? sl[idx] / sl[sl.length - 1] : 1;
        sum += h.userBalance * h.priceUsd * ratio;
      }
      aggregated.push(sum);
    }
    return renderSparkline(aggregated, total24hPnlUsd, 48, 18);
  };

  // Chain badge renderer
  const renderChainBadge = (asset: Asset) => {
    if (discoveredIds.has(asset.id)) {
      return (
        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5 inline" /> NEW
        </span>
      );
    }

    const chainBadges: Record<number, { label: string; bg: string; text: string }> = {
      56: { label: 'BNB', bg: 'bg-[#F3BA2F]/20', text: 'text-[#B88755]' },
      137: { label: 'POL', bg: 'bg-[#8247E5]/20', text: 'text-[#8247E5]' },
      8453: { label: 'BASE', bg: 'bg-[#0052FF]/20', text: 'text-[#0052FF]' },
      42161: { label: 'ARB', bg: 'bg-[#28A0F0]/20', text: 'text-[#28A0F0]' },
      43114: { label: 'AVAX', bg: 'bg-[#E84142]/20', text: 'text-[#E84142]' },
      10: { label: 'OP', bg: 'bg-[#FF0420]/20', text: 'text-[#FF0420]' },
      0: { label: 'NIM', bg: 'bg-[#E5B887]/20', text: 'text-[#B88755]' },
    };

    const badge = chainBadges[asset.chainId];
    if (!badge) return null;

    return (
      <span className={`text-[9px] font-bold px-1 rounded ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  // Single Asset Row Card Component
  const renderAssetRow = (asset: Asset, isOwned: boolean = false) => {
    const holdingUsd = asset.userBalance * asset.priceUsd;
    const isPositive = (asset.change24h || 0) >= 0;

    return (
      <div
        key={asset.id}
        onClick={() => onSelectAssetForSwap(asset)}
        className={`rounded-2xl bg-white border p-3.5 flex items-center justify-between shadow-sm cursor-pointer hover:bg-slate-50 transition-all ${
          isOwned ? 'border-amber-200/80 bg-gradient-to-r from-amber-500/[0.02] to-white ring-1 ring-amber-500/10' : 'border-slate-100'
        }`}
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
              {renderChainBadge(asset)}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-slate-500 font-mono">
                {asset.userBalance > 0
                  ? asset.userBalance > 1000
                    ? asset.userBalance.toLocaleString()
                    : asset.userBalance.toFixed(asset.userBalance > 10 ? 2 : 4)
                  : '0.00'}{' '}
                {asset.symbol}
              </span>
              <span className="text-[10px] text-slate-400">
                · ${asset.priceUsd >= 1 ? asset.priceUsd.toFixed(2) : asset.priceUsd.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        {/* Small Line Chart */}
        <div className="mx-2 hidden sm:block">
          {renderSparkline(asset.sparkline, asset.change24h, 54, 22)}
        </div>

        {/* Right side: USD Value and 24h change */}
        <div className="text-right">
          <div className="font-bold text-xs text-slate-900">
            ${holdingUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div
            className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${
              isPositive ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            <span>{isPositive ? '+' : ''}{(asset.change24h || 0).toFixed(2)}%</span>
          </div>
        </div>
      </div>
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
          <span>{isExpanded ? 'Less' : 'View all'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Top Horizontal Row: NIM Card & 24h Whole Portfolio P&L Card */}
      <div className="flex items-center gap-2.5 mb-3">
        {/* Nimiq Card */}
        <div
          onClick={() => nimAsset && onSelectAssetForSwap(nimAsset)}
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

        {/* 24h Whole Portfolio Profit/Loss Summary Card (Replaces Bitcoin Card) */}
        <div
          className={`flex-1 h-[72px] rounded-2xl bg-white border p-2.5 px-3 flex items-center justify-between shadow-sm transition-all ${
            holdings.length > 0 && isPnlPositive
              ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-500/[0.04] to-white ring-1 ring-emerald-500/10'
              : holdings.length > 0 && !isPnlPositive
              ? 'border-red-200/80 bg-gradient-to-r from-red-500/[0.04] to-white ring-1 ring-red-500/10'
              : 'border-slate-100'
          }`}
        >
          {/* Left: 24h Profit / Loss & Dollar Amount */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
              {holdings.length > 0 && isPnlPositive ? (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              ) : holdings.length > 0 && !isPnlPositive ? (
                <TrendingDown className="w-3 h-3 text-red-500" />
              ) : null}
              <span>24h Portfolio P&L</span>
            </div>
            <div
              className={`font-bold text-sm leading-tight mt-0.5 ${
                holdings.length === 0
                  ? 'text-slate-800'
                  : isPnlPositive
                  ? 'text-emerald-600'
                  : 'text-red-500'
              }`}
            >
              {holdings.length === 0
                ? '$0.00'
                : `${isPnlPositive ? '+' : '-'}$${Math.abs(total24hPnlUsd).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </div>
          </div>

          {/* Right: Sparkline & % Badge */}
          <div className="flex items-center gap-1.5">
            <div className="hidden xs:block">
              {renderPortfolioSparkline()}
            </div>
            <div
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg whitespace-nowrap ${
                holdings.length === 0
                  ? 'bg-slate-100 text-slate-500'
                  : isPnlPositive
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                  : 'bg-red-50 text-red-500 border border-red-200/50'
              }`}
            >
              {holdings.length > 0 && isPnlPositive ? '+' : ''}
              {total24hPnlPercent.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Main Asset List Rows */}
      <div className="space-y-2">
        {/* 1. AUTO-LIST ALL ASSETS THE USER OWNS (HOLDINGS > 0) */}
        {holdings.length > 0 ? (
          <>
            <div className="flex items-center justify-between pt-1 pb-0.5 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Your Assets ({holdings.length})
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                Auto-Listed Live
              </span>
            </div>
            {holdings.map((asset) => renderAssetRow(asset, true))}
          </>
        ) : null}

        {/* 2. POPULAR / MARKET ASSETS */}
        {holdings.length === 0 ? (
          // Default initial view if user has 0 balance in everything
          marketAssets.slice(0, 3).map((asset) => renderAssetRow(asset, false))
        ) : !isExpanded ? (
          // If user owns assets and view all is not expanded, show a couple popular ones below
          <div className="pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1.5">
              Popular Market Assets
            </div>
            <div className="space-y-2">
              {marketAssets.slice(0, 2).map((asset) => renderAssetRow(asset, false))}
            </div>
          </div>
        ) : null}

        {/* 3. EXTENDED ASSETS (WHEN VIEW ALL IS EXPANDED) */}
        {isExpanded && (
          <div className="pt-2 space-y-2 animate-in fade-in duration-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1.5">
              All Available Assets & Stocks ({marketAssets.length})
            </div>
            {marketAssets.map((asset) => renderAssetRow(asset, false))}
          </div>
        )}
      </div>
    </div>
  );
};
