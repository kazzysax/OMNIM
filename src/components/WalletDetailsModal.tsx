import React, { useState } from 'react';
import { WalletState } from '../types';
import { X, Copy, Check, ShieldCheck, CheckCircle2, Globe, Cpu } from 'lucide-react';

interface WalletDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletState;
}

export const WalletDetailsModal: React.FC<WalletDetailsModalProps> = ({
  isOpen,
  onClose,
  wallet,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (type: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#121318] border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-5 max-h-[90vh] flex flex-col shadow-2xl overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden p-[1px] bg-gradient-to-tr from-[#B88755] to-[#E5B887]">
              <img src="/omnim-logo.jpg" alt="OMNIM" className="w-full h-full object-cover rounded-full" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Nimiq Pay Provider</h3>
              <p className="text-xs text-slate-400">Dual-Chain Runtime Environment</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Runtime Status Card */}
        <div className="mt-4 p-4 rounded-2xl bg-[#181922] border border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#E5B887]" />
              Host Environment
            </span>
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {wallet.isNimiqPayHost ? 'Nimiq Pay Mobile Container' : 'Connected (Preview Runtime)'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#E5B887]" />
              Nimiq PoS Consensus
            </span>
            <span className="font-bold text-white font-mono">
              {wallet.isConsensusEstablished ? 'Established (100%)' : 'Synchronizing'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Current Block Height</span>
            <span className="font-mono text-slate-300">#{wallet.lastBlockHeight}</span>
          </div>
        </div>

        {/* Nimiq Account */}
        <div className="mt-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-semibold">Native Nimiq Address</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#E5B887]/20 text-[#E5B887] font-bold">
              window.nimiq
            </span>
          </div>
          <div className="font-mono text-xs text-white break-all select-all">
            {wallet.nimiqAddress}
          </div>
          <button
            onClick={() => wallet.nimiqAddress && handleCopy('nim', wallet.nimiqAddress)}
            className="mt-2 text-xs text-[#E5B887] hover:underline flex items-center gap-1"
          >
            {copiedType === 'nim' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedType === 'nim' ? 'Copied' : 'Copy Nimiq Address'}</span>
          </button>
        </div>

        {/* EVM Universal Account */}
        <div className="mt-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-semibold">Universal EVM Address</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">
              window.ethereum (EIP-1193)
            </span>
          </div>
          <div className="font-mono text-xs text-white break-all select-all">
            {wallet.evmAddress}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Active on BNB Smart Chain (56), Polygon (137), Base (8453), Arbitrum (42161).
          </div>
          <button
            onClick={() => wallet.evmAddress && handleCopy('evm', wallet.evmAddress)}
            className="mt-2 text-xs text-[#E5B887] hover:underline flex items-center gap-1"
          >
            {copiedType === 'evm' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedType === 'evm' ? 'Copied' : 'Copy EVM Address'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

