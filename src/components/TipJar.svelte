<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { sendTransactions } from '@aboutcircles/miniapp-sdk';
	import { CIRCLES_HUB_V2, encodeCirclesTip } from '$lib/chains.js';

	interface Props { address: string; }
	let { address }: Props = $props();

	const CRC_EUR = 0.01;
	const CIRCLES_RPC = 'https://rpc.aboutcircles.com/';

	const PRESETS = [
		{ amount: 10,  emoji: '🙏', label: 'Small tip' },
		{ amount: 100, emoji: '☕', label: 'Coffee'    },
		{ amount: 500, emoji: '🍕', label: 'Pizza'     }
	];

	type CrcToken = {
		tokenId: string;
		circles: number;
		attoCircles: string;
		staticAttoCircles: string;
		isErc1155: boolean;
		isWrapped: boolean;
	};

	type Status = 'idle' | 'loading' | 'sending' | 'success' | 'error';
	let status           = $state<Status>('loading');
	let errorMsg         = $state<string | null>(null);
	let transferable     = $state(0);
	let erc1155Tokens    = $state<CrcToken[]>([]);
	let resetTimeout: ReturnType<typeof setTimeout>;

	onMount(async () => {
		try {
			const res  = await fetch(CIRCLES_RPC, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
			// Pick the ERC1155 token with the most balance
			const token = erc1155Tokens.reduce((best, t) => t.circles > best.circles ? t : best);
			// Convert requested demurraged amount → static attoCircles
			const demurragedAtto  = BigInt(amount) * 10n ** 18n;
			const staticAtto      = demurragedAtto * BigInt(token.staticAttoCircles) / BigInt(token.attoCircles);
			await sendTransactions([{
				to:   CIRCLES_HUB_V2,
				data: encodeCirclesTip(address as `0x${string}`, BigInt(token.tokenId), staticAtto)
			}]);
			status = 'success';
			clearTimeout(resetTimeout);
			resetTimeout = setTimeout(() => (status = 'idle'), 3000);
		} catch (e: unknown) {
			errorMsg = e instanceof Error ? e.message : 'Transaction rejected';
			status   = 'error';
		}
	}

	function fmtEur(amount: number): string {
		const eur = amount * CRC_EUR;
		return eur < 1 ? `≈€${eur.toFixed(2)}` : `≈€${eur.toLocaleString('en', { maximumFractionDigits: 2 })}`;
	}
</script>

<div>
	<p class="mb-3 text-xs" style="color: var(--text-muted)">
		Like this app? Tip the builder with CRC ✦
	</p>

	<div class="flex gap-2">
		{#each PRESETS as preset}
			{@const canTip = status !== 'loading' && transferable >= preset.amount && erc1155Tokens.length > 0}
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
				<span class="text-[10px]" style="color: var(--text-dim)">{fmtEur(preset.amount)}</span>
			</button>
		{/each}
	</div>

	{#if status === 'loading'}
		<p class="mt-2 text-xs" style="color: var(--text-dim)">Checking CRC balance…</p>
	{:else if status === 'sending'}
		<p class="mt-2 text-xs" style="color: var(--text-muted)">Sending…</p>
	{:else if status === 'success'}
		<p class="mt-2 text-sm font-bold" style="color: var(--green)">✓ Sent! Thank you 🙏</p>
	{:else if status === 'error' && errorMsg}
		<p class="mt-2 text-xs" style="color: #dc2626">{errorMsg}</p>
	{/if}
</div>
