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

  const isTwoStepNIM = fromAsset.symbol === 'NIM';
  const isFromBnbStock = fromAsset.category === 'stocks' && fromAsset.chainId === 56;
  const isToBnbStock = toAsset.category === 'stocks' && toAsset.chainId === 56;
  const fromValueUsd = parsedFromAmount * fromAsset.priceUsd;

  let originChainId = fromAsset.chainId;
  let originCurrency = fromAsset.contractAddress.startsWith('0x')
    ? fromAsset.contractAddress
    : '0x0000000000000000000000000000000000000000';

  let relayAmount = toAtomicUnits(parsedFromAmount, fromAsset.decimals);

  if (isTwoStepNIM) {
    // Leg 1: NIM -> Polygon USDC (Fastspot / Oasis anchor)
    // Leg 2: Polygon USDC -> Destination Asset via Relay Link
    originChainId = 137;
    originCurrency = POLYGON_USDC_ADDRESS;
    relayAmount = Math.floor(fromValueUsd * 1_000_000).toString();
  } else if (isFromBnbStock) {
    // Selling BNB tokenized stock/commodity: routes via BSC-USD
    originChainId = 56;
    originCurrency = BSC_USD_ADDRESS;
    relayAmount = Math.floor(fromValueUsd * 1e18).toString();
  }

  const destinationChainId = toAsset.chainId === 0 ? 137 : toAsset.chainId;
  let destinationCurrency = toAsset.contractAddress.startsWith('0x')
    ? toAsset.contractAddress
    : '0x0000000000000000000000000000000000000000';

  if (isToBnbStock) {
    // Buying BNB tokenized stock/commodity: Relay routes into BSC-USD on BNB Chain
    destinationCurrency = BSC_USD_ADDRESS;
  }

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
    const errorMsg = errorJson.message || `Relay Mainnet route returned HTTP ${res.status}`;
    throw new Error(`Relay Mainnet: ${errorMsg}`);
  }

  relayQuoteData = await res.json();

  if (relayQuoteData.fees?.gas?.amountUsd) {
    estimatedGasUsd = parseFloat(relayQuoteData.fees.gas.amountUsd) || 0;
  }
  if (relayQuoteData.fees?.relayer?.amountUsd) {
    relayFeeUsd = parseFloat(relayQuoteData.fees.relayer.amountUsd) || 0;
  }
  if (relayQuoteData.details?.totalImpact?.percent) {
    priceImpact = Math.abs(parseFloat(relayQuoteData.details.totalImpact.percent)) || 0;
  }
  if (relayQuoteData.details?.timeEstimate) {
    timeEstimate = relayQuoteData.details.timeEstimate + (isTwoStepNIM ? 10 : 0);
  }

  if (isToBnbStock) {
    const totalUsdOut = parseFloat(relayQuoteData.details?.currencyOut?.amountFormatted || fromValueUsd.toString());
    const units = totalUsdOut / toAsset.priceUsd;
    formattedToAmount = units > 1000 ? units.toFixed(2) : units > 1 ? units.toFixed(4) : units.toFixed(6);
  } else if (relayQuoteData.details?.currencyOut?.amountFormatted) {
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

  const steps: RouteStep[] = [];
  if (isTwoStepNIM) {
    steps.push({
      step: 1,
      title: 'Leg 1: NIM ➔ Polygon USDC',
      description: `Atomic swap of ${parsedFromAmount.toLocaleString()} NIM to ~$${fromValueUsd.toFixed(2)} USDC via Nimiq Fastspot`,
      protocol: 'Nimiq FastSpot',
      status: 'pending',
      chainName: 'Nimiq',
    });
    steps.push({
      step: 2,
      title: `Leg 2: Relay Bridge ➔ ${toAsset.name} (BNB Chain)`,
      description: `Relay Link execution on BNB Smart Chain delivering ${toAsset.symbol}`,
      protocol: 'Relay Protocol',
      status: 'pending',
      chainName: 'BNB Smart Chain',
    });
  } else if (isToBnbStock) {
    steps.push({
      step: 1,
      title: `Relay Bridge (${fromAsset.symbol} ➔ BNB Smart Chain)`,
      description: `Cross-chain execution settling on BNB Smart Chain (Chain ID: 56)`,
      protocol: 'Relay Protocol',
      status: 'pending',
      chainName: 'BNB Smart Chain',
    });
    steps.push({
      step: 2,
      title: `Acquire ${toAsset.symbol} on BNB Chain`,
      description: `Credit ${formattedToAmount} ${toAsset.symbol} shares to your BNB address`,
      protocol: 'BNB Smart Chain (BEP-20)',
      status: 'pending',
      chainName: 'BNB Smart Chain',
    });
  } else {
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
    isTwoStepNIM,
    steps,
    minReceived,
    relayTxData: relayQuoteData?.steps || null,
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
  };
}
