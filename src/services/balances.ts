import { Asset } from '../types';
import { CHAIN_RPC_MAP } from './nimiqWallet';

/**
 * Batched balance reads.
 *
 * One Multicall3 `aggregate3` eth_call returns every token balance on a chain in
 * a single request, so the app makes one RPC call per chain instead of one per
 * asset. Multicall3 is deployed at the same address on every chain OMNIM supports.
 */

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const AGGREGATE3 = '0x82ad56cb';
const BALANCE_OF = '0x70a08231';
const GET_ETH_BALANCE = '0x4d2301cc';
const RPC_TIMEOUT_MS = 6000;

const NATIVE_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000001010',
]);

export const isNativeAddress = (address: string) => !address || NATIVE_ADDRESSES.has(address.toLowerCase());

const pad32 = (hex: string) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const word = (n: number | bigint) => BigInt(n).toString(16).padStart(64, '0');

/** ABI-encode aggregate3([(target, allowFailure=true, callData)]) */
function encodeAggregate3(calls: { target: string; data: string }[]): string {
  const bodies = calls.map(({ target, data }) => {
    const bytes = data.replace(/^0x/, '');
    const padded = bytes.padEnd(Math.ceil(bytes.length / 64) * 64, '0');
    return pad32(target) + word(1) + word(0x60) + word(bytes.length / 2) + padded;
  });
  let offset = calls.length * 32;
  const offsets = bodies.map((b) => {
    const o = word(offset);
    offset += b.length / 2;
    return o;
  });
  return AGGREGATE3 + word(0x20) + word(calls.length) + offsets.join('') + bodies.join('');
}

/** Decode aggregate3 result into one (success, uint256-from-returnData) per call. */
function decodeAggregate3(hex: string, count: number): (bigint | null)[] {
  const data = hex.replace(/^0x/, '');
  const readWord = (byteOffset: number) => BigInt('0x' + (data.slice(byteOffset * 2, byteOffset * 2 + 64) || '0'));
  const arrayStart = Number(readWord(0));
  const length = Number(readWord(arrayStart));
  if (length !== count) throw new Error('Unexpected multicall result length');
  const elementsStart = arrayStart + 32;

  return Array.from({ length }, (_, i) => {
    const tupleStart = elementsStart + Number(readWord(elementsStart + i * 32));
    const success = readWord(tupleStart) === 1n;
    const bytesStart = tupleStart + Number(readWord(tupleStart + 32));
    const bytesLen = Number(readWord(bytesStart));
    if (!success || bytesLen < 32) return null;
    return readWord(bytesStart + 32);
  });
}

async function rpcCall(url: string, to: string, data: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error || typeof json.result !== 'string') throw new Error(json.error?.message || 'bad rpc result');
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Balances (human units) for every given asset on one chain, keyed by asset id.
 * An asset is omitted when its individual call failed, so callers keep the previous
 * value instead of showing a false zero. Returns null if every RPC failed.
 */
export async function fetchChainBalances(
  chainId: number,
  owner: string,
  assets: Pick<Asset, 'id' | 'contractAddress' | 'decimals'>[]
): Promise<Record<string, number> | null> {
  const rpcs = (CHAIN_RPC_MAP[chainId] || []).slice(0, 3);
  if (rpcs.length === 0 || assets.length === 0) return null;

  const ownerPadded = pad32(owner);
  const calls = assets.map((a) =>
    isNativeAddress(a.contractAddress)
      ? { target: MULTICALL3, data: GET_ETH_BALANCE + ownerPadded }
      : { target: a.contractAddress, data: BALANCE_OF + ownerPadded }
  );
  const payload = encodeAggregate3(calls);

  let raw: string;
  try {
    raw = await Promise.any(rpcs.map((url) => rpcCall(url, MULTICALL3, payload)));
  } catch {
    return null;
  }

  const values = decodeAggregate3(raw, assets.length);
  const out: Record<string, number> = {};
  assets.forEach((a, i) => {
    const v = values[i];
    if (v !== null) out[a.id] = Number(v) / Math.pow(10, a.decimals);
  });
  return out;
}
