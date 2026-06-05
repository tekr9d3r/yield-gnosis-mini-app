<script lang="ts">
	import { onMount } from 'svelte';
	import { parseUnits, formatUnits } from 'viem';
	import { isMiniappMode, onWalletChange, sendTransactions } from '@aboutcircles/miniapp-sdk';
	import {
		BALANCER_VAULT, SYIELDPOT_ADDRESS, ERC20_ABI,
		encodeBalancerSwap, publicClient
	} from '$lib/chains.js';
	import { encodeApprove } from '$lib/aave.js';

	// Token definitions
	const USDC_E = {
		address: '0x2a22f9c3b484c3629090feed35f17ff8f88f76f0' as `0x${string}`,
		symbol:  'USDC.e',
		decimals: 6
	};
	const S_YIELDPOT = {
		address: SYIELDPOT_ADDRESS,
		symbol:  's-YIELDPOT',
		decimals: 18
	};

	let address  = $state<`0x${string}` | null>(null);
	let flipped  = $state(false);

	const tokenIn  = $derived(flipped ? S_YIELDPOT : USDC_E);
	const tokenOut = $derived(flipped ? USDC_E : S_YIELDPOT);

	let input      = $state('');
	let balanceIn  = $state(0n);
	let balanceOut = $state(0n);
	let allowance  = $state(0n);

	let txState  = $state<'idle' | 'approving' | 'swapping' | 'success' | 'error'>('idle');
	let errMsg   = $state('');
	let txHash   = $state('');

	const parsed = $derived.by(() => {
		try {
			const s = input.trim();
			if (!s || parseFloat(s) <= 0) return 0n;
			return parseUnits(s, tokenIn.decimals);
		} catch { return 0n; }
	});

	const needsApproval = $derived(parsed > 0n && allowance < parsed);
	const balInAmt      = $derived(Number(balanceIn) / 10 ** tokenIn.decimals);
	const balOutAmt     = $derived(Number(balanceOut) / 10 ** tokenOut.decimals);

	async function loadBalances() {
		if (!address) return;
		const [bIn, bOut, allow] = await Promise.allSettled([
			publicClient.readContract({ address: tokenIn.address,  abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
			publicClient.readContract({ address: tokenOut.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
			publicClient.readContract({ address: tokenIn.address,  abi: ERC20_ABI, functionName: 'allowance', args: [address, BALANCER_VAULT] })
		]);
		if (bIn.status    === 'fulfilled') balanceIn  = bIn.value as bigint;
		if (bOut.status   === 'fulfilled') balanceOut = bOut.value as bigint;
		if (allow.status  === 'fulfilled') allowance  = allow.value as bigint;
	}

	// Reload balances when direction flips
	$effect(() => { flipped; if (address) loadBalances(); });

	onMount(() => {
		if (!isMiniappMode()) return;
		onWalletChange(async (addr) => {
			address = addr as `0x${string}` | null;
			if (address) await loadBalances();
		});
	});

	function setMax() {
		const dp = Math.min(tokenIn.decimals, 6);
		input = (Number(balanceIn) / 10 ** tokenIn.decimals).toFixed(dp).replace(/\.?0+$/, '');
	}

	async function approve() {
		if (!address || txState !== 'idle') return;
		txState = 'approving'; errMsg = '';
		try {
			await sendTransactions([{
				to:   tokenIn.address,
				data: encodeApprove(BALANCER_VAULT, parsed)
			}]);
			allowance = parsed;
			txState = 'idle';
		} catch (e: unknown) {
			errMsg  = e instanceof Error ? e.message : 'Rejected';
			txState = 'error';
		}
	}

	async function swap() {
		if (!address || parsed === 0n || txState !== 'idle') return;
		txState = 'swapping'; errMsg = ''; txHash = '';
		try {
			const result = await sendTransactions([{
				to:   BALANCER_VAULT,
				data: encodeBalancerSwap(tokenIn.address, tokenOut.address, parsed, address)
			}]);
			txHash  = (result as { hash?: string })?.hash ?? '';
			txState = 'success';
			input   = '';
			await loadBalances();
		} catch (e: unknown) {
			errMsg  = e instanceof Error ? e.message : 'Rejected';
			txState = 'error';
		}
	}

	function reset() { txState = 'idle'; errMsg = ''; }
</script>

<svelte:head><title>Swap · Yield</title></svelte:head>

<main class="flex min-h-screen items-start justify-center py-12 px-4" style="background:var(--bg);">
	<div class="w-full max-w-sm">

		<h1 class="mb-6 text-[22px] font-black" style="color:var(--text);letter-spacing:-0.03em;">
			Swap
		</h1>

		{#if !address}
			<div class="rounded-[var(--r-lg)] p-6 text-center" style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);">
				<p style="color:var(--text-muted);">Open in Circles miniapp to connect wallet.</p>
			</div>

		{:else}
			<div class="overflow-hidden rounded-[var(--r-lg)]" style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);">

				<!-- Token In -->
				<div class="p-4">
					<div class="mb-2 flex justify-between text-[12px]" style="color:var(--text-muted);">
						<span>You pay</span>
						<button onclick={setMax} class="font-semibold" style="color:var(--accent);">
							Max: {balInAmt.toLocaleString('en-US', { maximumFractionDigits: 4 })} {tokenIn.symbol}
						</button>
					</div>
					<div class="flex items-center gap-3">
						<input
							type="text"
							inputmode="decimal"
							placeholder="0.00"
							bind:value={input}
							disabled={txState !== 'idle'}
							class="tnum min-w-0 flex-1 bg-transparent text-[28px] font-bold outline-none disabled:opacity-50"
							style="color:var(--text);"
						/>
						<div class="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold" style="background:var(--ghost-bg);color:var(--text);">
							{tokenIn.symbol}
						</div>
					</div>
				</div>

				<!-- Flip button -->
				<div class="relative flex items-center px-4">
					<div class="flex-1" style="border-top:var(--row-sep);"></div>
					<button
						onclick={() => { flipped = !flipped; input = ''; reset(); }}
						class="mx-3 flex h-8 w-8 items-center justify-center rounded-full text-lg transition-all active:scale-90"
						style="background:var(--ghost-bg);border:var(--card-border);"
					>⇅</button>
					<div class="flex-1" style="border-top:var(--row-sep);"></div>
				</div>

				<!-- Token Out -->
				<div class="p-4">
					<div class="mb-2 text-[12px]" style="color:var(--text-muted);">You receive (estimated)</div>
					<div class="flex items-center gap-3">
						<div class="tnum min-w-0 flex-1 text-[28px] font-bold" style="color:var(--text-muted);">
							~
						</div>
						<div class="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold" style="background:var(--ghost-bg);color:var(--text);">
							{tokenOut.symbol}
						</div>
					</div>
					<div class="mt-1 text-[12px]" style="color:var(--text-muted);">
						Balance: {balOutAmt.toLocaleString('en-US', { maximumFractionDigits: 4 })} {tokenOut.symbol}
					</div>
				</div>

				<!-- Action buttons -->
				<div class="px-4 pb-4">
					{#if txState === 'success'}
						<div class="mb-3 rounded-[var(--r-md)] p-3 text-center text-sm font-semibold" style="background:#d1fae5;color:#065f46;">
							✓ Swap successful{txHash ? ` · ${txHash.slice(0,10)}…` : ''}
						</div>
						<button onclick={reset} class="w-full rounded-[var(--r-md)] py-3 text-sm font-bold" style="background:var(--ghost-bg);color:var(--text);">
							Swap again
						</button>

					{:else if txState === 'error'}
						<div class="mb-3 rounded-[var(--r-md)] p-3 text-xs" style="background:#fee2e2;color:#dc2626;">
							{errMsg}
						</div>
						<button onclick={reset} class="w-full rounded-[var(--r-md)] py-3 text-sm font-bold" style="background:var(--ghost-bg);color:var(--text);">
							Try again
						</button>

					{:else if parsed === 0n}
						<button disabled class="w-full rounded-[var(--r-md)] py-3 text-sm font-bold opacity-40" style="background:var(--accent);color:#fff;">
							Enter amount
						</button>

					{:else if parsed > balanceIn}
						<button disabled class="w-full rounded-[var(--r-md)] py-3 text-sm font-bold opacity-40" style="background:var(--accent);color:#fff;">
							Insufficient {tokenIn.symbol}
						</button>

					{:else if needsApproval}
						<button
							onclick={approve}
							disabled={txState === 'approving'}
							class="w-full rounded-[var(--r-md)] py-3 text-sm font-bold text-white disabled:opacity-50"
							style="background:var(--accent);box-shadow:var(--accent-shadow);"
						>
							{txState === 'approving' ? 'Approving…' : `Approve ${tokenIn.symbol}`}
						</button>

					{:else}
						<button
							onclick={swap}
							disabled={txState === 'swapping'}
							class="w-full rounded-[var(--r-md)] py-3 text-sm font-bold text-white disabled:opacity-50"
							style="background:var(--accent);box-shadow:var(--accent-shadow);"
						>
							{txState === 'swapping' ? 'Swapping…' : `Swap ${tokenIn.symbol} → ${tokenOut.symbol}`}
						</button>
					{/if}
				</div>

				<!-- Pool info -->
				<div class="border-t px-4 py-3 text-[11.5px]" style="border-color:var(--border);color:var(--text-muted);">
					Balancer V2 · s-YIELDPOT/USDC.e pool · Gnosis Chain
				</div>
			</div>

			<a href="/" class="mt-4 block text-center text-[12px]" style="color:var(--text-muted);">← Back to Yield</a>
		{/if}
	</div>
</main>
