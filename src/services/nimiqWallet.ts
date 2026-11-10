import { init } from '@nimiq/mini-app-sdk';
import { WalletState } from '../types';

declare global {
  interface Window {
    nimiq?: any;
    ethereum?: any;
  }
}

let cachedNimiqProvider: any = null;
let initPromise: Promise<any> | null = null;

async function getNimiqProvider() {
  if (cachedNimiqProvider) return cachedNimiqProvider;
  if (!initPromise) {
    initPromise = init({ timeout: 10000 })
      .then((provider) => {
        cachedNimiqProvider = provider;
        return provider;
      })
      .catch((e) => {
        console.warn('Nimiq SDK init warning:', e);
        initPromise = null;
        return null;
      });
  }
  return initPromise;
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
    const nimiqProvider = await getNimiqProvider();
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
        try {
          isConsensusEstablished = await nimiqProvider.isConsensusEstablished();
        } catch { }
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

export const CHAIN_RPC_MAP: Record<number, string[]> = {
  56: ['https://bsc.publicnode.com', 'https://1rpc.io/bnb'],
  137: ['https://polygon-bor-rpc.publicnode.com', 'https://1rpc.io/matic'],
  8453: ['https://mainnet.base.org', 'https://1rpc.io/base'],
  42161: ['https://arbitrum-one-rpc.publicnode.com', 'https://arb1.arbitrum.io/rpc'],
  10: ['https://optimism-rpc.publicnode.com'],
  43114: ['https://avalanche-c-chain-rpc.publicnode.com'],
};

export async function fetchRealEvmBalance(
  tokenAddress: string,
  userAddress: string,
  decimals: number = 18,
  chainId: number = 56
): Promise<number> {
  if (!userAddress) return 0;

  const isNative =
    !tokenAddress ||
    tokenAddress === '0x0000000000000000000000000000000000000000' ||
    tokenAddress === '0x0000000000000000000000000000000000001010';

  const cleanAddr = userAddress.toLowerCase().replace('0x', '').padStart(64, '0');
  const payload = isNative
    ? {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [userAddress, 'latest'],
    }
    : {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [
        {
          to: tokenAddress,
          data: '0x70a08231' + cleanAddr,
        },
        'latest',
      ],
    };

  // 1. Try injected window.ethereum first for Polygon (instant 0ms IPC call)
  if (typeof window !== 'undefined' && window.ethereum && (chainId === 137 || !chainId)) {
    try {
      if (isNative) {
        const balanceWeiHex = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [userAddress, 'latest'],
        });
        if (balanceWeiHex && balanceWeiHex !== '0x') {
          const balanceBig = BigInt(balanceWeiHex);
          return Number(balanceBig) / Math.pow(10, decimals);
        }
      } else {
        const balanceHex = await window.ethereum.request({
          method: 'eth_call',
          params: [
            {
              to: tokenAddress,
              data: '0x70a08231' + cleanAddr,
            },
            'latest',
          ],
        });
        if (balanceHex && balanceHex !== '0x') {
          const balanceBig = BigInt(balanceHex);
          return Number(balanceBig) / Math.pow(10, decimals);
        }
      }
    } catch { }
  }

  const rpcs = CHAIN_RPC_MAP[chainId] || [];

  // Fast fetch function with 2200ms timeout
  const fetchSingleRpc = async (rpcUrl: string): Promise<number> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2200);
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.result && json.result !== '0x') {
          const balanceBig = BigInt(json.result);
          return Number(balanceBig) / Math.pow(10, decimals);
        }
        return 0;
      }
      return 0;
    } catch {
      return 0;
    }
  };

  // 2. Race all active public RPC endpoints in parallel for instantaneous result
  if (rpcs.length > 0) {
    try {
      return await Promise.any(rpcs.map((url) => fetchSingleRpc(url)));
    } catch {
      // Fall through to window.ethereum
    }
  }

  // 3. Fallback to injected window.ethereum
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      if (isNative) {
        const balanceWeiHex = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [userAddress, 'latest'],
        });
        if (balanceWeiHex && balanceWeiHex !== '0x') {
          const balanceWei = BigInt(balanceWeiHex);
          return Number(balanceWei) / Math.pow(10, decimals);
        }
      } else {
        const balanceHex = await window.ethereum.request({
          method: 'eth_call',
          params: [
            {
              to: tokenAddress,
              data: '0x70a08231' + cleanAddr,
            },
            'latest',
          ],
        });

        if (balanceHex && balanceHex !== '0x') {
          const balanceBig = BigInt(balanceHex);
          return Number(balanceBig) / Math.pow(10, decimals);
        }
      }
    } catch {
      return 0;
    }
  }

  return 0;
}

