<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { formatUnits } from 'viem';
	import { getATokenBalance } from '$lib/aave.js';
	import type { AssetInfo } from '$lib/types.js';
	import GrowthChart from './GrowthChart.svelte';

	interface Props {
		address: `0x${string}`;
		asset: AssetInfo;
	}

	let { address, asset }: Props = $props();

	const apy          = $derived(asset.apy ?? 0);
	const aTokenAddress = $derived(asset.aTokenAddress!);

	// Plain JS anchor — not reactive, avoids $effect loops
	let _anchor = { base: 0, time: 0 };
	let displayNum = $state(0);

	const SEC_PER_YEAR = 31_536_000;

	async function refreshFromChain() {
		const raw  = await getATokenBalance(address, aTokenAddress);
		_anchor = { base: parseFloat(formatUnits(raw, asset.decimals)), time: Date.now() };
		displayNum = _anchor.base;
	}

	let tickInterval:  ReturnType<typeof setInterval>;
	let chainInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		refreshFromChain();
		tickInterval = setInterval(() => {
			if (_anchor.base === 0) return;
			const dt = (Date.now() - _anchor.time) / 1000;
			displayNum = _anchor.base + _anchor.base * (apy / 100) * dt / SEC_PER_YEAR;
		}, 100);
		chainInterval = setInterval(refreshFromChain, 30_000);
	});

	onDestroy(() => {
		clearInterval(tickInterval);
		clearInterval(chainInterval);
	});

	// 4 decimals: "100.12" (large) + "34" (small)
	const formatted = $derived.by(() => {
		const s  = displayNum.toFixed(4);
		const [w = '0', f = ''] = s.split('.');
		const p  = f.padEnd(4, '0');
		return { head: `${w}.${p.slice(0, 2)}`, tail: p.slice(2) };
	});

	const principalEur = $derived(_anchor.base);
</script>

<div class="slide-up flex flex-col gap-3">

	<!-- Main counter card -->
	<div
		class="relative overflow-hidden rounded-2xl p-6 text-center"
		style="background: var(--surface); border: 1px solid rgba(22,163,74,0.25); box-shadow: 0 4px 20px rgba(22,163,74,0.1)"
	>
		<span class="float-sparkle  absolute left-5  top-4    text-base" style="color: rgba(249,115,22,0.4)">✦</span>
		<span class="float-sparkle-2 absolute right-7 top-3   text-sm"  style="color: rgba(22,163,74,0.4)">✦</span>
		<span class="float-sparkle-3 absolute left-8  bottom-6 text-xs" style="color: rgba(55,55,200,0.3)">✦</span>
		<span class="float-sparkle  absolute right-5  bottom-8 text-xs" style="color: rgba(249,115,22,0.25)">✦</span>

		<p class="mb-4 text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">
			Your {asset.symbol} Yield Balance
		</p>

		<div class="counter-tick flex items-baseline justify-center gap-0">
			<span class="text-5xl font-black tabular-nums" style="color: var(--text)">{formatted.head}</span>
			<span class="text-3xl font-black tabular-nums" style="color: var(--text-muted)">{formatted.tail}</span>
			<span class="ml-2 text-sm font-bold" style="color: var(--text-muted)">{asset.symbol}</span>
		</div>

		<div class="mt-4 flex items-center justify-center gap-2">
			<span class="glow-ring inline-block h-2.5 w-2.5 rounded-full" style="background: var(--green)"></span>
			<span class="text-xs font-semibold" style="color: var(--text-dim)">
				Earning {apy.toFixed(2)}% APY · live
			</span>
		</div>

		<div
			class="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
			style="background: var(--green-light); border: 1px solid rgba(22,163,74,0.2)"
		>
			<span class="sparkle text-xs" style="color: var(--green)">✦</span>
			<img src="/img/aave-aave-logo.png" alt="Aave" class="h-3.5 w-3.5" />
			<span class="text-xs font-bold" style="color: var(--green)">{apy.toFixed(2)}% APY on Aave v3</span>
		</div>
	</div>

	<!-- Growth projection -->
	{#if principalEur > 0}
		<div
			class="rounded-2xl p-4"
			style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(55,55,200,0.06)"
		>
			<p class="mb-3 text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">
				Projected Growth
			</p>
			<GrowthChart principal={principalEur} {apy} />
		</div>
	{/if}

</div>
