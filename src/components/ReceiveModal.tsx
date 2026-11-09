import React, { useState } from 'react';
import { WalletState } from '../types';
import { X, Copy, Check, QrCode } from 'lucide-react';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletState;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({ isOpen, onClose, wallet }) => {
  const [activeTab, setActiveTab] = useState<'evm' | 'nimiq'>('evm');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentAddress = activeTab === 'evm' ? wallet.evmAddress : wallet.nimiqAddress;

  const handleCopy = () => {
    if (currentAddress) {
      navigator.clipboard.writeText(currentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] p-5 shadow-2xl overflow-hidden text-slate-900">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Receive</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl my-3 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('evm')}
            className={`py-1.5 rounded-lg transition-all ${activeTab === 'evm' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
          >
            EVM (BNB Chain, Polygon, Base)
          </button>
          <button
            onClick={() => setActiveTab('nimiq')}
            className={`py-1.5 rounded-lg transition-all ${activeTab === 'nimiq' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
          >
            Nimiq (NIM)
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl mx-auto my-2 flex items-center justify-center w-48 h-48">
          <QrCode className="w-36 h-36 text-slate-900 stroke-[1.5]" />
        </div>

        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
          <div className="font-mono text-xs text-slate-800 break-all select-all font-medium">
            {currentAddress}
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="mt-3 w-full py-3 rounded-xl bg-[#1C1C1E] text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied' : 'Copy Address'}</span>
        </button>
      </div>
    </div>
  );
};
