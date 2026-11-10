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


