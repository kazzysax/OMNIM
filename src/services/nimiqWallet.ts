import { init } from '@nimiq/mini-app-sdk';
import { WalletState } from '../types';

declare global {
  interface Window {
    nimiq?: any;
    ethereum?: any;
  }
}

export async function connectDualWallet(): Promise<WalletState> {
  const isInsideNimiqPay = typeof window !== 'undefined' && (!!window.nimiq || !!window.ethereum);

  let nimiqAddress: string | null = null;
  let isConsensusEstablished = false;
  let nimiqBalanceLuna = 0;
  let evmAddress: string | null = null;
  let evmChainId: number | null = 137;
  let lastBlockHeight = 0;

  try {
    const nimiqProvider = await init({ timeout: 4000 });
    if (nimiqProvider) {
      const accounts = await nimiqProvider.listAccounts();
      if (accounts && accounts.length > 0) {
        nimiqAddress = accounts[0];
        if (typeof nimiqProvider.getBalance === 'function') {
          try {
            nimiqBalanceLuna = await nimiqProvider.getBalance(nimiqAddress);
          } catch { }
        }
      }

      if (typeof nimiqProvider.isConsensusEstablished === 'function') {
        isConsensusEstablished = await nimiqProvider.isConsensusEstablished();
      }

      if (typeof nimiqProvider.getBlockNumber === 'function') {
        try {
          lastBlockHeight = await nimiqProvider.getBlockNumber();
        } catch { }
      }
    }
  } catch (err) {
    if (window.nimiq && typeof window.nimiq.listAccounts === 'function') {
      try {
        const accounts = await window.nimiq.listAccounts();
        if (accounts && accounts.length > 0) {
          nimiqAddress = accounts[0];
          if (typeof window.nimiq.getBalance === 'function') {
            nimiqBalanceLuna = await window.nimiq.getBalance(nimiqAddress);
          }
        }
      } catch { }
    }
  }

  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        evmAddress = accounts[0];
      } else {
        const requested = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (requested && requested.length > 0) evmAddress = requested[0];
      }

      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainIdHex) {
        evmChainId = parseInt(chainIdHex, 16);
      }
    } catch (e) {
      console.warn('EVM provider request error:', e);
    }
  }

  return {
    isNimiqPayHost: isInsideNimiqPay,
    nimiqConnected: !!nimiqAddress,
    nimiqAddress,
    nimiqBalanceLuna,
    evmConnected: !!evmAddress,
    evmAddress,
    evmChainId,
    isSyncing: false,
    isConsensusEstablished,
    lastBlockHeight,
  };
}

export async function fetchRealEvmBalance(
  tokenAddress: string,
  userAddress: string,
  decimals: number = 18
): Promise<number> {
  if (typeof window === 'undefined' || !window.ethereum || !userAddress) return 0;

  try {
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      const balanceWeiHex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [userAddress, 'latest'],
      });
      const balanceWei = BigInt(balanceWeiHex);
      return Number(balanceWei) / 1e18;
    } else {
      const cleanAddr = userAddress.toLowerCase().replace('0x', '').padStart(64, '0');
      const data = '0x70a08231' + cleanAddr;

      const balanceHex = await window.ethereum.request({
        method: 'eth_call',
        params: [
          {
            to: tokenAddress,
            data,
          },
          'latest',
        ],
      });

      if (!balanceHex || balanceHex === '0x') return 0;
      const balanceBig = BigInt(balanceHex);
      return Number(balanceBig) / Math.pow(10, decimals);
    }
  } catch (err) {
    return 0;
  }
}

export async function executeNimTransfer(params: {
  recipient: string;
  valueInLuna: number;
  feeInLuna?: number;
}): Promise<string> {
  if (window.nimiq && typeof window.nimiq.sendBasicTransaction === 'function') {
    return await window.nimiq.sendBasicTransaction({
      recipient: params.recipient,
      value: params.valueInLuna,
      fee: params.feeInLuna || 1000,
    });
  }

  throw new Error('Nimiq provider not found. Please open inside Nimiq Pay.');
}

const KNOWN_CHAINS: Record<number, any> = {
  56: {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  137: {
    chainId: '0x89',
    chainName: 'Polygon Mainnet',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  8453: {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
  43114: {
    chainId: '0xa86a',
    chainName: 'Avalanche C-Chain',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://snowtrace.io'],
  },
  42161: {
    chainId: '0xa4b1',
    chainName: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
  10: {
    chainId: '0xa',
    chainName: 'OP Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.optimism.io'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
  },
};

export async function executeEvmTransaction(params: {
  to: string;
  data?: string;
  value?: string;
  from?: string;
  chainId?: number;
}): Promise<string> {
  if (typeof window !== 'undefined' && window.ethereum && typeof window.ethereum.request === 'function') {
    // If a specific chain is requested, verify and switch network
    if (params.chainId) {
      const hexChainId = '0x' + params.chainId.toString(16);
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        });
      } catch (switchError: any) {
        // Error code 4902 indicates chain is not added to the wallet
        if (switchError.code === 4902 && KNOWN_CHAINS[params.chainId]) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [KNOWN_CHAINS[params.chainId]],
            });
          } catch (addError) {
            console.warn('wallet_addEthereumChain error:', addError);
          }
        } else {
          console.warn('Network switch warning:', switchError);
        }
      }
    }

    // Ensure value is strictly formatted as valid Hex (e.g. 0x0 or 0x123)
    let formattedValue = '0x0';
    if (params.value && params.value !== '0') {
      if (typeof params.value === 'string' && params.value.startsWith('0x')) {
        formattedValue = params.value;
      } else {
        try {
          formattedValue = '0x' + BigInt(params.value).toString(16);
        } catch {
          formattedValue = '0x0';
        }
      }
    }

    return await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          to: params.to,
          from: params.from,
          data: params.data || '0x',
          value: formattedValue,
        },
      ],
    });
  }

  throw new Error('EVM wallet not detected. Please connect MetaMask, Coinbase Wallet, or Nimiq Pay Web3 to execute on Mainnet.');
}
