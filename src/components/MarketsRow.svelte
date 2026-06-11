<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let { address, onOpen, onPrices }: {
		address: string | null;
		onOpen: (sym: string) => void;
		onPrices?: (prices: Record<string, number>) => void;
	} = $props();

	type PriceData = { eur: number; change: number };
	type PriceMap = Record<string, PriceData>;

	const PRIMARY = [
		{ sym: 'BTC',  name: 'Bitcoin',  logo: '/img/bitcoin.png',  cgId: 'bitcoin'      },
		{ sym: 'ETH',  name: 'Ethereum', logo: '/img/ethereum.png', cgId: 'ethereum'     },
		{ sym: 'GNO',  name: 'Gnosis',   logo: '/img/gnosis.png',   cgId: 'gnosis'       },
	];

	const SECONDARY = [
		{ sym: 'XDAI', name: 'xDAI',  logo: '/img/xdai.png',  cgId: 'xdai'         },
		{ sym: 'COW',  name: 'CoW',   logo: '/img/cow.png',   cgId: 'cow-protocol' },
		{ sym: 'AAVE', name: 'Aave',  logo: '/img/aave.png',  cgId: 'aave'         },
	];

	const ALL_TOKENS = [...PRIMARY, ...SECONDARY];

	let prices   = $state<PriceMap>({});
	let loading  = $state(true);
	let expanded = $state(false);

	async function fetchPrices() {
		try {
			const ids = 'bitcoin,ethereum,gnosis,xdai,cow-protocol,aave';
			const r = await fetch(
				`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`
			);
			if (!r.ok) return;
			const d = await r.json();
			const next: PriceMap = {};
			for (const t of ALL_TOKENS) {
				const entry = d[t.cgId];
				if (entry) next[t.sym] = { eur: entry.eur, change: entry.eur_24h_change ?? 0 };
			}
			prices = next;
			onPrices?.(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v.eur])));
		} catch { /* keep showing cached / shimmer */ }
		finally { loading = false; }
	}

	let interval: ReturnType<typeof setInterval>;
	onMount(() => {
		fetchPrices();
		interval = setInterval(fetchPrices, 60_000);
	});
	onDestroy(() => clearInterval(interval));

	function fmtPrice(eur: number): string {
		if (eur >= 10000) return '€' + eur.toLocaleString('en-US', { maximumFractionDigits: 0 });
		if (eur >= 100)   return '€' + eur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		return '€' + eur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
	}
</script>

<!-- Row header -->
<div class="mb-1.5 px-5">
	<span class="text-[11.5px] font-black uppercase tracking-widest" style="color:var(--text-dim);">Invest</span>
</div>

<!-- Primary tiles -->
<div class="flex gap-2.5 px-4" class:mb-2={expanded} class:mb-4={!expanded}>
	{#each PRIMARY as token, i}
		{@render tile(token, i)}
	{/each}
</div>

<!-- Secondary tiles (expandable) -->
{#if expanded}
	<div class="mb-4 flex gap-2.5 px-4">
		{#each SECONDARY as token, i}
			{@render tile(token, i + PRIMARY.length)}
		{/each}
	</div>
{/if}

<!-- Expand toggle -->
<div class="mb-4 flex justify-center">
	<button
		onclick={() => (expanded = !expanded)}
		class="flex items-center gap-1 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
		style="background:var(--ghost-bg);color:var(--text-muted);border:var(--card-border);"
	>
		{expanded ? 'Show less' : 'Show more'}
		<svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="transition:transform 0.2s;transform:rotate({expanded ? 180 : 0}deg);">
			<path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</button>
</div>

{#snippet tile(token: typeof PRIMARY[0], i: number)}
	<button
		onclick={() => onOpen(token.sym)}
		class="flex min-w-0 flex-1 flex-col gap-2 rounded-[var(--r-md)] p-3 text-left transition-all active:scale-95"
		style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);animation:floatUp 0.3s ease both;animation-delay:{i * 0.05}s;"
	>
		{#if loading && !prices[token.sym]}
			<div class="flex items-center gap-1.5">
				<div class="h-[26px] w-[26px] rounded-full" style="background:linear-gradient(90deg,var(--ghost-bg) 25%,var(--inline-bg) 50%,var(--ghost-bg) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;"></div>
				<div class="h-3.5 w-8 rounded" style="background:linear-gradient(90deg,var(--ghost-bg) 25%,var(--inline-bg) 50%,var(--ghost-bg) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;"></div>
			</div>
			<div class="h-3.5 w-14 rounded" style="background:linear-gradient(90deg,var(--ghost-bg) 25%,var(--inline-bg) 50%,var(--ghost-bg) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;"></div>
		{:else}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1.5">
					<img src={token.logo} alt={token.sym} width="26" height="26" class="rounded-full object-cover" />
					<span class="text-[13.5px] font-extrabold" style="color:var(--text);">{token.sym}</span>
				</div>
				<div class="flex h-5 w-5 items-center justify-center rounded-full" style="background:var(--accent-soft);">
					<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
						<path d="M2.5 7.5L7.5 2.5M7.5 2.5H4M7.5 2.5V6" stroke="var(--accent)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</div>
			</div>
			<div class="flex flex-col gap-0.5">
				{#if prices[token.sym]}
					<span class="tnum truncate text-[13.5px] font-bold leading-none" style="color:var(--text);">{fmtPrice(prices[token.sym].eur)}</span>
					{@const change = prices[token.sym].change}
					<span class="text-[10.5px] font-semibold leading-none" style="color:{change >= 0 ? 'var(--yield)' : 'var(--down)'};">
						{change >= 0 ? '▲' : '▼'}{Math.abs(change).toFixed(2)}%
					</span>
				{:else}
					<span class="text-[12px]" style="color:var(--text-dim);">—</span>
				{/if}
			</div>
		{/if}
	</button>
{/snippet}
