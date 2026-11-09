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
          } catch {}
        }
      }

      if (typeof nimiqProvider.isConsensusEstablished === 'function') {
        isConsensusEstablished = await nimiqProvider.isConsensusEstablished();
      }

      if (typeof nimiqProvider.getBlockNumber === 'function') {
        try {
          lastBlockHeight = await nimiqProvider.getBlockNumber();
        } catch {}
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
      } catch {}
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

export async function executeEvmTransaction(params: {
  to: string;
  data?: string;
  value?: string;
  from?: string;
  chainId?: number;
}): Promise<string> {
  if (typeof window !== 'undefined' && window.ethereum && typeof window.ethereum.request === 'function') {
    // If a specific chain is requested and differs, switch network
    if (params.chainId) {
      try {
        const hexChainId = '0x' + params.chainId.toString(16);
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        });
      } catch (switchError: any) {
        console.warn('Network switch prompt/error:', switchError);
      }
    }

    return await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          to: params.to,
          from: params.from,
          data: params.data || '0x',
          value: params.value || '0x0',
        },
      ],
    });
  }

  throw new Error('EVM wallet not detected. Please connect MetaMask, Coinbase Wallet, or Nimiq Pay Web3 to execute on Mainnet.');
}
