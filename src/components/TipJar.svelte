<script lang="ts">
	import { onDestroy } from 'svelte';
	import { parseUnits } from 'viem';
	import { sendTransactions } from '@aboutcircles/miniapp-sdk';
	import { CIRCLES_HUB_V2, encodeCirclesTip } from '$lib/chains.js';

	interface Props {
		address: string;
		crcBalance: number;
	}

	let { address, crcBalance }: Props = $props();

	const CRC_USD = 0.10;

	const PRESETS = [
		{ amount: 1,  emoji: '🙏', label: 'Small tip' },
		{ amount: 10, emoji: '☕', label: 'Coffee'    },
		{ amount: 50, emoji: '🍕', label: 'Pizza'      }
	];

	type Status = 'idle' | 'sending' | 'success' | 'error';
	let status    = $state<Status>('idle');
	let errorMsg  = $state<string | null>(null);
	let resetTimeout: ReturnType<typeof setTimeout>;

	async function tip(amount: number) {
		status   = 'sending';
		errorMsg = null;
		try {
			const raw = parseUnits(String(amount), 18);
			await sendTransactions([{
				to:   CIRCLES_HUB_V2,
				data: encodeCirclesTip(address as `0x${string}`, raw)
			}]);
			status = 'success';
			clearTimeout(resetTimeout);
			resetTimeout = setTimeout(() => (status = 'idle'), 3000);
		} catch (e: unknown) {
			errorMsg = e instanceof Error ? e.message : 'Transaction rejected';
			status   = 'error';
		}
	}

	onDestroy(() => clearTimeout(resetTimeout));

	function fmtUsd(amount: number): string {
		const usd = amount * CRC_USD;
		return usd < 1 ? `≈$${usd.toFixed(2)}` : `≈$${usd.toLocaleString('en', { maximumFractionDigits: 0 })}`;
	}
</script>

<div>
	<p class="mb-3 text-xs" style="color: var(--text-muted)">
		Like this app? Tip the builder with CRC ✦
	</p>

	<div class="flex gap-2">
		{#each PRESETS as preset}
			{@const canTip = crcBalance >= preset.amount}
			<button
				onclick={() => tip(preset.amount)}
				disabled={status === 'sending' || !canTip}
				class="flex flex-1 flex-col items-center gap-1 rounded-xl py-3 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				style="background: var(--surface-2); border: 1.5px solid var(--border)"
				onmouseenter={(e) => { if (canTip && status !== 'sending') { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.background = 'rgba(55,55,200,0.08)'; } }}
				onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
			>
				<span class="text-lg leading-none">{preset.emoji}</span>
				<span class="text-xs font-bold tabular-nums" style="color: var(--text)">{preset.amount} CRC</span>
				<span class="text-[10px]" style="color: var(--text-dim)">{fmtUsd(preset.amount)}</span>
			</button>
		{/each}
	</div>

	{#if status === 'sending'}
		<p class="mt-2 text-xs" style="color: var(--text-muted)">Sending…</p>
	{:else if status === 'success'}
		<p class="mt-2 text-sm font-bold" style="color: var(--green)">✓ Sent! Thank you 🙏</p>
	{:else if status === 'error' && errorMsg}
		<p class="mt-2 text-xs" style="color: #dc2626">{errorMsg}</p>
	{/if}
</div>
