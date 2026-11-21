import { Asset } from '../types';

/**
 * Live prices.
 *
 *  - Majors with a CoinGecko id (NIM, BNB, ETH, POL, AVAX, ARB, OP, BTC, USDT) come from one
 *    batched CoinGecko call, which also provides a 24h change.
 *  - Everything else (tokenized stocks, gold, fiat tokens, long-tail crypto) is priced by
 *    Relay's token price endpoint, the same source Relay uses to value swap quotes, so the
 *    price shown matches the USD values in a quote. Relay has no 24h change, so it is
 *    derived from price samples stored on this device.
 *
 * Li.Fi is deliberately not used here: its free tier allows ~75 requests per 2 hours,
 * which must be kept for swap quotes.
 */

const COINGECKO_SIMPLE = 'https://api.coingecko.com/api/v3/simple/price';
const RELAY_PRICE = 'https://api.relay.link/currencies/token/price/v2';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const COINGECKO_IDS: Record<string, string> = {
  NIM: 'nimiq',
  BNB: 'binancecoin',
  ETH: 'ethereum',
  POL: 'polygon-ecosystem-token',
  AVAX: 'avalanche-2',
  ARB: 'arbitrum',
  OP: 'optimism',
  BTCB: 'bitcoin',
  WBTC: 'bitcoin',
  cbBTC: 'bitcoin',
  USDT: 'tether',
};

export interface LivePrice {
  priceUsd: number;
  change24h: number;
  source: 'coingecko' | 'relay';
}

/** Ignore a new price that jumps further than this from the last accepted one (thin-pool glitches). */
const MAX_JUMP = 0.35;

const HISTORY_KEY = 'omnim_price_history_v1';
const HISTORY_SAMPLE_MS = 30 * 60 * 1000;
const HISTORY_KEEP_MS = 27 * 60 * 60 * 1000;
const MIN_AGE_FOR_CHANGE_MS = 20 * 60 * 60 * 1000;

type History = Record<string, [number, number][]>; // id -> [timestamp, price][]

function loadHistory(): History {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveHistory(h: History) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {
    /* storage unavailable: change24h simply stays 0 */
  }
}

/** Record a sample (at most one per 30 min) and return the 24h change in % if we have ~a day of data. */
function trackHistory(history: History, id: string, price: number, now: number): { change24h: number; sparkline?: number[] } {
  const samples = (history[id] || []).filter(([t]) => now - t <= HISTORY_KEEP_MS);
  const last = samples[samples.length - 1];
  if (!last || now - last[0] >= HISTORY_SAMPLE_MS) samples.push([now, price]);
  history[id] = samples;

  const oldest = samples[0];
  const sparkline = samples.length >= 3 ? samples.map(([, p]) => p) : undefined;
  if (!oldest || now - oldest[0] < MIN_AGE_FOR_CHANGE_MS || oldest[1] <= 0) return { change24h: 0, sparkline };
  return { change24h: parseFloat((((price - oldest[1]) / oldest[1]) * 100).toFixed(2)), sparkline };
}

async function fetchJson(url: string, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCoinGeckoMajors(): Promise<Record<string, { usd: number; change: number }>> {
  const ids = Array.from(new Set(Object.values(COINGECKO_IDS))).join(',');
  const data = await fetchJson(`${COINGECKO_SIMPLE}?ids=${ids}&vs_currencies=usd&include_24hr_change=true`, 4000);
  const out: Record<string, { usd: number; change: number }> = {};
  if (data) {
    for (const [id, v] of Object.entries<any>(data)) {
      if (typeof v?.usd === 'number' && v.usd > 0) out[id] = { usd: v.usd, change: typeof v.usd_24h_change === 'number' ? v.usd_24h_change : 0 };
    }
  }
  return out;
}

async function fetchRelayPrice(asset: Asset): Promise<number | null> {
  const native = !asset.contractAddress || asset.contractAddress.toLowerCase() === '0x0000000000000000000000000000000000001010';
  const address = native ? ZERO_ADDRESS : asset.contractAddress;
  const data = await fetchJson(`${RELAY_PRICE}?chainId=${asset.chainId}&address=${address}`, 4000);
  const price = data ? parseFloat(data.price) : NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** Run async work over items with a small concurrency limit. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

/**
 * Fetch live prices for `assets`. Returns a map keyed by asset id; assets whose price could not
 * be fetched (or looked wrong) are omitted so the caller keeps its previous value.
 */
export async function fetchLivePrices(assets: Asset[]): Promise<Record<string, LivePrice & { sparkline?: number[] }>> {
  const now = Date.now();
  const history = loadHistory();
  const out: Record<string, LivePrice & { sparkline?: number[] }> = {};

  const accept = (asset: Asset, price: number) => !(asset.priceUsd > 0 && Math.abs(price - asset.priceUsd) / asset.priceUsd > MAX_JUMP);

  const withCoinGecko = assets.filter((a) => COINGECKO_IDS[a.symbol]);
  const rest = assets.filter((a) => !COINGECKO_IDS[a.symbol]);

  const [majors, relayPrices] = await Promise.all([
    withCoinGecko.length ? fetchCoinGeckoMajors() : Promise.resolve({}),
    mapLimit(rest, 4, async (a) => ({ a, price: await fetchRelayPrice(a) })),
  ]);

  for (const a of withCoinGecko) {
    const m = (majors as Record<string, { usd: number; change: number }>)[COINGECKO_IDS[a.symbol]];
    if (m && accept(a, m.usd)) out[a.id] = { priceUsd: m.usd, change24h: parseFloat(m.change.toFixed(2)), source: 'coingecko' };
  }

  for (const { a, price } of relayPrices) {
    if (price === null || !accept(a, price)) continue;
    const { change24h, sparkline } = trackHistory(history, a.id, price, now);
    out[a.id] = { priceUsd: price, change24h, source: 'relay', sparkline };
  }

  saveHistory(history);
  return out;
}
