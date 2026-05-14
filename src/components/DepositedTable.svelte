<script lang="ts">
	import { slide } from 'svelte/transition';
	import { onDestroy, onMount } from 'svelte';
	import { formatUnits } from 'viem';
	import { sendTransactions } from '@aboutcircles/miniapp-sdk';
	import { encodeWithdraw } from '$lib/aave.js';
	import { AAVE_POOL } from '$lib/chains.js';
	import type { AssetInfo } from '$lib/types.js';
	import TokenLogo from './TokenLogo.svelte';
	import GrowthLine from './GrowthLine.svelte';
	import InlineDeposit from './InlineDeposit.svelte';

	interface Props {
		assets: AssetInfo[];
		address: `0x${string}`;
		onWithdrawDone: () => void;
		onDeposited: () => void;
	}

	let { assets, address, onWithdrawDone, onDeposited }: Props = $props();

	let expandedCardId = $state<string | null>(null);

	const deposited = $derived(assets.filter(a => a.depositedBalance > 0n));

	// ── Tick: plain JS anchors, only displayNums is reactive ─────────────────
	// Keeping anchors out of $state avoids the reactive-loop where updating
	// displayNums triggers $effect → resets anchors → counter flashes.

	type Anchor = { base: number; time: number };
	const _anchors = new Map<string, Anchor>();   // not reactive
	let displayNums = $state(new Map<string, number>());

	const SEC_PER_YEAR = 31_536_000;

	let interval: ReturnType<typeof setInterval>;

	onMount(() => {
		interval = setInterval(() => {
			const now  = Date.now();
			const next = new Map<string, number>();

			for (const a of assets) {
				if (a.depositedBalance === 0n) continue;
				const base = parseFloat(formatUnits(a.depositedBalance, a.decimals));

				// Re-seed only when the chain-fetched balance changes
				let anchor = _anchors.get(a.id);
				if (!anchor || Math.abs(anchor.base - base) > 1e-10) {
					anchor = { base, time: now };
					_anchors.set(a.id, anchor);
				}

				if (!a.apy) { next.set(a.id, base); continue; }
				const dt = (now - anchor.time) / 1000;
				next.set(a.id, anchor.base + anchor.base * (a.apy / 100) * dt / SEC_PER_YEAR);
			}

			displayNums = next;
		}, 100);
	});

	onDestroy(() => clearInterval(interval));

	// ── EUR total ─────────────────────────────────────────────────────────────

	function toEur(asset: AssetInfo, n: number): number {
		if (asset.balance > 0n) {
			const w = parseFloat(formatUnits(asset.balance, asset.decimals));
			return w > 0 ? n * (asset.eurValue / w) : 0;
		}
		if (asset.id === 'eure')                          return n;
		if (asset.id === 'usdc' || asset.id === 'wxdai') return n * 0.92;
		return n * 2500 * 0.92;
	}

	const totalEur = $derived.by(() => {
		let sum = 0;
		for (const a of deposited) sum += toEur(a, displayNums.get(a.id) ?? 0);
		return sum;
	});

	// ── Withdraw ─────────────────────────────────────────────────────────────

	let withdrawingId = $state<string | null>(null);
	let errorId       = $state<string | null>(null);
	let errorMsg      = $state<string | null>(null);

	async function withdraw(asset: AssetInfo) {
		withdrawingId = asset.id; errorId = null; errorMsg = null;
		try {
			await sendTransactions([{ to: AAVE_POOL, data: encodeWithdraw(asset.address, address) }]);
			onWithdrawDone();
		} catch (e: unknown) {
			errorMsg = e instanceof Error ? e.message : 'Transaction rejected';
			errorId  = asset.id; withdrawingId = null;
		}
	}

	// ── Formatting ────────────────────────────────────────────────────────────

	// Max 4 decimals, trailing zeros beyond 2 trimmed
	function fmtBal(n: number): string {
		if (n === 0) return '0';
		if (n < 0.0001) return '<0.0001';
		return n.toLocaleString('en', { maximumFractionDigits: 4 });
	}

	// Total: "€312.12" (large) + "34567890" (smaller)  [2+8=10 decimals]
	function fmtTotal(n: number): { head: string; tail: string } {
		const s = n.toFixed(10);
		const [w = '0', f = ''] = s.split('.');
		const p = f.padEnd(10, '0');
		return { head: `€${w}.${p.slice(0, 2)}`, tail: p.slice(2) };
	}
