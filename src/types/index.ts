export type AssetCategory = 'stocks' | 'crypto' | 'currencies' | 'all';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: 'stocks' | 'crypto' | 'currencies';
  chain: string;
  chainId: number; // 56: BNB, 137: Polygon, 8453: Base, 1: Ethereum, 42161: Arbitrum, 0: Nimiq
  contractAddress: string;
  decimals: number;
  icon: string; // fallback icon/emoji
  logoUrl?: string; // High-res Google-sourced official brand favicon/logo
  color: string;
  priceUsd: number;
  change24h: number; // percentage
  userBalance: number;
  isVerified: boolean;
  explorerUrl: string;
  description: string;
  sparkline?: number[];
  hasSwapLiquidity?: boolean;
  liquidityNote?: string;
  /** Token can be sold but not bought through the current routers. */
  sellOnly?: boolean;
  /** Where the live price comes from; `snapshot` means the bundled fallback value is shown. */
  priceSource?: 'coingecko' | 'relay' | 'snapshot';
  /** Result of scripts/verify-assets.mjs: full = buy/sell/depth checked, buy-only = buy checked. */
  verification?: 'full' | 'buy-only' | 'sell-only';
}

export interface RouteStep {
  step: number;
  title: string;
  description: string;
  protocol: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  txHash?: string;
  chainName: string;
}

export interface SwapQuote {
  fromAsset: Asset;
  toAsset: Asset;
  fromAmount: string;
  toAmount: string;
  exchangeRate: number; // 1 fromAsset = X toAsset
  priceImpact: number; // percentage
  relayFeeUsd: number;
  estimatedGasUsd: number;
  estimatedTimeSeconds: number;
  isTwoStepNIM: boolean;
  steps: RouteStep[];
  minReceived: string;
  relayTxData?: any;
  fromAmountUsd?: number;
  toAmountUsd?: number;
  /** Router that produced this quote, e.g. "Relay" or "Li.Fi (sushiswap)". */
  provider: string;
  /** Epoch ms when the quote was fetched; quotes go stale after QUOTE_TTL_MS. */
  quotedAt: number;
  /** Total value lost to fees, gas and slippage, as % of the amount sent (from router USD values). */
  totalCostPct: number;
  /** Soft warning shown to the user (high but acceptable cost, etc.). */
  warning?: string;
}

export interface WalletState {
  isNimiqPayHost: boolean;
  nimiqConnected: boolean;
  nimiqAddress: string | null;
  nimiqBalanceLuna: number;
  evmConnected: boolean;
  evmAddress: string | null;
  evmChainId: number | null;
  isSyncing: boolean;
  isConsensusEstablished: boolean;
  lastBlockHeight: number;
}

export interface TransactionRecord {
  id: string;
  type: 'swap' | 'send' | 'receive';
  fromSymbol: string;
  toSymbol?: string;
  fromAmount: number;
  toAmount?: number;
  fromLogoUrl?: string;
  toLogoUrl?: string;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'needs_action';
  txHash?: string;
  chain: string;
  explorerUrl?: string;
  note?: string;
  actionUrl?: string;
  actionLabel?: string;
}


