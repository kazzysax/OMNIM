import React, { useState, useEffect } from 'react';
import { Asset, SwapQuote, WalletState } from '../types';
import { getSwapQuote } from '../services/relay';
import { executeEvmTransaction } from '../services/nimiqWallet';
import { AssetSelectorModal } from './AssetSelectorModal';
import { OmnimLogoAnimation } from './OmnimLogoAnimation';
import {
  X,
  ArrowDownUp,
  CheckCircle2,
  Clock,
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
  onSwapSuccess: (fromAsset: Asset, toAsset: Asset, fromAmount: number, toAmount: number) => void;
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
  const defaultFrom = initialFromAsset || assets.find((a) => a.symbol === 'USDC') || assets[0];
  const defaultTo = initialToAsset || assets.find((a) => a.symbol === 'bTSLA') || assets.find((a) => a.symbol === 'bGOLD') || assets[1];

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

  useEffect(() => {
    if (initialFromAsset) setFromAsset(initialFromAsset);
    if (initialToAsset) setToAsset(initialToAsset);
  }, [initialFromAsset, initialToAsset]);

  useEffect(() => {
    let active = true;

    async function fetchQuote() {
      if (!fromAsset || !toAsset) return;
      setIsLoadingQuote(true);
      setErrorMsg(null);

      try {
        const q = await getSwapQuote(fromAsset, toAsset, fromAmount, wallet.evmAddress || undefined);
        if (active) {
          setQuote(q);
        }
      } catch (err: any) {
        if (active) {
          setQuote(null);
          setErrorMsg(err.message || 'Mainnet route quotation failed.');
        }
      } finally {
        if (active) setIsLoadingQuote(false);
      }
    }

    fetchQuote();

    return () => {
      active = false;
    };
  }, [fromAsset, toAsset, fromAmount, wallet.evmAddress]);

  if (!isOpen) return null;

  const parsedFromAmount = parseFloat(fromAmount) || 0;
  const isInsufficient = parsedFromAmount > fromAsset.userBalance;

  const handleSwitchAssets = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
  };

  const handleExecuteSwap = async () => {
    if (!quote || parsedFromAmount <= 0) return;
    setIsExecuting(true);
    setErrorMsg(null);
    setIsSuccess(false);

    try {
      if (quote.isTwoStepNIM) {
        throw new Error('NIM cross-chain bridging requires Nimiq Pay built-in Fastspot service. Please bridge NIM to Polygon USDC first or swap EVM assets directly on Mainnet.');
      }

      if (!quote.relayTxData || !Array.isArray(quote.relayTxData) || quote.relayTxData.length === 0) {
        throw new Error('No executable transaction route returned by Relay Protocol Mainnet for this token pair.');
      }

      for (let i = 0; i < quote.relayTxData.length; i++) {
        const step = quote.relayTxData[i];
        if (step.items && step.items.length > 0) {
          for (let j = 0; j < step.items.length; j++) {
            const item = step.items[j];
            if (item.data) {
              setExecutionStatusText(`Step ${i + 1}/${quote.relayTxData.length}: ${step.description || 'Confirm in Wallet'}...`);
              await executeEvmTransaction({
                to: item.data.to,
                data: item.data.data,
                value: item.data.value,
                from: wallet.evmAddress || undefined,
                chainId: fromAsset.chainId,
              });
            }
          }
        }
      }

      setIsSuccess(true);
      setExecutionStatusText('Swap completed successfully on-chain!');
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });

      onSwapSuccess(fromAsset, toAsset, parsedFromAmount, parseFloat(quote.toAmount) || 0);

      setTimeout(() => {
        setIsExecuting(false);
        setIsSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Swap transaction was rejected or failed.');
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
                Relay Link
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
                <span>Balance: {fromAsset.userBalance.toLocaleString()} {fromAsset.symbol}</span>
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

              <div className="mt-1 text-[11px] text-slate-400 font-medium">
                ≈ ${(parsedFromAmount * fromAsset.priceUsd).toFixed(2)} USD ({fromAsset.chain})
              </div>
            </div>

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
                    <span className="text-slate-400 animate-pulse text-sm">Quoting Relay...</span>
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

              <div className="mt-1 text-[11px] text-slate-400 font-medium">
                ≈ ${(parseFloat(quote?.toAmount || '0') * toAsset.priceUsd).toFixed(2)} USD ({toAsset.chain})
              </div>
            </div>

            {quote && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 space-y-1">
                {quote.isTwoStepNIM ? (
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span>Route</span>
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      NIM ➔ Polygon USDC ➔ {toAsset.symbol}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span>Relay Bridge</span>
                    <span className="font-mono text-[10px]">{fromAsset.chain} ➔ {toAsset.chain}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Rate</span>
                  <span className="font-mono text-slate-700">
                    1 {fromAsset.symbol} ≈ {quote.exchangeRate < 0.001 ? quote.exchangeRate.toExponential(2) : quote.exchangeRate.toFixed(4)} {toAsset.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Price Impact</span>
                  <span className={`font-mono ${quote.priceImpact > 2 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {quote.priceImpact.toFixed(2)}%
                  </span>
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
              disabled={isExecuting || isInsufficient || parsedFromAmount <= 0}
              className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-wide shadow-md transition-all active:scale-[0.98] ${isInsufficient
                ? 'bg-red-50 text-red-500 cursor-not-allowed'
                : parsedFromAmount <= 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#1C1C1E] text-white hover:bg-black'
                }`}
            >
              {isInsufficient ? 'Insufficient Balance' : isExecuting ? 'Executing Mainnet Swap...' : `Swap ${fromAsset.symbol} to ${toAsset.symbol}`}
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
      />

      <AssetSelectorModal
        isOpen={isSelectingTo}
        onClose={() => setIsSelectingTo(false)}
        assets={assets}
        selectedAsset={toAsset}
        onSelect={setToAsset}
        title="Receive Asset"
        excludeAssetId={fromAsset.id}
      />
    </>
  );
};
