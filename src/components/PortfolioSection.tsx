import React, { useMemo, useState } from 'react';
import { Asset, AssetCategory } from '../types';
import { CHAIN_SHORT, displayName, formatAmount, formatPrice, formatUsd } from '../utils/format';

interface PortfolioSectionProps {
  assets: Asset[];
  discoveredAssets?: Asset[];
  onSelectAssetForSwap: (asset: Asset) => void;
}

/** Balances worth less than this are tucked behind "Show all". */
const DUST_USD = 0.01;
const HOLDINGS_PREVIEW = 6;
const MARKETS_PREVIEW = 5;

const MARKET_TABS: { id: AssetCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stocks', label: 'Stocks & Gold' },
  { id: 'currencies', label: 'Currencies' },
  { id: 'crypto', label: 'Crypto' },
];

const valueOf = (a: Asset) => a.userBalance * a.priceUsd;

const AssetIcon: React.FC<{ asset: Asset }> = ({ asset }) => {
  const [failed, setFailed] = useState(false);
  const showImage = asset.logoUrl && !failed;
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-slate-100"
      style={{ backgroundColor: showImage ? '#fff' : `${asset.color}22` }}
    >
      {showImage ? (
        <img src={asset.logoUrl} alt="" className="w-full h-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-sm font-bold" style={{ color: asset.color }}>
          {displayName(asset.name).charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
};

const Change: React.FC<{ value: number }> = ({ value }) => {
  // 0 means "no 24h data yet" for most tokens, so show nothing instead of a fake "+0.00%".
  if (!value) return null;
  const up = value > 0;
  return (
    <div className={`text-[10px] font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? '+' : ''}
      {value.toFixed(2)}%
    </div>
  );
};

const AssetRow: React.FC<{ asset: Asset; mode: 'holding' | 'market'; onClick: () => void }> = ({ asset, mode, onClick }) => (
  <button
    onClick={onClick}
    className="w-full rounded-2xl bg-white border border-slate-100 px-3.5 py-3 flex items-center gap-3 shadow-sm text-left hover:bg-slate-50 active:scale-[0.99] transition-all"
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
        {mode === 'holding' ? `${formatAmount(asset.userBalance)} ${asset.symbol}` : asset.symbol}
        {asset.hasSwapLiquidity === false && <span className="font-sans text-amber-600"> · swaps paused</span>}
      </div>
    </div>

    <div className="text-right shrink-0">
      <div className="font-bold text-xs text-slate-900">
        {mode === 'holding' ? formatUsd(valueOf(asset)) : formatPrice(asset.priceUsd)}
      </div>
      <Change value={asset.change24h} />
    </div>
  </button>
);

const TextButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
  >
    {children}
  </button>
);

export const PortfolioSection: React.FC<PortfolioSectionProps> = ({
  assets,
  discoveredAssets = [],
  onSelectAssetForSwap,
}) => {
  const [showAllHoldings, setShowAllHoldings] = useState(false);
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const [marketTab, setMarketTab] = useState<AssetCategory>('all');

  const allAssets = useMemo(() => {
    const merged = [...assets];
    for (const da of discoveredAssets) if (!merged.some((a) => a.id === da.id)) merged.push(da);
    return merged;
  }, [assets, discoveredAssets]);

  const holdings = useMemo(
    () => allAssets.filter((a) => a.userBalance > 0).sort((a, b) => valueOf(b) - valueOf(a)),
    [allAssets]
  );
  const mainHoldings = holdings.filter((a) => valueOf(a) >= DUST_USD);
  const dustCount = holdings.length - mainHoldings.length;
  const visibleHoldings = showAllHoldings ? holdings : mainHoldings.slice(0, HOLDINGS_PREVIEW);
  const hiddenHoldings = holdings.length - visibleHoldings.length;

  const markets = useMemo(() => {
    const held = new Set(holdings.map((h) => h.id));
    return allAssets
      .filter((a) => !held.has(a.id) && !a.sellOnly && (marketTab === 'all' || a.category === marketTab))
      // Swappable assets first; ones with paused swaps (NIM) go last.
      .sort((a, b) => Number(a.hasSwapLiquidity === false) - Number(b.hasSwapLiquidity === false));
  }, [allAssets, holdings, marketTab]);
  const visibleMarkets = showAllMarkets ? markets : markets.slice(0, MARKETS_PREVIEW);

  return (
    <div className="px-5 pt-1 pb-36 text-slate-900">
      {/* Holdings */}
      <h2 className="text-sm font-bold tracking-tight mb-2.5">Portfolio</h2>

      {holdings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center">
          <div className="text-xs font-semibold text-slate-700">No assets yet</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Tap + to buy stocks, gold, currencies or crypto.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleHoldings.map((asset) => (
            <AssetRow key={asset.id} asset={asset} mode="holding" onClick={() => onSelectAssetForSwap(asset)} />
          ))}
          {hiddenHoldings > 0 && (
            <TextButton onClick={() => setShowAllHoldings(true)}>
              Show all {holdings.length} assets{dustCount > 0 ? ` (incl. ${dustCount} small balance${dustCount > 1 ? 's' : ''})` : ''}
            </TextButton>
          )}
          {showAllHoldings && holdings.length > HOLDINGS_PREVIEW && (
            <TextButton onClick={() => setShowAllHoldings(false)}>Show less</TextButton>
          )}
        </div>
      )}

      {/* Markets */}
      <h2 className="text-sm font-bold tracking-tight mt-6 mb-2.5">Markets</h2>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2.5 -mx-1 px-1">
        {MARKET_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setMarketTab(tab.id);
              setShowAllMarkets(false);
            }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
              marketTab === tab.id ? 'bg-[#1C1C1E] text-white' : 'bg-white border border-slate-100 text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visibleMarkets.map((asset) => (
          <AssetRow key={asset.id} asset={asset} mode="market" onClick={() => onSelectAssetForSwap(asset)} />
        ))}
        {markets.length > MARKETS_PREVIEW && (
          <TextButton onClick={() => setShowAllMarkets((v) => !v)}>
            {showAllMarkets ? 'Show less' : `Show all ${markets.length}`}
          </TextButton>
        )}
      </div>
    </div>
  );
};
