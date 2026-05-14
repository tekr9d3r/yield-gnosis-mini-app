# Yield — Gnosis App Mini App

A [Gnosis App Mini App](https://www.aboutcircles.com) that lets users deposit **EURe** and **USDC.e** into [Aave v3](https://aave.com) on Gnosis Chain to earn yield — with live ticking balances that grow in real time.

---

## Features

- **Deposit EURe & USDC.e** into Aave v3 with a single tap — approve + supply batched in one transaction
- **Live earning counter** — balance updates every 100ms using float accrual math, no flicker
- **Inline deposit/withdraw** — no page navigation, forms expand directly in the card
- **Always-visible earning cards** — APY banner + invite to deposit even before funds are committed
- **Subtle growth chart** — SVG line that draws on mount, gives a feel of funds growing
- **Wallet sheet** — bottom drawer showing deposited + wallet balances with live ticking
- **APY & TVL** fetched from DeFiLlama, cached for 5 minutes
- **ETH/EUR prices** from DeFiLlama + Frankfurter API

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit 2 + Svelte 5 (runes mode) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Chain reads | viem v2 — `createPublicClient` on Gnosis Chain |
| Wallet / Tx | `@aboutcircles/miniapp-sdk` |
| Deploy | Vercel (adapter-vercel) |

---

## Contracts — Gnosis Chain (chainId 100)

| Contract | Address |
|---|---|
| Aave v3 Pool | `0xb50201558B00496A145fE76f7424749556E326D8` |
| EURe | `0xcb444e90d8198415266c6a2724b7900fb12fc56e` |
| USDC.e | `0x2a22f9c3b484c3629090feed35f17ff8f88f76f0` |

aToken addresses are resolved at runtime via `pool.getReserveData(asset).aTokenAddress`.

---

## Getting Started

```bash
npm install
npm run dev
```

In dev mode the app loads with a mock address so you can see the UI without a connected wallet. Connect via the Circles Mini App environment for real transactions.

---

## Project Structure

```
src/
├── lib/
│   ├── assets.ts      # Static config for supported tokens
│   ├── aave.ts        # aToken reads, encodeApprove/Supply/Withdraw
│   ├── balances.ts    # Fetches all ERC20 balances in parallel
│   ├── defilama.ts    # APY + TVL from DeFiLlama (5-min cache)
│   ├── prices.ts      # ETH/USD + USD/EUR rates
│   ├── chains.ts      # publicClient, ABIs, contract addresses
│   └── types.ts       # AssetInfo, AppPhase
├── components/
│   ├── DepositedTable.svelte  # Always-visible earning cards (2-col grid)
│   ├── AssetTable.svelte      # Wallet balance + APY spreadsheet
│   ├── InlineDeposit.svelte   # Inline deposit form (slide-down)
│   ├── GrowthLine.svelte      # Animated SVG growth chart
│   ├── WalletSheet.svelte     # Bottom sheet wallet overview
│   └── TokenLogo.svelte       # Logo with colored fallback
└── routes/
    └── +page.svelte           # Root page — phase state machine
```

---

## Live Counter Implementation

Balances tick every 100ms using plain JS anchors (not Svelte `$state`) to avoid reactive loops:

```ts
// Anchor stores the chain-read base + timestamp
const _anchors = new Map<string, { base: number; time: number }>();

setInterval(() => {
  const dt = (Date.now() - anchor.time) / 1000;
  displayNum = anchor.base + anchor.base * (apy / 100) * dt / 31_536_000;
}, 100);
```

The chain balance is re-read every 30s to stay accurate. Only `displayNums` is `$state` — the Map reference is replaced on each tick to trigger a single Svelte re-render.

---

## Built by

**Tekr0x.eth** — [@tekr0x on X](https://x.com/tekr0x)
