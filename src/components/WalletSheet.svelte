<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { formatUnits } from 'viem';
	import { sendTransactions } from '@aboutcircles/miniapp-sdk';
	import { getATokenBalance, encodeWithdraw } from '$lib/aave.js';
	import { AAVE_POOL } from '$lib/chains.js';
	import type { AssetInfo } from '$lib/types.js';
	import TokenLogo from './TokenLogo.svelte';

	interface Props {
		address: `0x${string}`;
		assets: AssetInfo[];
		onClose: () => void;
		onWithdrawDone: () => void;
	}

	let { address, assets, onClose, onWithdrawDone }: Props = $props();

	// ── Deposited balances (plain JS anchors, 100ms smooth tick) ────────────

	type Anchor = { base: number; time: number };
	const _anchors = new Map<string, Anchor>();   // not reactive
	let displayNums = $state(new Map<string, number>());

	const SEC_PER_YEAR = 31_536_000;

	async function loadDeposited() {
		const eligible = assets.filter(a => a.aTokenAddress);
		const results  = await Promise.allSettled(
			eligible.map(a => getATokenBalance(address, a.aTokenAddress!))
		);
		eligible.forEach((a, i) => {
			const raw = results[i].status === 'fulfilled'
				? (results[i] as PromiseFulfilledResult<bigint>).value
				: 0n;
			if (raw > 0n) {
				const base = parseFloat(formatUnits(raw, a.decimals));
				_anchors.set(a.id, { base, time: Date.now() });
			}
		});
	}

	let tickInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		loadDeposited();
		tickInterval = setInterval(() => {
			const now  = Date.now();
			const next = new Map<string, number>();
			for (const [id, anchor] of _anchors) {
				const a = assets.find(x => x.id === id);
				if (!a?.apy) { next.set(id, anchor.base); continue; }
				const dt = (now - anchor.time) / 1000;
				next.set(id, anchor.base + anchor.base * (a.apy / 100) * dt / SEC_PER_YEAR);
			}
			if (next.size) displayNums = next;
		}, 100);
	});

	onDestroy(() => clearInterval(tickInterval));

	// ── Withdraw ──────────────────────────────────────────────────────────────

	let withdrawingId = $state<string | null>(null);
	let withdrawError = $state<string | null>(null);

	async function withdraw(asset: AssetInfo) {
		withdrawingId = asset.id;
		withdrawError = null;
		try {
			await sendTransactions([
				{ to: AAVE_POOL, data: encodeWithdraw(asset.address, address) }
			]);
			onWithdrawDone();
			onClose();
		} catch (e: unknown) {
			withdrawError = e instanceof Error ? e.message : 'Transaction rejected';
			withdrawingId = null;
		}
	}

	// ── Formatting ────────────────────────────────────────────────────────────

	const shortAddr = $derived(address.slice(0, 8) + '…' + address.slice(-6));

	const depositedAssets = $derived(
		assets.filter(a => (displayNums.get(a.id) ?? 0) > 0)
	);

	const walletAssets = $derived(
		assets.filter(a => parseFloat(formatUnits(a.balance, a.decimals)) > 0)
	);

	const totalEur = $derived(assets.reduce((s, a) => s + a.eurValue, 0));

	let copied = $state(false);

	async function copyAddress() {
		await navigator.clipboard.writeText(address);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	function fmtSpot(asset: AssetInfo): string {
		const n = parseFloat(formatUnits(asset.balance, asset.decimals));
		if (n < 0.0001) return '<0.0001';
		return n.toLocaleString('en', { maximumFractionDigits: 4 });
	}

	function fmtEur(val: number): string {
		if (val < 0.01) return '';
		return '≈€' + val.toLocaleString('en', { maximumFractionDigits: 2 });
	}

	function fmtDeposited(asset: AssetInfo): { head: string; tail: string } {
		const n   = displayNums.get(asset.id) ?? 0;
		const str = n.toFixed(4);
		const [w = '0', f = ''] = str.split('.');
		const p = f.padEnd(4, '0');
		return { head: `${w}.${p.slice(0, 2)}`, tail: p.slice(2) };
	}
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-end justify-center"
	style="background: rgba(10,10,46,0.4); backdrop-filter: blur(2px)"
	role="presentation"
	onclick={onClose}
>
	<!-- Sheet -->
	<div
		class="slide-up w-full max-w-md rounded-t-3xl p-6"
		style="background: var(--bg); max-height: 90vh; overflow-y: auto"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
	>
		<!-- Handle -->
		<div class="mx-auto mb-5 h-1 w-10 rounded-full" style="background: var(--border)"></div>

		<!-- Address row -->
		<div class="mb-5 rounded-2xl p-4" style="background: var(--surface); border: 1px solid var(--border)">
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<div class="h-2.5 w-2.5 rounded-full" style="background: var(--green)"></div>
					<span class="font-mono text-sm font-semibold" style="color: var(--text)">{shortAddr}</span>
				</div>
				<button
					onclick={copyAddress}
					class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95"
					style="background: var(--blue-light); color: var(--blue)"
				>
					{copied ? '✓ Copied' : 'Copy'}
				</button>
			</div>
		</div>

		<!-- ── Deposited (Earning) ── -->
		{#if depositedAssets.length > 0}
			<p class="mb-2 text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">
				Deposited · Earning
			</p>

			<div class="mb-4 flex flex-col gap-2">
				{#each depositedAssets as asset (asset.id)}
					{@const fmt = fmtDeposited(asset)}
					<div
						class="rounded-2xl p-4"
						style="background: var(--surface); border: 1px solid rgba(22,163,74,0.25); box-shadow: 0 2px 8px rgba(22,163,74,0.08)"
					>
						<!-- Token row -->
						<div class="mb-3 flex items-center gap-3">
							<TokenLogo symbol={asset.symbol} logoUrl={asset.logoUrl} size={32} />
							<div class="min-w-0 flex-1">
								<p class="text-sm font-bold" style="color: var(--text)">{asset.symbol}</p>
								{#if asset.apy !== null}
									<p class="text-xs font-semibold" style="color: var(--green)">
										{asset.apy.toFixed(2)}% APY · <img src="/img/aave-aave-logo.png" alt="" class="inline h-3 w-3 mx-0.5 -mt-px" />Aave v3
									</p>
								{/if}
							</div>
							<!-- Live indicator -->
							<div class="flex items-center gap-1.5">
								<span class="glow-ring inline-block h-2 w-2 rounded-full" style="background: var(--green)"></span>
								<span class="text-xs font-semibold" style="color: var(--green)">live</span>
							</div>
						</div>

						<!-- Ticking balance -->
						<div class="counter-tick mb-3 flex items-baseline gap-0">
							<span class="text-2xl font-black tabular-nums" style="color: var(--text)">{fmt.head}</span>
							<span class="text-lg font-black tabular-nums" style="color: var(--text-muted)">{fmt.tail}</span>
							<span class="ml-1.5 text-sm font-bold" style="color: var(--text-muted)">{asset.symbol}</span>
						</div>

						<!-- Withdraw button -->
						{#if withdrawError && withdrawingId === asset.id}
							<p class="mb-2 text-xs font-semibold" style="color: #dc2626">{withdrawError}</p>
						{/if}
						<button
							onclick={() => withdraw(asset)}
							disabled={withdrawingId !== null}
							class="w-full rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
							style="background: var(--surface-2); border: 1.5px solid var(--border); color: var(--text-muted)"
							onmouseenter={(e) => { if (!withdrawingId) { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; } }}
							onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
						>
							{withdrawingId === asset.id ? 'Withdrawing…' : 'Withdraw'}
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<!-- ── Wallet balances ── -->
		{#if walletAssets.length > 0}
			<p class="mb-2 text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">
				Wallet
			</p>

			<div class="mb-3 flex flex-col gap-1.5">
				{#each walletAssets as asset (asset.id)}
					<div
						class="flex items-center gap-3 rounded-xl px-4 py-3"
						style="background: var(--surface); border: 1px solid var(--border)"
					>
						<TokenLogo symbol={asset.symbol} logoUrl={asset.logoUrl} size={32} />
						<div class="min-w-0 flex-1">
							<p class="text-sm font-bold" style="color: var(--text)">{asset.symbol}</p>
						</div>
						<span class="font-bold tabular-nums text-sm" style="color: var(--text)">{fmtSpot(asset)}</span>
						{#if asset.eurValue >= 0.01}
							<span class="text-xs tabular-nums" style="color: var(--text-dim)">{fmtEur(asset.eurValue)}</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Total -->
		{#if totalEur >= 0.01}
			<div
				class="mb-5 flex items-center justify-between rounded-xl px-4 py-3"
				style="background: var(--blue-light); border: 1px solid rgba(55,55,200,0.12)"
			>
				<span class="text-sm font-bold" style="color: var(--blue)">Wallet total</span>
				<span class="text-base font-black tabular-nums" style="color: var(--blue)">
					≈€{totalEur.toLocaleString('en', { maximumFractionDigits: 2 })}
				</span>
			</div>
		{/if}

		<!-- Close -->
		<button
			onclick={onClose}
			class="w-full rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95"
			style="background: var(--surface); border: 1.5px solid var(--border); color: var(--text-muted)"
		>
			Close
		</button>
	</div>
</div>
