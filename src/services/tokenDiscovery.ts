/**
 * tokenDiscovery.ts
 *
 * Auto-discovers ERC-20 tokens in a user's wallet that aren't in the
 * predefined asset list. Scans recent Transfer event logs on supported
 * chains, fetches token metadata (name, symbol, decimals, balance),
 * and optionally pulls price data from CoinGecko.
 */

import type { Asset } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RPC endpoints per chain (fallbacks in order). */
const CHAIN_RPC_MAP: Record<number, string[]> = {
  56: ['https://bsc.publicnode.com', 'https://56.rpc.thirdweb.com'],
  137: [
    'https://polygon-bor-rpc.publicnode.com',
    'https://polygon.gateway.tenderly.co',
    'https://137.rpc.thirdweb.com',
    'https://polygon.drpc.org',
  ],
  8453: [
    'https://mainnet.base.org',
    'https://8453.rpc.thirdweb.com',
    'https://base.gateway.tenderly.co',
  ],
  42161: [
    'https://arbitrum-one-rpc.publicnode.com',
    'https://arb1.arbitrum.io/rpc',
    'https://42161.rpc.thirdweb.com',
  ],
  10: [
    'https://optimism-rpc.publicnode.com',
    'https://mainnet.optimism.io',
    'https://10.rpc.thirdweb.com',
  ],
  43114: [
    'https://avalanche-c-chain-rpc.publicnode.com',
    'https://api.avax.network/ext/bc/C/rpc',
  ],
};

/** Common popular tokens per chain as discovery fallback */
const CHAIN_CANDIDATE_TOKENS: Record<number, string[]> = {
  56: [
    '0x55d398326f99059fF775485246999027B3197955', // USDT BSC
    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC BSC
    '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
    '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', // DAI BSC
    '0x2859e4544c4bb03966803b044a93563bd2d0dd4d', // SHIB BSC
  ],
  137: [
    '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI Polygon
    '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH Polygon
    '0xb0897686c545045aFc77CF20eC7A532E3120E0F1', // LINK Polygon
  ],
  8453: [
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC Base
    '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', // DAI Base
    '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', // DEGEN Base
  ],
  42161: [
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC Arb
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT Arb
    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI Arb
  ],
  10: [
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC OP
    '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT OP
  ],
  43114: [
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // USDC AVAX
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', // USDT AVAX
  ],
};

/** Human-readable chain names. */
const CHAIN_NAME_MAP: Record<number, string> = {
  56: 'BNB Smart Chain',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum One',
  10: 'OP Mainnet',
  43114: 'Avalanche C-Chain',
};

/** CoinGecko platform identifiers keyed by chainId. */
const COINGECKO_PLATFORM_MAP: Record<number, string> = {
  56: 'binance-smart-chain',
  137: 'polygon-pos',
  8453: 'base',
  42161: 'arbitrum-one',
  10: 'optimistic-ethereum',
  43114: 'avalanche',
};

/** Block explorer base URLs keyed by chainId (address pages). */
const EXPLORER_MAP: Record<number, string> = {
  56: 'https://bscscan.com/token/',
  137: 'https://polygonscan.com/token/',
  8453: 'https://basescan.org/token/',
  42161: 'https://arbiscan.io/token/',
  10: 'https://optimistic.etherscan.io/token/',
  43114: 'https://snowtrace.io/token/',
};

/** ERC-20 Transfer event topic: Transfer(address,address,uint256). */
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** ABI function selectors. */
const SELECTOR_NAME = '0x06fdde03';
const SELECTOR_SYMBOL = '0x95d89b41';
const SELECTOR_DECIMALS = '0x313ce567';
const SELECTOR_BALANCE_OF = '0x70a08231';

/** Global limits. */
const FETCH_TIMEOUT_MS = 3000;
const BLOCK_LOOKBACK = 5000;
const MAX_DISCOVERED_TOKENS = 20;

// ---------------------------------------------------------------------------
// Helpers – networking
// ---------------------------------------------------------------------------

/**
 * Creates an AbortSignal that fires after `ms` milliseconds.
 * Uses the static helper when available, otherwise falls back to a manual
 * AbortController so we stay compatible with older runtimes.
 */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Send a JSON-RPC request to the first responsive RPC endpoint for a chain.
 * Falls back through the endpoint list on failure.
 */
