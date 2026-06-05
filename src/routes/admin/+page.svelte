<script lang="ts">
	import { onMount } from 'svelte';
	import { isMiniappMode, onWalletChange, sendTransactions } from '@aboutcircles/miniapp-sdk';
	import { CIRCLES_HUB_V2, YIELDPOT_GROUP, encodeGroupMint } from '$lib/chains.js';

	const ADMIN_ADDRESS = '0x15BE89708053Cbc405F29095ECf803D51b5812C7' as const;

	let address   = $state<`0x${string}` | null>(null);
	let isAdmin   = $derived(address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase());
	let amount    = $state('10');
	let txState   = $state<'idle' | 'sending' | 'success' | 'error'>('idle');
	let txHash    = $state('');
	let errMsg    = $state('');

	onMount(() => {
		if (!isMiniappMode()) return;
		onWalletChange((addr) => {
			address = addr as `0x${string}` | null;
		});
	});

	async function mint() {
		if (!address || !isAdmin || txState === 'sending') return;
		const parsed = parseFloat(amount);
		if (!parsed || parsed <= 0) return;

		txState = 'sending';
		errMsg  = '';
		txHash  = '';

		try {
			const amountWei = BigInt(Math.floor(parsed * 1e18));
			const result = await sendTransactions([{
				to:   CIRCLES_HUB_V2,
				data: encodeGroupMint(YIELDPOT_GROUP, address, amountWei)
			}]);
			txHash  = (result as { hash?: string })?.hash ?? '';
			txState = 'success';
		} catch (e: unknown) {
			errMsg  = e instanceof Error ? e.message : 'Transaction rejected';
			txState = 'error';
		}
	}
</script>

<svelte:head><title>Admin · Yield</title></svelte:head>

<main class="min-h-screen py-12 px-4" style="background:#0f0f0f;color:#e5e5e5;font-family:monospace;">
	<div class="mx-auto max-w-sm">
		<h1 class="mb-6 text-xl font-bold" style="color:#a78bfa;">⚙ Admin</h1>

		{#if !address}
			<p style="color:#6b7280;">Waiting for wallet…</p>

		{:else if !isAdmin}
			<p style="color:#ef4444;">Access denied.</p>
			<p class="mt-1 text-xs" style="color:#6b7280;">{address}</p>

		{:else}
			<p class="mb-6 text-xs" style="color:#6b7280;">Connected: {address}</p>

			<!-- Mint form -->
			<div class="rounded-lg p-5" style="background:#1c1c1c;border:1px solid #2a2a2a;">
				<h2 class="mb-4 text-sm font-bold" style="color:#a78bfa;">Mint Yield Pot Group Tokens</h2>

				<div class="mb-3">
					<label class="mb-1 block text-xs" style="color:#9ca3af;">Group</label>
					<p class="text-xs break-all" style="color:#6b7280;">{YIELDPOT_GROUP}</p>
				</div>

				<div class="mb-3">
					<label class="mb-1 block text-xs" style="color:#9ca3af;">Collateral avatar (your address)</label>
					<p class="text-xs break-all" style="color:#6b7280;">{address}</p>
				</div>

				<div class="mb-4">
					<label class="mb-1 block text-xs" style="color:#9ca3af;">Amount (CRC)</label>
					<input
						type="number"
						min="0.001"
						step="1"
						bind:value={amount}
						disabled={txState === 'sending'}
						class="w-full rounded px-3 py-2 text-sm disabled:opacity-50"
						style="background:#111;border:1px solid #333;color:#e5e5e5;outline:none;"
					/>
				</div>

				<button
					onclick={mint}
					disabled={txState === 'sending'}
					class="w-full rounded py-2.5 text-sm font-bold disabled:opacity-50"
					style="background:#7c3aed;color:#fff;"
				>
					{txState === 'sending' ? 'Minting…' : 'Mint tokens'}
				</button>

				{#if txState === 'success'}
					<p class="mt-3 text-xs" style="color:#34d399;">
						✓ Minted successfully{txHash ? ` · ${txHash.slice(0, 10)}…` : ''}
					</p>
				{/if}
				{#if txState === 'error'}
					<p class="mt-3 text-xs" style="color:#f87171;">{errMsg}</p>
				{/if}
			</div>
		{/if}
	</div>
</main>
