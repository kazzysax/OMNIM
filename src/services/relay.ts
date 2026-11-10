import { Asset, SwapQuote, RouteStep } from '../types';

const RELAY_API_BASE = 'https://api.relay.link';
export const POLYGON_USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // Native Polygon USDC

export function toAtomicUnits(amount: string | number, decimals: number): string {
  const str = typeof amount === 'number' ? amount.toFixed(decimals) : amount.toString().trim();
  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) return '0';
  const parts = str.split('.');
  const whole = parts[0] || '0';
  const frac = parts[1] || '';
  const paddedFrac = frac.slice(0, decimals).padEnd(decimals, '0');
  const cleanWhole = whole.replace(/^0+/, '') || '0';
  const combined = (cleanWhole === '0' ? '' : cleanWhole) + paddedFrac;
  return combined.replace(/^0+/, '') || '0';
}

export interface FastspotEstimateResult {
  toAmount: number;
  serviceFeePercentage: number;
}

export async function fetchFastspotEstimate(
  fromSymbol: string,
  toSymbol: string,
  amount: number
): Promise<FastspotEstimateResult | null> {
  if (amount <= 0) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://api.go.fastspot.io/fast/v1/estimates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { [fromSymbol]: amount },
        to: toSymbol,
        includedFees: 'required',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.to && data[0].to[0]?.amount) {
        return {
          toAmount: parseFloat(data[0].to[0].amount) || 0,
          serviceFeePercentage: data[0].serviceFeePercentage ?? 0.0025,
        };
      }
    }
    return null;
  } catch (e) {
    console.warn('Fastspot estimate warning:', e);
    return null;
  }
}

