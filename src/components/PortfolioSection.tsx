import AssetLogo from './AssetLogo';
import React, { useState, useMemo } from 'react';
import { Asset } from '../types';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { CHAIN_SHORT, displayName, formatAmount, formatPrice, formatUsd } from '../utils/format';

/** Holdings shown before "Show all"; balances under $0.01 are always tucked away. */
const HOLDINGS_PREVIEW = 6;
const DUST_USD = 0.01;

interface PortfolioSectionProps {
  assets: Asset[];
  discoveredAssets?: Asset[];
  onSelectAssetForSwap: (asset: Asset) => void;
}

const AssetIcon: React.FC<{ asset: Asset }> = ({ asset }) => <AssetLogo asset={asset} size={36} />;

export const PortfolioSection: React.FC<PortfolioSectionProps> = ({
  assets,
  discoveredAssets = [],
  onSelectAssetForSwap,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showAllHoldings, setShowAllHoldings] = useState<boolean>(false);

  // Merge predefined assets and discovered assets
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
      .filter((a) => a.userBalance > 0 && a.id !== nimAsset?.id)
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

  // Everything held, including NIM, for the 24h P&L card
  const allHeld = useMemo(() => allDisplayAssets.filter((a) => a.userBalance > 0), [allDisplayAssets]);

  // Calculate Whole Portfolio 24h Profit / Loss
  const { total24hPnlUsd, total24hPnlPercent } = useMemo(() => {
    const totalCurrentVal = allHeld.reduce((sum, a) => sum + a.userBalance * a.priceUsd, 0);

    if (totalCurrentVal <= 0) {
      return { total24hPnlUsd: 0, total24hPnlPercent: 0 };
    }

    const pnlUsd = allHeld.reduce((sum, a) => {
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
  }, [allHeld]);

  const isPnlPositive = total24hPnlUsd >= 0;

  // Mini Sparkline SVG Generator
  const renderSparkline = (data?: number[], change24h: number = 0, width = 54, height = 22) => {
    const isPositive = change24h >= 0;
    // No history yet: draw nothing rather than an invented trend line.
    if (!data || data.length < 2) return null;
    const pointsData = [...data];

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
    if (allHeld.length === 0) {
      return renderSparkline(undefined, 0, 48, 18);
    }
    const withSparkline = allHeld.filter((h) => h.sparkline && h.sparkline.length >= 2);
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

  // Single asset row. Holdings show balance and value; other assets show their price.
  const renderAssetRow = (asset: Asset, isOwned: boolean = false) => {
    const change = asset.change24h || 0;
    return (
      <div
        key={asset.id}
        onClick={() => onSelectAssetForSwap(asset)}
        className="rounded-2xl bg-white border border-slate-100 p-3.5 flex items-center gap-3 shadow-sm cursor-pointer hover:bg-slate-50 transition-all"
      >
        <AssetIcon asset={asset} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs text-slate-900 truncate">{displayName(asset.name)}</span>
            <span className="text-[9px] font-semibold px-1.5 py-px rounded bg-slate-100 text-slate-500 shrink-0">
              {CHAIN_SHORT[asset.chainId] ?? asset.chain}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
            {isOwned ? `${formatAmount(asset.userBalance)} ${asset.symbol}` : asset.symbol}
            {asset.hasSwapLiquidity === false && <span className="font-sans text-amber-600"> · swaps paused</span>}
          </div>
        </div>

        <div className="mx-1 hidden sm:block">{renderSparkline(asset.sparkline, change, 54, 22)}</div>

        <div className="text-right shrink-0">
          <div className="font-bold text-xs text-slate-900">
            {isOwned ? formatUsd(asset.userBalance * asset.priceUsd) : formatPrice(asset.priceUsd)}
          </div>
          {/* 0 means no 24h data yet, so show nothing rather than a fake +0.00% */}
          {change !== 0 && (
            <div className={`text-[10px] font-semibold ${change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {change > 0 ? '+' : ''}{change.toFixed(2)}%
            </div>
          )}
        </div>
      </div>
    );
  };

  const mainHoldings = holdings.filter((a) => a.userBalance * a.priceUsd >= DUST_USD);
  const visibleHoldings = showAllHoldings ? holdings : mainHoldings.slice(0, HOLDINGS_PREVIEW);

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
          className={`flex-1 h-[72px] rounded-2xl bg-white border p-2.5 px-3 flex items-center justify-between shadow-sm transition-all ${allHeld.length > 0 && isPnlPositive
              ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-500/[0.04] to-white ring-1 ring-emerald-500/10'
              : allHeld.length > 0 && !isPnlPositive
                ? 'border-red-200/80 bg-gradient-to-r from-red-500/[0.04] to-white ring-1 ring-red-500/10'
                : 'border-slate-100'
            }`}
        >
          {/* Left: 24h Profit / Loss & Dollar Amount */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
              {allHeld.length > 0 && isPnlPositive ? (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              ) : allHeld.length > 0 && !isPnlPositive ? (
                <TrendingDown className="w-3 h-3 text-red-500" />
              ) : null}
              <span>24h Portfolio P&L</span>
            </div>
            <div
              className={`font-bold text-sm leading-tight mt-0.5 ${allHeld.length === 0
                  ? 'text-slate-800'
                  : isPnlPositive
                    ? 'text-emerald-600'
                    : 'text-red-500'
                }`}
            >
              {allHeld.length === 0
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
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg whitespace-nowrap ${allHeld.length === 0
                  ? 'bg-slate-100 text-slate-500'
                  : isPnlPositive
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                    : 'bg-red-50 text-red-500 border border-red-200/50'
                }`}
            >
              {allHeld.length > 0 && isPnlPositive ? '+' : ''}
              {total24hPnlPercent.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Asset list */}
      <div className="space-y-2">
        {visibleHoldings.map((asset) => renderAssetRow(asset, true))}
        {holdings.length > visibleHoldings.length && (
          <button
            onClick={() => setShowAllHoldings(true)}
            className="w-full py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Show all {holdings.length} assets
          </button>
        )}

        {/* Nothing held yet: a few assets to get started */}
        {holdings.length === 0 && !isExpanded && marketAssets.slice(0, 3).map((asset) => renderAssetRow(asset, false))}

        {isExpanded && (
          <div className="pt-2 space-y-2 animate-in fade-in duration-200">
            <div className="text-[11px] font-semibold text-slate-400 px-1">All assets ({marketAssets.length})</div>
            {marketAssets.map((asset) => renderAssetRow(asset, false))}
          </div>
        )}
      </div>
    </div>
  );
};