</script>

<div class="flex flex-col gap-1">

	<!-- ── Live total card ────────────────────────────────────────────────── -->
	{#if totalEur > 0}
		{@const tot = fmtTotal(totalEur)}
		<div
			class="relative mb-2 overflow-hidden rounded-2xl px-5 py-4"
			style="background: var(--surface); border: 1px solid rgba(22,163,74,0.25); box-shadow: 0 4px 16px rgba(22,163,74,0.08)"
		>
			<span class="float-sparkle absolute right-5 top-3 text-sm" style="color: rgba(249,115,22,0.35)">✦</span>
			<div class="mb-2 flex items-center gap-2">
				<span class="glow-ring inline-block h-2 w-2 rounded-full" style="background: var(--green)"></span>
				<p class="text-xs font-bold uppercase tracking-widest" style="color: var(--green)">Deposited · Earning</p>
			</div>
			<div class="flex items-baseline gap-0">
				<span class="text-3xl font-black tabular-nums" style="color: var(--text)">{tot.head}</span>
				<span class="text-xl font-black tabular-nums" style="color: var(--text-muted)">{tot.tail}</span>
			</div>
		</div>
	{:else}
		<div
			class="relative mb-2 overflow-hidden rounded-2xl px-5 py-4"
			style="background: var(--surface); border: 1px solid var(--border)"
		>
			<span class="float-sparkle absolute right-5 top-3 text-sm" style="color: rgba(249,115,22,0.2)">✦</span>
			<p class="mb-2 text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">Your Earnings</p>
			<p class="text-3xl font-black tabular-nums" style="color: var(--text-dim)">€0.00</p>
			<p class="mt-1 text-xs" style="color: var(--text-dim)">Deposit below to start earning yield on Aave v3</p>
		</div>
	{/if}

	<!-- ── Asset cards (2-column grid) — always show all assets ─────────── -->
	<div class="grid grid-cols-2 gap-3">
		{#each assets as asset (asset.id)}
			{@const hasDeposit = asset.depositedBalance > 0n}
			{@const bal = fmtBal(displayNums.get(asset.id) ?? 0)}
			<div
				class="flex flex-col overflow-hidden rounded-2xl"
				style="background: var(--surface); border: 1px solid {hasDeposit ? 'rgba(22,163,74,0.2)' : 'var(--border)'}"
			>
				<!-- ① APY banner -->
				{#if asset.apy !== null}
					<div
						class="flex items-center justify-between px-3 py-2"
						style="background: {hasDeposit ? 'rgba(22,163,74,0.07)' : 'rgba(55,55,200,0.05)'}; border-bottom: 1px solid {hasDeposit ? 'rgba(22,163,74,0.12)' : 'rgba(55,55,200,0.1)'}"
					>
						<span class="text-xs font-semibold" style="color: var(--text-dim)">APY</span>
						<span class="text-base font-black tabular-nums" style="color: {hasDeposit ? 'var(--green)' : 'var(--blue)'}">{asset.apy.toFixed(2)}%</span>
					</div>
				{:else if asset.apyLoading}
					<div class="px-3 py-2" style="border-bottom: 1px solid var(--border)">
						<div class="ml-auto h-4 w-12 animate-pulse rounded" style="background: var(--surface-2)"></div>
					</div>
				{/if}

				<!-- ② Token identity -->
				<div class="flex items-center gap-2 px-3 pt-3 pb-2">
					<TokenLogo symbol={asset.symbol} logoUrl={asset.logoUrl} size={26} />
					<div class="min-w-0">
						<p class="truncate text-sm font-bold leading-none mb-0.5" style="color: var(--text)">{asset.symbol}</p>
						<span class="inline-flex items-center gap-0.5 text-xs font-semibold" style="color: #8888a0">
							<img src="/img/aave-aave-logo.png" alt="" class="h-2.5 w-2.5 mr-0.5" />Aave v3
						</span>
					</div>
				</div>

				{#if hasDeposit}
					<!-- ③ Live balance -->
					<div class="px-3 pb-1">
						<p class="text-xs font-semibold mb-0.5" style="color: var(--text-dim)">Earning</p>
						<p class="text-xl font-black tabular-nums leading-none" style="color: var(--text)">{bal}</p>
					</div>

					<!-- ④ Growth chart -->
					<div class="overflow-hidden" style="height:30px">
						<GrowthLine id={asset.id} />
					</div>

					<!-- ⑤ Actions: Earn + Withdraw -->
					<div class="flex gap-1.5 px-3 pb-3 pt-2">
						<button
							onclick={() => { expandedCardId = expandedCardId === asset.id ? null : asset.id; }}
							disabled={withdrawingId !== null || asset.balance === 0n}
							class="earn-btn flex-1 rounded-xl py-2 text-xs font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
							style="background: {expandedCardId === asset.id ? 'var(--surface-2)' : 'var(--blue)'}; color: {expandedCardId === asset.id ? 'var(--text-muted)' : '#fff'}; border: {expandedCardId === asset.id ? '1.5px solid var(--border)' : 'none'}"
						>
							{expandedCardId === asset.id ? 'Cancel' : '+ Earn'}
						</button>
						<button
							onclick={() => withdraw(asset)}
							disabled={withdrawingId !== null}
							class="flex-1 rounded-xl py-2 text-xs font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
							style="border: 1.5px solid var(--border); color: var(--text-muted)"
							onmouseenter={(e) => { if (!withdrawingId) { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; } }}
							onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
						>
							{withdrawingId === asset.id ? '…' : 'Out'}
						</button>
					</div>
				{:else}
					<!-- ③ Empty state — invite to deposit -->
					<div class="px-3 pb-3 pt-1">
						<p class="mb-0.5 text-xs font-semibold" style="color: var(--text-dim)">Not earning yet</p>
						{#if asset.apy !== null}
							<p class="text-xs" style="color: var(--text-dim)">
								Earn {asset.apy.toFixed(2)}% on your {asset.symbol}
							</p>
						{/if}
					</div>

					<!-- ⑤ Actions: Earn only (full-width) -->
					<div class="mt-auto px-3 pb-3">
						<button
							onclick={() => { expandedCardId = expandedCardId === asset.id ? null : asset.id; }}
							disabled={asset.balance === 0n}
							class="earn-btn w-full rounded-xl py-2 text-xs font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
							style="background: {expandedCardId === asset.id ? 'var(--surface-2)' : 'var(--blue)'}; color: {expandedCardId === asset.id ? 'var(--text-muted)' : '#fff'}; border: {expandedCardId === asset.id ? '1.5px solid var(--border)' : 'none'}"
						>
							{expandedCardId === asset.id ? 'Cancel' : '+ Earn'}
						</button>
						{#if asset.balance === 0n}
							<p class="mt-1.5 text-center text-xs" style="color: var(--text-dim)">No {asset.symbol} in wallet</p>
						{/if}
					</div>
				{/if}

				<!-- Inline deposit form -->
				{#if expandedCardId === asset.id}
					<div transition:slide={{ duration: 200 }} class="px-3 pb-3">
						<InlineDeposit
							{asset}
							{address}
							onDeposited={() => { expandedCardId = null; onDeposited(); }}
							onCancel={() => (expandedCardId = null)}
						/>
					</div>
				{/if}

				{#if errorId === asset.id && errorMsg}
					<p class="px-3 pb-2 text-xs" style="color: #dc2626">{errorMsg}</p>
				{/if}
			</div>
		{/each}
	</div>

</div>

<style>
	.earn-btn {
		position: relative;
		overflow: hidden;
		transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
	}

	.earn-btn:hover:not(:disabled) {
		background: var(--blue-hover) !important;
		transform: scale(1.04);
		box-shadow: 0 0 16px rgba(55, 55, 200, 0.45), 0 4px 12px rgba(55, 55, 200, 0.3);
	}

	.earn-btn::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.28) 50%, transparent 65%);
		transform: translateX(-120%);
	}

	.earn-btn:hover:not(:disabled)::after {
		animation: earn-shimmer 0.45s ease-out forwards;
	}

	@keyframes earn-shimmer {
		to { transform: translateX(120%); }
	}
</style>