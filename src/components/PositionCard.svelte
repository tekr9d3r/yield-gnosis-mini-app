<script lang="ts">
	import { formatUnits, parseUnits, maxUint256 } from 'viem';
	import { sendTransactions } from '@aboutcircles/miniapp-sdk';
	import { encodeApprove, encodeSupply, encodeWithdraw } from '$lib/aave.js';
	import { AAVE_POOL } from '$lib/chains.js';
	import type { AssetInfo } from '$lib/types.js';
	import TokenLogo from './TokenLogo.svelte';

	interface Props {
		asset:     AssetInfo;
		address:   `0x${string}`;
		eurRate:   number;
		onChanged: () => void;
	}
	let { asset, address, eurRate, onChanged }: Props = $props();

	type Mode = 'deposit' | 'withdraw' | null;
	let mode:    Mode   = $state(null);
	let input:   string = $state('');
	let txState: 'idle' | 'sending' | 'error' = $state('idle');
	let errMsg:  string = $state('');

	// Live-ticking deposited value
	const depositedAmt = $derived(Number(asset.depositedBalance) / 10 ** asset.decimals);
	const walletAmt    = $derived(Number(asset.balance) / 10 ** asset.decimals);
	const active       = $derived(asset.depositedBalance > 0n);

	let live = $state(0);
	$effect(() => {
		live = depositedAmt;
		if (!active) return;
		const apy    = asset.apy ?? 0;
		const base   = depositedAmt;
		const perSec = base * (apy / 100) / (365 * 24 * 3600);
		const t0     = Date.now();
		const id     = setInterval(() => {
			live = base + perSec * ((Date.now() - t0) / 1000);
		}, 1000);
		return () => clearInterval(id);
	});

	// Quick-fill chips
	const chips = $derived.by((): [string, number][] => {
		const ref = mode === 'deposit' ? walletAmt : depositedAmt;
		return [['25%', ref * 0.25], ['50%', ref * 0.5], ['Max', ref]];
	});

	// Projected annual yield on input amount
	const projYr = $derived((parseFloat(input) || 0) * ((asset.apy ?? 0) / 100));

	// Viem-parsed input
	const parsed = $derived.by(() => {
		try {
			const s = input.trim();
			if (!s || parseFloat(s) <= 0) return 0n;
			const [w, f = ''] = s.split('.');
			return parseUnits(`${w}.${f.slice(0, asset.decimals)}`, asset.decimals);
		} catch { return 0n; }
	});

	const isValid = $derived(
		mode === 'deposit' ? parsed > 0n && parsed <= asset.balance : parsed > 0n
	);

	function setChip(val: number) {
		const dp = Math.min(asset.decimals, 6);
		const [w, f = ''] = val.toFixed(dp).split('.');
		input = f ? `${w}.${f.replace(/0+$/, '') || '0'}` : w;
	}

	async function submit() {
		if (!isValid || txState === 'sending') return;
		txState = 'sending';
		errMsg  = '';
		try {
			if (mode === 'deposit') {
				await sendTransactions([
					{ to: asset.address, data: encodeApprove(AAVE_POOL, parsed) },
					{ to: AAVE_POOL,     data: encodeSupply(asset.address, parsed, address) }
				]);
			} else {
				const amt = parsed >= asset.depositedBalance ? maxUint256 : parsed;
				await sendTransactions([
					{ to: AAVE_POOL, data: encodeWithdraw(asset.address, address, amt) }
				]);
			}
			mode    = null;
			input   = '';
			txState = 'idle';
			onChanged();
		} catch (e: unknown) {
			errMsg  = e instanceof Error ? e.message : 'Transaction rejected';
			txState = 'error';
		}
	}

	function toggleMode(m: Mode) {
		if (mode === m) { mode = null; input = ''; errMsg = ''; txState = 'idle'; }
		else            { mode = m;    input = ''; errMsg = ''; txState = 'idle'; }
	}

	// Sparkline
	function sparklinePath(w: number, h: number, up: boolean, seed: number): [string, number, number] {
		let r = seed * 9301 + 49297;
		const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
		const n = 11;
		const pts: string[] = [];
		let ly = h * 0.7, lx = 0;
		for (let i = 0; i < n; i++) {
			const trend = up ? -i * (h * 0.42 / n) : i * (h * 0.2 / n);
			ly = Math.max(3, Math.min(h - 3, h * 0.7 + trend + (rand() - 0.5) * h * 0.18));
			lx = (i / (n - 1)) * w;
			pts.push(`${i === 0 ? 'M' : 'L'}${lx.toFixed(1)} ${ly.toFixed(1)}`);
		}
		return [pts.join(' '), lx, ly];
	}

	const seed = $derived(asset.symbol.length + 2);
	const [spPath, spX, spY] = $derived(sparklinePath(140, 28, active, seed));
</script>

<div
	class="flex flex-1 flex-col overflow-hidden rounded-[var(--r-lg)]"
	style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);min-width:0;"
