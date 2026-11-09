import { Asset, SwapQuote, RouteStep } from '../types';

const RELAY_API_BASE = 'https://api.relay.link';
const BSC_USD_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // BSC-USD Tether on BNB Chain
const POLYGON_USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // Native Polygon USDC

export function toAtomicUnits(amount: string | number, decimals: number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num <= 0) return '0';
  const factor = Math.pow(10, decimals);
  return Math.floor(num * factor).toString();
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

  // 1. Guard against native NIM on EVM Relay Protocol
  if (fromAsset.symbol === 'NIM' || toAsset.symbol === 'NIM') {
    throw new Error(
      'Native NIM operates on the Nimiq Layer-1 network. Relay Protocol routes EVM-to-EVM assets (Polygon, BSC, Base, Arbitrum). To swap to/from native NIM, use the official Nimiq Wallet or Nimiq Pay.'
    );
  }

  // 2. Guard against assets with no active DEX liquidity pool
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

  // 3. Prevent same-token swap error on Relay
  if (
    fromAsset.id === toAsset.id ||
    (fromAsset.chainId === toAsset.chainId &&
      fromAsset.contractAddress.toLowerCase() === toAsset.contractAddress.toLowerCase())
  ) {
    throw new Error('Cannot swap an asset for itself. Please choose a different destination asset.');
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
  let timeEstimate = isTwoStepNIM ? 12 : 3;

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
      tradeType: 'EXACT_INPUT'
    })
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

  // Pure AMM DEX Swap Impact (slippage vs pool depth)
  // This avoids conflating fixed cross-chain relayer gas fees with price impact
  if (relayQuoteData.details?.swapImpact?.percent) {
    priceImpact = Math.abs(parseFloat(relayQuoteData.details.swapImpact.percent)) || 0;
  } else if (relayQuoteData.details?.totalImpact?.percent) {
    priceImpact = Math.abs(parseFloat(relayQuoteData.details.totalImpact.percent)) || 0;
  }

  if (relayQuoteData.details?.timeEstimate) {
    timeEstimate = relayQuoteData.details.timeEstimate + (isTwoStepNIM ? 10 : 0);
  }

  // 100% Genuine, on-chain executable output amount directly from Relay DEX router
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
    isTwoStepNIM: fromAsset.symbol === 'NIM',
    steps: [],
    minReceived: '0',
    fromAmountUsd: 0,
    toAmountUsd: 0,
  };
}
