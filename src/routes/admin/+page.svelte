<script lang="ts">
	import { onMount } from 'svelte';
	import { isMiniappMode, onWalletChange, sendTransactions } from '@aboutcircles/miniapp-sdk';
	import {
		CIRCLES_HUB_V2, YIELDPOT_GROUP, YIELDPOT_TREASURY,
		EURE_ADDRESS, USDC_E_ADDRESS, WBTC_ADDRESS,
		COW_SETTLEMENT, COW_VAULT_RELAYER,
		encodeGroupMint, encodeTrust, encodeSetApprovalForAll,
		getTreasuryNonce, computeSafeTxHash, encodeApproveHash,
		encodeExecWithApprovedHash, encodeHubBatchTransfer,
		encodeCoWPresign, hashCoWOrder, computeCoWOrderUid, encodeERC20Approve,
		type CoWOrderFields,
		publicClient
	} from '$lib/chains.js';

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

	// Approval state
	let approvalState = $state<'idle' | 'sending' | 'success' | 'error'>('idle');
	let approvalHash  = $state('');
	let approvalErr   = $state('');

	// Transfer state
	type Holding = { id: bigint; amount: bigint; label: string };
	let transferRecipient = $state('');
	let transferState     = $state<'idle' | 'loading' | 'sending' | 'success' | 'error'>('idle');
	let transferErr       = $state('');
	let transferHash      = $state('');
	let holdings          = $state<Holding[]>([]);
	let holdingsLoaded    = $state(false);

	async function loadHoldings() {
		transferState = 'loading';
		try {
			// Step 1: get unique token IDs ever sent to the treasury
			const url = `https://gnosis.blockscout.com/api/v2/addresses/${YIELDPOT_TREASURY}/token-transfers?type=ERC-1155&filter=to`;
			const items: { total: { token_id: string } }[] = [];
			let next: string | null = url;
			while (next) {
				const r = await fetch(next);
				const d = await r.json();
				if (d.items) items.push(...d.items);
				next = d.next_page_params
					? url + '&' + new URLSearchParams(d.next_page_params)
					: null;
			}
			const uniqueIds = [...new Set(items.map(i => i.total.token_id))];

			// Step 2: fetch LIVE balanceOf for each token ID (respects demurrage decay)
			const HUB_BALANCE_ABI = [{
				name: 'balanceOf', type: 'function', stateMutability: 'view',
				inputs: [{ name: 'account', type: 'address' }, { name: 'id', type: 'uint256' }],
				outputs: [{ name: '', type: 'uint256' }]
			}] as const;

			const balResults = await Promise.allSettled(
				uniqueIds.map(id =>
					publicClient.readContract({
						address: CIRCLES_HUB_V2,
						abi: HUB_BALANCE_ABI,
						functionName: 'balanceOf',
						args: [YIELDPOT_TREASURY, BigInt(id)]
					})
				)
			);

			holdings = uniqueIds
				.map((id, i) => {
					const bal = balResults[i].status === 'fulfilled' ? balResults[i].value as bigint : 0n;
					const addr = '0x' + BigInt(id).toString(16).padStart(40, '0');
					return { id: BigInt(id), amount: bal, label: addr.slice(0, 6) + '…' + addr.slice(-4) };
				})
				.filter(h => h.amount > 0n);

			holdingsLoaded = true;
			transferState  = 'idle';
		} catch (e: unknown) {
			transferErr   = e instanceof Error ? e.message : 'Failed to load';
			transferState = 'error';
		}
	}

	async function transferAll() {
		if (!address || !isAdmin || transferState === 'sending') return;
		const recipient = transferRecipient.trim() as `0x${string}`;
		if (!recipient.startsWith('0x') || recipient.length !== 42) {
			transferErr = 'Invalid recipient address'; transferState = 'error'; return;
		}
		if (holdings.length === 0) {
			transferErr = 'No CRC to transfer'; transferState = 'error'; return;
		}
		transferState = 'sending'; transferErr = ''; transferHash = '';
		try {
			const nonce       = await getTreasuryNonce(YIELDPOT_TREASURY);
			const batchData   = encodeHubBatchTransfer(
				YIELDPOT_TREASURY, recipient,
				holdings.map(h => h.id),
				holdings.map(h => h.amount)
			);
			const safeTxHash  = computeSafeTxHash(YIELDPOT_TREASURY, CIRCLES_HUB_V2, batchData, nonce);
			const result = await sendTransactions([
				{ to: YIELDPOT_TREASURY, data: encodeApproveHash(safeTxHash) },
				{ to: YIELDPOT_TREASURY, data: encodeExecWithApprovedHash(CIRCLES_HUB_V2, batchData, address) }
			]);
			transferHash  = Array.isArray(result) ? result[0] : (result as { hash?: string })?.hash ?? '';
			transferState = 'success';
		} catch (e: unknown) {
			transferErr   = e instanceof Error ? e.message : 'Transaction rejected';
			transferState = 'error';
		}
	}

	// CoW Swap test state
	type CoWQuoteResp = {
		sellToken: string; buyToken: string; receiver: string | null;
		sellAmount: string; buyAmount: string; validTo: number;
		appData: string; feeAmount: string; kind: string;
		partiallyFillable: boolean; sellTokenBalance: string; buyTokenBalance: string;
	};
	let cowSellToken  = $state<'EURe' | 'USDC.e'>('EURe');
	let cowSellAmt    = $state('1');
	let cowQuote      = $state<CoWQuoteResp | null>(null);
	let cowQuoteId    = $state<number | null>(null);
	let cowState      = $state<'idle' | 'quoting' | 'quoted' | 'swapping' | 'polling' | 'done' | 'error'>('idle');
	let cowOrderUid   = $state('');
	let cowErr        = $state('');

	const COW_API = 'https://api.cow.fi/xdai/api/v1';

	async function getCoWQuote() {
		if (!address || cowState === 'quoting') return;
		cowState = 'quoting'; cowErr = ''; cowQuote = null; cowQuoteId = null;
		try {
			const sellTokenAddr = cowSellToken === 'EURe' ? EURE_ADDRESS : USDC_E_ADDRESS;
			const decimals      = cowSellToken === 'EURe' ? 18 : 6;
			const parsed        = parseFloat(cowSellAmt);
			if (!parsed || parsed <= 0) throw new Error('Invalid amount');
			const sellAmountBeforeFee = BigInt(Math.floor(parsed * 10 ** decimals)).toString();

			const resp = await fetch(`${COW_API}/quote`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sellToken: sellTokenAddr,
					buyToken:  WBTC_ADDRESS,
					sellAmountBeforeFee,
					from:      address,
					receiver:  address,
					validFor:  1800,
					appData:   '0x0000000000000000000000000000000000000000000000000000000000000000',
					kind:      'sell'
				})
			});
			if (!resp.ok) throw new Error(await resp.text());
			const data = await resp.json();
			cowQuote   = data.quote as CoWQuoteResp;
			cowQuoteId = data.id ?? null;
			cowState   = 'quoted';
		} catch (e: unknown) {
			cowErr   = e instanceof Error ? e.message : 'Quote failed';
			cowState = 'error';
		}
	}

	async function cowSwap() {
		if (!address || !isAdmin || !cowQuote || cowState === 'swapping') return;
		cowState = 'swapping'; cowErr = ''; cowOrderUid = '';
		try {
			const q = cowQuote;
			// CoW now requires feeAmount=0; fold old fee into sellAmount
			const fullSellAmount = BigInt(q.sellAmount) + BigInt(q.feeAmount);
			const order: CoWOrderFields = {
				sellToken:         q.sellToken as `0x${string}`,
				buyToken:          q.buyToken  as `0x${string}`,
				receiver:          (q.receiver ?? address) as `0x${string}`,
				sellAmount:        fullSellAmount,
				buyAmount:         BigInt(q.buyAmount),
				validTo:           q.validTo,
				appData:           q.appData as `0x${string}`,
				feeAmount:         0n,
				kind:              q.kind,
				partiallyFillable: q.partiallyFillable,
				sellTokenBalance:  q.sellTokenBalance,
				buyTokenBalance:   q.buyTokenBalance
			};

			// POST order first — CoW returns its canonical orderUid
			const postResp = await fetch(`${COW_API}/orders`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sellToken:         order.sellToken,
					buyToken:          order.buyToken,
					receiver:          order.receiver,
					sellAmount:        order.sellAmount.toString(),
					buyAmount:         order.buyAmount.toString(),
					validTo:           order.validTo,
					appData:           order.appData,
					feeAmount:         '0',
					kind:              order.kind,
					partiallyFillable: order.partiallyFillable,
					sellTokenBalance:  order.sellTokenBalance,
					buyTokenBalance:   order.buyTokenBalance,
					signingScheme:     'presign',
					signature:         address,
					from:              address,
					...(cowQuoteId !== null ? { quoteId: cowQuoteId } : {})
				})
			});
			if (!postResp.ok) throw new Error(await postResp.text());

			// Use CoW's returned uid for the presign — eliminates any local hash mismatch
			const uid = await postResp.json() as string;
			cowOrderUid = uid;

			const sellTokenAddr = cowSellToken === 'EURe' ? EURE_ADDRESS : USDC_E_ADDRESS;
			await sendTransactions([
				{ to: sellTokenAddr,  data: encodeERC20Approve(COW_VAULT_RELAYER, fullSellAmount) },
				{ to: COW_SETTLEMENT, data: encodeCoWPresign(uid as `0x${string}`) }
			]);
			cowState    = 'polling';
			pollCoWOrder(uid);
		} catch (e: unknown) {
			cowErr   = e instanceof Error ? e.message : 'Swap failed';
			cowState = 'error';
		}
	}

	async function pollCoWOrder(uid: string) {
		for (let i = 0; i < 100; i++) {
			await new Promise(r => setTimeout(r, 3000));
			try {
				const r = await fetch(`${COW_API}/orders/${encodeURIComponent(uid)}`);
				if (!r.ok) continue;
				const d = await r.json();
				if (d.status === 'fulfilled') { cowState = 'done'; return; }
				if (d.status === 'cancelled' || d.status === 'expired') {
					cowErr = `Order ${d.status}`; cowState = 'error'; return;
				}
			} catch { /* keep polling */ }
		}
		cowErr = 'Order timed out'; cowState = 'error';
	}

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

	async function approve() {
		if (!address || !isAdmin || approvalState === 'sending') return;
		approvalState = 'sending';
		approvalErr   = '';
		approvalHash  = '';
		try {
			const result = await sendTransactions([{
				to:   CIRCLES_HUB_V2,
				data: encodeSetApprovalForAll(YIELDPOT_GROUP, true)
			}]);
			approvalHash  = (result as { hash?: string })?.hash ?? '';
			approvalState = 'success';
		} catch (e: unknown) {
			approvalErr   = e instanceof Error ? e.message : 'Transaction rejected';
			approvalState = 'error';
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

			<!-- Approval section -->
			<div class="mb-4 rounded-lg p-5" style="background:#1c1c1c;border:1px solid #2a2a2a;">
				<h2 class="mb-1 text-sm font-bold" style="color:#a78bfa;">Approve Group Operator</h2>
				<p class="mb-4 text-xs" style="color:#6b7280;">
					Calls <code>setApprovalForAll(YIELDPOT_GROUP, true)</code> on Hub V2 from your Safe.<br/>
					Grants the group contract permission to move your CRC tokens — likely required before groupMint succeeds.
				</p>

				<div class="mb-4">
					<p class="mb-1 text-xs" style="color:#9ca3af;">Operator (group address)</p>
					<p class="break-all text-xs" style="color:#6b7280;">{YIELDPOT_GROUP}</p>
				</div>

				<button
					onclick={approve}
					disabled={approvalState === 'sending'}
					class="w-full rounded py-2.5 text-sm font-bold disabled:opacity-50"
					style="background:#065f46;color:#fff;"
				>
					{approvalState === 'sending' ? 'Approving…' : 'Approve operator'}
				</button>

				{#if approvalState === 'success'}
					<p class="mt-3 text-xs" style="color:#34d399;">
						✓ Approved{approvalHash ? ` · ${approvalHash.slice(0, 10)}…` : ''}
					</p>
				{/if}
				{#if approvalState === 'error' && approvalErr}
					<p class="mt-3 text-xs" style="color:#f87171;">{approvalErr}</p>
				{/if}
			</div>

			<!-- Transfer Treasury CRC -->
			<div class="mb-4 rounded-lg p-5" style="background:#1c1c1c;border:1px solid #2a2a2a;">
				<h2 class="mb-1 text-sm font-bold" style="color:#a78bfa;">Transfer Treasury CRC</h2>
				<p class="mb-4 text-xs" style="color:#6b7280;">
					Sends all CRC held in the treasury Safe to a recipient in one batch transaction.
				</p>

				<div class="mb-3">
					<p class="mb-1 text-xs" style="color:#9ca3af;">Treasury</p>
					<p class="break-all text-xs" style="color:#6b7280;">{YIELDPOT_TREASURY}</p>
				</div>

				{#if !holdingsLoaded}
					<button
						onclick={loadHoldings}
						disabled={transferState === 'loading'}
						class="mb-4 w-full rounded py-2 text-xs font-bold disabled:opacity-50"
						style="background:#1e293b;color:#94a3b8;border:1px solid #334155;"
					>
						{transferState === 'loading' ? 'Loading…' : 'Load treasury holdings'}
					</button>
				{:else}
					<div class="mb-4 rounded p-3" style="background:#111;border:1px solid #1e293b;">
						<p class="mb-1 text-xs font-bold" style="color:#9ca3af;">{holdings.length} token{holdings.length !== 1 ? 's' : ''} in treasury</p>
						{#each holdings as h}
							<div class="flex justify-between text-xs" style="color:#6b7280;">
								<span class="font-mono">{h.label}</span>
								<span>{(Number(h.amount) / 1e18).toFixed(2)} CRC</span>
							</div>
						{/each}
						{#if holdings.length === 0}
							<p class="text-xs" style="color:#4b5563;">Treasury is empty</p>
						{/if}
					</div>
				{/if}

				<div class="mb-4">
					<p class="mb-1 text-xs" style="color:#9ca3af;">Recipient address</p>
					<input
						type="text"
						placeholder="0x…"
						bind:value={transferRecipient}
						disabled={transferState === 'sending'}
						class="w-full rounded px-3 py-2 text-xs disabled:opacity-50"
						style="background:#111;border:1px solid #333;color:#e5e5e5;outline:none;"
					/>
				</div>

				<button
					onclick={transferAll}
					disabled={transferState === 'sending' || holdings.length === 0}
					class="w-full rounded py-2.5 text-sm font-bold disabled:opacity-50"
					style="background:#b45309;color:#fff;"
				>
					{transferState === 'sending' ? 'Sending…' : `Transfer ${holdings.length > 0 ? holdings.length + ' token' + (holdings.length !== 1 ? 's' : '') : 'CRC'} to recipient`}
				</button>

				{#if transferState === 'success'}
					<p class="mt-3 text-xs" style="color:#34d399;">
						✓ Transferred{transferHash ? ` · ${transferHash.slice(0, 10)}…` : ''}
					</p>
				{/if}
				{#if transferState === 'error' && transferErr}
					<p class="mt-3 text-xs" style="color:#f87171;">{transferErr}</p>
				{/if}
			</div>

			<!-- CoW Swap Test -->
			<div class="mb-4 rounded-lg p-5" style="background:#1c1c1c;border:1px solid #2a2a2a;">
				<h2 class="mb-1 text-sm font-bold" style="color:#a78bfa;">CoW Swap Test</h2>
				<p class="mb-4 text-xs" style="color:#6b7280;">
					Swap EURe or USDC.e → WBTC via CoW Protocol (presign flow).
				</p>

				<!-- Sell token toggle -->
				<div class="mb-3 flex gap-2">
					{#each (['EURe', 'USDC.e'] as const) as tok}
						<button
							onclick={() => { cowSellToken = tok; cowQuote = null; cowState = 'idle'; }}
							class="rounded px-3 py-1 text-xs font-bold"
							style="background:{cowSellToken === tok ? '#312e81' : '#111'};
							       color:{cowSellToken === tok ? '#a78bfa' : '#6b7280'};
							       border:1px solid {cowSellToken === tok ? '#4c1d95' : '#333'};"
						>{tok}</button>
					{/each}
				</div>

				<!-- Amount input -->
				<div class="mb-4">
					<p class="mb-1 text-xs" style="color:#9ca3af;">Sell amount ({cowSellToken})</p>
					<input
						type="number" min="0.000001" step="any"
						bind:value={cowSellAmt}
						disabled={cowState === 'quoting' || cowState === 'swapping'}
						class="w-full rounded px-3 py-2 text-xs disabled:opacity-50"
						style="background:#111;border:1px solid #333;color:#e5e5e5;outline:none;"
					/>
				</div>

				<button
					onclick={getCoWQuote}
					disabled={cowState === 'quoting' || cowState === 'swapping' || cowState === 'polling'}
					class="mb-4 w-full rounded py-2 text-xs font-bold disabled:opacity-50"
					style="background:#1e293b;color:#94a3b8;border:1px solid #334155;"
				>
					{cowState === 'quoting' ? 'Getting quote…' : 'Get Quote'}
				</button>

				{#if cowQuote}
					<div class="mb-4 rounded p-3" style="background:#111;border:1px solid #1e293b;">
						<div class="flex justify-between text-xs">
							<span style="color:#9ca3af;">Receive (WBTC)</span>
							<span style="color:#e5e5e5;" class="font-mono">
								{(Number(cowQuote.buyAmount) / 1e8).toFixed(8)}
							</span>
						</div>
						<div class="mt-1 flex justify-between text-xs">
							<span style="color:#9ca3af;">Fee ({cowSellToken})</span>
							<span style="color:#6b7280;" class="font-mono">
								{(Number(cowQuote.feeAmount) / (cowSellToken === 'EURe' ? 1e18 : 1e6)).toFixed(4)}
							</span>
						</div>
						<div class="mt-1 flex justify-between text-xs">
							<span style="color:#9ca3af;">Valid until</span>
							<span style="color:#6b7280;">{new Date(cowQuote.validTo * 1000).toLocaleTimeString()}</span>
						</div>
					</div>

					<button
						onclick={cowSwap}
						disabled={cowState === 'swapping' || cowState === 'polling' || cowState === 'done'}
						class="w-full rounded py-2.5 text-sm font-bold disabled:opacity-50"
						style="background:#7c2d12;color:#fff;"
					>
						{cowState === 'swapping' ? 'Approving + Presigning…' : 'Swap →'}
					</button>
				{/if}

				{#if cowOrderUid}
					<div class="mt-3 rounded p-3" style="background:#111;border:1px solid #1e293b;">
						<p class="mb-1 text-xs font-bold" style="color:#9ca3af;">Order UID</p>
						<p class="break-all font-mono text-[10px]" style="color:#6b7280;">{cowOrderUid}</p>
						<p class="mt-2 text-xs">
							Status:
							<span class="font-bold" style="color:{cowState === 'done' ? '#34d399' : cowState === 'error' ? '#f87171' : '#fbbf24'};">
								{cowState === 'done' ? '✓ Fulfilled' : cowState === 'error' ? '✗ ' + cowErr : '⏳ Open…'}
							</span>
						</p>
						<a
							href="https://explorer.cow.fi/gc/orders/{cowOrderUid}"
							target="_blank" rel="noopener noreferrer"
							class="mt-1 block text-xs" style="color:#6b7280;"
						>View on CoW Explorer ↗</a>
					</div>
				{/if}

				{#if cowState === 'error' && !cowOrderUid}
					<p class="mt-3 text-xs" style="color:#f87171;">{cowErr}</p>
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