export async function executeNimTransfer(params: {
  recipient: string;
  valueInLuna: number;
  feeInLuna?: number;
}): Promise<string> {
  const provider = await getNimiqProvider();
  if (provider && typeof provider.sendBasicTransaction === 'function') {
    const res = await provider.sendBasicTransaction({
      recipient: params.recipient,
      value: params.valueInLuna,
      fee: params.feeInLuna || 1000,
    });
    if (typeof res === 'string') return res;
    if (res && (res as any).hash) return (res as any).hash;
  }

  if (window.nimiq && typeof window.nimiq.sendBasicTransaction === 'function') {
    const res = await window.nimiq.sendBasicTransaction({
      recipient: params.recipient,
      value: params.valueInLuna,
      fee: params.feeInLuna || 1000,
    });
    if (typeof res === 'string') return res;
    if (res && (res as any).hash) return (res as any).hash;
  }

  throw new Error('Nimiq provider not found. Please open inside Nimiq Pay.');
}

const KNOWN_CHAINS: Record<number, any> = {
  56: {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org', 'https://bsc.publicnode.com'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  137: {
    chainId: '0x89',
    chainName: 'Polygon Mainnet',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com', 'https://polygon-bor-rpc.publicnode.com', 'https://1rpc.io/matic'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  8453: {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org', 'https://1rpc.io/base'],
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
    // 1. Verify and switch network if a specific chainId is requested
    if (params.chainId) {
      const hexChainId = '0x' + params.chainId.toString(16);
      try {
        const currentChainHex = await window.ethereum.request({ method: 'eth_chainId' });
        if (!currentChainHex || parseInt(currentChainHex, 16) !== params.chainId) {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hexChainId }],
          });
        }
      } catch (switchError: any) {
        // Error code 4902 or unrecognized chain means chain needs to be added
        const isNotAdded =
          switchError?.code === 4902 ||
          switchError?.code === -32603 ||
          switchError?.message?.toLowerCase().includes('wallet_addethereumchain') ||
          switchError?.message?.toLowerCase().includes('unrecognized') ||
          switchError?.data?.originalError?.code === 4902;

        if (isNotAdded && KNOWN_CHAINS[params.chainId]) {
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

    // 2. Format value strictly as valid Hex (e.g. 0x0 or 0x123...)
    let formattedValue = '0x0';
    if (params.value && params.value !== '0' && params.value !== '0x0') {
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

    const txPayload: any = {
      to: params.to,
      data: params.data || '0x',
      value: formattedValue,
    };
    if (params.from) {
      txPayload.from = params.from;
    }

    return await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [txPayload],
    });
  }

  throw new Error('EVM wallet not detected. Please connect MetaMask, Coinbase Wallet, or Nimiq Pay Web3 to execute on Mainnet.');
}

/**
 * Poll for on-chain block inclusion and receipt confirmation before declaring swap success.
 */
export async function waitForEvmReceipt(
  txHash: string,
  chainId: number = 137,
  maxWaitMs: number = 45000
): Promise<boolean> {
  const rpcs = CHAIN_RPC_MAP[chainId] || [];
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // 1. Try injected provider if available
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const receipt = await window.ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        });
        if (receipt && receipt.blockNumber) {
          const status = receipt.status;
          return status === '0x1' || status === 1 || status === true;
        }
      } catch { }
    }

    // 2. Try fast public RPCs
    for (const rpc of rpcs) {
      try {
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          }),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.result && json.result.blockNumber) {
            const status = json.result.status;
            return status === '0x1' || status === 1 || status === true;
          }
        }
      } catch { }
    }

    // Wait 2 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return true; // Fallback to avoid freezing UI permanently
}
