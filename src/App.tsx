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

      try {
        const priceRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=nimiq,tether,ethereum,binancecoin,matic-network,bitcoin&vs_currencies=usd'
        );
        if (priceRes.ok) {
          const prices = await priceRes.json();
          setAssets((prev) =>
            prev.map((a) => {
              if (a.symbol === 'NIM' && prices.nimiq?.usd) return { ...a, priceUsd: prices.nimiq.usd };
              if (a.symbol === 'USDT' && prices.tether?.usd) return { ...a, priceUsd: prices.tether.usd };
              if (a.symbol === 'ETH' && prices.ethereum?.usd) return { ...a, priceUsd: prices.ethereum.usd };
              if (a.symbol === 'BNB' && prices.binancecoin?.usd) return { ...a, priceUsd: prices.binancecoin.usd };
              if (a.symbol === 'POL' && prices['matic-network']?.usd) return { ...a, priceUsd: prices['matic-network'].usd };
              if (a.symbol === 'WBTC' && prices.bitcoin?.usd) return { ...a, priceUsd: prices.bitcoin.usd };
              return a;
            })
          );
        }
      } catch {}

      if (state.nimiqAddress || state.evmAddress) {
        const updated = await Promise.all(
          assets.map(async (asset) => {
            if (asset.symbol === 'NIM') {
              const nimBalance = state.nimiqBalanceLuna / 100000;
              return { ...asset, userBalance: nimBalance };
            }
            if (state.evmAddress && asset.chainId > 0) {
              const realBal = await fetchRealEvmBalance(
                asset.contractAddress,
                state.evmAddress,
                asset.decimals
              );
              return { ...asset, userBalance: realBal };
            }
            return { ...asset, userBalance: 0 };
          })
        );
        setAssets(updated);
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
