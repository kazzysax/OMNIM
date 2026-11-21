import React, { useState, useEffect, useRef } from 'react';
import { Asset, SwapQuote, WalletState } from '../types';
import { getSwapQuote, QUOTE_TTL_MS } from '../services/routing';
import { executeEvmTransaction, waitForEvmReceipt } from '../services/nimiqWallet';
import { AssetSelectorModal } from './AssetSelectorModal';
import { OmnimLogoAnimation } from './OmnimLogoAnimation';
import {
  X,
  ArrowDownUp,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  initialFromAsset?: Asset;
  initialToAsset?: Asset;
  wallet: WalletState;
  onSwapSuccess: (
    fromAsset: Asset,
    toAsset: Asset,
    fromAmount: number,
    toAmount: number,
    txHash?: string,
    isTwoStepNIM?: boolean
  ) => void;
}

export const SwapModal: React.FC<SwapModalProps> = ({
  isOpen,
  onClose,
  assets,
  initialFromAsset,
  initialToAsset,
  wallet,
  onSwapSuccess,
}) => {
  const defaultFrom = initialFromAsset || assets.find((a) => a.id === 'usdc-polygon') || assets[0];
  const defaultTo = initialToAsset || assets.find((a) => a.id === 'xaut-bnb') || assets[1];

  const [fromAsset, setFromAsset] = useState<Asset>(defaultFrom);
  const [toAsset, setToAsset] = useState<Asset>(defaultTo);
  const [fromAmount, setFromAmount] = useState<string>('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);

  const [isSelectingFrom, setIsSelectingFrom] = useState<boolean>(false);
  const [isSelectingTo, setIsSelectingTo] = useState<boolean>(false);

  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionStatusText, setExecutionStatusText] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const quoteRef = useRef<SwapQuote | null>(null);
  quoteRef.current = quote;

  useEffect(() => {
    if (initialFromAsset) setFromAsset(initialFromAsset);
    if (initialToAsset) setToAsset(initialToAsset);
  }, [initialFromAsset, initialToAsset]);

  // Keep the quote fresh while the sheet is open (prices and gas move).
  useEffect(() => {
    if (!isOpen || isExecuting) return;
    // Li.Fi quotes are not auto-refreshed (free tier is ~75 requests / 2h); they re-quote on confirm if stale.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && quoteRef.current && !quoteRef.current.provider.startsWith('Li.Fi')) {
        setRefreshTick((t) => t + 1);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [isOpen, isExecuting]);

  useEffect(() => {
    let active = true;

    const parsed = parseFloat(fromAmount) || 0;
    if (parsed <= 0) {
      setQuote(null);
      setErrorMsg(null);
      setIsLoadingQuote(false);
      return;
    }

    if (fromAsset.hasSwapLiquidity === false) {
      setQuote(null);
      setErrorMsg(`${fromAsset.symbol} has low DEX liquidity on ${fromAsset.chain}. Swapping from this asset is currently unavailable.`);
      setIsLoadingQuote(false);
      return;
    }

    if (toAsset.hasSwapLiquidity === false) {
      setQuote(null);
      setErrorMsg(`${toAsset.symbol} has low DEX liquidity on ${toAsset.chain}. Swapping to this asset is currently unavailable.`);
      setIsLoadingQuote(false);
      return;
    }

    if (refreshTick === 0 || !quote) setIsLoadingQuote(true);
    setErrorMsg(null);

    const debounceTimer = setTimeout(async () => {
      try {
        const q = await getSwapQuote(fromAsset, toAsset, fromAmount, wallet.evmAddress || undefined);
        if (active) {
          setQuote(q);
          setErrorMsg(null);
        }
      } catch (err: any) {
        if (active) {
          setQuote(null);
          const rawMsg = err.message || '';
          if (rawMsg.toLowerCase().includes('failed to fetch') || rawMsg.toLowerCase().includes('networkerror')) {
            setErrorMsg('Network quote service temporarily slow. Retrying in background...');
          } else if (rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('429')) {
            setErrorMsg('Routing network currently busy. Please wait a moment or adjust the amount.');
          } else {
            setErrorMsg(rawMsg || 'Mainnet route quotation failed.');
          }
        }
      } finally {
        if (active) setIsLoadingQuote(false);
      }
    }, 700);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
    };
  }, [fromAsset, toAsset, fromAmount, wallet.evmAddress, refreshTick]);

  if (!isOpen) return null;

  const parsedFromAmount = parseFloat(fromAmount) || 0;
  const isInsufficient = parsedFromAmount > fromAsset.userBalance;

  // Gas buffer for native gas tokens (POL, BNB, ETH, AVAX)
  const isNativePaying =
    !fromAsset.contractAddress ||
    fromAsset.contractAddress === '0x0000000000000000000000000000000000000000' ||
    fromAsset.contractAddress === '0x0000000000000000000000000000000000001010';

  const gasBuffer = isNativePaying
    ? fromAsset.chainId === 137
      ? 0.08 // Polygon: reserve 0.08 POL
      : fromAsset.chainId === 56
        ? 0.002 // BSC: reserve 0.002 BNB
        : 0.001 // Base/Arb/OP/AVAX
    : 0;

  const maxSpendable = isNativePaying
    ? Math.max(0, parseFloat((fromAsset.userBalance - gasBuffer).toFixed(4)))
    : fromAsset.userBalance;

  const isExceedingGasReserve =
    isNativePaying &&
    parsedFromAmount > maxSpendable &&
    parsedFromAmount <= fromAsset.userBalance;

  const handleSwitchAssets = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
  };

  const handleExecuteSwap = async () => {
    if (!quote || parsedFromAmount <= 0) return;

    // Never sign a stale quote: refresh first and make the user confirm the new numbers.
    if (Date.now() - quote.quotedAt > QUOTE_TTL_MS) {
      setIsLoadingQuote(true);
      try {
        const fresh = await getSwapQuote(fromAsset, toAsset, fromAmount, wallet.evmAddress || undefined);
        setQuote(fresh);
        setErrorMsg('Quote refreshed with current prices. Review it and tap swap again.');
      } catch (e: any) {
        setQuote(null);
        setErrorMsg(e.message || 'Could not refresh the quote.');
      } finally {
        setIsLoadingQuote(false);
      }
      return;
    }

    setIsExecuting(true);
    setErrorMsg(null);
    setIsSuccess(false);

    try {
      let lastTxHash: string | undefined;

      // Origin is an EVM chain (Polygon, BNB Chain, Base, Arbitrum, ...)
      {
        if (!quote.relayTxData || !Array.isArray(quote.relayTxData) || quote.relayTxData.length === 0) {
          throw new Error('No executable transaction route returned for this token pair.');
        }

        const totalSteps = quote.relayTxData.length;

        for (let i = 0; i < quote.relayTxData.length; i++) {
          const step = quote.relayTxData[i];
          if (step.items && step.items.length > 0) {
            for (let j = 0; j < step.items.length; j++) {
              const item = step.items[j];
              if (item.data) {
                setExecutionStatusText(`Step ${i + 1}/${totalSteps}: Please confirm transaction in your wallet...`);
                const txHash = await executeEvmTransaction({
                  to: item.data.to,
                  data: item.data.data,
                  value: item.data.value,
                  from: wallet.evmAddress || undefined,
                  chainId: fromAsset.chainId,
                });

                if (txHash) {
                  lastTxHash = txHash;
                  const shortHash = `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;
                  setExecutionStatusText(`Broadcasted (${shortHash}). Waiting for on-chain block confirmation...`);

                  // 1. Wait for block inclusion on origin chain
                  await waitForEvmReceipt(txHash, fromAsset.chainId);

                  // 2. If cross-chain, show relay progress
                  if (fromAsset.chainId !== toAsset.chainId) {
                    setExecutionStatusText(`Confirmed on ${fromAsset.chain}! Relaying cross-chain to ${toAsset.chain}...`);
                    await new Promise((resolve) => setTimeout(resolve, 4000));
                  }
                }
              }
            }
          }
        }

      }

      setIsSuccess(true);
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      setExecutionStatusText(
        fromAsset.chainId === toAsset.chainId
          ? `Swap confirmed. About ${quote.toAmount} ${toAsset.symbol} received.`
          : `Submitted. About ${quote.toAmount} ${toAsset.symbol} will arrive on ${toAsset.chain} shortly.`
      );

      onSwapSuccess(
        fromAsset,
        toAsset,
        parsedFromAmount,
        parseFloat(quote.toAmount) || 0,
        lastTxHash,
        false
      );

      setTimeout(() => {
        setIsExecuting(false);
        setIsSuccess(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Swap transaction was rejected or failed on-chain.');
      setIsExecuting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] p-5 shadow-2xl overflow-hidden text-slate-900">

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-bold text-slate-900">Mainnet Swap</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {quote?.provider.split(' ')[0] ?? 'Best route'}
              </span>
            </div>
            <button
              onClick={onClose}
              disabled={isExecuting}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>You Pay</span>
                <div className="flex items-center gap-1.5">
                  <span>Balance: {fromAsset.userBalance > 0 ? (fromAsset.userBalance > 1000 ? fromAsset.userBalance.toLocaleString() : fromAsset.userBalance.toFixed(4)) : '0.00'} {fromAsset.symbol}</span>
                  {fromAsset.userBalance > 0 && (
                    <button
                      type="button"
                      disabled={isExecuting}
                      onClick={() => setFromAmount(maxSpendable > 0 ? maxSpendable.toString() : '0')}
                      className="px-1.5 py-0.2 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold transition-colors"
                    >
                      MAX
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.0"
                  disabled={isExecuting}
                  className="w-full bg-transparent text-xl font-bold text-slate-900 placeholder-slate-400 focus:outline-none font-mono"
                />

                <button
                  type="button"
                  onClick={() => setIsSelectingFrom(true)}
                  disabled={isExecuting}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-900 font-bold text-xs shadow-sm shrink-0 hover:bg-slate-50 transition-colors"
                >
                  {fromAsset.logoUrl ? (
                    <img src={fromAsset.logoUrl} alt={fromAsset.symbol} className="w-4 h-4 object-contain rounded-full" />
                  ) : (
                    <span>{fromAsset.icon}</span>
                  )}
                  <span>{fromAsset.symbol}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>

              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">
                  ≈ ${quote?.fromAmountUsd ? quote.fromAmountUsd.toFixed(2) : (parsedFromAmount * fromAsset.priceUsd).toFixed(2)} USD ({fromAsset.chain})
                </span>
                {fromAsset.hasSwapLiquidity === false && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
                    Swaps unavailable
                  </span>
                )}
              </div>
            </div>

            {isExceedingGasReserve && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between">
                <span>Reserving ~{gasBuffer} {fromAsset.symbol} for gas fees.</span>
                <button
                  type="button"
                  onClick={() => setFromAmount(maxSpendable.toString())}
                  className="font-bold underline text-amber-900 hover:text-amber-950 ml-2 shrink-0"
                >
                  Set {maxSpendable}
                </button>
              </div>
            )}

            <div className="flex justify-center -my-1 z-10 relative">
              <button
                type="button"
                onClick={handleSwitchAssets}
                disabled={isExecuting}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
              >
                <ArrowDownUp className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>You Receive</span>
                <span className="text-[10px] text-slate-400">{toAsset.chain}</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-xl font-bold text-slate-900 font-mono">
                  {isLoadingQuote ? (
                    <span className="text-slate-400 animate-pulse text-sm">Quoting Route...</span>
                  ) : (
                    quote?.toAmount || '0.00'
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsSelectingTo(true)}
                  disabled={isExecuting}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-900 font-bold text-xs shadow-sm shrink-0 hover:bg-slate-50 transition-colors"
                >
                  {toAsset.logoUrl ? (
                    <img src={toAsset.logoUrl} alt={toAsset.symbol} className="w-4 h-4 object-contain rounded-full" />
                  ) : (
                    <span>{toAsset.icon}</span>
                  )}
                  <span>{toAsset.symbol}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>

              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">
                  ≈ ${quote?.toAmountUsd ? quote.toAmountUsd.toFixed(2) : (parseFloat(quote?.toAmount || '0') * toAsset.priceUsd).toFixed(2)} USD ({toAsset.chain})
                </span>
                {toAsset.hasSwapLiquidity === false && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
                    Swaps unavailable
                  </span>
                )}
              </div>
            </div>

            {quote && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span>Route</span>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-700 font-semibold">
                    {quote.provider} · {fromAsset.chain === toAsset.chain ? fromAsset.chain : `${fromAsset.chain} ➔ ${toAsset.chain}`}
                  </span>
                </div>
                {toAsset.symbol === 'NIM' && wallet.nimiqAddress && (
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span>NIM Destination</span>
                    <span className="font-mono text-[10px] text-slate-700">
                      {wallet.nimiqAddress.slice(0, 8)}...{wallet.nimiqAddress.slice(-6)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Rate</span>
                  <span className="font-mono text-slate-700">
                    1 {fromAsset.symbol} ≈ {quote.exchangeRate < 0.001 ? quote.exchangeRate.toExponential(2) : quote.exchangeRate.toFixed(4)} {toAsset.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total cost (fees + slippage)</span>
                  <span className={`font-mono font-medium ${quote.totalCostPct > 1.5 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {quote.totalCostPct < 0.01 ? '< 0.01%' : `${quote.totalCostPct.toFixed(2)}%`}
                  </span>
                </div>
                {quote.relayFeeUsd + quote.estimatedGasUsd > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Network + router fees</span>
                    <span className="font-mono text-slate-700">≈ ${(quote.relayFeeUsd + quote.estimatedGasUsd).toFixed(3)}</span>
                  </div>
                )}
                {quote.warning && <div className="text-amber-600 font-medium">⚠ {quote.warning}</div>}
                <div className="flex items-center justify-between">
                  <span>Min. Received</span>
                  <span className="font-mono text-slate-700">{quote.minReceived} {toAsset.symbol}</span>
                </div>
              </div>
            )}

            {isExecuting && (
              <div className="py-4 px-3 rounded-2xl bg-gradient-to-b from-[#0F1015] to-[#1A1C24] text-white flex flex-col items-center justify-center gap-3 shadow-lg border border-amber-500/20 animate-in fade-in zoom-in-95 duration-200">
                <OmnimLogoAnimation mode="loop" size={48} showGlow={true} />
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#FCE1C9]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                    <span>Settling Swap on Chain</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono truncate max-w-[280px]">
                    {executionStatusText}
                  </p>
                </div>
              </div>
            )}

            {isSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-xs text-emerald-700 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Swap Successful!</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-50 text-xs text-red-600">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleExecuteSwap}
              disabled={isExecuting || isInsufficient || parsedFromAmount <= 0 || fromAsset.hasSwapLiquidity === false || toAsset.hasSwapLiquidity === false || !quote}
              className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-wide shadow-md transition-all active:scale-[0.98] ${fromAsset.hasSwapLiquidity === false || toAsset.hasSwapLiquidity === false
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed shadow-none'
                  : isInsufficient
                    ? 'bg-red-50 text-red-500 cursor-not-allowed'
                    : parsedFromAmount <= 0 || !quote
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#1C1C1E] text-white hover:bg-black'
                }`}
            >
              {fromAsset.hasSwapLiquidity === false || toAsset.hasSwapLiquidity === false
                ? 'Swap unavailable'
                : isInsufficient
                  ? 'Insufficient Balance'
                  : isExecuting
                    ? 'Executing Swap...'
                    : `Swap ${fromAsset.symbol} to ${toAsset.symbol}`}
            </button>
          </div>
        </div>
      </div>

      <AssetSelectorModal
        isOpen={isSelectingFrom}
        onClose={() => setIsSelectingFrom(false)}
        assets={assets}
        selectedAsset={fromAsset}
        onSelect={setFromAsset}
        title="Pay With"
        excludeAssetId={toAsset.id}
        isSwapContext={true}
      />

      <AssetSelectorModal
        isOpen={isSelectingTo}
        onClose={() => setIsSelectingTo(false)}
        assets={assets}
        selectedAsset={toAsset}
        onSelect={setToAsset}
        title="Receive Asset"
        excludeAssetId={fromAsset.id}
        isSwapContext={true}
      />
    </>
  );
};
