import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Asset, WalletState, TransactionRecord } from './types';
import { INITIAL_ASSETS } from './config/assets';
import { connectDualWallet } from './services/nimiqWallet';
import { discoverNewTokens } from './services/tokenDiscovery';
import { fetchLivePrices } from './services/prices';
import OmnimAI from './components/OmnimAI';
import { fetchChainBalances } from './services/balances';
import { HeroBalanceCard } from './components/HeroBalanceCard';
import { PortfolioSection } from './components/PortfolioSection';
import { TransactionHistoryView } from './components/TransactionHistoryView';
import { SwapModal } from './components/SwapModal';
import { ReceiveModal } from './components/ReceiveModal';
import { SendModal } from './components/SendModal';
import { AssetDetailModal } from './components/AssetDetailModal';
import { WalletDetailsModal } from './components/WalletDetailsModal';
import { FloatingDock, ActiveTab } from './components/FloatingDock';
import { AppSplashIntro } from './components/AppSplashIntro';

// Fast Instant Balance Cache from localStorage
function getInitialAssets(): Asset[] {
  try {
    localStorage.removeItem('omnim_asset_balances');
  } catch { }
  return INITIAL_ASSETS.map((a) => ({ ...a, userBalance: 0 }));
}

function getInitialDiscoveredAssets(): Asset[] {
  try {
    const cached = localStorage.getItem('omnim_discovered_tokens');
    if (cached) {
      return JSON.parse(cached) as Asset[];
    }
  } catch { }
  return [];
}

function getInitialTransactions(): TransactionRecord[] {
  try {
    const saved = localStorage.getItem('omnim_tx_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Drop the demo entries that older versions seeded into every new wallet.
        return parsed.filter((tx: TransactionRecord) => !String(tx.id).startsWith('tx-seed-'));
      }
    }
  } catch { }
  return [];
}

