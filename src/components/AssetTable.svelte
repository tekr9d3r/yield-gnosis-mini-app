<script lang="ts">
	import { formatUnits } from 'viem';
	import type { AssetInfo } from '$lib/types.js';
	import TokenLogo from './TokenLogo.svelte';

	interface Props {
		assets: AssetInfo[];
		address: `0x${string}`;
		onDeposited: () => void;
		crcBalance?: number;
	}

	let { assets, crcBalance = 0 }: Props = $props();

	function fmtCrc(n: number): string {
		if (n === 0) return '—';
		if (n < 0.01) return '<0.01';
		return n.toLocaleString('en', { maximumFractionDigits: 2 });
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
</script>

<div class="flex flex-col gap-1">

	<!-- Header -->
	<div class="grid items-center gap-2 px-3 pb-1" style="grid-template-columns: 1fr 90px">
		<span class="text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">Asset</span>
		<span class="text-right text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">Balance</span>
	</div>

	<!-- CRC row -->
	<div class="grid items-center gap-2 rounded-2xl px-3 py-3" style="background: var(--surface); grid-template-columns: 1fr 90px">
		<div class="flex min-w-0 items-center gap-2.5">
			<img src="/img/crc-logo.webp" alt="CRC" class="h-9 w-9 shrink-0 rounded-full object-cover" />
			<div class="min-w-0">
				<p class="truncate text-sm font-bold" style="color: var(--text)">CRC</p>
				<p class="truncate text-xs" style="color: var(--text-dim)">Circles</p>
			</div>
		</div>
		<div class="text-right">
			<p class="text-sm font-bold tabular-nums" style="color: {crcBalance > 0 ? 'var(--text)' : 'var(--text-dim)'}">
				{fmtCrc(crcBalance)}
			</p>
		</div>
	</div>

	<!-- Rows -->
	{#each assets as asset (asset.id)}
		<div class="flex flex-col rounded-2xl" style="background: var(--surface)">

			<!-- Main row -->
			<div class="grid items-center gap-2 px-3 py-3" style="grid-template-columns: 1fr 90px">

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
			</div>

		</div>
	{/each}

</div>
