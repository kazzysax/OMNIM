import { Asset, SwapQuote, RouteStep } from '../types';

/**
 * Swap routing engine.
 *
 * Strategy:
 *  1. Ask Relay first. If its route is cheap (<= LIFI_FALLBACK_COST_PCT) use it.
 *  2. If Relay fails or is expensive, also ask Li.Fi and keep whichever leaves the user
 *     with more value. Li.Fi's free tier allows only ~75 requests per 2 hours per IP, so it is
 *     a fallback, not the default. Set VITE_LIFI_API_KEY to lift that limit.
 *  3. Cost is measured from the routers' own USD values (fees + gas + slippage). Anything over
 *     MAX_COST_PCT is blocked, so a thin-liquidity route can never be shown as a normal quote.
 */

const RELAY_API = 'https://api.relay.link';
const LIFI_API = 'https://li.quest/v1';

/** Block any route that would cost more than this share of the amount sent. */
export const MAX_COST_PCT = 5;
/** Show a warning above this cost. */
export const WARN_COST_PCT = 1.5;
/** A quote older than this must be refreshed before it is executed. */
export const QUOTE_TTL_MS = 30_000;

/** Ask Li.Fi as well when Relay's route costs more than this. */
const LIFI_FALLBACK_COST_PCT = 1;
const QUOTE_CACHE_MS = 10_000;
const REQUEST_TIMEOUT_MS = 12_000;
const LIFI_API_KEY: string | undefined = (import.meta as any).env?.VITE_LIFI_API_KEY || undefined;

/** Epoch ms until which Li.Fi is skipped because it rate-limited us. */
let lifiBlockedUntil = 0;
const quoteCache = new Map<string, { at: number; quote: SwapQuote }>();
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const POLYGON_NATIVE = '0x0000000000000000000000000000000000001010';

type ErrorCode = 'rate_limit' | 'no_route' | 'too_small' | 'impact' | 'network' | 'other';

class RouteError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decimal string/number -> integer string in the token's smallest unit. No float rounding. */
export function toAtomicUnits(amount: string | number, decimals: number): string {
  let str = typeof amount === 'number' ? amount.toFixed(Math.min(decimals, 20)) : amount.toString().trim();
  if (!/^\d*\.?\d*$/.test(str) || str === '' || str === '.') return '0';
  const [whole = '0', frac = ''] = str.split('.');
  const padded = frac.slice(0, decimals).padEnd(decimals, '0');
  return (whole + padded).replace(/^0+/, '') || '0';
}

export function isNativeAsset(asset: Asset): boolean {
  const a = (asset.contractAddress || '').toLowerCase();
  return !a || a === ZERO_ADDRESS || a === POLYGON_NATIVE;
}

const routerAddress = (asset: Asset) => (isNativeAsset(asset) ? ZERO_ADDRESS : asset.contractAddress);

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new RouteError('network', 'Routing service did not respond in time.');
  } finally {
    clearTimeout(timer);
  }
}

function formatOut(n: number): string {
  return n > 1000 ? n.toFixed(2) : n > 1 ? n.toFixed(4) : n.toFixed(6);
}

function costPct(fromUsd: number, toUsd: number): number {
  if (!(fromUsd > 0) || !(toUsd >= 0)) return 0;
  return Math.max(0, parseFloat((((fromUsd - toUsd) / fromUsd) * 100).toFixed(2)));
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
};

// ---------------------------------------------------------------------------
// Router 1: Li.Fi
// ---------------------------------------------------------------------------

