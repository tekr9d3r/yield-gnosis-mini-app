<script lang="ts">
	import { maxUint256, parseUnits } from 'viem';
	import { sendTransactions } from '@aboutcircles/miniapp-sdk';
	import { encodeWithdraw } from '$lib/aave.js';
	import { AAVE_POOL } from '$lib/chains.js';
	import type { AssetInfo } from '$lib/types.js';

	interface Props {
		asset: AssetInfo;
		address: `0x${string}`;
		depositedAmt: number;   // live display value for showing balance
		onWithdrawn: () => void;
		onCancel: () => void;
	}

	let { asset, address, depositedAmt, onWithdrawn, onCancel }: Props = $props();

	let input = $state('');
	let status = $state<'idle' | 'sending' | 'error'>('idle');
	let errorMsg = $state('');

	function setMax() {
		const [w, f = ''] = depositedAmt.toFixed(asset.decimals > 6 ? 6 : asset.decimals).split('.');
		input = f ? `${w}.${f.replace(/0+$/, '') || '0'}` : w;
	}

	const parsed = $derived.by(() => {
		try {
			const str = input.trim();
			if (!str || parseFloat(str) <= 0) return 0n;
			const [w, f = ''] = str.split('.');
			const safe = f ? `${w}.${f.slice(0, asset.decimals)}` : w;
			return parseUnits(safe, asset.decimals);
		} catch {
			return 0n;
		}
	});

	const isValid = $derived(parsed > 0n);

	// If user wants to withdraw >= on-chain balance, use maxUint256 to avoid dust issues
	const withdrawAmount = $derived(
		parsed >= asset.depositedBalance ? maxUint256 : parsed
	);

	async function withdraw() {
		if (!isValid) return;
		status = 'sending';
		errorMsg = '';
		try {
			await sendTransactions([
				{ to: AAVE_POOL, data: encodeWithdraw(asset.address, address, withdrawAmount) }
			]);
			onWithdrawn();
		} catch (e: unknown) {
			errorMsg = e instanceof Error ? e.message : 'Transaction rejected';
			status = 'error';
		}
	}
</script>

<div
	class="mt-2 rounded-xl p-3"
	style="background: var(--surface-2); border: 1px solid var(--border)"
>
	<!-- Deposited balance — click to fill max -->
	<button
		onclick={setMax}
		disabled={depositedAmt <= 0 || status === 'sending'}
		class="mb-2 w-full text-left text-xs transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
		style="color: var(--text-dim)"
	>
		Deposited:
		<span class="font-bold underline decoration-dotted" style="color: var(--text)">
			{depositedAmt > 0 ? depositedAmt.toLocaleString('en', { maximumFractionDigits: 4 }) : '0'}
			{asset.symbol}
		</span>
	</button>

	<!-- Input + MAX -->
	<div
		class="mb-2.5 flex items-center overflow-hidden rounded-lg"
		style="background: var(--surface); border: 1px solid var(--border)"
	>
		<input
			type="text"
			inputmode="decimal"
			placeholder="0.00"
			bind:value={input}
			disabled={status === 'sending'}
			class="flex-1 bg-transparent px-3 py-2 text-sm font-bold tabular-nums outline-none disabled:opacity-50"
			style="color: var(--text)"
		/>
		<button
			onclick={setMax}
			disabled={depositedAmt <= 0 || status === 'sending'}
			class="mr-2 rounded-md px-2 py-0.5 text-xs font-bold transition-opacity hover:opacity-70 disabled:opacity-30"
			style="background: rgba(220,38,38,0.1); color: #dc2626"
		>MAX</button>
	</div>

	<!-- Withdraw -->
	<button
		onclick={withdraw}
		disabled={!isValid || status === 'sending'}
		class="mb-1.5 w-full rounded-xl py-2 text-sm font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
		style="background: rgba(220,38,38,0.12); border: 1.5px solid rgba(220,38,38,0.3); color: #dc2626"
	>
		{status === 'sending' ? 'Withdrawing…' : `Withdraw ${asset.symbol}`}
	</button>

	<!-- Cancel -->
	<button
		onclick={onCancel}
		disabled={status === 'sending'}
		class="w-full py-1 text-xs transition-opacity hover:opacity-60 disabled:opacity-30"
		style="color: var(--text-dim)"
	>Cancel</button>

	{#if status === 'error' && errorMsg}
		<p class="mt-2 text-xs" style="color: #dc2626">{errorMsg}</p>
	{/if}
</div>
