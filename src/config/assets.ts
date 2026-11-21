import { Asset } from '../types';
import registry from './assets.registry.json';

/**
 * Asset catalog.
 *
 * The token list lives in assets.registry.json and is produced by
 * `node scripts/verify-assets.mjs`, which checks each contract on-chain and
 * requires a real, cheap Relay/Li.Fi quote for buying and selling it. Only tokens
 * that pass are listed, so everything shown in the app can actually be swapped.
 */

interface RegistryEntry {
  id: string;
  symbol: string;
  name: string;
  category: 'stocks' | 'crypto' | 'currencies';
  group: 'ondo' | 'binance' | 'gold' | 'fiat' | 'stable' | 'native' | 'crypto';
  chainId: number;
  address: string;
  decimals: number;
  priceUsd: number;
  icon: string;
  color: string;
  logo?: string | null;
  verification: 'full' | 'buy-only' | 'sell-only';
  native?: boolean;
  sellOnly?: boolean;
  legacy?: boolean;
}

export const CHAINS: Record<number, { name: string; explorer: string }> = {
  0: { name: 'Nimiq Network', explorer: 'https://nimiq.watch' },
  1: { name: 'Ethereum', explorer: 'https://etherscan.io' },
  10: { name: 'OP Mainnet', explorer: 'https://optimistic.etherscan.io' },
  56: { name: 'BNB Smart Chain', explorer: 'https://bscscan.com' },
  137: { name: 'Polygon', explorer: 'https://polygonscan.com' },
  8453: { name: 'Base', explorer: 'https://basescan.org' },
  42161: { name: 'Arbitrum One', explorer: 'https://arbiscan.io' },
  43114: { name: 'Avalanche C-Chain', explorer: 'https://snowtrace.io' },
};

const DESCRIPTIONS: Record<RegistryEntry['group'], (e: RegistryEntry) => string> = {
  ondo: (e) => `Tokenized ${e.name} issued by Ondo Global Markets on BNB Chain, backed 1:1 by the underlying security. Tradable 24/7. Not available to US persons.`,
  binance: (e) => `Tokenized ${e.name} stock on BNB Chain. Tradable 24/7.`,
  gold: (e) => `${e.name}: a token backed by physical gold, tradable on ${CHAINS[e.chainId].name}.`,
  fiat: (e) => `${e.name}: an on-chain, fiat-backed currency token on ${CHAINS[e.chainId].name}.`,
  stable: (e) => `${e.name}: a dollar stablecoin on ${CHAINS[e.chainId].name}.`,
  native: (e) => `Native gas token of ${CHAINS[e.chainId].name}.`,
  crypto: (e) => `${e.name} on ${CHAINS[e.chainId].name}.`,
};

function toAsset(e: RegistryEntry): Asset {
  const chain = CHAINS[e.chainId];
  const explorerUrl = e.native ? chain.explorer : `${chain.explorer}/token/${e.address}`;
  return {
    id: e.id,
    symbol: e.symbol,
    name: e.name,
    category: e.category,
    chain: chain.name,
    chainId: e.chainId,
    contractAddress: e.address,
    decimals: e.decimals,
    icon: e.icon,
    logoUrl: e.logo ?? undefined,
    color: e.color,
    priceUsd: e.priceUsd,
    change24h: 0,
    userBalance: 0,
    isVerified: true,
    hasSwapLiquidity: true,
    sellOnly: e.sellOnly,
    legacy: e.legacy,
    verification: e.verification,
    priceSource: 'snapshot',
    explorerUrl,
    description: DESCRIPTIONS[e.group](e),
  };
}

const NIM: Asset = {
  id: 'nim-native',
  symbol: 'NIM',
  name: 'Nimiq',
  category: 'crypto',
  chain: 'Nimiq Network',
  chainId: 0,
  contractAddress: 'NATIVE_NIM',
  decimals: 5, // 1 NIM = 100,000 Luna
  icon: '💛',
  logoUrl: '/logos/nim.png',
  color: '#E5B887',
  priceUsd: 0.0282,
  change24h: 0,
  userBalance: 0,
  isVerified: true,
  hasSwapLiquidity: false,
  liquidityNote: 'Swaps to and from NIM are paused while the Fastspot relayer is down. Balance and transfers work.',
  priceSource: 'snapshot',
  explorerUrl: 'https://nimiq.watch',
  description: 'Native cryptocurrency of the browser-first Nimiq proof-of-stake blockchain.',
};

export const INITIAL_ASSETS: Asset[] = [NIM, ...(registry as RegistryEntry[]).map(toAsset)];

export const CATEGORY_METADATA = {
  all: { label: 'All Assets', icon: '✨' },
  stocks: { label: 'Stocks & Gold', icon: '📈' },
  crypto: { label: 'Crypto', icon: '🌐' },
  currencies: { label: 'Currencies', icon: '💱' },
};
