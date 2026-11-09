import React, { useState, useEffect } from 'react';
import { Asset, WalletState } from './types';
import { INITIAL_ASSETS } from './config/assets';
import { connectDualWallet, fetchRealEvmBalance } from './services/nimiqWallet';
import { HeroBalanceCard } from './components/HeroBalanceCard';
import { PortfolioSection } from './components/PortfolioSection';
import { SwapModal } from './components/SwapModal';
import { ReceiveModal } from './components/ReceiveModal';
import { SendModal } from './components/SendModal';
import { AssetDetailModal } from './components/AssetDetailModal';
import { WalletDetailsModal } from './components/WalletDetailsModal';
import { FloatingDock, ActiveTab } from './components/FloatingDock';
import { AppSplashIntro } from './components/AppSplashIntro';

export default function App() {
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
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
  
  // Modals
  const [isSwapOpen, setIsSwapOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isWalletDetailsOpen, setIsWalletDetailsOpen] = useState(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<Asset | null>(null);

  const [swapFromAsset, setSwapFromAsset] = useState<Asset | undefined>();
  const [swapToAsset, setSwapToAsset] = useState<Asset | undefined>();

  useEffect(() => {
    refreshWalletAndBalances();
  }, []);

  const refreshWalletAndBalances = async () => {
    try {
      const state = await connectDualWallet();
      setWallet(state);

      let currentPrices: any = null;
      try {
        const priceRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=nimiq,tether,ethereum,binancecoin,matic-network,bitcoin,avalanche-2,arbitrum,optimism&vs_currencies=usd&include_24hr_change=true'
        );
        if (priceRes.ok) {
          currentPrices = await priceRes.json();
        }
      } catch {}

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
            } else if (asset.symbol === 'POL' && currentPrices['matic-network']?.usd) {
              updatedPrice = currentPrices['matic-network'].usd;
              if (typeof currentPrices['matic-network'].usd_24h_change === 'number') {
                updatedChange = parseFloat(currentPrices['matic-network'].usd_24h_change.toFixed(2));
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
            balance = state.nimiqAddress ? state.nimiqBalanceLuna / 100000 : 0;
          }

          return {
            ...asset,
            priceUsd: updatedPrice,
            change24h: updatedChange,
            userBalance: balance,
          };
        })
      );

      if (state.evmAddress) {
        const evmBalances = await Promise.all(
          INITIAL_ASSETS.map(async (asset) => {
            if (asset.chainId > 0 && asset.contractAddress) {
              const bal = await fetchRealEvmBalance(
                asset.contractAddress,
                state.evmAddress!,
                asset.decimals
              );
              return { id: asset.id, bal };
            }
            return { id: asset.id, bal: 0 };
          })
        );

        setAssets((prev) =>
          prev.map((asset) => {
            const found = evmBalances.find((e) => e.id === asset.id);
            if (found && asset.chainId > 0) {
              return { ...asset, userBalance: found.bal };
            }
            return asset;
          })
        );
      }
    } catch (e) {
      console.warn('Refresh error:', e);
    }
  };

  const totalPortfolioValueUsd = assets.reduce(
    (sum, a) => sum + a.userBalance * a.priceUsd,
    0
  );

  const nimAsset = assets.find((a) => a.symbol === 'NIM');
  const nimBalance = nimAsset ? nimAsset.userBalance : wallet.nimiqBalanceLuna / 100000;

  const handleSwapSuccess = (
    fromAsset: Asset,
    toAsset: Asset,
    fromAmount: number,
    toAmount: number
  ) => {
    setAssets((prev) =>
      prev.map((item) => {
        if (item.id === fromAsset.id) {
          return {
            ...item,
            userBalance: Math.max(0, item.userBalance - fromAmount),
          };
        }
        if (item.id === toAsset.id) {
          return {
            ...item,
            userBalance: item.userBalance + toAmount,
          };
        }
        return item;
      })
    );
  };

  const handleSendSuccess = (asset: Asset, amount: number) => {
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
          />

          <PortfolioSection
            assets={assets}
            onSelectAssetForSwap={handleSelectAssetForSwap}
          />
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
        assets={assets}
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
        assets={assets}
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
        onClose={() => setIsWalletDetailsOpen(false)}
        wallet={wallet}
      />
    </div>
  );
}
