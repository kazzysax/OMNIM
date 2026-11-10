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

  // =========================================================================
  // ROUTE CASE 1: SWAPPING TO NIM (Destination is Nimiq L1)
  // =========================================================================
  if (isToNim) {
    const isPolygonStable =
      fromAsset.chainId === 137 && (fromAsset.symbol === 'USDC' || fromAsset.symbol === 'USDT');

    if (isPolygonStable) {
      // Direct 1-Step Fastspot Atomic Swap
      const fastspotFrom = fromAsset.symbol === 'USDT' ? 'USDT_MATIC' : 'USDC_MATIC';
      const fastspotData = await fetchFastspotEstimate(fastspotFrom, 'NIM', parsedFromAmount);

      let outNim = 0;
      if (fastspotData && fastspotData.toAmount > 0) {
        outNim = fastspotData.toAmount;
      } else {
        // High-fidelity fallback using market price minus 0.25% Fastspot fee
        const nimPrice = toAsset.priceUsd > 0 ? toAsset.priceUsd : 0.00285;
        outNim = ((parsedFromAmount * fromAsset.priceUsd) / nimPrice) * (1 - 0.0025);
      }

      const formattedToAmount = outNim > 1000 ? outNim.toFixed(2) : outNim.toFixed(4);
      const exchangeRate = parsedFromAmount > 0 ? outNim / parsedFromAmount : 0;
      const numToAmount = parseFloat(formattedToAmount) || 0;

      return {
        fromAsset,
        toAsset,
        fromAmount,
        toAmount: formattedToAmount,
        exchangeRate,
        priceImpact: 0.25,
        relayFeeUsd: 0,
        estimatedGasUsd: 0.001,
        estimatedTimeSeconds: 15,
        isTwoStepNIM: false,
        steps: [
          {
            step: 1,
            title: 'Fastspot Atomic Swap',
            description: `Direct non-custodial swap: Polygon ${fromAsset.symbol} ➔ Nimiq (NIM)`,
            protocol: 'Fastspot',
            status: 'pending',
            chainName: 'Polygon',
          },
        ],
        minReceived: (numToAmount * 0.995).toFixed(2),
        relayTxData: null,
        fromAmountUsd: parsedFromAmount * fromAsset.priceUsd,
        toAmountUsd: numToAmount * (toAsset.priceUsd || 0.00285),
      };
    } else {
      // 2-Step Route: Relay routes EVM Token ➔ Polygon USDC, then Fastspot routes Polygon USDC ➔ NIM
      const relayAmount = toAtomicUnits(parsedFromAmount, fromAsset.decimals);
      const originChainId = fromAsset.chainId;
      const originCurrency = fromAsset.contractAddress.startsWith('0x')
        ? fromAsset.contractAddress
        : '0x0000000000000000000000000000000000000000';

      const res = await fetch(`${RELAY_API_BASE}/quote/v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userEvmAddress,
          originChainId,
          destinationChainId: 137,
          originCurrency,
          destinationCurrency: POLYGON_USDC_ADDRESS,
          amount: relayAmount,
          tradeType: 'EXACT_INPUT',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const rawErr = errJson.message || `HTTP ${res.status}`;
        if (rawErr.toLowerCase().includes('fee exceeds') || rawErr.toLowerCase().includes('amount too low')) {
          throw new Error('Swap amount is too low to cover cross-chain relayer gas fees. Try swapping at least ~$0.50.');
        }
        throw new Error(`Relay Mainnet: ${rawErr}`);
      }

      const relayData = await res.json();
      const usdcFormatted = relayData.details?.currencyOut?.amountFormatted || '0';
      const usdcNum = parseFloat(usdcFormatted) || 0;

      if (usdcNum <= 0) {
        throw new Error('Relay Protocol was unable to route swap to Polygon USDC for Fastspot conversion.');
      }

      // Fastspot conversion from resulting Polygon USDC to NIM
      const fastspotData = await fetchFastspotEstimate('USDC_MATIC', 'NIM', usdcNum);
      let outNim = 0;
      if (fastspotData && fastspotData.toAmount > 0) {
        outNim = fastspotData.toAmount;
      } else {
        const nimPrice = toAsset.priceUsd > 0 ? toAsset.priceUsd : 0.00285;
        outNim = ((usdcNum * 1.0) / nimPrice) * (1 - 0.0025);
      }

      const formattedToAmount = outNim > 1000 ? outNim.toFixed(2) : outNim.toFixed(4);
      const exchangeRate = parsedFromAmount > 0 ? outNim / parsedFromAmount : 0;
      const numToAmount = parseFloat(formattedToAmount) || 0;
      const relayFeeUsd = parseFloat(relayData.fees?.relayer?.amountUsd || '0') || 0;
      const estimatedGasUsd = parseFloat(relayData.fees?.gas?.amountUsd || '0') || 0;
      const relayImpact = Math.abs(parseFloat(relayData.details?.swapImpact?.percent || '0')) || 0;

      const steps: RouteStep[] = [];
      if (relayData.steps && Array.isArray(relayData.steps)) {
        relayData.steps.forEach((s: any, idx: number) => {
          steps.push({
            step: idx + 1,
            title: s.description || `Step ${idx + 1}: Swap to Polygon USDC`,
            description: s.action || `Execute transaction on ${fromAsset.chain}`,
            protocol: 'Relay Protocol',
            status: 'pending',
            chainName: fromAsset.chain,
          });
        });
      } else {
        steps.push({
          step: 1,
          title: `Relay Swap (${fromAsset.symbol} ➔ Polygon USDC)`,
          description: `Swaps ${parsedFromAmount} ${fromAsset.symbol} to ${usdcNum.toFixed(4)} Polygon USDC`,
          protocol: 'Relay Protocol',
          status: 'pending',
          chainName: fromAsset.chain,
        });
      }

      steps.push({
        step: steps.length + 1,
        title: 'Fastspot Atomic Swap (Polygon USDC ➔ NIM)',
        description: `Atomic swap ${usdcNum.toFixed(4)} USDC into ~${formattedToAmount} NIM via Fastspot`,
        protocol: 'Fastspot',
        status: 'pending',
        chainName: 'Polygon',
      });

      return {
        fromAsset,
        toAsset,
        fromAmount,
        toAmount: formattedToAmount,
        exchangeRate,
        priceImpact: relayImpact + 0.25,
        relayFeeUsd,
        estimatedGasUsd,
        estimatedTimeSeconds: (relayData.details?.timeEstimate || 5) + 15,
        isTwoStepNIM: true,
        steps,
        minReceived: (numToAmount * 0.99).toFixed(2),
        relayTxData: relayData.steps || null,
        fromAmountUsd: parsedFromAmount * fromAsset.priceUsd,
        toAmountUsd: numToAmount * (toAsset.priceUsd || 0.00285),
      };
    }
  }

  // =========================================================================
  // ROUTE CASE 2: SWAPPING FROM NIM (Origin is Nimiq L1)
  // =========================================================================
  if (isFromNim) {
    const isPolygonStable =
      toAsset.chainId === 137 && (toAsset.symbol === 'USDC' || toAsset.symbol === 'USDT');

    if (isPolygonStable) {
      // Direct Fastspot Atomic Swap: NIM ➔ Polygon USDC/USDT
      const fastspotTo = toAsset.symbol === 'USDT' ? 'USDT_MATIC' : 'USDC_MATIC';
      const fastspotData = await fetchFastspotEstimate('NIM', fastspotTo, parsedFromAmount);

      let outStable = 0;
      if (fastspotData && fastspotData.toAmount > 0) {
        outStable = fastspotData.toAmount;
      } else {
        outStable = (parsedFromAmount * fromAsset.priceUsd) * (1 - 0.0025);
      }

      const formattedToAmount = outStable.toFixed(4);
      const exchangeRate = parsedFromAmount > 0 ? outStable / parsedFromAmount : 0;
      const numToAmount = parseFloat(formattedToAmount) || 0;

      return {
        fromAsset,
        toAsset,
        fromAmount,
        toAmount: formattedToAmount,
        exchangeRate,
        priceImpact: 0.25,
        relayFeeUsd: 0,
        estimatedGasUsd: 0.001,
        estimatedTimeSeconds: 15,
        isTwoStepNIM: false,
        steps: [
          {
            step: 1,
            title: 'Fastspot Atomic Swap',
            description: `Atomic swap ${parsedFromAmount} NIM ➔ Polygon ${toAsset.symbol} via Fastspot`,
            protocol: 'Fastspot',
            status: 'pending',
            chainName: 'Nimiq Network',
          },
        ],
        minReceived: (numToAmount * 0.995).toFixed(4),
        relayTxData: null,
        fromAmountUsd: parsedFromAmount * fromAsset.priceUsd,
        toAmountUsd: numToAmount * toAsset.priceUsd,
      };
    } else {
      // 2-Step Route: Fastspot routes NIM ➔ Polygon USDC, then Relay routes Polygon USDC ➔ Destination EVM Token
      const fastspotData = await fetchFastspotEstimate('NIM', 'USDC_MATIC', parsedFromAmount);
      let interimUsdc = 0;
      if (fastspotData && fastspotData.toAmount > 0) {
        interimUsdc = fastspotData.toAmount;
      } else {
        interimUsdc = (parsedFromAmount * fromAsset.priceUsd) * (1 - 0.0025);
      }

      const relayAmount = toAtomicUnits(interimUsdc, 6); // Polygon USDC has 6 decimals
      const destinationCurrency = toAsset.contractAddress.startsWith('0x')
        ? toAsset.contractAddress
        : '0x0000000000000000000000000000000000000000';

      const res = await fetch(`${RELAY_API_BASE}/quote/v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userEvmAddress,
          originChainId: 137,
          destinationChainId: toAsset.chainId,
          originCurrency: POLYGON_USDC_ADDRESS,
          destinationCurrency,
          amount: relayAmount,
          tradeType: 'EXACT_INPUT',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`Relay Mainnet: ${errJson.message || `HTTP ${res.status}`}`);
      }

      const relayData = await res.json();
      const formattedToAmount = relayData.details?.currencyOut?.amountFormatted || '0';
      const numToAmount = parseFloat(formattedToAmount) || 0;
      const exchangeRate = parsedFromAmount > 0 ? numToAmount / parsedFromAmount : 0;
      const relayFeeUsd = parseFloat(relayData.fees?.relayer?.amountUsd || '0') || 0;
      const estimatedGasUsd = parseFloat(relayData.fees?.gas?.amountUsd || '0') || 0;
      const relayImpact = Math.abs(parseFloat(relayData.details?.swapImpact?.percent || '0')) || 0;

      return {
        fromAsset,
        toAsset,
        fromAmount,
        toAmount: formattedToAmount,
        exchangeRate,
        priceImpact: relayImpact + 0.25,
        relayFeeUsd,
        estimatedGasUsd,
        estimatedTimeSeconds: (relayData.details?.timeEstimate || 5) + 15,
        isTwoStepNIM: true,
        steps: [
          {
            step: 1,
            title: 'Fastspot Atomic Swap',
            description: `NIM ➔ ${interimUsdc.toFixed(4)} Polygon USDC`,
            protocol: 'Fastspot',
            status: 'pending',
            chainName: 'Nimiq Network',
          },
          {
            step: 2,
            title: `Relay Bridge (Polygon USDC ➔ ${toAsset.symbol})`,
            description: `Executes cross-chain route on ${toAsset.chain}`,
            protocol: 'Relay Protocol',
            status: 'pending',
            chainName: toAsset.chain,
          },
        ],
        minReceived: (numToAmount * 0.99).toFixed(4),
        relayTxData: relayData.steps || null,
        fromAmountUsd: parsedFromAmount * fromAsset.priceUsd,
        toAmountUsd: numToAmount * toAsset.priceUsd,
      };
    }
  }

  // =========================================================================
  // ROUTE CASE 3: EVM TO EVM (Polygon, BSC, Base, Arbitrum)
  // =========================================================================

  // Guard against assets flagged with no DEX liquidity pool
  if (toAsset.hasSwapLiquidity === false) {
    throw new Error(
      `${toAsset.symbol} does not currently have active DEX liquidity on Relay Protocol (${toAsset.chain}). Live liquid assets include TSLA, NVDA, MSFT, AMZN, USDT, USDC, POL, BNB, ETH, and CAKE.`
    );
  }
  if (fromAsset.hasSwapLiquidity === false) {
    throw new Error(
      `${fromAsset.symbol} does not currently have active DEX liquidity on Relay Protocol (${fromAsset.chain}).`
    );
  }

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
        `Relay Protocol currently does not have active DEX liquidity for ${toAsset.symbol} on ${toAsset.chain}. Live liquid assets include TSLA, NVDA, MSFT, USDT, USDC, POL, BNB, ETH, and CAKE.`
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
    fromAmount,
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
