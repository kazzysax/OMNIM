#!/usr/bin/env node
/**
 * Verifies every asset in a registry file against live infrastructure:
 *
 *   1. On-chain: the contract exists and its decimals() match the registry.
 *   2. Routing: a $20 buy, a $200 buy and a $20 sell all return a quote from
 *      Relay and/or Li.Fi whose total cost (per the routers' own USD values)
 *      stays within the limits below.
 *
 * Usage:
 *   node scripts/verify-assets.mjs                      verify src/config/assets.registry.json
 *   node scripts/verify-assets.mjs candidates.json --write verified.json
 *
 * Exit code is 1 when any asset fails, so this can run in CI.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const VALUE_FLAGS = ['--write', '--routers', '--checks', '--concurrency'];
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const outPath = opt('--write', null);
const inPath = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1])) ?? resolve(here, '../src/config/assets.registry.json');
// Router order mirrors the app: Relay first, Li.Fi only as a fallback (Li.Fi's free tier is ~75 requests / 2h per IP).
const ROUTERS = opt('--routers', 'relay,lifi').split(',');
const CHECKS = opt('--checks', 'buy20,buy200,sell20').split(',');

const LIMITS = { buy20: 2.5, buy200: 3.5, sell20: 3.5, minCost: -1.0 }; // percent of value lost
const USER = '0x14F34A56dD53e8B88364103c4DB8f231206b2245'; // any address; quotes do not need a balance
const ZERO = '0x0000000000000000000000000000000000000000';

const RPC = {
  1: 'https://ethereum-rpc.publicnode.com',
  10: 'https://optimism-rpc.publicnode.com',
  56: 'https://bsc-rpc.publicnode.com',
  137: 'https://polygon-bor-rpc.publicnode.com',
  8453: 'https://base-rpc.publicnode.com',
  42161: 'https://arbitrum-one-rpc.publicnode.com',
  43114: 'https://avalanche-c-chain-rpc.publicnode.com',
};
// Stablecoin used as the other side of every test swap on each chain.
const STABLE = {
  1: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  10: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
  56: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  137: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
  8453: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  42161: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
  43114: { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const atomic = (amount, decimals) => {
  const [w, f = ''] = amount.toFixed(Math.min(decimals, 12)).split('.');
  return ((w + f.padEnd(decimals, '0').slice(0, decimals)).replace(/^0+/, '') || '0');
};

async function rpc(chainId, method, params) {
  const res = await fetch(RPC[chainId], {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return (await res.json()).result;
}

async function checkOnChain(a) {
  if (a.address === ZERO || a.native) return { ok: true, note: 'native' };
  const code = await rpc(a.chainId, 'eth_getCode', [a.address, 'latest']);
  if (!code || code === '0x') return { ok: false, note: 'no contract at address' };
  const dec = await rpc(a.chainId, 'eth_call', [{ to: a.address, data: '0x313ce567' }, 'latest']);
  const onchain = dec && dec !== '0x' ? parseInt(dec, 16) : null;
  if (onchain !== null && onchain !== a.decimals) return { ok: false, note: `decimals ${onchain} != registry ${a.decimals}` };
  return { ok: true, note: 'contract ok' };
}

const pct = (inUsd, outUsd) => (inUsd > 0 ? ((inUsd - outUsd) / inUsd) * 100 : NaN);

async function relayQuote(fromChain, toChain, fromToken, toToken, amount) {
  const res = await fetch('https://api.relay.link/quote/v2', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: USER, originChainId: fromChain, destinationChainId: toChain, originCurrency: fromToken, destinationCurrency: toToken, amount, tradeType: 'EXACT_INPUT', slippageTolerance: '100' }),
  });
  const d = await res.json().catch(() => ({}));
  const out = d.details?.currencyOut;
  if (!res.ok || !out) return { ok: false, err: String(d.message ?? res.status).slice(0, 60) };
  const inUsd = parseFloat(d.details.currencyIn?.amountUsd);
  const outUsd = parseFloat(out.amountUsd);
  if (!(inUsd > 0) || !(outUsd >= 0)) return { ok: false, err: 'no USD values' };
  return { ok: true, cost: pct(inUsd, outUsd) };
}

async function lifiQuote(fromChain, toChain, fromToken, toToken, amount) {
  const q = new URLSearchParams({ fromChain, toChain, fromToken, toToken, fromAmount: amount, fromAddress: USER, slippage: '0.005' });
  const res = await fetch(`https://li.quest/v1/quote?${q}`);
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.estimate) return { ok: false, err: String(d.message ?? res.status).slice(0, 60) };
  const inUsd = parseFloat(d.estimate.fromAmountUSD);
  const outUsd = parseFloat(d.estimate.toAmountUSD);
  if (!(inUsd > 0) || !(outUsd >= 0)) return { ok: false, err: 'no USD values' };
  return { ok: true, cost: pct(inUsd, outUsd) };
}

const QUOTERS = { relay: relayQuote, lifi: lifiQuote };
const GOOD_ENOUGH_PCT = 1.0; // skip the fallback router when the first one is already this cheap

/** Quote with routers in order; fall back to the next one on failure or when the cost is above GOOD_ENOUGH_PCT. */
async function bestQuote(chain, from, to, amount) {
  const results = [];
  for (const name of ROUTERS) {
    const r = await QUOTERS[name](chain, chain, from, to, amount);
    await sleep(300);
    results.push({ ...r, name });
    if (r.ok && r.cost <= GOOD_ENOUGH_PCT) break;
  }
  const good = results.filter((r) => r.ok);
  if (!good.length) return { ok: false, err: results.map((r) => `${r.name}: ${r.err}`).join(' | ') };
  const best = good.reduce((m, r) => (r.cost < m.cost ? r : m));
  return { ok: true, cost: best.cost, via: best.name };
}

