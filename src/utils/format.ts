/** Display helpers shared by the portfolio views. */

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0.00';
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) return '<$0.01';
  if (abs < 1 && abs > 0) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumSignificantDigits: 3 })}`;
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Price of one unit: keeps enough precision for cheap tokens (e.g. $0.0282). */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString('en-US', { maximumSignificantDigits: 3 })}`;
}

/** Token amount: commas for large numbers, up to 4 significant decimals for small ones. */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (abs >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return value.toLocaleString('en-US', { maximumSignificantDigits: 4 });
}

/** "Aave (BNB Chain)" -> "Aave"; the chain is shown as a badge next to the name. */
export function displayName(name: string): string {
  return name.replace(/\s*\((BNB Chain|Polygon|Base|Arbitrum|OP Mainnet|Avalanche|BSC)\)\s*$/i, '');
}

export const CHAIN_SHORT: Record<number, string> = {
  0: 'Nimiq',
  1: 'ETH',
  10: 'OP',
  56: 'BNB',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  43114: 'Avax',
};
