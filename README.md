# OMNIM — Universal Portfolio & Cross-Chain Gateway for Nimiq Pay

[![Nimiq Mini-Apps](https://img.shields.io/badge/Nimiq-Mini--App-E5B887?style=flat&logo=nimiq)](https://nimiq.dev/mini-apps)
[![Relay Infrastructure](https://img.shields.io/badge/Relay-Cross--Chain%20Execution-2775CA?style=flat)](https://relay.link)
[![BNB Chain](https://img.shields.io/badge/BNB%20Chain-BEP--20%20Stocks-F3BA2F?style=flat&logo=binance)](https://bscscan.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**OMNIM** is a high-performance, non-custodial multi-asset portfolio and cross-chain swap gateway built specifically for the **Nimiq Pay Mini-App** ecosystem.

While Nimiq Pay provides world-class instant crypto and fiat POS payments, OMNIM transforms Nimiq Pay into a **comprehensive global investment portfolio**: enabling users to hold and swap between **native crypto**, **10 tokenized equities on BNB Chain**, **physical Gold & Silver RWAs on BNB Chain**, and **regulated fiat currencies (EUR, GBP, USD)**—all from a single self-custodial interface.

---

## 🌟 Core Highlights & Innovations

1. **Dual-Chain Wallet Architecture**:
   * Interfaces natively with Nimiq (`window.nimiq` via `@nimiq/mini-app-sdk`) and Nimiq Pay's injected EVM layer (`window.ethereum` via EIP-1193 standard).
   * Automatically switches networks via `wallet_switchEthereumChain` across BNB Smart Chain, Polygon, and Base.

2. **100% Real Mainnet Routing**:
   * Direct execution powered by **Relay Protocol Mainnet API** (`https://api.relay.link/quote/v2`).
   * No mocks, no simulated burn escrows. EVM transactions pass live signed calldata directly to the user's Web3 wallet for on-chain execution.

3. **10 Stocks + Gold & Silver (All Centralized on BNB Chain)**:
   * All 10 equities plus physical Gold and Silver are hosted exclusively on **BNB Smart Chain (Chain ID: 56)** as verified BEP-20 contracts.
   * Cross-chain routing from Polygon (`USDC`, `USDT`, `EURe`) or Base (`ETH`) settles directly onto BNB Chain via Relay Link with sub-second execution (~1–2s).

4. **Google-Sourced Brand Visuals**:
   * High-resolution 128px official brand and company logos outsourced directly via Google's Favicon & Brand API (`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`).
   * Ensures crisp, official pictorial representation for every single stock, commodity, currency, and crypto asset with zero broken links.

---

## 📜 Verified Asset Registry

### 📈 Stocks & Commodities (BNB Smart Chain — Chain ID: 56)

| Asset | Symbol | BscScan Contract Address | Explorer |
| :--- | :--- | :--- | :--- |
| **Tesla Inc.** | `bTSLA` | `0x2494b603319d4D9F9715c9f4496d9E0364B59d93` | [BscScan](https://bscscan.com/token/0x2494b603319d4D9F9715c9f4496d9E0364B59d93) |
| **NVIDIA Corp.** | `bNVDA` | `0xA9eE28C80f960B889dFbd1902055218cBa016F75` | [BscScan](https://bscscan.com/token/0xA9eE28C80f960B889dFbd1902055218cBa016F75) |
| **Apple Inc.** | `bAAPL` | `0x390a684E2905474d2b3F30C462C0923842618c4` | [BscScan](https://bscscan.com/token/0x390a684E2905474d2b3F30C462C0923842618c4) |
| **Microsoft Corp.** | `bMSFT` | `0x6Bfe75D1ad432050eA973C3A3DcD88F02e2444C3` | [BscScan](https://bscscan.com/token/0x6Bfe75D1ad432050eA973C3A3DcD88F02e2444C3) |
| **Amazon.com Inc.** | `bAMZN` | `0x4553cFe1C09f37f38b12dC509F676964e392F8Fc` | [BscScan](https://bscscan.com/token/0x4553cFe1C09f37f38b12dC509F676964e392F8Fc) |
| **Alphabet Inc.** | `bGOOGL`| `0x091fc7778e6932d4009b087b191d1ee3bac5729a` | [BscScan](https://bscscan.com/token/0x091fc7778e6932d4009b087b191d1ee3bac5729a) |
| **Meta Platforms** | `bMETA` | `0xd7df5863a3e742f0c767768cdfcb63f09e0422f6` | [BscScan](https://bscscan.com/token/0xd7df5863a3e742f0c767768cdfcb63f09e0422f6) |
| **Coinbase Global**| `bCOIN` | `0xf8589b526FdD65F7F301c605a6e04F0F1b4B3620` | [BscScan](https://bscscan.com/token/0xf8589b526FdD65F7F301c605a6e04F0F1b4B3620) |
| **SPDR S&P 500 ETF**| `bSPY` | `0x6a708ead771238919d85930b5a0f10454e1c331a` | [BscScan](https://bscscan.com/token/0x6a708ead771238919d85930b5a0f10454e1c331a) |
| **Invesco QQQ** | `bQQQ` | `0x0cde6936353d9e033100fcce7db00c4efd73559a` | [BscScan](https://bscscan.com/token/0x0cde6936353d9e033100fcce7db00c4efd73559a) |
| **PAX Gold (Gold RWA)** | `bGOLD`| `0x7950865a9140cb519342433146ed5b40c6f210f7` | [BscScan](https://bscscan.com/token/0x7950865a9140cb519342433146ed5b40c6f210f7) |
| **iShares Silver Trust** | `bSLV` | `0x8b872732b07be325a8803CDB480D9d20B6f8d11B` | [BscScan](https://bscscan.com/token/0x8b872732b07be325a8803CDB480D9d20B6f8d11B) |

### 💱 Fiat Currencies & Stablecoins (Polygon — Chain ID: 137)

| Asset | Symbol | Polygon Contract Address | Role |
| :--- | :--- | :--- | :--- |
| **USD Coin** | `USDC` | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | Primary routing token |
| **Tether USD** | `USDT` | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | Global dollar stablecoin |
| **Monerium Euro** | `EURe` | `0x18ec0A6E18E5bc37916924774E37bf1536993a9a` | Authorized SEPA Euro on-chain |
| **Circle Euro** | `EURC` | `0x1aBaEA1f7C25081f3241b7d76D5C7771746B7095` | Circle-issued Euro |
| **Pound Sterling** | `GBPT` | `0x0f85ce675c9603099ac9f417f694e99f57ebbf23` | 100% fiat-backed British Pound |

### 🌐 Curated Cryptocurrencies

| Asset | Symbol | Network | Contract / Type |
| :--- | :--- | :--- | :--- |
| **Nimiq** | `NIM` | Nimiq Network (`0`) | Native Browser PoS Coin |
| **BNB** | `BNB` | BNB Chain (`56`) | Native Gas Token |
| **Ethereum** | `ETH` | Base (`8453`) | Native L2 Ether |
| **Polygon** | `POL` | Polygon (`137`) | Native Gas Token |
| **Wrapped Bitcoin** | `WBTC` | Polygon (`137`) | `0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6` |
| **PancakeSwap** | `CAKE` | BNB Chain (`56`) | `0x0E09FaBB73BD3Ade0a17ECC321fD13a19e81cE82` |
| **Floki** | `FLOKI` | BNB Chain (`56`) | `0xfb5b838b6cfeedc2873ab27866079ac55363d07e` |

---

## 🛠️ Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│                   Nimiq Pay Mobile App                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │               OMNIM Mini-App WebView             │  │
│  │                                                  │  │
│  │  ┌─────────────────┐       ┌──────────────────┐  │  │
│  │  │  window.nimiq   │       │ window.ethereum  │  │  │
│  │  │  (@nimiq/sdk)   │       │   (EIP-1193)     │  │  │
│  │  └────────┬────────┘       └────────┬─────────┘  │  │
│  └───────────┼─────────────────────────┼────────────┘  │
└──────────────┼─────────────────────────┼───────────────┘
               │                         │
       NIM Native Flow          Cross-Chain Execution
      (Nimiq Pay Hub)             (Relay Protocol)
               │                         │
               ▼                         ▼
         Nimiq Network         BNB Chain / Polygon / Base
                               (10 Stocks, Gold, Silver, Fiat)
```

* **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons.
* **Wallet Rails**: `@nimiq/mini-app-sdk`, EIP-1193 Standard Provider (`viem`).
* **Cross-Chain Rail**: Relay Client (`https://api.relay.link/quote/v2`).
* **Visual Identity**: Official Google Favicon & Brand API (128px).

---

## 🚀 Running the Project Locally

### 1. Prerequisites
* Node.js v18+ (tested on Node v20/v22/v24)
* npm or pnpm

### 2. Installation & Setup
```bash
# Clone the repository
git clone https://github.com/kazzysax/OMNIM.git
cd OMNIM

# Install dependencies
npm install

# Start the Vite development server
npm run dev

# Build for production
npm run build
```

### 3. Testing inside Nimiq Pay
1. Open **Nimiq Pay** on your mobile device.
2. In Nimiq Pay's Developer / Mini-Apps tab, enter your local IP address (e.g. `http://192.168.1.X:5173`).
3. OMNIM will automatically detect `window.nimiq` and `window.ethereum` and establish consensus.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
