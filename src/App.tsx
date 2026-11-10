import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Asset, WalletState, TransactionRecord } from './types';
import { INITIAL_ASSETS } from './config/assets';
import { connectDualWallet, fetchRealEvmBalance } from './services/nimiqWallet';
import { discoverNewTokens } from './services/tokenDiscovery';
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Sanitize any legacy two-step entries from earlier versions
        return parsed.map((tx: TransactionRecord) => ({
          ...tx,
          status: 'confirmed',
          actionUrl: undefined,
          actionLabel: undefined,
          toSymbol: tx.toSymbol === 'Polygon USDC' ? 'NIM' : tx.toSymbol,
          note: tx.note?.includes('Fastspot')
            ? 'Swapped on Polygon Mainnet to native NIM in your Nimiq wallet'
            : tx.note,
        }));
      }
    }
  } catch { }

  return [
    {
      id: 'tx-seed-1',
      type: 'swap',
      fromSymbol: 'POL',
      toSymbol: 'NIM',
      fromAmount: 5,
      toAmount: 1850.5,
      timestamp: Date.now() - 3600000 * 1.5,
      status: 'confirmed',
      chain: 'Polygon Mainnet',
      explorerUrl: 'https://polygonscan.com',
      note: 'Swapped on Polygon Mainnet to native NIM in your Nimiq wallet',
    },
    {
      id: 'tx-seed-2',
      type: 'send',
      fromSymbol: 'POL',
      fromAmount: 2,
      timestamp: Date.now() - 3600000 * 3,
      status: 'confirmed',
      chain: 'Polygon Mainnet',
      explorerUrl: 'https://polygonscan.com',
      note: 'Transfer on Polygon Mainnet to 0xbd84...73dd',
    },
  ];
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
  const lastPriceFetchRef = useRef<number>(0);
  const cachedPricesRef = useRef<any>(null);
  const lastDiscoveryRef = useRef<number>(0);

  useEffect(() => {
    // Initial fetch
    refreshWalletAndBalances();

    // Regular polling every 25 seconds for snappy updates without network socket congestion or RPC rate-limiting
    const timer = setInterval(() => {
      refreshWalletAndBalances();
    }, 25000);

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

      // 1. Price cache check (fetch only every 45 seconds to avoid CoinGecko 429 rate limit)
      let currentPrices: any = cachedPricesRef.current;
      const now = Date.now();
      if (!currentPrices || now - lastPriceFetchRef.current > 45000) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const priceRes = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=nimiq,tether,ethereum,binancecoin,matic-network,polygon-ecosystem-token,bitcoin,avalanche-2,arbitrum,optimism&vs_currencies=usd&include_24hr_change=true',
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          if (priceRes.ok) {
            currentPrices = await priceRes.json();
            cachedPricesRef.current = currentPrices;
            lastPriceFetchRef.current = now;
          }
        } catch {
          // Keep using existing cached prices
        }
      }

      // 2. Update price and Nimiq balance on existing assets
      setAssets((prevAssets) =>
        prevAssets.map((asset) => {
          let updatedPrice = asset.priceUsd;
          let updatedChange = asset.change24h;

          if (currentPrices) {
            if (asset.symbol === 'NIM' && currentPrices.nimiq?.usd) {
              updatedPrice = currentPrices.nimiq.usd;
              if (typeof currentPrices.nimiq.usd_24h_change === 'number') {
                updatedChange = parseFloat(currentPrices.nimiq.usd_24h_change.toFixed(2));
              }
            } else if (asset.symbol === 'USDT' && currentPrices.tether?.usd) {
              updatedPrice = currentPrices.tether.usd;
              if (typeof currentPrices.tether.usd_24h_change === 'number') {
                updatedChange = parseFloat(currentPrices.tether.usd_24h_change.toFixed(2));
              }
            } else if (asset.symbol === 'ETH' && currentPrices.ethereum?.usd) {
              updatedPrice = currentPrices.ethereum.usd;
              if (typeof currentPrices.ethereum.usd_24h_change === 'number') {
                updatedChange = parseFloat(currentPrices.ethereum.usd_24h_change.toFixed(2));
              }
            } else if (asset.symbol === 'BNB' && currentPrices.binancecoin?.usd) {
              updatedPrice = currentPrices.binancecoin.usd;
              if (typeof currentPrices.binancecoin.usd_24h_change === 'number') {
                updatedChange = parseFloat(currentPrices.binancecoin.usd_24h_change.toFixed(2));
              }
            } else if (asset.symbol === 'POL') {
              const polPriceObj = currentPrices['polygon-ecosystem-token'] || currentPrices['matic-network'];
              if (polPriceObj?.usd) {
                updatedPrice = polPriceObj.usd;
                if (typeof polPriceObj.usd_24h_change === 'number') {
                  updatedChange = parseFloat(polPriceObj.usd_24h_change.toFixed(2));
                }
              }
            } else if (asset.symbol === 'WBTC' && currentPrices.bitcoin?.usd) {
              updatedPrice = currentPrices.bitcoin.usd;
              if (typeof currentPrices.bitcoin.usd_24h_change === 'number') {
                updatedChange = parseFloat(currentPrices.bitcoin.usd_24h_change.toFixed(2));
              }
            } else if (asset.symbol === 'AVAX' && currentPrices['avalanche-2']?.usd) {
              updatedPrice = currentPrices['avalanche-2'].usd;
              if (typeof currentPrices['avalanche-2'].usd_24h_change === 'number') {
                updatedChange = parseFloat(currentPrices['avalanche-2'].usd_24h_change.toFixed(2));
              }
            } else if (asset.symbol === 'ARB' && currentPrices.arbitrum?.usd) {
              updatedPrice = currentPrices.arbitrum.usd;
              if (typeof currentPrices.arbitrum.usd_24h_change === 'number') {
                updatedChange = parseFloat(currentPrices.arbitrum.usd_24h_change.toFixed(2));
              }
            } else if (asset.symbol === 'OP' && currentPrices.optimism?.usd) {
              updatedPrice = currentPrices.optimism.usd;
              if (typeof currentPrices.optimism.usd_24h_change === 'number') {
                updatedChange = parseFloat(currentPrices.optimism.usd_24h_change.toFixed(2));
              }
            }
          }

          let balance = asset.userBalance;
          if (asset.symbol === 'NIM') {
            if (state.nimiqAddress) {
              const currentLuna = state.nimiqBalanceLuna / 100000;
              // If currentLuna is > 0 or consensus confirmed, use it; otherwise preserve existing balance during transient network hiccups
              balance = currentLuna > 0 ? currentLuna : (asset.userBalance > 0 && !state.isConsensusEstablished ? asset.userBalance : currentLuna);
            } else {
              balance = 0;
            }
          }

          return {
            ...asset,
            priceUsd: updatedPrice,
            change24h: updatedChange,
            userBalance: balance,
          };
        })
      );

      // 3. Resilient EVM Multi-Chain balance query in controlled batches
      if (!state.evmAddress) {
        // If EVM wallet is disconnected, all EVM asset balances must be 0
        setAssets((prev) =>
          prev.map((asset) => (asset.chainId > 0 ? { ...asset, userBalance: 0 } : asset))
        );
      } else {
        const chunkSize = 6;
        const evmBalances: { id: string; bal: number | null }[] = [];

        for (let i = 0; i < INITIAL_ASSETS.length; i += chunkSize) {
          const chunk = INITIAL_ASSETS.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(
            chunk.map(async (asset) => {
              if (asset.chainId > 0 && asset.contractAddress) {
                const bal = await fetchRealEvmBalance(
                  asset.contractAddress,
                  state.evmAddress!,
                  asset.decimals,
                  asset.chainId
                );
                return { id: asset.id, bal };
              }
              return { id: asset.id, bal: 0 };
            })
          );
          evmBalances.push(...chunkResults);
        }

        setAssets((prev) => {
          const updated = prev.map((asset) => {
            const found = evmBalances.find((e) => e.id === asset.id);
            if (found && asset.chainId > 0) {
              // Only overwrite if a valid numeric balance was obtained
              // If bal is null (temporary RPC network timeout), preserve previous userBalance!
              if (found.bal !== null && typeof found.bal === 'number') {
                return { ...asset, userBalance: found.bal };
              }
              return asset;
            }
            return asset;
          });

          // Cache non-zero balances in localStorage scoped to this EVM address
          try {
            const balanceMap: Record<string, number> = {};
            updated.forEach((a) => {
              if (a.userBalance > 0) balanceMap[a.id] = a.userBalance;
            });
            localStorage.setItem(`omnim_asset_balances_${state.evmAddress!.toLowerCase()}`, JSON.stringify(balanceMap));
          } catch { }

          return updated;
        });
      }

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
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setIsRefreshing(false);
      isRefreshingRef.current = false;
    }
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

  const nimAsset = assets.find((a) => a.symbol === 'NIM');
  const nimBalance = nimAsset ? nimAsset.userBalance : wallet.nimiqBalanceLuna / 100000;

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
    setTimeout(() => refreshWalletAndBalances(), 2500);
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
    setTimeout(() => refreshWalletAndBalances(), 2000);
  };

  const handleSelectAssetForSwap = (asset: Asset) => {
    if (asset.symbol === 'NIM') {
      setSwapFromAsset(asset);
      setSwapToAsset(assets.find((a) => a.symbol === 'bTSLA'));
    } else {
      setSwapFromAsset(assets.find((a) => a.symbol === 'NIM'));
      setSwapToAsset(asset);
    }
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
                nimBalance={nimBalance}
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
    </div>
  );
}
