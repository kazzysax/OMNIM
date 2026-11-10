import React, { useState } from 'react';
import { TransactionRecord } from '../types';
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Trash2
} from 'lucide-react';

interface TransactionHistoryViewProps {
  transactions: TransactionRecord[];
  polygonUsdcBalance?: number;
  onClearHistory: () => void;
  onOpenSwap: () => void;
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({
  transactions,
  onClearHistory,
  onOpenSwap,
}) => {
  const [filter, setFilter] = useState<'all' | 'swap' | 'transfer'>('all');

  const filtered = transactions.filter((tx) => {
    if (filter === 'all') return true;
    if (filter === 'swap') return tx.type === 'swap';
    if (filter === 'transfer') return tx.type === 'send' || tx.type === 'receive';
    return true;
  });

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full px-4 pt-3 pb-24 space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Activity</h2>
          <p className="text-[12px] text-slate-500">Past transactions & cross-chain operations</p>
        </div>

        {transactions.length > 0 && (
          <button
            onClick={onClearHistory}
            title="Clear history"
            className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 border border-slate-300/40 text-xs font-semibold">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${filter === 'all'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
            }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('swap')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${filter === 'swap'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
            }`}
        >
          Swaps
        </button>
        <button
          onClick={() => setFilter('transfer')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${filter === 'transfer'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
            }`}
        >
          Transfers
        </button>
      </div>

      {/* Transactions List */}
      {filtered.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800">No Transactions Found</h4>
            <p className="text-xs text-slate-500 max-w-[240px]">
              Swaps and transfers you make will be recorded here with on-chain receipts.
            </p>
          </div>
          <button
            onClick={onOpenSwap}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs shadow hover:bg-black transition-all"
          >
            Start a Swap
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((tx) => (
            <div
              key={tx.id}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col gap-2 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'swap'
                        ? 'bg-purple-100 text-purple-700'
                        : tx.type === 'send'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                  >
                    {tx.type === 'swap' ? (
                      <ArrowLeftRight className="w-4 h-4" />
                    ) : tx.type === 'send' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4" />
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {tx.type === 'swap'
                        ? `Swap ${tx.fromSymbol} ➔ ${tx.toSymbol}`
                        : tx.type === 'send'
                          ? `Send ${tx.fromSymbol}`
                          : `Receive ${tx.fromSymbol}`}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-medium">
                      <span>{formatDate(tx.timestamp)}</span>
                      <span>•</span>
                      <span>{tx.chain}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-slate-900">
                    {tx.type === 'swap' ? (
                      <span>
                        +{tx.toAmount} {tx.toSymbol}
                      </span>
                    ) : (
                      <span>
                        {tx.type === 'send' ? '-' : '+'}
                        {tx.fromAmount} {tx.fromSymbol}
                      </span>
                    )}
                  </div>
                  {tx.type === 'swap' && (
                    <div className="text-[10px] font-mono text-slate-400">
                      from {tx.fromAmount} {tx.fromSymbol}
                    </div>
                  )}
                </div>
              </div>

              {/* Note / Details */}
              {tx.note && (
                <div className="p-2 rounded-xl bg-slate-50 text-[11px] text-slate-600 border border-slate-100">
                  {tx.note}
                </div>
              )}

              {/* Bottom Row: Status Badge & Explorer Link */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                <div className="flex items-center gap-1.5">
                  {tx.status === 'confirmed' ? (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      Confirmed
                    </span>
                  ) : tx.status === 'needs_action' ? (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                      <Clock className="w-3 h-3" />
                      Step 1 Done
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {tx.txHash && tx.explorerUrl && (
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-mono"
                    >
                      <span>{tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

