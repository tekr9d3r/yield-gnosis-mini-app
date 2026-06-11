# Yield — Gnosis Circles Miniapp

A [Circles](https://www.aboutcircles.com) miniapp for Gnosis Chain that lets users earn yield, invest in crypto assets, and participate in a weekly prize pot — all from a passkey-secured Gnosis Safe wallet, with no seed phrase required.

---

## Features

### Earn yield
Deposit **EURe** or **USDC.e** into [Aave v3](https://aave.com) on Gnosis Chain. Interest accrues continuously and is visible as a live ticking counter. Withdraw anytime — partial or full.

### Weekly YieldPot
All interest earned across all depositors flows into a shared pot. Every week, one contributor wins the entire pot. The more you deposit and the longer you keep it in, the higher your chance of winning. No-loss — your principal is always safe.

### Invest
Buy and sell **BTC** (WBTC), **ETH** (WETH), and **GNO** directly from your Circles wallet via [CoW Swap](https://swap.cow.fi). Orders use the PRESIGN scheme — no message signing required, fully compatible with Gnosis Safe passkey wallets. Best execution price with MEV protection.

### Passkey secured
Powered by Circles on Gnosis Chain. Wallets are Gnosis Safes controlled by a device passkey — no seed phrase, no browser extension.

---

## Privacy & Security

| Topic | Detail |
|---|---|
| Smart contracts | Aave v3 and CoW Protocol official contracts only — no custom contracts deployed |
| Data storage | None — no database, no backend, no analytics |
| Data collection | None — wallet address is never sent to any server controlled by this app |
| Chain reads | Public RPC only (`rpc.gnosischain.com` with `rpc2.gnosischain.com` fallback) |
| APY data | Public DeFiLlama API — read-only, no auth |
| Price data | Public CoinGecko API — read-only, no auth |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit 2 + Svelte 5 (runes mode) |
| Styling | Tailwind CSS v4 |
| Chain reads | viem v2 — `createPublicClient` on Gnosis Chain |
| Wallet / Tx | `@aboutcircles/miniapp-sdk` — `sendTransactions`, `onWalletChange` |
| Swap | CoW Protocol API (`api.cow.fi/xdai`) — PRESIGN flow |
| Deploy | Vercel (adapter-vercel) |

---

## Contracts — Gnosis Chain (chainId 100)

| Contract | Address |
|---|---|
| Aave v3 Pool | `0xb50201558B00496A145fE76f7424749556E326D8` |
| CoW Settlement | `0x9008D19f58AAbD9eD0D60971565AA8510560ab41` |
| CoW Vault Relayer | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` |
| EURe | `0xcb444e90d8198415266c6a2724b7900fb12fc56e` |
| USDC.e | `0x2a22f9c3b484c3629090feed35f17ff8f88f76f0` |
| WBTC | `0x8e5bbbb09ed1ebde8674cda39a0c169401db4252` |
| WETH | `0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1` |
| GNO | `0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb` |
| YieldPot Group | `0xA7b485Eae7EC8793f29C1ebb268455705c5B67AF` |
| YieldPot Treasury | `0x5C36Ed9663742c791bE6eDB993847c306Cb8f4b3` |

aToken addresses are resolved at runtime via `pool.getReserveData(asset).aTokenAddress`.

---

## Project Structure

```
src/
├── lib/
│   ├── chains.ts      # publicClient, ABIs, contract addresses, CoW helpers
│   ├── aave.ts        # aToken reads, encode supply/withdraw
│   ├── balances.ts    # Fetches all ERC-20 balances in parallel
│   ├── defilama.ts    # APY + TVL from DeFiLlama (5-min cache)
│   ├── prices.ts      # USD/EUR rate
│   └── types.ts       # AssetInfo type
├── components/
│   ├── HeroCard.svelte        # Total balance with live counter
│   ├── PositionCard.svelte    # Per-asset deposit card (deposit/withdraw inline)
│   ├── MarketsRow.svelte      # Invest tiles — live prices for BTC/ETH/GNO
│   ├── AssetSheet.svelte      # Buy/sell bottom sheet via CoW Swap PRESIGN
│   ├── YieldPotCard.svelte    # Weekly pot CTA card
│   ├── YieldPotSheet.svelte   # Full pot details + contribution flow
│   ├── WalletSheet.svelte     # Wallet overview bottom sheet
│   ├── AboutSheet.svelte      # App info, features, builder, tip jar
│   ├── TipJar.svelte          # CRC tip buttons
│   └── TokenLogo.svelte       # Token logo with fallback
└── routes/
    ├── +page.svelte           # Home — phase state machine
    ├── admin/+page.svelte     # Admin tools (gated)
    └── swap/+page.svelte      # s-YIELDPOT ↔ USDC.e via Balancer
```

---

## Getting Started

```bash
npm install
npm run dev
```

The app runs as a Circles miniapp — open it from [circles.gnosis.io](https://circles.gnosis.io) or connect a wallet via the Circles SDK for real transactions.

---

## Built by

**Tekr0x.eth** — [@tekr0x on X](https://x.com/tekr0x)
