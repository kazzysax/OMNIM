import React, { useState } from 'react';
import { WalletState } from '../types';
import { X, Copy, Check, Wallet } from 'lucide-react';

interface WalletDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletState;
  onConnectEvm?: () => void;
}

export const WalletDetailsModal: React.FC<WalletDetailsModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onConnectEvm,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (type: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] p-5 shadow-2xl overflow-y-auto text-slate-900 border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden p-[1px] bg-slate-100 border border-slate-200">
              <img src="/omnim-logo.jpg" alt="OMNIM" className="w-full h-full object-cover rounded-full" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Accounts</h3>
              <p className="text-xs text-slate-400">Connected Wallets</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nimiq Account */}
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-700 font-bold">Nimiq Address</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
              NIM
            </span>
          </div>
          <div className="font-mono text-xs text-slate-800 break-all select-all font-medium py-1">
            {wallet.nimiqAddress || 'Not connected'}
          </div>
          <button
            onClick={() => wallet.nimiqAddress && handleCopy('nim', wallet.nimiqAddress)}
            className="mt-2 text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-white border border-slate-200 shadow-sm active:scale-95 transition-all"
          >
            {copiedType === 'nim' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedType === 'nim' ? 'Copied' : 'Copy Address'}</span>
          </button>
        </div>

        {/* EVM Universal Account */}
        <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-700 font-bold">EVM Address</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
              Polygon / Multi-Chain
            </span>
          </div>
          <div className="font-mono text-xs text-slate-800 break-all select-all font-medium py-1">
            {wallet.evmAddress || 'Not connected'}
          </div>
          {wallet.evmAddress ? (
            <button
              onClick={() => handleCopy('evm', wallet.evmAddress!)}
              className="mt-2 text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-white border border-slate-200 shadow-sm active:scale-95 transition-all"
            >
              {copiedType === 'evm' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedType === 'evm' ? 'Copied' : 'Copy Address'}</span>
            </button>
          ) : (
            <button
              onClick={onConnectEvm}
              className="mt-2 text-xs font-bold text-white flex items-center gap-1.5 py-2 px-3 rounded-xl bg-[#1C1C1E] hover:bg-black shadow-md active:scale-95 transition-all"
            >
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <span>Connect EVM Wallet</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