// =========================================================================
// ROUTER ENGINE 1: Li.Fi Multi-DEX & Bridge Aggregator
// (Aggregates PancakeSwap, SushiSwap, Fly, Bitget, OKX, Nordstern, 1inch, Mayan, etc.)
// =========================================================================
export async function fetchLiFiQuote(
  fromAsset: Asset,
  toAsset: Asset,
  parsedFromAmount: number,
  userEvmAddress: string
): Promise<SwapQuote> {
  const url = new URL('https://li.quest/v1/quote');
  url.searchParams.set('fromChain', fromAsset.chainId.toString());
  url.searchParams.set('toChain', toAsset.chainId.toString());

  const fromCurrency = fromAsset.contractAddress.startsWith('0x')
    ? fromAsset.contractAddress
    : '0x0000000000000000000000000000000000000000';
  const toCurrency = toAsset.contractAddress.startsWith('0x')
    ? toAsset.contractAddress
    : '0x0000000000000000000000000000000000000000';

  url.searchParams.set('fromToken', fromCurrency);
  url.searchParams.set('toToken', toCurrency);
  url.searchParams.set('fromAmount', toAtomicUnits(parsedFromAmount, fromAsset.decimals));
  url.searchParams.set('fromAddress', userEvmAddress);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const res = await fetch(url.toString(), { signal: controller.signal });
  clearTimeout(timer);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Li.Fi route error: HTTP ${res.status}`);
  }

  const data = await res.json();
  const rawOut = parseFloat(data.estimate?.toAmount || '0') / Math.pow(10, toAsset.decimals);
  const formattedToAmount = rawOut > 1000 ? rawOut.toFixed(2) : rawOut > 1 ? rawOut.toFixed(4) : rawOut.toFixed(6);

  let estimatedGasUsd = 0;
  if (Array.isArray(data.estimate?.gasCosts)) {
    estimatedGasUsd = data.estimate.gasCosts.reduce(
      (sum: number, g: any) => sum + (parseFloat(g.amountUSD) || 0),
      0
    );
  }

  let relayFeeUsd = 0;
  if (Array.isArray(data.estimate?.feeCosts)) {
    relayFeeUsd = data.estimate.feeCosts.reduce(
      (sum: number, f: any) => sum + (parseFloat(f.amountUSD) || 0),
      0
    );
  }

  const numToAmount = parseFloat(formattedToAmount) || 0;
  const exchangeRate = parsedFromAmount > 0 ? numToAmount / parsedFromAmount : 0;
  const minReceived = data.estimate?.toAmountMin
    ? (parseFloat(data.estimate.toAmountMin) / Math.pow(10, toAsset.decimals)).toFixed(numToAmount > 10 ? 2 : 5)
    : (numToAmount * 0.995).toFixed(numToAmount > 10 ? 2 : 5);

  const fromAmountUsd = parsedFromAmount * fromAsset.priceUsd;
  const toAmountUsd = numToAmount * toAsset.priceUsd;
  const priceImpact =
    fromAmountUsd > 0 && toAmountUsd > 0
      ? Math.max(0, parseFloat((((fromAmountUsd - toAmountUsd) / fromAmountUsd) * 100).toFixed(2)))
      : 0.1;

  const relayTxData: any[] = [];
  const steps: RouteStep[] = [];

  const isNative = fromCurrency === '0x0000000000000000000000000000000000000000';
  const approvalAddress = data.estimate?.approvalAddress;

  // Step 1: Token Approval (if ERC-20 origin)
  if (!isNative && approvalAddress && approvalAddress.startsWith('0x')) {
    const spenderPadded = approvalAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const maxUint256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const approveCalldata = `0x095ea7b3${spenderPadded}${maxUint256}`;

    relayTxData.push({
      id: 'approve',
      description: `Approve ${fromAsset.symbol}`,
      items: [
        {
          status: 'not-started',
          data: {
            to: fromCurrency,
            data: approveCalldata,
            value: '0',
          },
        },
      ],
    });

    steps.push({
      step: 1,
      title: `Approve ${fromAsset.symbol}`,
      description: `Grant router permission to swap ${fromAsset.symbol} on ${fromAsset.chain}`,
      protocol: `Li.Fi (${data.tool || 'Router'})`,
      status: 'pending',
      chainName: fromAsset.chain,
    });
  }

  // Step 2: Swap Transaction
  relayTxData.push({
    id: 'swap',
    description: `Swap ${fromAsset.symbol} to ${toAsset.symbol}`,
    items: [
      {
        status: 'not-started',
        data: {
          to: data.transactionRequest.to,
          data: data.transactionRequest.data,
          value: data.transactionRequest.value || '0',
        },
      },
    ],
  });

  steps.push({
    step: steps.length + 1,
    title: `Swap via Li.Fi (${data.tool || 'Router'})`,
    description: `Execute route on ${fromAsset.chain}`,
    protocol: `Li.Fi (${data.tool || 'Router'})`,
    status: 'pending',
    chainName: fromAsset.chain,
  });

  return {
    fromAsset,
    toAsset,
    fromAmount: parsedFromAmount.toString(),
    toAmount: formattedToAmount,
    exchangeRate,
    priceImpact,
    relayFeeUsd,
    estimatedGasUsd,
    estimatedTimeSeconds: data.estimate?.executionDuration || 5,
    isTwoStepNIM: false,
    steps,
    minReceived,
    relayTxData,
    fromAmountUsd,
    toAmountUsd,
  };
}

// =========================================================================
// ROUTER ENGINE 2: Relay Protocol Cross-Chain DEX Aggregator
// =========================================================================
export async function fetchRelayQuote(
  fromAsset: Asset,
  toAsset: Asset,
  parsedFromAmount: number,
  userEvmAddress: string
): Promise<SwapQuote> {
  const originChainId = fromAsset.chainId;
  const originCurrency = fromAsset.contractAddress.startsWith('0x')
    ? fromAsset.contractAddress
    : '0x0000000000000000000000000000000000000000';

  const destinationChainId = toAsset.chainId;
  const destinationCurrency = toAsset.contractAddress.startsWith('0x')
    ? toAsset.contractAddress
    : '0x0000000000000000000000000000000000000000';

  const relayAmount = toAtomicUnits(parsedFromAmount, fromAsset.decimals);

  let relayQuoteData: any = null;
  let formattedToAmount = '';
  let relayFeeUsd = 0;
  let estimatedGasUsd = 0;
  let priceImpact = 0;
  let timeEstimate = 3;

  const res = await fetch(`${RELAY_API_BASE}/quote/v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: userEvmAddress,
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: relayAmount,
      tradeType: 'EXACT_INPUT',
    }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const rawError = errorJson.message || `HTTP ${res.status}`;

    if (
      rawError.includes('Invalid input or output currency') ||
      errorJson.errorCode === 'INVALID_INPUT_CURRENCY'
    ) {
      throw new Error(
        `Relay Protocol currently does not have active DEX liquidity for ${toAsset.symbol} on ${toAsset.chain}.`
      );
    }

    if (
      rawError.toLowerCase().includes('fee exceeds') ||
      rawError.toLowerCase().includes('amount too low')
    ) {
      throw new Error(
        'Swap amount is too small to cover cross-chain relayer gas fees. Please try swapping at least ~$0.50.'
      );
    }

    if (rawError.includes('Sender and recipient cannot be the same')) {
      throw new Error('This swap route matches origin currency. Please select a different token.');
    }

    throw new Error(`Relay Mainnet: ${rawError}`);
  }

  relayQuoteData = await res.json();

  if (relayQuoteData.fees?.gas?.amountUsd) {
    estimatedGasUsd = parseFloat(relayQuoteData.fees.gas.amountUsd) || 0;
  }
  if (relayQuoteData.fees?.relayer?.amountUsd) {
    relayFeeUsd = parseFloat(relayQuoteData.fees.relayer.amountUsd) || 0;
  }

  if (relayQuoteData.details?.swapImpact?.percent) {
    priceImpact = Math.abs(parseFloat(relayQuoteData.details.swapImpact.percent)) || 0;
  } else if (relayQuoteData.details?.totalImpact?.percent) {
    priceImpact = Math.abs(parseFloat(relayQuoteData.details.totalImpact.percent)) || 0;
  }

  if (relayQuoteData.details?.timeEstimate) {
    timeEstimate = relayQuoteData.details.timeEstimate;
  }

  if (relayQuoteData.details?.currencyOut?.amountFormatted) {
    const outNum = parseFloat(relayQuoteData.details.currencyOut.amountFormatted);
    formattedToAmount = outNum > 1000 ? outNum.toFixed(2) : outNum > 1 ? outNum.toFixed(4) : outNum.toFixed(6);
  } else {
    throw new Error('Relay Mainnet did not return executable output amount.');
  }

  const exchangeRate = parsedFromAmount > 0 ? (parseFloat(formattedToAmount) || 0) / parsedFromAmount : 0;
  const numToAmount = parseFloat(formattedToAmount) || 0;
  const minReceived = relayQuoteData.details?.currencyOut?.minimumAmount
    ? (parseFloat(relayQuoteData.details.currencyOut.minimumAmount) / Math.pow(10, toAsset.decimals)).toFixed(numToAmount > 10 ? 2 : 5)
    : (numToAmount * 0.995).toFixed(numToAmount > 10 ? 2 : 5);

  const fromAmountUsd = relayQuoteData.details?.currencyIn?.amountUsd
    ? parseFloat(relayQuoteData.details.currencyIn.amountUsd)
    : parsedFromAmount * fromAsset.priceUsd;

  const toAmountUsd = relayQuoteData.details?.currencyOut?.amountUsd
    ? parseFloat(relayQuoteData.details.currencyOut.amountUsd)
    : numToAmount * toAsset.priceUsd;

  const steps: RouteStep[] = [];
  if (relayQuoteData.steps && Array.isArray(relayQuoteData.steps)) {
    relayQuoteData.steps.forEach((s: any, idx: number) => {
      steps.push({
        step: idx + 1,
        title: s.description || `Relay Step ${idx + 1}`,
        description: s.action || `Execute transaction on ${fromAsset.chain}`,
        protocol: 'Relay Protocol',
        status: 'pending',
        chainName: fromAsset.chain,
      });
    });
  } else {
    steps.push({
      step: 1,
      title: `Relay Swap (${fromAsset.symbol} ➔ ${toAsset.symbol})`,
      description: `Direct Mainnet execution on ${toAsset.chain}`,
      protocol: 'Relay Protocol',
      status: 'pending',
      chainName: toAsset.chain,
    });
  }

  return {
    fromAsset,
    toAsset,
    fromAmount: parsedFromAmount.toString(),
    toAmount: formattedToAmount,
    exchangeRate,
    priceImpact,
    relayFeeUsd,
    estimatedGasUsd,
    estimatedTimeSeconds: timeEstimate,
    isTwoStepNIM: false,
    steps,
    minReceived,
    relayTxData: relayQuoteData?.steps || null,
    fromAmountUsd,
    toAmountUsd,
  };
}

