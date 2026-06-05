<script lang="ts">
	import { onMount } from 'svelte';
	import { isMiniappMode, onWalletChange, sendTransactions } from '@aboutcircles/miniapp-sdk';
	import { CIRCLES_HUB_V2, YIELDPOT_GROUP, encodeGroupMint, encodeTrust } from '$lib/chains.js';

	const ADMIN_ADDRESS = '0x15BE89708053Cbc405F29095ECf803D51b5812C7' as const;

	let address = $state<`0x${string}` | null>(null);
	let isAdmin = $derived(address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase());

	// Mint state
	let mintAmount  = $state('10');
	let mintState   = $state<'idle' | 'sending' | 'success' | 'error'>('idle');
	let mintHash    = $state('');
	let mintErr     = $state('');

	// Trust state
	let trustTarget = $state('');
	let trustState  = $state<'idle' | 'sending' | 'success' | 'error'>('idle');
	let trustHash   = $state('');
	let trustErr    = $state('');

	onMount(() => {
		if (!isMiniappMode()) return;
		onWalletChange((addr) => {
			address = addr as `0x${string}` | null;
		});
	});

	async function mint() {
		if (!address || !isAdmin || mintState === 'sending') return;
		const parsed = parseFloat(mintAmount);
		if (!parsed || parsed <= 0) return;

		mintState = 'sending';
		mintErr   = '';
		mintHash  = '';

		try {
			const amountWei = BigInt(Math.floor(parsed * 1e18));
			const result = await sendTransactions([{
				to:   CIRCLES_HUB_V2,
				data: encodeGroupMint(YIELDPOT_GROUP, address, amountWei)
			}]);
			mintHash  = (result as { hash?: string })?.hash ?? '';
			mintState = 'success';
		} catch (e: unknown) {
			mintErr   = e instanceof Error ? e.message : 'Transaction rejected';
			mintState = 'error';
		}
	}

	async function trust() {
		if (!address || !isAdmin || trustState === 'sending') return;
		const target = trustTarget.trim() as `0x${string}`;
		if (!target.startsWith('0x') || target.length !== 42) {
			trustErr   = 'Invalid address';
			trustState = 'error';
			return;
		}

		trustState = 'sending';
		trustErr   = '';
		trustHash  = '';

		try {
			const result = await sendTransactions([{
				to:   CIRCLES_HUB_V2,
				data: encodeTrust(target)
			}]);
			trustHash  = (result as { hash?: string })?.hash ?? '';
			trustState = 'success';
		} catch (e: unknown) {
			trustErr   = e instanceof Error ? e.message : 'Transaction rejected';
			trustState = 'error';
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

			<!-- Trust section -->
			<div class="mb-4 rounded-lg p-5" style="background:#1c1c1c;border:1px solid #2a2a2a;">
				<h2 class="mb-1 text-sm font-bold" style="color:#a78bfa;">Set Trust</h2>
				<p class="mb-4 text-xs" style="color:#6b7280;">
					Calling from your Safe → your Safe will trust the target address.<br/>
					To make the <em>group</em> trust an address, the group contract itself must be the caller — try this first and check if it resolves the groupMint error.
				</p>

				<div class="mb-4">
					<p class="mb-1 text-xs" style="color:#9ca3af;">Caller (msg.sender)</p>
					<p class="break-all text-xs" style="color:#6b7280;">{address}</p>
				</div>

				<div class="mb-4">
					<p class="mb-1 text-xs" style="color:#9ca3af;">Trust receiver (address to trust)</p>
					<input
						type="text"
						placeholder="0x…"
						bind:value={trustTarget}
						disabled={trustState === 'sending'}
						class="w-full rounded px-3 py-2 text-xs disabled:opacity-50"
						style="background:#111;border:1px solid #333;color:#e5e5e5;outline:none;"
					/>
				</div>

				<button
					onclick={trust}
					disabled={trustState === 'sending'}
					class="w-full rounded py-2.5 text-sm font-bold disabled:opacity-50"
					style="background:#0e7490;color:#fff;"
				>
					{trustState === 'sending' ? 'Sending…' : 'Set trust'}
				</button>

				{#if trustState === 'success'}
					<p class="mt-3 text-xs" style="color:#34d399;">
						✓ Trust set{trustHash ? ` · ${trustHash.slice(0, 10)}…` : ''}
					</p>
				{/if}
				{#if trustState === 'error' && trustErr}
					<p class="mt-3 text-xs" style="color:#f87171;">{trustErr}</p>
				{/if}
			</div>

			<!-- Mint section -->
			<div class="rounded-lg p-5" style="background:#1c1c1c;border:1px solid #2a2a2a;">
				<h2 class="mb-1 text-sm font-bold" style="color:#a78bfa;">Mint Yield Pot Group Tokens</h2>
				<p class="mb-4 text-xs" style="color:#6b7280;">
					Requires the group to trust your address first (use Set Trust above).
				</p>

				<div class="mb-3">
					<p class="mb-1 text-xs" style="color:#9ca3af;">Group</p>
					<p class="break-all text-xs" style="color:#6b7280;">{YIELDPOT_GROUP}</p>
				</div>

				<div class="mb-3">
					<p class="mb-1 text-xs" style="color:#9ca3af;">Collateral avatar</p>
					<p class="break-all text-xs" style="color:#6b7280;">{address}</p>
				</div>

				<div class="mb-4">
					<p class="mb-1 text-xs" style="color:#9ca3af;">Amount (CRC)</p>
					<input
						type="number"
						min="0.001"
						step="1"
						bind:value={mintAmount}
						disabled={mintState === 'sending'}
						class="w-full rounded px-3 py-2 text-sm disabled:opacity-50"
						style="background:#111;border:1px solid #333;color:#e5e5e5;outline:none;"
					/>
				</div>

				<button
					onclick={mint}
					disabled={mintState === 'sending'}
					class="w-full rounded py-2.5 text-sm font-bold disabled:opacity-50"
					style="background:#7c3aed;color:#fff;"
				>
					{mintState === 'sending' ? 'Minting…' : 'Mint tokens'}
				</button>

				{#if mintState === 'success'}
					<p class="mt-3 text-xs" style="color:#34d399;">
						✓ Minted{mintHash ? ` · ${mintHash.slice(0, 10)}…` : ''}
					</p>
				{/if}
				{#if mintState === 'error' && mintErr}
					<p class="mt-3 text-xs" style="color:#f87171;">{mintErr}</p>
				{/if}
			</div>
		{/if}
	</div>
</main>
