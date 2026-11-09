import React, { useState } from 'react';
import { Asset, WalletState } from '../types';
import { executeNimTransfer, executeEvmTransaction } from '../services/nimiqWallet';
import { X, CheckCircle2, ChevronDown, Clock } from 'lucide-react';
import { AssetSelectorModal } from './AssetSelectorModal';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  wallet: WalletState;
  onSendSuccess: (asset: Asset, amount: number) => void;
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
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const isInsufficient = parsedAmount > selectedAsset.userBalance;

  const handleSend = async () => {
    if (!recipient || parsedAmount <= 0) return;
    setIsSending(true);
    setStatusMessage('Preparing transaction...');

    try {
      if (selectedAsset.symbol === 'NIM') {
        setStatusMessage('Signing in Nimiq Pay...');
        await executeNimTransfer({
          recipient,
          valueInLuna: Math.floor(parsedAmount * 100000),
        });
      } else {
        setStatusMessage(`Submitting on ${selectedAsset.chain}...`);
        await executeEvmTransaction({
          to: recipient,
          from: wallet.evmAddress || undefined,
        });
      }

      setIsSuccess(true);
      setStatusMessage(`Sent ${parsedAmount} ${selectedAsset.symbol}!`);
      onSendSuccess(selectedAsset, parsedAmount);

      setTimeout(() => {
        setIsSending(false);
        setIsSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      setStatusMessage(err.message || 'Transaction failed.');
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
                  onClick={() => setAmount(selectedAsset.userBalance.toString())}
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
              <div className="p-2.5 rounded-xl bg-slate-100 text-xs text-slate-700 flex items-center gap-2">
                {isSending && <Clock className="w-3.5 h-3.5 animate-spin text-slate-900" />}
                {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                <span>{statusMessage}</span>
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
