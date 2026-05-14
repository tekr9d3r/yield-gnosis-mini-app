<script lang="ts">
	import { untrack } from 'svelte';
	import { formatUnits } from 'viem';
	import { sendTransactions } from '@aboutcircles/miniapp-sdk';
	import { AAVE_POOL } from '$lib/chains.js';
	import { encodeApprove, encodeSupply, parseAmount, formatBalance } from '$lib/aave.js';
	import type { AssetInfo } from '$lib/types.js';

	interface Props {
		address: `0x${string}`;
		asset: AssetInfo;
		onDeposited: () => void;
		onBack: () => void;
	}

	let { address, asset, onDeposited, onBack }: Props = $props();

	let amountInput = $state(untrack(() => formatUnits(asset.balance, asset.decimals)));
	let step = $state<'input' | 'sending' | 'error'>('input');
	let errorMsg = $state<string | null>(null);

	const parsedAmount  = $derived(parseAmount(amountInput, asset.decimals));
	const isValid       = $derived(parsedAmount > 0n && parsedAmount <= asset.balance && amountInput.trim() !== '');
	const enteredNum    = $derived(parseFloat(amountInput) || 0);

	// Earnings in EUR (EURe is 1:1 EUR; others use eurValue ratio)
	const enteredEur = $derived(() => {
		if (enteredNum === 0 || asset.balance === 0n) return 0;
		const totalNum = parseFloat(formatUnits(asset.balance, asset.decimals));
		if (totalNum === 0) return 0;
		return (enteredNum / totalNum) * asset.eurValue;
	});

	const yearlyEur  = $derived(asset.apy && enteredEur() > 0 ? enteredEur() * (asset.apy / 100) : null);
	const weeklyEur  = $derived(yearlyEur !== null ? yearlyEur / 52 : null);
	const dailyEur   = $derived(yearlyEur !== null ? yearlyEur / 365 : null);

	function fmtEarning(v: number): string {
		if (v < 0.001) return '<€0.001';
		if (v < 1)     return '+€' + v.toFixed(3);
		return '+€' + v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function setMax() {
		amountInput = formatUnits(asset.balance, asset.decimals);
	}

	async function deposit() {
		if (!isValid) return;
		step = 'sending';
		errorMsg = null;
		try {
			await sendTransactions([
				{ to: asset.address, data: encodeApprove(AAVE_POOL, parsedAmount) },
				{ to: AAVE_POOL,     data: encodeSupply(asset.address, parsedAmount, address) }
			]);
			onDeposited();
		} catch (e: unknown) {
			errorMsg = e instanceof Error ? e.message : 'Transaction was rejected';
			step = 'error';
		}
	}
</script>

<div class="slide-up flex flex-col gap-3">

	<!-- Back -->
	<button
		onclick={onBack}
		class="flex items-center gap-1.5 self-start text-xs font-semibold transition-opacity hover:opacity-60"
		style="color: var(--text-muted)"
	>
		← Back
	</button>

	<div
		class="rounded-2xl p-5"
		style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(55,55,200,0.06)"
	>
		<!-- Title -->
		<p class="mb-4 text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">
			Deposit {asset.symbol}
		</p>

		<!-- Available balance -->
		<div class="mb-2 flex items-center justify-between">
			<span class="text-xs" style="color: var(--text-dim)">Available</span>
			<div class="flex items-center gap-2">
				<span class="text-xs font-bold tabular-nums" style="color: var(--text)">
					{formatBalance(asset.balance, asset.decimals, 4)} {asset.symbol}
				</span>
				{#if asset.balance > 0n}
					<button
						onclick={setMax}
						class="rounded-md px-2 py-0.5 text-xs font-bold transition-all active:scale-95"
						style="background: var(--blue-light); color: var(--blue)"
					>
						MAX
					</button>
				{/if}
			</div>
		</div>

		<!-- Amount input -->
		<div
			class="mb-5 flex items-center overflow-hidden rounded-xl"
			style="background: var(--surface-2); border: 1.5px solid var(--border)"
		>
			<input
				type="text"
				inputmode="decimal"
				placeholder="0.00"
				bind:value={amountInput}
				disabled={step === 'sending'}
				class="flex-1 bg-transparent px-4 py-3.5 text-2xl font-black outline-none tabular-nums placeholder:text-lg placeholder:font-normal"
				style="color: var(--text)"
			/>
			<span class="pr-4 text-sm font-semibold" style="color: var(--text-muted)">{asset.symbol}</span>
		</div>

		<!-- Earnings at current APY -->
		{#if asset.apy !== null && enteredNum > 0}
			<div class="mb-1 flex items-center gap-1.5">
				<span class="sparkle text-xs" style="color: var(--orange)">✦</span>
				<p class="text-xs font-bold" style="color: var(--text-muted)">
					At {asset.apy.toFixed(2)}% APY you'd earn:
				</p>
			</div>

			<div class="flex flex-col gap-1">
				{#each [
					{ label: 'per year',  value: yearlyEur,  color: 'var(--green)',     size: 'text-xl' },
					{ label: 'per week',  value: weeklyEur,  color: 'var(--blue)',       size: 'text-base' },
					{ label: 'per day',   value: dailyEur,   color: 'var(--text-muted)', size: 'text-sm' }
				] as row}
					{#if row.value !== null}
						<div class="flex items-center justify-between rounded-xl px-3 py-2.5"
							style="background: var(--surface-2)"
						>
							<span class="text-xs font-semibold" style="color: var(--text-dim)">{row.label}</span>
							<span class="{row.size} font-black tabular-nums" style="color: {row.color}">
								{fmtEarning(row.value)}
							</span>
						</div>
					{/if}
				{/each}
			</div>
		{:else if asset.apy !== null}
			<p class="text-xs" style="color: var(--text-dim)">Enter an amount to see your earnings.</p>
		{/if}
	</div>

	<!-- Sending state -->
	{#if step === 'sending'}
		<div
			class="flex items-center justify-center gap-3 rounded-2xl px-4 py-4"
			style="background: var(--blue-light); border: 1px solid rgba(55,55,200,0.15)"
		>
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-transparent"
				style="border-top-color: var(--blue); border-right-color: var(--blue)"></div>
			<span class="text-sm font-semibold" style="color: var(--blue)">Depositing your {asset.symbol}…</span>
		</div>
	{/if}

	<!-- Error -->
	{#if step === 'error' && errorMsg}
		<div
			class="rounded-2xl px-4 py-3"
			style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2)"
		>
			<p class="text-xs font-semibold" style="color: #dc2626">{errorMsg}</p>
			<button
				onclick={() => { step = 'input'; errorMsg = null; }}
				class="mt-1 text-xs underline"
				style="color: #dc2626"
			>Try again</button>
		</div>
	{/if}

	<!-- CTA -->
	{#if step !== 'error'}
		<button
			onclick={deposit}
			disabled={!isValid || step === 'sending'}
			class="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
			style="background: var(--green); box-shadow: 0 4px 16px var(--green-shadow)"
			onmouseenter={(e) => { if (isValid && step !== 'sending') e.currentTarget.style.opacity = '0.88'; }}
			onmouseleave={(e) => (e.currentTarget.style.opacity = '1')}
		>
			{step === 'sending' ? 'Confirming…' : 'Confirm Deposit'}
		</button>
	{/if}

</div>