// =========================================================================
// MAIN ENTRY POINT: Intelligent Multi-Router (Li.Fi + Relay Fallback)
// =========================================================================
export async function getSwapQuote(
  fromAsset: Asset,
  toAsset: Asset,
  fromAmount: string,
  userEvmAddress: string = '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7'
): Promise<SwapQuote> {
  const parsedFromAmount = parseFloat(fromAmount) || 0;

  if (parsedFromAmount <= 0) {
    return createEmptyQuote(fromAsset, toAsset);
  }

  // 1. Prevent same-token swap
  if (
    fromAsset.id === toAsset.id ||
    (fromAsset.chainId === toAsset.chainId &&
      fromAsset.contractAddress.toLowerCase() === toAsset.contractAddress.toLowerCase())
  ) {
    throw new Error('Cannot swap an asset for itself. Please choose a different destination asset.');
  }

  const isFromNim = fromAsset.symbol === 'NIM';
  const isToNim = toAsset.symbol === 'NIM';

  // 2. NIM L1 Swaps (Suspended until Fastspot re-enables Polygon HTLC relayer)
  if (isToNim) {
    throw new Error(
      'Fastspot atomic swaps to native NIM are currently paused on the Nimiq network (Fastspot relayer error: "The handling of USDC on Polygon failed"). Swaps directly to NIM are temporarily suspended to prevent assets from stopping at intermediate Polygon USDC.'
    );
  }

  if (isFromNim) {
    throw new Error(
      'Fastspot atomic swaps from native NIM to EVM chains are currently paused by the Nimiq network. Swaps will resume once Fastspot re-enables Polygon HTLC relayers.'
    );
  }

  // 3. EVM to EVM Intelligent Routing
  // If either asset is on BNB Chain (56), prioritize Li.Fi (deep coverage for bAAPL, bTSLA, bNVDA, bMETA, bGOOGL, bSPY, bQQQ, bCOIN, bGOLD, bSLV, CAKE)
  if (fromAsset.chainId === 56 || toAsset.chainId === 56) {
    try {
      return await fetchLiFiQuote(fromAsset, toAsset, parsedFromAmount, userEvmAddress);
    } catch (lifiErr: any) {
      console.warn('Li.Fi quote failed on BNB Chain, attempting Relay fallback:', lifiErr.message);
      try {
        return await fetchRelayQuote(fromAsset, toAsset, parsedFromAmount, userEvmAddress);
      } catch (relayErr: any) {
        throw new Error(lifiErr.message || relayErr.message);
      }
    }
  }

  // For other EVM routes (e.g. Polygon, Base, Arbitrum), try Relay first, fallback to Li.Fi
  try {
    return await fetchRelayQuote(fromAsset, toAsset, parsedFromAmount, userEvmAddress);
  } catch (relayErr: any) {
    console.warn('Relay route unavailable, attempting Li.Fi router fallback:', relayErr.message);
    try {
      return await fetchLiFiQuote(fromAsset, toAsset, parsedFromAmount, userEvmAddress);
    } catch (lifiErr: any) {
      throw new Error(relayErr.message || lifiErr.message);
    }
  }
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
  };
}
