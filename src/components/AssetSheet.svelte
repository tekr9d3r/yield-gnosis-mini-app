<script lang="ts">
	import { onMount } from 'svelte';
	import { sendTransactions } from '@aboutcircles/miniapp-sdk';
	import {
		EURE_ADDRESS, WBTC_ADDRESS, WETH_ADDRESS, GNO_ADDRESS,
		SDAI_ADDRESS, COW_TOKEN_ADDRESS, AAVE_TOKEN_ADDRESS,
		COW_SETTLEMENT, COW_VAULT_RELAYER,
		encodeCoWPresign, encodeERC20Approve,
		ERC20_ABI, publicClient,
		type CoWOrderFields
	} from '$lib/chains.js';

	let { sym, address, eureBalance, onClose, onDone }: {
		sym:          'BTC' | 'ETH' | 'GNO' | 'SDAI' | 'COW' | 'AAVE';
		address:      `0x${string}`;
		eureBalance:  bigint;
		onClose:      () => void;
		onDone:       () => void;
	} = $props();

	const TOKEN_CONFIG: Record<string, { name: string; logo: string; address: `0x${string}`; decimals: number }> = {
		BTC:  { name: 'Bitcoin',  logo: '/img/bitcoin.png',  address: WBTC_ADDRESS,      decimals: 8  },
		ETH:  { name: 'Ethereum', logo: '/img/ethereum.png', address: WETH_ADDRESS,      decimals: 18 },
		GNO:  { name: 'Gnosis',   logo: '/img/gnosis.png',   address: GNO_ADDRESS,       decimals: 18 },
		SDAI: { name: 'sDAI',     logo: '/img/sdai.png',     address: SDAI_ADDRESS,      decimals: 18 },
		COW:  { name: 'CoW',      logo: '/img/cow.png',      address: COW_TOKEN_ADDRESS, decimals: 18 },
		AAVE: { name: 'Aave',     logo: '/img/aave.png',     address: AAVE_TOKEN_ADDRESS,decimals: 18 },
	};

	const COW_API = 'https://api.cow.fi/xdai/api/v1';

	type CoWQuoteResp = {
		sellToken: string; buyToken: string; receiver: string | null;
		sellAmount: string; buyAmount: string; validTo: number;
		appData: string; feeAmount: string; kind: string;
		partiallyFillable: boolean; sellTokenBalance: string; buyTokenBalance: string;
	};

	const cfg = $derived(TOKEN_CONFIG[sym]);

	let mode      = $state<'buy' | 'sell'>('buy');
	let amount    = $state('');
	let tokenBal  = $state(0n);
	let quote     = $state<CoWQuoteResp | null>(null);
	let quoteId   = $state<number | null>(null);
	let swapState = $state<'idle' | 'quoting' | 'quoted' | 'confirming' | 'polling' | 'done' | 'error'>('idle');
	let orderUid  = $state('');
	let errMsg    = $state('');

	// Price + change from parent's MarketsRow (we re-fetch independently here)
	let tokenPrice  = $state(0);
	let tokenChange = $state(0);

	const eureAmt = $derived(Number(eureBalance) / 1e18);
	const tokenAmt = $derived(Number(tokenBal) / 10 ** cfg.decimals);

	const availableAmt = $derived(mode === 'buy' ? eureAmt : tokenAmt);
	const availableLabel = $derived(mode === 'buy' ? `€${eureAmt.toFixed(2)} EURe` : `${tokenAmt.toFixed(6)} ${sym}`);

	// Estimate receive for quote preview using market price
	const receiveEst = $derived(() => {
		const n = parseFloat(amount);
		if (!n || tokenPrice === 0) return null;
		if (mode === 'buy')  return (n / tokenPrice).toFixed(8);  // EURe → token
		if (mode === 'sell') return (n * tokenPrice).toFixed(2);  // token → EURe
		return null;
	});

	// Debounce handle
	let quoteTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleQuote() {
		quote = null; quoteId = null;
		if (quoteTimer) clearTimeout(quoteTimer);
		const n = parseFloat(amount);
		if (!n || n <= 0) { swapState = 'idle'; return; }
		swapState = 'quoting';
		quoteTimer = setTimeout(fetchQuote, 600);
	}

	async function fetchQuote() {
		const n = parseFloat(amount);
		if (!n || n <= 0) { swapState = 'idle'; return; }
		try {
			const isBuy = mode === 'buy';
			const sellToken   = isBuy ? EURE_ADDRESS : cfg.address;
			const buyToken    = isBuy ? cfg.address  : EURE_ADDRESS;
			const sellDec     = isBuy ? 18 : cfg.decimals;
			const sellAmountBeforeFee = BigInt(Math.floor(n * 10 ** sellDec)).toString();

			const resp = await fetch(`${COW_API}/quote`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sellToken, buyToken, sellAmountBeforeFee,
					from:     address,
					receiver: address,
					validFor: 1800,
					appData:  '0x0000000000000000000000000000000000000000000000000000000000000000',
					kind:     'sell'
				})
			});
			if (!resp.ok) throw new Error(await resp.text());
			const data = await resp.json();
			quote     = data.quote as CoWQuoteResp;
			quoteId   = data.id ?? null;
			swapState = 'quoted';
		} catch (e: unknown) {
			errMsg    = e instanceof Error ? e.message : 'Quote failed';
			swapState = 'error';
		}
	}

	async function doSwap() {
		if (!quote || swapState === 'confirming' || swapState === 'polling') return;
		swapState = 'confirming'; errMsg = ''; orderUid = '';
		try {
			const q = quote;
			const isBuy = mode === 'buy';
			const sellTokenAddr = isBuy ? EURE_ADDRESS : cfg.address;

			const fullSellAmount = BigInt(q.sellAmount) + BigInt(q.feeAmount);
			const order: CoWOrderFields = {
				sellToken:         q.sellToken as `0x${string}`,
				buyToken:          q.buyToken  as `0x${string}`,
				receiver:          (q.receiver ?? address) as `0x${string}`,
				sellAmount:        fullSellAmount,
				buyAmount:         BigInt(q.buyAmount),
				validTo:           q.validTo,
				appData:           q.appData as `0x${string}`,
				feeAmount:         0n,
				kind:              q.kind,
				partiallyFillable: q.partiallyFillable,
				sellTokenBalance:  q.sellTokenBalance,
				buyTokenBalance:   q.buyTokenBalance
			};

			const postResp = await fetch(`${COW_API}/orders`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sellToken:         order.sellToken,
					buyToken:          order.buyToken,
					receiver:          order.receiver,
					sellAmount:        order.sellAmount.toString(),
					buyAmount:         order.buyAmount.toString(),
					validTo:           order.validTo,
					appData:           order.appData,
					feeAmount:         '0',
					kind:              order.kind,
					partiallyFillable: order.partiallyFillable,
					sellTokenBalance:  order.sellTokenBalance,
					buyTokenBalance:   order.buyTokenBalance,
					signingScheme:     'presign',
					signature:         address,
					from:              address,
					...(quoteId !== null ? { quoteId } : {})
				})
			});
			if (!postResp.ok) throw new Error(await postResp.text());

			const uid = await postResp.json() as string;
			orderUid = uid;

			const txs = [
				{ to: sellTokenAddr,  data: encodeERC20Approve(COW_VAULT_RELAYER, fullSellAmount) },
				{ to: COW_SETTLEMENT, data: encodeCoWPresign(uid as `0x${string}`) }
			];
			await sendTransactions(txs);

			swapState = 'polling';
			pollOrder(uid);
		} catch (e: unknown) {
			errMsg    = e instanceof Error ? e.message : 'Swap failed';
			swapState = 'error';
		}
	}

	async function pollOrder(uid: string) {
		for (let i = 0; i < 100; i++) {
			await new Promise(r => setTimeout(r, 3000));
			try {
				const r = await fetch(`${COW_API}/orders/${encodeURIComponent(uid)}`);
				if (!r.ok) continue;
				const d = await r.json();
				if (d.status === 'fulfilled')  { swapState = 'done'; onDone(); return; }
				if (d.status === 'cancelled' || d.status === 'expired') {
					errMsg = `Order ${d.status}`; swapState = 'error'; return;
				}
			} catch { /* keep polling */ }
		}
		errMsg = 'Order timed out'; swapState = 'error';
	}

	function setPercent(pct: number) {
		const base = availableAmt;
		if (!base) return;
		const val  = base * pct;
		const prec = mode === 'buy' ? 2 : cfg.decimals;
		amount     = val.toFixed(prec);
		scheduleQuote();
	}

	function switchMode(m: 'buy' | 'sell') {
		mode = m; amount = ''; quote = null; quoteId = null;
		swapState = 'idle'; errMsg = '';
	}

	function fmtReceive(v: string | null): string {
		if (!v) return '…';
		const n = parseFloat(v);
		if (mode === 'buy')  return `${n.toFixed(6)} ${sym}`;
		return `€${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function fmtQuoteReceive(): string {
		if (!quote) return '…';
		const isBuy = mode === 'buy';
		const raw   = isBuy ? Number(quote.buyAmount) / 10 ** cfg.decimals : Number(quote.buyAmount) / 1e18;
		return isBuy
			? `${raw.toFixed(6)} ${sym}`
			: `€${raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	const busy = $derived(swapState === 'confirming' || swapState === 'polling');

	onMount(async () => {
		// Fetch token balance for sell mode
		try {
			tokenBal = await publicClient.readContract({ address: cfg.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }) as bigint;
		} catch { tokenBal = 0n; }

		// Fetch current price for estimate display
		try {
			const cgMap: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum', GNO: 'gnosis', SDAI: 'savings-xdai', COW: 'cow-protocol', AAVE: 'aave' };
			const cgId = cgMap[sym] ?? sym.toLowerCase();
			const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=eur&include_24hr_change=true`);
			if (r.ok) {
				const d = await r.json();
				const entry = d[cgId];
				if (entry) { tokenPrice = entry.eur; tokenChange = entry.eur_24h_change ?? 0; }
			}
		} catch { /* non-critical */ }
	});
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-end justify-center"
	style="background:rgba(10,10,46,0.45);backdrop-filter:blur(3px);"
	role="dialog"
	aria-modal="true"
>
	<!-- Sheet panel -->
	<div class="slide-up w-full max-w-md overflow-hidden rounded-t-[28px]"
		style="background:var(--card);">

		<!-- Grab handle -->
		<div class="flex justify-center pt-3 pb-1">
			<div class="h-1 w-10 rounded-full" style="background:var(--border);"></div>
		</div>

		<!-- Header -->
		<div class="flex items-center gap-3 px-5 pt-3 pb-4">
			<img src={cfg.logo} alt={sym} width="44" height="44" class="rounded-full object-cover" style="border:2px solid var(--inline-bg);" />
			<div class="flex-1">
				<div class="text-[18px] font-extrabold leading-tight" style="color:var(--text);">{cfg.name}</div>
				<div class="flex items-center gap-2 text-[13px]" style="color:var(--text-muted);">
					<span>{sym}</span>
					{#if tokenPrice > 0}
						<span class="tnum font-semibold" style="color:var(--text);">
							€{tokenPrice >= 1000
								? tokenPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })
								: tokenPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
						</span>
						<span class="text-[11px] font-semibold" style="color:{tokenChange >= 0 ? 'var(--yield)' : 'var(--down)'};">
							{tokenChange >= 0 ? '▲' : '▼'}{Math.abs(tokenChange).toFixed(2)}%
						</span>
					{/if}
				</div>
			</div>
			<button
				onclick={onClose}
				class="flex h-8 w-8 items-center justify-center rounded-full text-[16px] transition-all active:scale-90"
				style="background:var(--ghost-bg);color:var(--text-muted);"
			>✕</button>
		</div>

		<!-- Content (scrollable) -->
		<div class="overflow-y-auto px-5" style="max-height:70dvh;padding-bottom:max(env(safe-area-inset-bottom),32px);">

			<!-- Buy / Sell toggle -->
			<div class="mb-4 flex overflow-hidden rounded-[var(--r-md)] p-1" style="background:var(--ghost-bg);">
				<button
					onclick={() => switchMode('buy')}
					class="flex-1 rounded-[10px] py-2 text-[14px] font-bold transition-all"
					style="background:{mode === 'buy' ? 'var(--accent)' : 'transparent'};color:{mode === 'buy' ? '#fff' : 'var(--text-muted)'};"
				>Buy {sym}</button>
				<button
					onclick={() => switchMode('sell')}
					class="flex-1 rounded-[10px] py-2 text-[14px] font-bold transition-all"
					style="background:{mode === 'sell' ? 'var(--text)' : 'transparent'};color:{mode === 'sell' ? 'var(--card)' : 'var(--text-muted)'};"
				>Sell {sym}</button>
			</div>

			<!-- Available balance -->
			<div class="mb-3 flex items-center justify-between rounded-[var(--r-md)] px-4 py-2.5" style="background:var(--inline-bg);">
				<span class="text-[12.5px]" style="color:var(--text-muted);">
					{mode === 'buy' ? 'Spend from' : 'Available to sell'}
				</span>
				<span class="tnum text-[13px] font-bold" style="color:var(--text);">{availableLabel}</span>
			</div>

			<!-- Amount input -->
			<div class="mb-3 overflow-hidden rounded-[var(--r-md)]" style="border:2px solid var(--border);">
				<input
					type="number"
					min="0"
					step="any"
					placeholder={mode === 'buy' ? 'EUR amount' : `${sym} amount`}
					bind:value={amount}
					oninput={scheduleQuote}
					disabled={busy}
					class="w-full bg-transparent px-4 py-3.5 text-[20px] font-bold outline-none"
					style="color:var(--text);"
				/>
			</div>

			<!-- % chips -->
			<div class="mb-4 flex gap-2">
				{#each [25, 50, 100] as pct}
					<button
						onclick={() => setPercent(pct / 100)}
						disabled={busy}
						class="flex-1 rounded-[var(--r-md)] py-2 text-[13px] font-bold transition-all active:scale-95"
						style="background:var(--ghost-bg);color:var(--text-muted);"
					>{pct}%</button>
				{/each}
			</div>

			<!-- Quote preview -->
			{#if swapState === 'quoting'}
				<div class="mb-4 flex items-center justify-center gap-2 rounded-[var(--r-md)] py-3" style="background:var(--inline-bg);">
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-transparent" style="border-top-color:var(--accent);border-right-color:var(--accent);"></div>
					<span class="text-[13px]" style="color:var(--text-muted);">Getting quote…</span>
				</div>
			{:else if swapState === 'quoted' && quote}
				<div class="mb-4 rounded-[var(--r-md)] px-4 py-3" style="background:var(--inline-bg);">
					<div class="flex items-center justify-between">
						<div class="text-center">
							<div class="text-[11px] uppercase font-semibold" style="color:var(--text-muted);">You spend</div>
							<div class="tnum text-[14px] font-bold" style="color:var(--text);">
								{mode === 'buy'
									? `€${(Number(quote.sellAmount) / 1e18).toFixed(2)}`
									: `${(Number(quote.sellAmount) / 10 ** cfg.decimals).toFixed(6)} ${sym}`}
							</div>
						</div>
						<div class="text-[18px]" style="color:var(--text-dim);">→</div>
						<div class="text-center">
							<div class="text-[11px] uppercase font-semibold" style="color:var(--text-muted);">You receive</div>
							<div class="tnum text-[14px] font-bold" style="color:var(--yield);">{fmtQuoteReceive()}</div>
						</div>
					</div>
				</div>
			{:else if amount && parseFloat(amount) > 0 && swapState === 'idle'}
				<!-- Estimate from market price while debouncing -->
				<div class="mb-4 rounded-[var(--r-md)] px-4 py-3" style="background:var(--inline-bg);">
					<div class="flex items-center justify-between">
						<div class="text-center">
							<div class="text-[11px] uppercase font-semibold" style="color:var(--text-muted);">You spend</div>
							<div class="tnum text-[14px] font-bold" style="color:var(--text);">
								{mode === 'buy' ? `€${parseFloat(amount).toFixed(2)}` : `${parseFloat(amount).toFixed(6)} ${sym}`}
							</div>
						</div>
						<div class="text-[18px]" style="color:var(--text-dim);">→</div>
						<div class="text-center">
							<div class="text-[11px] uppercase font-semibold" style="color:var(--text-muted);">~You receive</div>
							<div class="tnum text-[14px] font-bold" style="color:var(--text-muted);">{fmtReceive(receiveEst())}</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Error message -->
			{#if swapState === 'error'}
				<div class="mb-4 rounded-[var(--r-md)] px-4 py-3 text-[13px]" style="background:color-mix(in srgb,var(--down) 12%,transparent);color:var(--down);">
					{errMsg}
					<button onclick={() => { swapState = 'idle'; errMsg = ''; }} class="ml-2 underline">Retry</button>
				</div>
			{/if}

			<!-- Order status (polling / done) -->
			{#if swapState === 'polling' || swapState === 'done'}
				<div class="mb-4 rounded-[var(--r-md)] px-4 py-3" style="background:var(--inline-bg);">
					<div class="flex items-center gap-2">
						{#if swapState === 'polling'}
							<div class="h-4 w-4 animate-spin rounded-full border-2 border-transparent" style="border-top-color:var(--accent);border-right-color:var(--accent);"></div>
							<span class="text-[13px]" style="color:var(--text-muted);">Waiting for CoW solver…</span>
						{:else}
							<span class="text-[16px]">✅</span>
							<span class="text-[13px] font-bold" style="color:var(--yield);">Swap fulfilled!</span>
						{/if}
					</div>
					{#if orderUid}
						<a
							href="https://explorer.cow.fi/gc/orders/{orderUid}"
							target="_blank"
							rel="noopener"
							class="mt-1.5 block text-[11.5px]"
							style="color:var(--accent);"
						>View on CoW Explorer ↗</a>
					{/if}
				</div>
			{/if}

			<!-- Action button -->
			<button
				onclick={doSwap}
				disabled={busy || swapState === 'done' || swapState === 'error' || (!quote && swapState !== 'quoting')}
				class="w-full rounded-[var(--r-lg)] py-4 text-[15.5px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
				style="background:{mode === 'buy' ? 'var(--accent)' : 'var(--text)'};box-shadow:{mode === 'buy' ? 'var(--accent-shadow)' : 'none'};"
			>
				{#if swapState === 'confirming'}
					Confirm in wallet…
				{:else if swapState === 'polling'}
					Waiting for fill…
				{:else if swapState === 'done'}
					Done!
				{:else}
					{mode === 'buy' ? 'Buy' : 'Sell'} {sym}
				{/if}
			</button>
		</div>
	</div>
</div>