export default function App() {
  const [assets, setAssets] = useState<Asset[]>(getInitialAssets);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(getInitialTransactions);
  const [wallet, setWallet] = useState<WalletState>({
    isNimiqPayHost: false,
    nimiqConnected: false,
    nimiqAddress: null,
    nimiqBalanceLuna: 0,
    evmConnected: false,
    evmAddress: null,
    evmChainId: null,
    isSyncing: true,
    isConsensusEstablished: false,
    lastBlockHeight: 0,
  });

  const [activeNavTab, setActiveNavTab] = useState<ActiveTab>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [isSwapOpen, setIsSwapOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isWalletDetailsOpen, setIsWalletDetailsOpen] = useState(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<Asset | null>(null);

  const [swapFromAsset, setSwapFromAsset] = useState<Asset | undefined>();
  const [swapToAsset, setSwapToAsset] = useState<Asset | undefined>();
  const [discoveredAssets, setDiscoveredAssets] = useState<Asset[]>(getInitialDiscoveredAssets);

  const isRefreshingRef = useRef(false);
  const pricesBusyRef = useRef(false);
  const discoveryBusyRef = useRef(false);
  const lastPriceFetchRef = useRef<number>(0);
  const lastFullPriceFetchRef = useRef<number>(0);
  const assetsRef = useRef<Asset[]>([]);
  assetsRef.current = assets;
  const lastDiscoveryRef = useRef<number>(0);

  useEffect(() => {
    // Initial fetch
    refreshWalletAndBalances();

    // Regular polling every 10 seconds for snappy updates without network socket congestion or RPC rate-limiting
    const timer = setInterval(() => {
      refreshWalletAndBalances();
    }, 10000);

    // Instant refresh when window or mobile app resumes / focused
    const handleFocus = () => refreshWalletAndBalances();
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshWalletAndBalances();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Listen for EVM wallet events for instant updates
    let handleChainChanged: (() => void) | undefined;
    let handleAccountsChanged: (() => void) | undefined;
    if (window.ethereum) {
      handleChainChanged = () => refreshWalletAndBalances();
      handleAccountsChanged = () => refreshWalletAndBalances();
      window.ethereum.on?.('chainChanged', handleChainChanged);
      window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (window.ethereum) {
        window.ethereum.removeListener?.('chainChanged', handleChainChanged);
        window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const refreshWalletAndBalances = async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      const state = await connectDualWallet();
      setWallet(state);

      // 2. Native NIM balance
      setAssets((prev) =>
        prev.map((asset) => {
          if (asset.symbol !== 'NIM') return asset;
          if (!state.nimiqAddress) return { ...asset, userBalance: 0 };
          const currentNim = state.nimiqBalanceLuna / 100000;
          // Keep the last known balance through transient network hiccups until consensus is confirmed.
          const balance = currentNim > 0 ? currentNim : asset.userBalance > 0 && !state.isConsensusEstablished ? asset.userBalance : currentNim;
          return { ...asset, userBalance: balance };
        })
      );

      // 3. EVM balances: one batched Multicall3 request per chain.
      if (!state.evmAddress) {
        setAssets((prev) => prev.map((asset) => (asset.chainId > 0 ? { ...asset, userBalance: 0 } : asset)));
      } else {
        const owner = state.evmAddress;
        const evmAssets = INITIAL_ASSETS.filter((a) => a.chainId > 0 && a.contractAddress);
        const chainIds = Array.from(new Set(evmAssets.map((a) => a.chainId)));
        // Apply each chain as soon as it answers instead of waiting for the slowest one.
        await Promise.all(
          chainIds.map(async (chainId) => {
            const result = await fetchChainBalances(chainId, owner, evmAssets.filter((a) => a.chainId === chainId));
            // Assets missing from a result (failed call or RPC outage) keep their previous balance.
            if (!result) return;
            setAssets((prev) =>
              prev.map((asset) => (asset.id in result ? { ...asset, userBalance: result[asset.id] } : asset))
            );
          })
        );
      }

      // Prices and token discovery are slower and don't block balances.
      void refreshPrices();
      void discoverTokens(state.evmAddress);
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setIsRefreshing(false);
      isRefreshingRef.current = false;
    }
  };

  const refreshPrices = async () => {
    if (pricesBusyRef.current) return;
    pricesBusyRef.current = true;
    try {
      // 1. Live prices: held assets every 2 min, the whole catalog every 5 min.
      const nowMs = Date.now();
      const catalog = assetsRef.current;
      const fullDue = nowMs - lastFullPriceFetchRef.current > 300000;
      const heldDue = nowMs - lastPriceFetchRef.current > 120000;
      if (fullDue || heldDue) {
        lastPriceFetchRef.current = nowMs;
        if (fullDue) lastFullPriceFetchRef.current = nowMs;
        const targets = fullDue ? catalog : catalog.filter((a) => a.userBalance > 0 || a.symbol === 'NIM');
        const live = await fetchLivePrices(targets);
        if (Object.keys(live).length > 0) {
          setAssets((prev) =>
            prev.map((a) => {
              const p = live[a.id];
              return p
                ? { ...a, priceUsd: p.priceUsd, change24h: p.change24h, sparkline: p.sparkline ?? a.sparkline, priceSource: p.source }
                : a;
            })
          );
        }
      }
    } catch (e) {
      console.warn('Price refresh error:', e);
    } finally {
      pricesBusyRef.current = false;
    }
  };

  const discoverTokens = async (evmAddress: string | null) => {
    if (discoveryBusyRef.current) return;
    discoveryBusyRef.current = true;
    try {
      const state = { evmAddress };
      // 4. Auto-discover new tokens not in the predefined list (throttled to every 3 mins to avoid network congestion)
      const nowTs = Date.now();
      if (state.evmAddress && nowTs - lastDiscoveryRef.current > 180000) {
        lastDiscoveryRef.current = nowTs;
        try {
          const knownAddresses = new Set(
            INITIAL_ASSETS.map((a) => a.contractAddress.toLowerCase())
          );
          discoveredAssets.forEach((da) => knownAddresses.add(da.contractAddress.toLowerCase()));

          const newTokens = await discoverNewTokens(state.evmAddress, knownAddresses);
          if (newTokens.length > 0) {
            setDiscoveredAssets((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const trulyNew = newTokens.filter((t) => !existingIds.has(t.id));
              let nextList: Asset[];
              if (trulyNew.length === 0) {
                nextList = prev.map((existing) => {
                  const updated = newTokens.find((n) => n.id === existing.id);
                  return updated
                    ? {
                      ...existing,
                      userBalance: updated.userBalance,
                      priceUsd: updated.priceUsd,
                      change24h: updated.change24h,
                    }
                    : existing;
                });
              } else {
                nextList = [...prev, ...trulyNew];
              }

              try {
                localStorage.setItem('omnim_discovered_tokens', JSON.stringify(nextList));
              } catch { }

              return nextList;
            });
          }
        } catch (e) {
          console.warn('Token discovery error:', e);
        }
      }
    } finally {
      discoveryBusyRef.current = false;
    }
  };

  /** After a swap/send, poll until the chain reflects it (bridges can take a while). */
  const refreshAfterTx = () => {
    [1500, 5000, 12000, 25000].forEach((ms) => setTimeout(() => refreshWalletAndBalances(), ms));
  };

  // Combine assets and discovered tokens for portfolio calculation
  const allCombinedAssets = useMemo(() => {
    const combined = [...assets];
    for (const da of discoveredAssets) {
      if (!combined.some((a) => a.id === da.id)) {
        combined.push(da);
      }
    }
    return combined;
  }, [assets, discoveredAssets]);

  const totalPortfolioValueUsd = allCombinedAssets.reduce(
    (sum, a) => sum + a.userBalance * a.priceUsd,
    0
  );


  const handleSwapSuccess = (
    fromAsset: Asset,
    toAsset: Asset,
    fromAmount: number,
    toAmount: number,
    txHash?: string,
    _isTwoStepNIM?: boolean
  ) => {
    setAssets((prev) =>
      prev.map((item) => {
        if (item.id === fromAsset.id) {
          return {
            ...item,
            userBalance: Math.max(0, item.userBalance - fromAmount),
          };
        }
        if (item.id === toAsset.id || (toAsset.symbol === 'NIM' && item.symbol === 'NIM')) {
          return {
            ...item,
            userBalance: item.userBalance + toAmount,
          };
        }
        return item;
      })
    );

    const newTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      type: 'swap',
      fromSymbol: fromAsset.symbol,
      toSymbol: toAsset.symbol,
      fromAmount,
      toAmount,
      timestamp: Date.now(),
      status: 'confirmed',
      txHash,
      chain: fromAsset.chain,
      explorerUrl: txHash
        ? fromAsset.chainId === 137
          ? `https://polygonscan.com/tx/${txHash}`
          : fromAsset.chainId === 56
            ? `https://bscscan.com/tx/${txHash}`
            : fromAsset.chainId === 8453
              ? `https://basescan.org/tx/${txHash}`
              : `https://etherscan.io/tx/${txHash}`
        : undefined,
      note: toAsset.symbol === 'NIM'
        ? `Swapped ${fromAsset.symbol} on ${fromAsset.chain} to native NIM in your Nimiq wallet`
        : fromAsset.symbol === 'NIM'
          ? `Swapped NIM to ${toAsset.symbol} on ${toAsset.chain}`
          : `Swapped on ${fromAsset.chain} via Relay Protocol`,
    };

    setTransactions((prev) => {
      const updated = [newTx, ...prev];
      try {
        localStorage.setItem('omnim_tx_history', JSON.stringify(updated));
      } catch { }
      return updated;
    });

    // Fast sync after swap
    refreshAfterTx();
  };

  const handleSendSuccess = (
    asset: Asset,
    amount: number,
    txHash?: string,
    recipient?: string
  ) => {
    setAssets((prev) =>
      prev.map((item) => {
        if (item.id === asset.id) {
          return {
            ...item,
            userBalance: Math.max(0, item.userBalance - amount),
          };
        }
        return item;
      })
    );

    const newTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      type: 'send',
      fromSymbol: asset.symbol,
      fromAmount: amount,
      timestamp: Date.now(),
      status: 'confirmed',
      txHash,
      chain: asset.chain,
      explorerUrl: txHash
        ? asset.chainId === 137
          ? `https://polygonscan.com/tx/${txHash}`
          : `https://bscscan.com/tx/${txHash}`
        : undefined,
      note: recipient ? `Sent to ${recipient.slice(0, 6)}...${recipient.slice(-4)}` : `Sent on ${asset.chain}`,
    };

    setTransactions((prev) => {
      const updated = [newTx, ...prev];
      try {
        localStorage.setItem('omnim_tx_history', JSON.stringify(updated));
      } catch { }
      return updated;
    });

    // Fast sync after send
    refreshAfterTx();
  };

  const handleSelectAssetForSwap = (asset: Asset) => {
    // Pay with whatever the user holds the most of (else USDC on Polygon) and buy the tapped asset.
    const swappable = assets.filter((a) => a.id !== asset.id && a.hasSwapLiquidity !== false);
    const funded = [...swappable].sort((a, b) => b.userBalance * b.priceUsd - a.userBalance * a.priceUsd)[0];
    const payWith = funded && funded.userBalance * funded.priceUsd > 1 ? funded : swappable.find((a) => a.id === 'usdc-polygon') ?? swappable[0];
    setSwapFromAsset(payWith);
    setSwapToAsset(asset.hasSwapLiquidity === false || asset.sellOnly ? undefined : asset);
    setIsSwapOpen(true);
  };

  return (
    <div className="w-full min-h-screen bg-[#F2F2F7] flex justify-center selection:bg-slate-300">
      <AppSplashIntro />
      <div className="w-full max-w-[420px] min-h-screen bg-[#F2F2F7] flex flex-col relative">
        <main className="flex-1 overflow-y-auto no-scrollbar pt-2 sm:pt-4">
          {activeNavTab === 'history' ? (
            <TransactionHistoryView
              transactions={transactions}
              polygonUsdcBalance={assets.find((a) => a.id === 'usdc-polygon')?.userBalance || 0}
              onClearHistory={() => {
                setTransactions([]);
                localStorage.removeItem('omnim_tx_history');
              }}
              onOpenSwap={() => {
                setSwapFromAsset(undefined);
                setSwapToAsset(undefined);
                setIsSwapOpen(true);
              }}
            />
          ) : (
            <>
              <HeroBalanceCard
                wallet={wallet}
                totalBalanceUsd={totalPortfolioValueUsd}
                onOpenReceive={() => setIsReceiveOpen(true)}
                onOpenSend={() => setIsSendOpen(true)}
                onOpenSwap={() => {
                  setSwapFromAsset(undefined);
                  setSwapToAsset(undefined);
                  setIsSwapOpen(true);
                }}
                onOpenWalletDetails={() => setIsWalletDetailsOpen(true)}
                onRefresh={refreshWalletAndBalances}
                isRefreshing={isRefreshing}
              />

              <PortfolioSection
                assets={assets}
                discoveredAssets={discoveredAssets}
                onSelectAssetForSwap={handleSelectAssetForSwap}
              />
            </>
          )}
        </main>

        <FloatingDock
          activeTab={activeNavTab}
          onTabChange={(tab) => {
            setActiveNavTab(tab);
            if (tab === 'swap') {
              setIsSwapOpen(true);
            } else if (tab === 'profile') {
              setIsWalletDetailsOpen(true);
            }
          }}
          onOpenSwap={() => setIsSwapOpen(true)}
        />
      </div>

      <SwapModal
        isOpen={isSwapOpen}
        onClose={() => setIsSwapOpen(false)}
        assets={allCombinedAssets}
        initialFromAsset={swapFromAsset}
        initialToAsset={swapToAsset}
        wallet={wallet}
        onSwapSuccess={handleSwapSuccess}
      />

      <ReceiveModal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        wallet={wallet}
      />

      <SendModal
        isOpen={isSendOpen}
        onClose={() => setIsSendOpen(false)}
        assets={allCombinedAssets}
        wallet={wallet}
        onSendSuccess={handleSendSuccess}
      />

      <AssetDetailModal
        asset={selectedAssetDetail}
        onClose={() => setSelectedAssetDetail(null)}
        onOpenSwap={handleSelectAssetForSwap}
      />

      <WalletDetailsModal
        isOpen={isWalletDetailsOpen}
        onClose={() => {
          setIsWalletDetailsOpen(false);
          if (activeNavTab === 'profile') setActiveNavTab('dashboard');
        }}
        wallet={wallet}
      />

      <OmnimAI />
    </div>
  );
}