async function fetchLiFiQuote(
  fromAsset: Asset,
  toAsset: Asset,
  amount: number,
  user: string
): Promise<SwapQuote> {
  const fromAtomic = toAtomicUnits(amount, fromAsset.decimals);
  const url = new URL(`${LIFI_API}/quote`);
  url.searchParams.set('fromChain', String(fromAsset.chainId));
  url.searchParams.set('toChain', String(toAsset.chainId));
  url.searchParams.set('fromToken', routerAddress(fromAsset));
  url.searchParams.set('toToken', routerAddress(toAsset));
  url.searchParams.set('fromAmount', fromAtomic);
  url.searchParams.set('fromAddress', user);
  url.searchParams.set('slippage', '0.005');

  const res = await fetchWithTimeout(url.toString(), LIFI_API_KEY ? { headers: { 'x-lifi-api-key': LIFI_API_KEY } } : {});
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = String(body.message || '').toLowerCase();
    if (res.status === 429 || msg.includes('rate limit')) {
      const resetSeconds = parseInt(res.headers.get('ratelimit-reset') || '', 10);
      lifiBlockedUntil = Date.now() + (Number.isFinite(resetSeconds) ? Math.min(resetSeconds, 7200) : 600) * 1000;
      throw new RouteError('rate_limit', 'Li.Fi is busy (rate limit).');
    }
    if (msg.includes('no available quotes') || msg.includes('no route')) throw new RouteError('no_route', 'Li.Fi has no route for this pair.');
    if (msg.includes('too low') || msg.includes('too small')) throw new RouteError('too_small', 'Amount is too small for this route.');
    throw new RouteError('other', body.message || `Li.Fi error (HTTP ${res.status})`);
  }

  const data = await res.json();
  const est = data.estimate ?? {};
  const tx = data.transactionRequest;
  if (!tx?.to || !tx?.data) throw new RouteError('other', 'Li.Fi returned no executable transaction.');

  const toAmount = num(est.toAmount) / Math.pow(10, toAsset.decimals);
  if (!(toAmount > 0)) throw new RouteError('no_route', 'Li.Fi returned an empty quote.');

  const fromUsd = num(est.fromAmountUSD) || amount * fromAsset.priceUsd;
  const toUsd = num(est.toAmountUSD) || toAmount * toAsset.priceUsd;
  const gasUsd = (est.gasCosts ?? []).reduce((s: number, g: any) => s + num(g.amountUSD), 0);
  const feeUsd = (est.feeCosts ?? []).reduce((s: number, f: any) => s + num(f.amountUSD), 0);
  const tool = data.tool || 'router';

  const txData: any[] = [];
  const steps: RouteStep[] = [];
  const approvalAddress = est.approvalAddress;

  if (!isNativeAsset(fromAsset) && approvalAddress?.startsWith('0x')) {
    const spender = approvalAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    // Approve exactly what this swap spends, never an unlimited allowance.
    const amountHex = BigInt(fromAtomic).toString(16).padStart(64, '0');
    txData.push({
      id: 'approve',
      description: `Approve ${fromAsset.symbol}`,
      items: [{ status: 'not-started', data: { to: fromAsset.contractAddress, data: `0x095ea7b3${spender}${amountHex}`, value: '0' } }],
    });
    steps.push({
      step: 1,
      title: `Approve ${fromAsset.symbol}`,
      description: `Allow the router to spend ${amount} ${fromAsset.symbol} (this swap only)`,
      protocol: `Li.Fi (${tool})`,
      status: 'pending',
      chainName: fromAsset.chain,
    });
  }

  txData.push({
    id: 'swap',
    description: `Swap ${fromAsset.symbol} to ${toAsset.symbol}`,
    items: [{ status: 'not-started', data: { to: tx.to, data: tx.data, value: tx.value || '0' } }],
  });
  steps.push({
    step: steps.length + 1,
    title: `Swap via ${tool}`,
    description: `Execute route on ${fromAsset.chain}${fromAsset.chainId !== toAsset.chainId ? ` → ${toAsset.chain}` : ''}`,
    protocol: `Li.Fi (${tool})`,
    status: 'pending',
    chainName: fromAsset.chain,
  });

  const minOut = est.toAmountMin ? num(est.toAmountMin) / Math.pow(10, toAsset.decimals) : toAmount * 0.995;

  return {
    fromAsset,
    toAsset,
    fromAmount: String(amount),
    toAmount: formatOut(toAmount),
    exchangeRate: toAmount / amount,
    priceImpact: costPct(fromUsd, toUsd),
    relayFeeUsd: feeUsd,
    estimatedGasUsd: gasUsd,
    estimatedTimeSeconds: est.executionDuration || 5,
    isTwoStepNIM: false,
    steps,
    minReceived: minOut.toFixed(minOut > 10 ? 2 : 5),
    relayTxData: txData,
    fromAmountUsd: fromUsd,
    toAmountUsd: toUsd,
    provider: `Li.Fi (${tool})`,
    quotedAt: Date.now(),
    totalCostPct: costPct(fromUsd, toUsd),
  };
}

// ---------------------------------------------------------------------------
// Router 2: Relay
// ---------------------------------------------------------------------------