async function rpcCall(
  chainId: number,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const endpoints = CHAIN_RPC_MAP[chainId] ?? [];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: timeoutSignal(FETCH_TIMEOUT_MS),
      });
      const json = (await res.json()) as { result?: unknown; error?: unknown };
      if (json.error) continue;
      return json.result;
    } catch {
      // Try next endpoint
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Helpers – ABI decoding
// ---------------------------------------------------------------------------

/**
 * Decode a hex-encoded ABI string response.
 *
 * Solidity ABI-encodes a dynamic `string` as:
 *   bytes 0-31  : offset to data (usually 0x20)
 *   bytes 32-63 : length of the string
 *   bytes 64+   : UTF-8 bytes, right-padded with zeros
 *
 * Some non-standard contracts (e.g. MKR) return a bytes32 directly —
 * we handle that case too by trimming trailing null bytes.
 */
function decodeAbiString(hex: string): string {
  if (!hex || hex === '0x') return '';

  const raw = hex.startsWith('0x') ? hex.slice(2) : hex;

  // Standard ABI-encoded string (>= 128 hex chars = 64 bytes)
  if (raw.length >= 128) {
    try {
      const lengthHex = raw.slice(64, 128);
      const strLen = parseInt(lengthHex, 16);
      if (strLen > 0 && strLen < 256) {
        const strHex = raw.slice(128, 128 + strLen * 2);
        return hexToUtf8(strHex);
      }
    } catch {
      // Fall through to bytes32 path
    }
  }

  // bytes32 fallback – strip trailing zeros
  const trimmed = raw.replace(/(00)+$/, '');
  if (trimmed.length > 0) {
    return hexToUtf8(trimmed);
  }
  return '';
}

/** Convert a hex string (no 0x prefix) to a UTF-8 string. */
function hexToUtf8(hex: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** Decode a uint256 hex value to a number (safe for decimals ≤ 18). */
function decodeUint256(hex: string): number {
  if (!hex || hex === '0x') return 0;
  const raw = hex.startsWith('0x') ? hex.slice(2) : hex;
  return parseInt(raw, 16);
}

/** Decode a uint256 hex value to a bigint (for large balances). */
function decodeUint256Big(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}

// ---------------------------------------------------------------------------
// Helpers – misc
// ---------------------------------------------------------------------------

/** Derive a deterministic hex colour from a contract address. */
function deriveColor(contractAddress: string): string {
  let hash = 0;
  for (let i = 0; i < contractAddress.length; i++) {
    hash = contractAddress.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = ((hash % 360) + 360) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

/** Pad an address to 32 bytes for use as a topic filter. */
function padAddress(address: string): string {
  const raw = address.startsWith('0x') ? address.slice(2) : address;
  return '0x' + raw.toLowerCase().padStart(64, '0');
}

// ---------------------------------------------------------------------------
// Core discovery logic
// ---------------------------------------------------------------------------

/**
 * Scan a single chain for ERC-20 Transfer events TO `userAddress` within
 * the most recent ~5000 blocks. Returns unique contract addresses found.
 */
async function scanChainForTransfers(
  chainId: number,
  userAddress: string,
): Promise<string[]> {
  const seen = new Set<string>();
  const result: string[] = [];

  // Add popular candidate tokens for this chain to check balances
  const candidates = CHAIN_CANDIDATE_TOKENS[chainId] || [];
  for (const c of candidates) {
    const lower = c.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
    }
  }

  try {
    // 1. Get the latest block number
    const latestBlockHex = (await rpcCall(chainId, 'eth_blockNumber', [])) as
      | string
      | undefined;

    if (latestBlockHex) {
      const latestBlock = parseInt(latestBlockHex, 16);
      const fromBlock = Math.max(0, latestBlock - 1000);

      // 2. Query Transfer(address,address,uint256) logs where topic[2] == userAddress
      const logs = (await rpcCall(chainId, 'eth_getLogs', [
        {
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: 'latest',
          topics: [TRANSFER_TOPIC, null, padAddress(userAddress)],
        },
      ])) as Array<{ address: string }> | undefined;

      if (Array.isArray(logs)) {
        for (const log of logs) {
          const addr = log.address?.toLowerCase();
          if (addr && !seen.has(addr)) {
            seen.add(addr);
            result.push(addr);
          }
        }
      }
    }
  } catch {
    // Fall back to candidate tokens on public RPC error
  }

  return result;
}

/**
 * Fetch ERC-20 metadata (name, symbol, decimals) and the user's balance
 * for a single token contract on a given chain.
 */
async function fetchTokenMeta(
  chainId: number,
  contractAddress: string,
  userAddress: string,
): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  balance: number;
} | null> {
  try {
    // Build the balanceOf call data: selector + padded address
    const balanceOfData =
      SELECTOR_BALANCE_OF + padAddress(userAddress).slice(2);

    // Fire all four calls in parallel
    const [nameHex, symbolHex, decimalsHex, balanceHex] = (await Promise.all([
      rpcCall(chainId, 'eth_call', [
        { to: contractAddress, data: SELECTOR_NAME },
        'latest',
      ]),
      rpcCall(chainId, 'eth_call', [
        { to: contractAddress, data: SELECTOR_SYMBOL },
        'latest',
      ]),
      rpcCall(chainId, 'eth_call', [
        { to: contractAddress, data: SELECTOR_DECIMALS },
        'latest',
      ]),
      rpcCall(chainId, 'eth_call', [
        { to: contractAddress, data: balanceOfData },
        'latest',
      ]),
    ])) as [string | undefined, string | undefined, string | undefined, string | undefined];

    const name = decodeAbiString(nameHex ?? '');
    const symbol = decodeAbiString(symbolHex ?? '');
    const decimals = decodeUint256(decimalsHex ?? '0x0');
    const rawBalance = decodeUint256Big(balanceHex ?? '0x0');

    // Skip tokens with zero balance or unreadable metadata
    if (!symbol || rawBalance === 0n) return null;

    // Convert raw balance to human-readable using decimals
    const balance = Number(rawBalance) / 10 ** decimals;

    return { name: name || symbol, symbol, decimals, balance };
  } catch {
    return null;
  }
}

/**
 * Attempt to fetch the USD price and 24h change for a token from CoinGecko.
 * Returns { priceUsd, change24h } or defaults on failure.
 */
async function fetchTokenPrice(
  chainId: number,
  contractAddress: string,
): Promise<{ priceUsd: number; change24h: number }> {
  const defaults = { priceUsd: 0, change24h: 0 };

  const platform = COINGECKO_PLATFORM_MAP[chainId];
  if (!platform) return defaults;

  try {
    const url =
      `https://api.coingecko.com/api/v3/simple/token_price/${platform}` +
      `?contract_addresses=${contractAddress}&vs_currencies=usd&include_24hr_change=true`;

    const res = await fetch(url, { signal: timeoutSignal(FETCH_TIMEOUT_MS) });
    if (!res.ok) return defaults;

    const data = (await res.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number }
    >;

    const entry = data[contractAddress.toLowerCase()];
    if (!entry) return defaults;

    return {
      priceUsd: entry.usd ?? 0,
      change24h: entry.usd_24h_change ?? 0,
    };
  } catch {
    return defaults;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover ERC-20 tokens in the user's wallet that are NOT in the known
 * asset list. Scans recent Transfer logs on each supported chain, fetches
 * token metadata + balances, and optionally fetches prices from CoinGecko.
 *
 * @param userAddress          - The user's wallet address (0x…)
 * @param knownContractAddresses - Set of lowercase contract addresses already
 *                                 tracked by the app
 * @param chainIds             - Optional subset of chain IDs to scan
 *                               (defaults to all supported chains)
 * @returns An array of newly discovered `Asset` objects (max 20)
 */
export async function discoverNewTokens(
  userAddress: string,
  knownContractAddresses: Set<string>,
  chainIds?: number[],
): Promise<Asset[]> {
  try {
    const targetChains = chainIds ?? Object.keys(CHAIN_RPC_MAP).map(Number);
    const discoveredAssets: Asset[] = [];

    // Normalise known addresses to lowercase for comparison
    const knownLower = new Set<string>();
    knownContractAddresses.forEach((a) => knownLower.add(a.toLowerCase()));

    // 1. Scan all target chains in parallel for Transfer events
    const chainResults = await Promise.allSettled(
      targetChains.map(async (chainId) => {
        const contracts = await scanChainForTransfers(chainId, userAddress);
        return { chainId, contracts };
      }),
    );

    // 2. Collect unique (chainId, contractAddress) pairs that aren't known
    const candidates: Array<{ chainId: number; contractAddress: string }> = [];

    for (const result of chainResults) {
      if (result.status !== 'fulfilled') continue;
      const { chainId, contracts } = result.value;
      for (const addr of contracts) {
        if (knownLower.has(addr)) continue;
        candidates.push({ chainId, contractAddress: addr });
        // Stop collecting once we have enough candidates
        if (candidates.length >= MAX_DISCOVERED_TOKENS) break;
      }
      if (candidates.length >= MAX_DISCOVERED_TOKENS) break;
    }

    if (candidates.length === 0) return [];

    // 3. Fetch metadata + price for every candidate in parallel
    const metaResults = await Promise.allSettled(
      candidates.map(async ({ chainId, contractAddress }) => {
        const [meta, price] = await Promise.all([
          fetchTokenMeta(chainId, contractAddress, userAddress),
          fetchTokenPrice(chainId, contractAddress),
        ]);
        if (!meta) return null;
        return { chainId, contractAddress, meta, price };
      }),
    );

    // 4. Build Asset objects
    for (const result of metaResults) {
      if (result.status !== 'fulfilled' || !result.value) continue;

      const { chainId, contractAddress, meta, price } = result.value;
      const chainName = CHAIN_NAME_MAP[chainId] ?? `Chain ${chainId}`;
      const explorerBase = EXPLORER_MAP[chainId] ?? '';

      const asset: Asset = {
        id: `discovered-${chainId}-${contractAddress.slice(2, 10)}`,
        symbol: meta.symbol.toUpperCase(),
        name: meta.name,
        category: 'crypto',
        chain: chainName,
        chainId,
        contractAddress,
        decimals: meta.decimals,
        icon: meta.symbol.toLowerCase(),
        logoUrl: undefined,
        color: deriveColor(contractAddress),
        priceUsd: price.priceUsd,
        change24h: price.change24h,
        userBalance: meta.balance,
        isVerified: false,
        explorerUrl: `${explorerBase}${contractAddress}`,
        description: `Auto-discovered ${meta.symbol} token on ${chainName}`,
      };

      discoveredAssets.push(asset);

      if (discoveredAssets.length >= MAX_DISCOVERED_TOKENS) break;
    }

    return discoveredAssets;
  } catch {
    // Never throw – return an empty array on any unexpected error
    return [];
  }
}
