import React, { useState } from 'react';
import { Asset, AssetCategory } from '../types';
import { AssetCard } from './AssetCard';
import { AssetCategoryTabs } from './AssetCategoryTabs';
import { ChevronDown, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

interface AssetListProps {
  assets: Asset[];
  onSwapAsset: (asset: Asset) => void;
  onViewDetails: (asset: Asset) => void;
}

export const AssetList: React.FC<AssetListProps> = ({ assets, onSwapAsset, onViewDetails }) => {
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory>('all');
  const [sortBy, setSortBy] = useState<'value' | 'change' | 'name'>('value');

  const filteredAssets = assets.filter((asset) => {
    if (selectedCategory === 'all') return true;
    return asset.category === selectedCategory;
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (sortBy === 'value') {
      return (b.userBalance * b.priceUsd) - (a.userBalance * a.priceUsd);
    }
    if (sortBy === 'change') {
      return b.change24h - a.change24h;
    }
    return a.name.localeCompare(b.name);
  });

  const counts: Record<AssetCategory, number> = {
    all: assets.length,
    stocks: assets.filter((a) => a.category === 'stocks').length,
    crypto: assets.filter((a) => a.category === 'crypto').length,
    currencies: assets.filter((a) => a.category === 'currencies').length,
  };

  return (
    <div className="pb-28">
      {/* Portfolio Header matching Reference UI */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <h2 className="text-lg font-bold text-white tracking-tight">Portfolio</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSortBy(sortBy === 'value' ? 'change' : sortBy === 'change' ? 'name' : 'value');
            }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-md bg-white/5 border border-white/5"
          >
            <span className="capitalize">{sortBy}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <AssetCategoryTabs
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        counts={counts}
      />

      {/* Assets Rows */}
      <div className="px-4 mt-2 space-y-2">
        {sortedAssets.length > 0 ? (
          sortedAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onSwapAsset={onSwapAsset}
              onViewDetails={onViewDetails}
            />
          ))
        ) : (
          <div className="text-center py-12 text-slate-500 text-sm">
            No assets found in this category.
          </div>
        )}
      </div>
    </div>
  );
};