>
	<!-- APY banner -->
	<div
		class="flex items-center justify-between px-3 py-2.5"
		style="background:{active ? 'var(--apy-bg)' : 'var(--ghost-bg)'};"
	>
		<span class="text-[11px] font-black uppercase tracking-widest" style="color:var(--text-muted);">APY</span>
		<span class="tnum text-[15px] font-black" style="color:var(--yield);">
			{asset.apy != null ? asset.apy.toFixed(2) + '%' : '—'}
		</span>
	</div>

	<div class="flex flex-1 flex-col p-3.5">
		<!-- Token header -->
		<div class="mb-3 flex items-center gap-2.5">
			<TokenLogo symbol={asset.symbol} logoUrl={asset.logoUrl} size={36} />
			<div>
				<div class="text-[15px] font-bold leading-tight" style="color:var(--text);">{asset.symbol}</div>
				<div class="text-[11.5px] font-medium" style="color:var(--text-muted);">Aave v3</div>
			</div>
		</div>

		<!-- Balance / status -->
		<div class="mb-2 flex-1">
			{#if active}
				<div class="text-[11.5px] font-semibold" style="color:var(--text-muted);">Earning</div>
				<div class="tnum text-[22px] font-bold leading-tight" style="color:var(--text);letter-spacing:-0.02em;">
					{live.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
				</div>
			{:else}
				<div class="text-[13.5px] font-bold" style="color:var(--text);">Not earning yet</div>
				<div class="mt-0.5 text-[12px] font-medium leading-snug" style="color:var(--text-muted);">
					Earn {asset.apy != null ? asset.apy.toFixed(2) + '%' : '—'} on your {asset.symbol}
				</div>
			{/if}
		</div>

		<!-- Sparkline -->
		<div class="my-2" style="opacity:{active ? 1 : 0.35};">
			<svg width="140" height="28" viewBox="0 0 140 28" style="display:block;overflow:visible;">
				<path d={spPath} fill="none" stroke="var(--yield)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
					style="stroke-dasharray:400;stroke-dashoffset:400;animation:drawLine 1.2s cubic-bezier(0.22,1,0.36,1) 0.1s forwards;" />
				{#if active}
					<circle cx={spX} cy={spY} r="2.5" fill="var(--yield)" style="animation:popIn 0.4s ease 1.1s both;" />
				{/if}
			</svg>
		</div>

		<!-- Buttons -->
		{#if active}
			<div class="flex gap-2">
				<button
					onclick={() => toggleMode('deposit')}
					class="flex-1 rounded-[var(--r-md)] py-2.5 text-sm font-bold text-white transition-all active:scale-95"
					style="background:{mode === 'deposit' ? 'var(--text-muted)' : 'var(--accent)'};box-shadow:{mode === 'deposit' ? 'none' : 'var(--accent-shadow)'};"
				>
					{mode === 'deposit' ? 'Cancel' : '+ Earn'}
				</button>
				<button
					onclick={() => toggleMode('withdraw')}
					class="flex-1 rounded-[var(--r-md)] py-2.5 text-sm font-bold transition-all active:scale-95"
					style="background:var(--ghost-bg);border:1px solid var(--border);color:var(--text);"
				>
					{mode === 'withdraw' ? 'Cancel' : 'Out'}
				</button>
			</div>
		{:else}
			<button
				onclick={() => toggleMode('deposit')}
				class="w-full rounded-[var(--r-md)] py-2.5 text-sm font-bold text-white transition-all active:scale-95"
				style="background:{mode === 'deposit' ? 'var(--text-muted)' : 'var(--accent)'};box-shadow:{mode === 'deposit' ? 'none' : 'var(--accent-shadow)'};"
			>
				{mode === 'deposit' ? 'Cancel' : '+ Earn'}
			</button>
		{/if}

		<!-- Inline form -->
		{#if mode}
			<div
				class="mt-3 overflow-hidden rounded-[var(--r-md)] p-3"
				style="background:var(--inline-bg);animation:expandDown 0.3s cubic-bezier(0.22,1,0.36,1) both;"
			>
				<!-- Available / deposited label -->
				<div class="mb-2 flex justify-between text-[11.5px] font-semibold">
					<span style="color:var(--text-muted);">{mode === 'deposit' ? 'Available' : 'Deposited'}</span>
					<span class="tnum font-bold" style="color:var(--text);">
						{(mode === 'deposit' ? walletAmt : depositedAmt).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
					</span>
				</div>

				<!-- Amount input -->
				<input
					type="text"
					inputmode="decimal"
					placeholder="0.00"
					bind:value={input}
					disabled={txState === 'sending'}
					class="tnum mb-2 w-full rounded-[10px] px-3 py-2.5 text-base font-bold outline-none disabled:opacity-50"
					style="background:var(--card);border:1px solid var(--border);color:var(--text);"
				/>

				<!-- Chips -->
				<div class="mb-2 flex gap-1.5">
					{#each chips as [label, val]}
						<button
							onclick={() => setChip(val)}
							disabled={txState === 'sending'}
							class="flex-1 rounded-[var(--r-md)] py-1.5 text-[11.5px] font-bold transition-all active:scale-95"
							style="background:var(--ghost-bg);border:1px solid var(--border);color:var(--text);"
						>{label}</button>
					{/each}
				</div>

				<!-- Projection -->
				{#if mode === 'deposit' && projYr > 0}
					<div class="mb-2 text-center text-[12px] font-bold" style="color:var(--yield);">
						≈ +{projYr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {asset.symbol}/yr at {(asset.apy ?? 0).toFixed(2)}%
					</div>
				{/if}

				<!-- Submit -->
				<button
					onclick={submit}
					disabled={!isValid || txState === 'sending'}
					class="w-full rounded-[var(--r-md)] py-2.5 text-sm font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
					style="background:var(--accent);box-shadow:var(--accent-shadow);"
				>
					{txState === 'sending'
						? (mode === 'deposit' ? 'Depositing…' : 'Withdrawing…')
						: (mode === 'deposit' ? `Deposit ${asset.symbol}` : `Withdraw ${asset.symbol}`)}
				</button>

				{#if txState === 'error' && errMsg}
					<p class="mt-2 text-center text-xs" style="color:#dc2626;">{errMsg}</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
