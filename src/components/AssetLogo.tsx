import { useState } from 'react';
import type { Asset } from '../types';

/**
 * One asset logo used everywhere. Logos are self-hosted in /public/logos;
 * if one ever fails to load we fall back to the asset's emoji (flags for currencies) so nothing looks broken.
 */
export default function AssetLogo({
  asset,
  size = 36,
  className = '',
}: {
  asset: Pick<Asset, 'logoUrl' | 'icon' | 'symbol' | 'color'>;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = asset.logoUrl && !failed;
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden border border-slate-200/70 bg-white ${className}`}
      style={{ width: size, height: size, backgroundColor: show ? '#fff' : `${asset.color}18` }}
    >
      {show ? (
        <img
          src={asset.logoUrl}
          alt={asset.symbol}
          loading="lazy"
          draggable={false}
          className="w-full h-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.5), lineHeight: 1 }}>{asset.icon || asset.symbol.charAt(0)}</span>
      )}
    </span>
  );
}
