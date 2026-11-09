import React from 'react';
import { AssetCategory } from '../types';
import { CATEGORY_METADATA } from '../config/assets';

interface AssetCategoryTabsProps {
  selectedCategory: AssetCategory;
  onSelectCategory: (cat: AssetCategory) => void;
  counts: Record<AssetCategory, number>;
}

export const AssetCategoryTabs: React.FC<AssetCategoryTabsProps> = ({
  selectedCategory,
  onSelectCategory,
  counts,
}) => {
  const categories: AssetCategory[] = ['all', 'stocks', 'crypto', 'currencies'];

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 py-2">
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat;
        const meta = CATEGORY_METADATA[cat];

        return (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
              isSelected
                ? 'bg-gradient-to-r from-[#B88755] to-[#E5B887] text-black shadow-md shadow-[#E5B887]/20 font-bold'
                : 'bg-[#16181E] border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-[#1E212A]'
            }`}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                isSelected
                  ? 'bg-black/20 text-black font-extrabold'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {counts[cat]}
            </span>
          </button>
        );
      })}
    </div>
  );
};