async function checkRouting(a) {
  const st = STABLE[a.chainId];
  if (!st) return { ok: false, note: `no stablecoin configured for chain ${a.chainId}` };
  const addr = a.address === ZERO ? ZERO : a.address;
  if (addr.toLowerCase() === st.address.toLowerCase()) return { ok: true, note: 'is the test stablecoin' };

  const checks = [];
  const price = a.priceUsd > 0 ? a.priceUsd : 1;
  for (const c of CHECKS) {
    if (checks.length && !checks.at(-1)[1].ok) break; // already failing, save quota
    if (c === 'buy20') checks.push(['buy $20', await bestQuote(a.chainId, st.address, addr, atomic(20, st.decimals)), LIMITS.buy20]);
    if (c === 'buy200') checks.push(['buy $200', await bestQuote(a.chainId, st.address, addr, atomic(200, st.decimals)), LIMITS.buy200]);
    if (c === 'sell20') checks.push(['sell $20', await bestQuote(a.chainId, addr, st.address, atomic(20 / price, a.decimals)), LIMITS.sell20]);
  }

  const failures = [];
  const costs = [];
  for (const [label, r, limit] of checks) {
    if (!r.ok) failures.push(`${label}: ${r.err}`);
    else if (r.cost > limit) failures.push(`${label}: cost ${r.cost.toFixed(1)}% > ${limit}%`);
    else if (r.cost < LIMITS.minCost) failures.push(`${label}: suspicious ${r.cost.toFixed(1)}% (router price stale)`);
    else costs.push(`${label} ${r.cost.toFixed(2)}% via ${r.via}`);
  }
  return failures.length ? { ok: false, note: failures.join('; ') } : { ok: true, note: costs.join(', ') };
}

const CONCURRENCY = Number(opt('--concurrency', 4)) || 4;
const registry = JSON.parse(readFileSync(inPath, 'utf8'));
const results = new Array(registry.length);

async function verifyOne(a) {
  let chain, routing;
  try {
    chain = await checkOnChain(a);
    if (!chain.ok) routing = { ok: false, note: '' };
    else if (a.native) routing = a.chainId in STABLE ? await checkRouting({ ...a, address: ZERO }) : { ok: true, note: 'native gas token' };
    else routing = await checkRouting(a);
  } catch (e) {
    chain = { ok: false, note: `error: ${e.message}` };
    routing = { ok: false, note: '' };
  }
  return { ok: chain.ok && routing.ok, line: [chain.note, routing.note].filter(Boolean).join(' | ') };
}

let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < registry.length) {
      const i = next++;
      const a = registry[i];
      results[i] = await verifyOne(a);
      console.log(`${results[i].ok ? 'PASS' : 'FAIL'}  ${String(a.chainId).padStart(5)}  ${a.symbol.padEnd(8)} ${results[i].line}`);
    }
  })
);

const verified = registry.filter((_, i) => results[i].ok);
const failed = registry.length - verified.length;
console.log(`\n${verified.length} passed, ${failed} failed of ${registry.length}`);
if (outPath) {
  writeFileSync(outPath, JSON.stringify(verified, null, 2) + '\n');
  console.log(`wrote ${outPath}`);
}
process.exit(failed ? 1 : 0);
