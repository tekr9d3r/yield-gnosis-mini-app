<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { sendTransactions } from '@aboutcircles/miniapp-sdk';
	import { CIRCLES_HUB_V2, encodeCirclesTip } from '$lib/chains.js';

	interface Props { address: string; }
	let { address }: Props = $props();

	const CRC_EUR    = 0.01;
	const CIRCLES_RPC = 'https://rpc.aboutcircles.com/';

	const PRESETS = [
		{ amount: 10,  emoji: '🙏', crc: '10 CRC',  eur: '≈€0.10' },
		{ amount: 100, emoji: '☕', crc: '100 CRC', eur: '≈€1'     },
		{ amount: 500, emoji: '🍕', crc: '500 CRC', eur: '≈€5'     },
	];

	type CrcToken = { tokenId: string; circles: number; attoCircles: string; staticAttoCircles: string; isErc1155: boolean; isWrapped: boolean };
	type Status = 'idle' | 'loading' | 'sending' | 'success' | 'error';

	let status        = $state<Status>('loading');
	let errorMsg      = $state<string | null>(null);
	let transferable  = $state(0);
	let erc1155Tokens = $state<CrcToken[]>([]);
	let tipped        = $state<number | null>(null);
	let resetTimeout: ReturnType<typeof setTimeout>;

	onMount(async () => {
		try {
			const res  = await fetch(CIRCLES_RPC, {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'circles_getTokenBalances', params: [address] })
			});
			const json = await res.json();
			const tokens: CrcToken[] = (json.result ?? []).filter((t: CrcToken) => t.isErc1155 && !t.isWrapped);
			erc1155Tokens = tokens;
			transferable  = tokens.reduce((s, t) => s + t.circles, 0);
		} catch { /* leave transferable = 0 */ }
		status = 'idle';
	});

	onDestroy(() => clearTimeout(resetTimeout));

	async function tip(amount: number) {
		status   = 'sending';
		errorMsg = null;
		try {
			const token     = erc1155Tokens.reduce((best, t) => t.circles > best.circles ? t : best);
			const amountAtto = BigInt(amount) * 10n ** 18n;
			await sendTransactions([{
				to:   CIRCLES_HUB_V2,
				data: encodeCirclesTip(address as `0x${string}`, BigInt(token.tokenId), amountAtto)
			}]);
			tipped  = amount;
			status  = 'success';
			clearTimeout(resetTimeout);
			resetTimeout = setTimeout(() => { status = 'idle'; tipped = null; }, 3000);
		} catch (e: unknown) {
			errorMsg = e instanceof Error ? e.message : 'Transaction rejected';
			status   = 'error';
		}
	}
</script>

<p class="mb-3 text-[12.5px] font-medium" style="color:var(--text-muted);">
	Like this app? Tip the builder with CRC ✦
</p>

<div class="flex gap-2">
	{#each PRESETS as preset}
		{@const canTip = status !== 'loading' && transferable >= preset.amount && erc1155Tokens.length > 0}
		{@const sent   = tipped === preset.amount && status === 'success'}
		<button
			onclick={() => tip(preset.amount)}
			disabled={status === 'sending' || !canTip}
			class="flex flex-1 flex-col items-center gap-1 rounded-[var(--r-md)] py-3 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
			style="background:{sent ? 'var(--accent-soft)' : 'var(--ghost-bg)'};border:1.5px solid {sent ? 'var(--accent)' : 'var(--border)'};"
		>
			<span class="text-xl leading-none">{preset.emoji}</span>
			<span class="text-[13px] font-black" style="color:var(--text);">{sent ? 'Sent!' : preset.crc}</span>
			<span class="text-[10.5px] font-semibold" style="color:var(--text-dim);">{preset.eur}</span>
		</button>
	{/each}
</div>

{#if status === 'loading'}
	<p class="mt-2 text-[11.5px]" style="color:var(--text-dim);">Checking CRC balance…</p>
{:else if status === 'sending'}
	<p class="mt-2 text-[11.5px]" style="color:var(--text-muted);">Sending…</p>
{:else if status === 'success'}
	<p class="mt-2 text-sm font-bold" style="color:var(--yield);">✓ Sent! Thank you 🙏</p>
{:else if status === 'error' && errorMsg}
	<p class="mt-2 text-xs" style="color:#dc2626;">{errorMsg}</p>
{/if}