async function fetchRelayQuote(
  fromAsset: Asset,
  toAsset: Asset,
  amount: number,
  user: string
): Promise<SwapQuote> {
  const res = await fetchWithTimeout(`${RELAY_API}/quote/v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user,
      originChainId: fromAsset.chainId,
      destinationChainId: toAsset.chainId,
      originCurrency: routerAddress(fromAsset),
      destinationCurrency: routerAddress(toAsset),
      amount: toAtomicUnits(amount, fromAsset.decimals),
      tradeType: 'EXACT_INPUT',
      slippageTolerance: '100',
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const raw = String(body.message || `HTTP ${res.status}`);
    const low = raw.toLowerCase();
    if (res.status === 429 || low.includes('rate limit')) throw new RouteError('rate_limit', 'Relay is busy (rate limit).');
    if (low.includes('swap impact is too high')) throw new RouteError('impact', 'Relay: price impact too high for this pair.');
    if (low.includes('no routes found') || low.includes('invalid input or output currency') || body.errorCode === 'INVALID_INPUT_CURRENCY')
      throw new RouteError('no_route', 'Relay has no route for this pair.');
    if (low.includes('fee exceeds') || low.includes('amount too low') || low.includes('too small'))
      throw new RouteError('too_small', 'Amount is too small to cover relayer fees.');
    if (low.includes('sender and recipient cannot be the same')) throw new RouteError('other', 'Origin and destination token are identical.');
    throw new RouteError('other', `Relay: ${raw}`);
  }

  const data = await res.json();
  const details = data.details ?? {};
  const out = details.currencyOut;
  if (!out?.amountFormatted) throw new RouteError('no_route', 'Relay returned no output amount.');

  const steps: any[] = Array.isArray(data.steps) ? data.steps : [];
  const executable = steps.length > 0 && steps.every((s) => s.kind === 'transaction' && s.items?.some((i: any) => i.data));
  if (!executable) throw new RouteError('other', 'Relay route needs a signature step this wallet cannot perform.');

  const toAmount = num(out.amountFormatted);
  if (!(toAmount > 0)) throw new RouteError('no_route', 'Relay returned an empty quote.');

  const fromUsd = num(details.currencyIn?.amountUsd) || amount * fromAsset.priceUsd;
  const toUsd = num(out.amountUsd) || toAmount * toAsset.priceUsd;
  const minOut = out.minimumAmount ? num(out.minimumAmount) / Math.pow(10, toAsset.decimals) : toAmount * 0.995;

  const routeSteps: RouteStep[] = steps.map((s, i) => ({
    step: i + 1,
    title: s.description || `Step ${i + 1}`,
    description: s.id === 'approve' ? `Allow Relay to spend ${fromAsset.symbol}` : `Execute on ${fromAsset.chain}`,
    protocol: 'Relay',
    status: 'pending',
    chainName: fromAsset.chain,
  }));

  return {
    fromAsset,
    toAsset,
    fromAmount: String(amount),
    toAmount: formatOut(toAmount),
    exchangeRate: toAmount / amount,
    priceImpact: costPct(fromUsd, toUsd),
    relayFeeUsd: num(data.fees?.relayer?.amountUsd),
    estimatedGasUsd: num(data.fees?.gas?.amountUsd),
    estimatedTimeSeconds: details.timeEstimate || 3,
    isTwoStepNIM: false,
    steps: routeSteps,
    minReceived: minOut.toFixed(minOut > 10 ? 2 : 5),
    relayTxData: steps,
    fromAmountUsd: fromUsd,
    toAmountUsd: toUsd,
    provider: 'Relay',
    quotedAt: Date.now(),
    totalCostPct: costPct(fromUsd, toUsd),
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const PLACEHOLDER_USER = '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7';

export async function getSwapQuote(
  fromAsset: Asset,
  toAsset: Asset,
  fromAmount: string,
  userEvmAddress: string = PLACEHOLDER_USER
): Promise<SwapQuote> {
  const amount = parseFloat(fromAmount) || 0;
  if (amount <= 0) return createEmptyQuote(fromAsset, toAsset);

  if (
    fromAsset.id === toAsset.id ||
    (fromAsset.chainId === toAsset.chainId &&
      fromAsset.contractAddress.toLowerCase() === toAsset.contractAddress.toLowerCase())
  ) {
    throw new Error('Cannot swap an asset for itself. Choose a different destination asset.');
  }

  if (fromAsset.hasSwapLiquidity === false) {
    throw new Error(`${fromAsset.symbol} has no reliable swap route on ${fromAsset.chain}.`);
  }
  if (toAsset.hasSwapLiquidity === false) {
    throw new Error(`${toAsset.symbol} has no reliable swap route on ${toAsset.chain}.`);
  }

  if (toAsset.sellOnly) {
    throw new Error(`${toAsset.symbol} can currently be sold but not bought here, because no verified route exists for buying it.`);
  }

  if (fromAsset.symbol === 'NIM' || toAsset.symbol === 'NIM') {
    throw new Error(
      'Swaps to and from native NIM are paused while the Fastspot atomic-swap relayer is unavailable. NIM balances and transfers still work.'
    );
  }

  const cacheKey = `${fromAsset.id}>${toAsset.id}:${amount}:${userEvmAddress.toLowerCase()}`;
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.at < QUOTE_CACHE_MS) return cached.quote;

  const errors: RouteError[] = [];
  const quotes: SwapQuote[] = [];
  const collect = (r: PromiseSettledResult<SwapQuote>) =>
    r.status === 'fulfilled' ? quotes.push(r.value) : errors.push(r.reason as RouteError);

  // 1. Relay first.
  collect((await Promise.allSettled([fetchRelayQuote(fromAsset, toAsset, amount, userEvmAddress)]))[0]);

  // 2. Li.Fi as a fallback when Relay failed or is expensive (and Li.Fi is not rate-limited).
  const relayOk = quotes[0];
  const needLifi = !relayOk || relayOk.totalCostPct > LIFI_FALLBACK_COST_PCT;
  if (needLifi && Date.now() >= lifiBlockedUntil) {
    collect((await Promise.allSettled([fetchLiFiQuote(fromAsset, toAsset, amount, userEvmAddress)]))[0]);
  } else if (needLifi && !relayOk) {
    errors.push(new RouteError('rate_limit', 'Li.Fi is busy (rate limit).'));
  }

  if (quotes.length === 0) {
    const has = (c: ErrorCode) => errors.some((e) => e?.code === c);
    if (has('too_small')) throw new Error('Amount is too small to cover routing fees. Try a larger amount.');
    if (has('impact') && !has('rate_limit')) throw new Error(`Not enough liquidity to swap ${fromAsset.symbol} to ${toAsset.symbol} at this size. Try a smaller amount.`);
    if (has('rate_limit') && !has('no_route')) throw new Error('Routing services are busy. Please retry in a few minutes.');
    if (has('no_route')) throw new Error(`No route found for ${fromAsset.symbol} to ${toAsset.symbol}. Try swapping via USDC or USDT.`);
    if (errors.length && errors.every((e) => e?.code === 'network')) throw new Error('Routing services are unreachable. Check your connection and retry.');
    throw new Error(errors.find((e) => e?.message)?.message || 'No swap route currently available.');
  }

  // Best route = most USD value delivered to the user.
  quotes.sort((a, b) => (b.toAmountUsd ?? 0) - (a.toAmountUsd ?? 0));
  const best = quotes[0];

  if (best.totalCostPct > MAX_COST_PCT) {
    const small = (best.fromAmountUsd ?? 0) < 25;
    throw new Error(
      `Best available route would cost ${best.totalCostPct.toFixed(1)}% in fees and slippage, so it was blocked to protect you.` +
        (small ? ' Fixed network fees weigh heavily on small swaps; try a larger amount.' : ' Liquidity for this pair is thin right now.')
    );
  }
  if (best.totalCostPct > WARN_COST_PCT) {
    best.warning = `This route costs ${best.totalCostPct.toFixed(1)}% in fees and slippage.`;
  }
  quoteCache.set(cacheKey, { at: Date.now(), quote: best });
  return best;
}

function createEmptyQuote(fromAsset: Asset, toAsset: Asset): SwapQuote {
  return {
    fromAsset,
    toAsset,
    fromAmount: '0',
    toAmount: '0',
    exchangeRate: 0,
    priceImpact: 0,
    relayFeeUsd: 0,
    estimatedGasUsd: 0,
    estimatedTimeSeconds: 3,
    isTwoStepNIM: false,
    steps: [],
    minReceived: '0',
    fromAmountUsd: 0,
    toAmountUsd: 0,
    provider: '',
    quotedAt: Date.now(),
    totalCostPct: 0,
  };
}
