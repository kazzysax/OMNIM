import React, { useState } from 'react';
import { Asset, WalletState } from '../types';
import { executeNimTransfer, executeEvmTransaction, waitForEvmReceipt } from '../services/nimiqWallet';
import { toAtomicUnits } from '../services/relay';
import { X, CheckCircle2, ChevronDown, Clock, AlertCircle } from 'lucide-react';
import { AssetSelectorModal } from './AssetSelectorModal';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  wallet: WalletState;
  onSendSuccess: (asset: Asset, amount: number, txHash?: string, recipient?: string) => void;
}

export const SendModal: React.FC<SendModalProps> = ({
  isOpen,
  onClose,
  assets,
  wallet,
  onSendSuccess,
}) => {
  const [selectedAsset, setSelectedAsset] = useState<Asset>(assets[0]);
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [isSelectingAsset, setIsSelectingAsset] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const isInsufficient = parsedAmount > selectedAsset.userBalance;

  // Gas buffer for native gas tokens (POL, BNB, ETH)
  const isNative =
    !selectedAsset.contractAddress ||
    selectedAsset.contractAddress === '0x0000000000000000000000000000000000000000' ||
    selectedAsset.contractAddress === '0x0000000000000000000000000000000000001010';

  const gasBuffer = isNative
    ? selectedAsset.chainId === 137
      ? 0.05 // Polygon: reserve 0.05 POL
      : selectedAsset.chainId === 56
        ? 0.002 // BSC: reserve 0.002 BNB
        : 0.001 // Base/Arb
    : 0;

  const maxSpendable = isNative
    ? Math.max(0, parseFloat((selectedAsset.userBalance - gasBuffer).toFixed(4)))
    : selectedAsset.userBalance;

  const handleMaxClick = () => {
    setAmount(maxSpendable > 0 ? maxSpendable.toString() : '0');
  };

  const handleSend = async () => {
    const trimmedRecipient = recipient.trim();
    if (!trimmedRecipient || parsedAmount <= 0) return;

    setIsSending(true);
    setIsError(false);
    setStatusMessage('Preparing transaction...');
    let finalTxHash: string | undefined;

    try {
      if (selectedAsset.symbol === 'NIM') {
        if (!trimmedRecipient.toLowerCase().startsWith('nq')) {
          throw new Error('Please enter a valid Nimiq address starting with NQ.');
        }

        setStatusMessage('Signing in Nimiq Pay...');
        finalTxHash = await executeNimTransfer({
          recipient: trimmedRecipient,
          valueInLuna: Math.round(parsedAmount * 100000),
        });
      } else {
        // EVM Address Validation
        if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedRecipient)) {
          throw new Error('Please enter a valid 0x EVM address (42 characters).');
        }

        setStatusMessage(`Switching wallet to ${selectedAsset.chain}...`);

        if (isNative) {
          // Native token transfer (e.g. POL on Polygon, BNB on BSC, ETH on Base)
          const rawAtomic = toAtomicUnits(parsedAmount, selectedAsset.decimals);
          const valueHex = '0x' + BigInt(rawAtomic).toString(16);

          setStatusMessage(`Please confirm sending ${parsedAmount} ${selectedAsset.symbol} on ${selectedAsset.chain}...`);
          finalTxHash = await executeEvmTransaction({
            to: trimmedRecipient,
            value: valueHex,
            data: '0x',
            chainId: selectedAsset.chainId,
            from: wallet.evmAddress || undefined,
          });
        } else {
          // ERC-20 token transfer: transfer(address to, uint256 value) -> selector 0xa9059cbb
          const rawAtomic = toAtomicUnits(parsedAmount, selectedAsset.decimals);
          const cleanRecipient = trimmedRecipient.toLowerCase().replace('0x', '').padStart(64, '0');
          const amountHex = BigInt(rawAtomic).toString(16).padStart(64, '0');
          const calldata = '0xa9059cbb' + cleanRecipient + amountHex;

          setStatusMessage(`Please confirm sending ${parsedAmount} ${selectedAsset.symbol} on ${selectedAsset.chain}...`);
          finalTxHash = await executeEvmTransaction({
            to: selectedAsset.contractAddress,
            value: '0x0',
            data: calldata,
            chainId: selectedAsset.chainId,
            from: wallet.evmAddress || undefined,
          });
        }

        if (finalTxHash) {
          const shortHash = `${finalTxHash.slice(0, 6)}...${finalTxHash.slice(-4)}`;
          setStatusMessage(`Transaction submitted (${shortHash}). Confirming on ${selectedAsset.chain}...`);
          await waitForEvmReceipt(finalTxHash, selectedAsset.chainId);
        }
      }

      setIsSuccess(true);
      setStatusMessage(`Sent ${parsedAmount} ${selectedAsset.symbol}!`);
      onSendSuccess(selectedAsset, parsedAmount, finalTxHash, trimmedRecipient);

      setTimeout(() => {
        setIsSending(false);
        setIsSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(err.message || 'Transaction failed or was rejected in your wallet.');
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] p-5 shadow-2xl overflow-hidden text-slate-900">

          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Send</h3>
            <button
              onClick={onClose}
              disabled={isSending}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">Asset</div>
                <div className="text-xs font-medium text-slate-600">
                  {selectedAsset.userBalance} {selectedAsset.symbol} available
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSelectingAsset(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-900 font-bold text-xs shadow-sm"
              >
                {selectedAsset.logoUrl ? (
                  <img src={selectedAsset.logoUrl} alt={selectedAsset.symbol} className="w-4 h-4 object-contain rounded-full" />
                ) : (
                  <span>{selectedAsset.icon}</span>
                )}
                <span>{selectedAsset.symbol}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <label className="block text-[11px] text-slate-400 mb-1">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={selectedAsset.symbol === 'NIM' ? 'NQ...' : '0x...'}
                className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-mono"
              />
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Amount</span>
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="text-slate-900 font-bold hover:underline"
                >
                  Max
                </button>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-transparent text-lg font-bold text-slate-900 placeholder-slate-400 focus:outline-none font-mono"
              />
            </div>

            {statusMessage && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${isError
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : isSuccess
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}
              >
                {isSending && <Clock className="w-3.5 h-3.5 animate-spin text-slate-900 shrink-0" />}
                {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                {isError && <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                <span className="break-all">{statusMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || isInsufficient || !recipient || parsedAmount <= 0}
              className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-wide shadow-md transition-all active:scale-[0.98] ${isInsufficient
                ? 'bg-red-50 text-red-500 cursor-not-allowed'
                : !recipient || parsedAmount <= 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#1C1C1E] text-white hover:bg-black'
                }`}
            >
              {isInsufficient ? 'Insufficient Balance' : isSending ? 'Sending...' : `Send ${selectedAsset.symbol}`}
            </button>
          </div>
        </div>
      </div>

      <AssetSelectorModal
        isOpen={isSelectingAsset}
        onClose={() => setIsSelectingAsset(false)}
        assets={assets}
        selectedAsset={selectedAsset}
        onSelect={setSelectedAsset}
        title="Select Asset"
      />
    </>
  );
};
