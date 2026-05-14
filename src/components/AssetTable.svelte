<script lang="ts">
	import { slide } from 'svelte/transition';
	import { formatUnits } from 'viem';
	import type { AssetInfo } from '$lib/types.js';
	import TokenLogo from './TokenLogo.svelte';
	import InlineDeposit from './InlineDeposit.svelte';

	interface Props {
		assets: AssetInfo[];
		address: `0x${string}`;
		onDeposited: () => void;
	}

	let { assets, address, onDeposited }: Props = $props();

	let expandedId = $state<string | null>(null);

	function toggle(asset: AssetInfo) {
		expandedId = expandedId === asset.id ? null : asset.id;
	}

	function handleDeposited() {
		expandedId = null;
		onDeposited();
	}

	function fmtBalance(asset: AssetInfo): string {
		const n = parseFloat(formatUnits(asset.balance, asset.decimals));
		if (n === 0) return '—';
		if (n < 0.0001) return '<0.0001';
		if (n < 1) return n.toFixed(4);
		return n.toLocaleString('en', { maximumFractionDigits: 4, minimumFractionDigits: 0 });
	}

	function fmtEur(val: number): string {
		if (val < 0.01) return '';
		if (val < 1) return '≈€' + val.toFixed(2);
		return '≈€' + val.toLocaleString('en', { maximumFractionDigits: 0 });
	}

	function hasBalance(asset: AssetInfo): boolean {
		return parseFloat(formatUnits(asset.balance, asset.decimals)) > 0;
	}

	function fmtTvl(usd: number): string {
		if (usd >= 1_000_000_000) return '$' + (usd / 1_000_000_000).toFixed(1) + 'B';
		if (usd >= 1_000_000)     return '$' + (usd / 1_000_000).toFixed(1) + 'M';
		if (usd >= 1_000)         return '$' + (usd / 1_000).toFixed(0) + 'k';
		return '$' + usd.toFixed(0);
	}
</script>

<div class="flex flex-col gap-1">

	<!-- Header -->
	<div class="grid items-center gap-2 px-3 pb-1" style="grid-template-columns: 1fr 90px 58px 64px">
		<span class="text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">Asset</span>
		<span class="text-right text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">Balance</span>
		<span class="text-right text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">APY</span>
		<span></span>
	</div>

	<!-- Rows -->
	{#each assets as asset (asset.id)}
		<div class="flex flex-col rounded-2xl" style="background: var(--surface)">

			<!-- Main row -->
			<div class="grid items-center gap-2 px-3 py-3" style="grid-template-columns: 1fr 90px 58px 64px">

				<!-- Asset: logo + name -->
				<div class="flex min-w-0 items-center gap-2.5">
					<TokenLogo symbol={asset.symbol} logoUrl={asset.logoUrl} size={36} />
					<div class="min-w-0">
						<p class="truncate text-sm font-bold" style="color: var(--text)">{asset.symbol}</p>
						<p class="truncate text-xs" style="color: var(--text-dim)">{asset.name}</p>
					</div>
				</div>

				<!-- Balance -->
				<div class="text-right">
					<p class="text-sm font-bold tabular-nums" style="color: {hasBalance(asset) ? 'var(--text)' : 'var(--text-dim)'}">
						{fmtBalance(asset)}
					</p>
					{#if hasBalance(asset) && asset.eurValue >= 0.01}
						<p class="text-xs tabular-nums" style="color: var(--text-dim)">{fmtEur(asset.eurValue)}</p>
					{/if}
				</div>

				<!-- APY + TVL -->
				<div class="text-right">
					{#if asset.apyLoading}
						<div class="ml-auto h-4 w-10 animate-pulse rounded" style="background: var(--surface-2)"></div>
					{:else if asset.apy !== null}
						<span class="inline-block rounded-full px-2 py-0.5 text-xs font-black tabular-nums" style="background: var(--green-light); color: var(--green)">
							{asset.apy.toFixed(2)}%
						</span>
						{#if asset.tvl !== null}
							<p class="mt-0.5 text-xs tabular-nums" style="color: var(--text-dim)">{fmtTvl(asset.tvl)}</p>
						{/if}
					{:else}
						<span class="text-xs" style="color: var(--text-dim)">—</span>
					{/if}
				</div>

				<!-- Earn button -->
				<div class="flex justify-end">
					<button
						onclick={() => toggle(asset)}
						disabled={!hasBalance(asset)}
						class="earn-btn rounded-xl px-3 py-1.5 text-xs font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
						style="background: {expandedId === asset.id ? 'var(--surface-2)' : 'var(--blue)'}; color: {expandedId === asset.id ? 'var(--text-muted)' : 'white'}; border: {expandedId === asset.id ? '1.5px solid var(--border)' : 'none'}"
					>
						{expandedId === asset.id ? 'Cancel' : 'Earn'}
					</button>
				</div>
			</div>

			<!-- Inline deposit form -->
			{#if expandedId === asset.id}
				<div transition:slide={{ duration: 200 }} class="px-3 pb-3">
					<InlineDeposit
						{asset}
						{address}
						onDeposited={handleDeposited}
						onCancel={() => (expandedId = null)}
					/>
				</div>
			{/if}

		</div>
	{/each}

</div>

<style>
	.earn-btn {
		position: relative;
		overflow: hidden;
		transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease;
	}

	.earn-btn:hover:not(:disabled) {
		transform: scale(1.04);
		box-shadow: 0 0 14px rgba(55, 55, 200, 0.4), 0 4px 10px rgba(55, 55, 200, 0.25);
	}

	.earn-btn::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.25) 50%, transparent 65%);
		transform: translateX(-120%);
	}

	.earn-btn:hover:not(:disabled)::after {
		animation: earn-shimmer 0.45s ease-out forwards;
	}

	@keyframes earn-shimmer {
		to { transform: translateX(120%); }
	}
</style>
