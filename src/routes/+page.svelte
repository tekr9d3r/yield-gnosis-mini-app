<script lang="ts">
	import { onMount } from 'svelte';
	import { isMiniappMode, onWalletChange } from '@aboutcircles/miniapp-sdk';
	import { Sdk } from '@aboutcircles/sdk';

	const INVITE_LINK = 'https://circles.gnosis.io/invitation/R0L994iA';
	import { fetchAllBalances } from '$lib/balances.js';
	import { fetchAaveApys, type PoolData } from '$lib/defilama.js';
	import { fetchTokenPrices } from '$lib/prices.js';
	import { getATokenAddress, getATokenBalance } from '$lib/aave.js';
	import type { AssetInfo } from '$lib/types.js';
	import HeroCard      from '../components/HeroCard.svelte';
	import PositionCard  from '../components/PositionCard.svelte';
	import TokenLogo     from '../components/TokenLogo.svelte';
	import WalletSheet   from '../components/WalletSheet.svelte';
	import TipJar        from '../components/TipJar.svelte';
	import YieldPotCard  from '../components/YieldPotCard.svelte';
	import YieldPotSheet from '../components/YieldPotSheet.svelte';

	type Phase = 'idle' | 'loading' | 'ready';
	let phase         = $state<Phase>('idle');
	let inMiniapp     = $state(false);
	let address       = $state<`0x${string}` | null>(null);
	let walletChecked = $state(false);
	let assets        = $state<AssetInfo[]>([]);
	let usdToEur      = $state(0.92);
	let walletOpen    = $state(false);
	let yieldPotOpen  = $state(false);
	let crcBalance    = $state(0);

	// Circles identity
	let profileName     = $state<string | undefined>(undefined);
	let profileImageUrl = $state<string | undefined>(undefined);
	let trustCount      = $state(0);

	let _sdk: Sdk | null = null;
	function getSdk(): Sdk {
		if (!_sdk) _sdk = new Sdk();
		return _sdk;
	}

	async function loadProfile(addr: `0x${string}`) {
		const sdk = getSdk();
		const [prof, trusted, bal] = await Promise.allSettled([
			sdk.rpc.profile.getProfileByAddress(addr),
			sdk.rpc.trust.getTrustedBy(addr),
			sdk.rpc.balance.getTotalBalance(addr)
		]);
		if (prof.status === 'fulfilled' && prof.value) {
			profileName = prof.value.name ?? undefined;
			const p   = prof.value;
			const raw = p.imageUrl ?? p.previewImageUrl ?? null;
			profileImageUrl = raw?.startsWith('ipfs://')
				? raw.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/')
				: raw ?? undefined;
		}
		if (trusted.status === 'fulfilled') trustCount = trusted.value.length;
		if (bal.status    === 'fulfilled') crcBalance  = Number(bal.value) / 1e18;
	}

	let _loadId = 0;

	async function loadData(addr: `0x${string}`) {
		const id = ++_loadId;
		phase = 'loading';

		const [balancesResult, apysResult, pricesResult] = await Promise.allSettled([
			fetchAllBalances(addr),
			fetchAaveApys(),
			fetchTokenPrices()
		]);

		if (id !== _loadId) return;

		let list: AssetInfo[] = balancesResult.status === 'fulfilled' ? balancesResult.value : [];
		const apyMap = apysResult.status === 'fulfilled' ? apysResult.value : new Map<string, PoolData>();
		if (pricesResult.status === 'fulfilled') usdToEur = pricesResult.value.usdToEur;

		const aTokenResults = await Promise.allSettled(list.map(a => getATokenAddress(a.address)));
		if (id !== _loadId) return;

		list = list.map((a, i) => {
			const poolData = apyMap.get(a.address.toLowerCase());
			return {
				...a,
				apy:           poolData?.apy ?? null,
				tvl:           poolData?.tvl ?? null,
				apyLoading:    false,
				aTokenAddress: aTokenResults[i].status === 'fulfilled'
					? (aTokenResults[i] as PromiseFulfilledResult<`0x${string}`>).value
					: null
			};
		});

		const depositedResults = await Promise.allSettled(
			list.map(a => a.aTokenAddress ? getATokenBalance(addr, a.aTokenAddress) : Promise.resolve(0n))
		);
		if (id !== _loadId) return;

		list = list.map((a, i) => ({
			...a,
			depositedBalance: depositedResults[i].status === 'fulfilled'
				? (depositedResults[i] as PromiseFulfilledResult<bigint>).value
				: 0n
		}));

		assets = list;
		phase  = 'ready';
	}

	onMount(() => {
		inMiniapp = isMiniappMode();
		if (!inMiniapp) {
			window.location.replace('https://circles.gnosis.io');
			return;
		}
		if (inMiniapp) {
			onWalletChange(async (addr) => {
				walletChecked = true;
				if (!addr) { phase = 'idle'; address = null; return; }
				address = addr as `0x${string}`;
				loadProfile(address);
				await loadData(address);
			});
		}
	});

	// Position assets: EURe and USDC.e
	const positions = $derived(assets.filter(a => ['EURe', 'USDC.e'].includes(a.symbol)));

	// Wallet asset list: all assets
	const walletAssets = $derived(assets.map(a => ({
		...a,
		walletAmt: Number(a.balance) / 10 ** a.decimals,
		eurVal:    a.symbol === 'EURe'
			? Number(a.balance) / 10 ** a.decimals
			: (Number(a.balance) / 10 ** a.decimals) * usdToEur
	})));

	function eurRateFor(a: AssetInfo): number {
		return a.symbol === 'EURe' ? 1.0 : usdToEur;
	}

	function createAccount() {
		window.open(INVITE_LINK, '_blank', 'noopener');
	}

	// Short address helper
	function short(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }
</script>

<svelte:head>
	<title>Yield · Aave v3</title>
</svelte:head>

<main class="min-h-screen py-6" style="background-color:var(--bg);">
	<div class="mx-auto w-full max-w-md">

		{#if inMiniapp && walletChecked && !address}
			<!-- No Circles account -->
			<div class="flex flex-col items-center gap-8 px-6 py-16">
				<div class="flex h-20 w-20 items-center justify-center rounded-full"
					style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);">
					<span class="text-4xl">✦</span>
				</div>
				<div class="text-center">
					<h1 class="mb-2 text-[26px] font-black leading-tight" style="color:var(--text);letter-spacing:-0.03em;">Welcome to Yield</h1>
					<p class="text-[14px] leading-relaxed" style="color:var(--text-muted);">
						Earn yield on your stablecoins and play the weekly CRC lottery — powered by Circles on Gnosis Chain.
					</p>
				</div>

				<div class="w-full max-w-xs">
					<button
						onclick={createAccount}
						class="w-full rounded-[var(--r-lg)] py-4 text-[15px] font-bold text-white transition-all active:scale-95"
						style="background:var(--accent);box-shadow:var(--accent-shadow);"
					>
						Create Circles Account
					</button>

					<p class="mt-4 text-center text-[12px]" style="color:var(--text-dim);">
						Free · No gas required · Secured by passkey
					</p>
				</div>

				<div class="w-full max-w-xs rounded-[var(--r-lg)] p-4 text-center"
					style="background:var(--card);border:var(--card-border);">
					<p class="mb-2 text-[12px] font-semibold" style="color:var(--text-muted);">Already have an account?</p>
					<p class="text-[12px]" style="color:var(--text-dim);">
						Connect your wallet in the Circles app and reopen Yield from the miniapps menu.
					</p>
				</div>
			</div>

		{:else if phase === 'loading' || (inMiniapp && !walletChecked)}
			<!-- Loading spinner -->
			<div class="flex flex-col items-center gap-4 py-24 text-center">
				<div class="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
					style="border-top-color:var(--accent);border-right-color:var(--accent);"></div>
				<p class="text-sm" style="color:var(--text-muted);">
					{!walletChecked ? 'Connecting wallet…' : 'Loading balances…'}
				</p>
			</div>

		{:else if phase === 'ready' && address}
			<!-- ── Header ── -->
			<header class="mb-5 flex items-center justify-between px-4">
				<div>
					<h1 class="text-[26px] font-black leading-none" style="color:var(--text);letter-spacing:-0.03em;">Yield</h1>
					<div class="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium" style="color:var(--text-muted);">
						<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
							<path d="M8 1.5l5 2v4c0 3.2-2.1 5.4-5 6.5C5.1 12.9 3 10.7 3 7.5v-4l5-2z" stroke="var(--yield)" stroke-width="1.5" stroke-linejoin="round"/>
							<path d="M5.8 8l1.5 1.6L10.4 6.3" stroke="var(--yield)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						<span>Aave v3 · Gnosis Chain</span>
					</div>
				</div>

				<button
					onclick={() => (walletOpen = true)}
					class="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-all active:scale-95"
					style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);"
				>
					{#if profileImageUrl}
						<img src={profileImageUrl} alt="" class="h-7 w-7 rounded-full object-cover" style="border:1.5px solid var(--yield);" />
					{:else}
						<div class="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-white"
							style="background:var(--accent);border:1.5px solid var(--yield);">
							{(profileName || address).slice(0, 2).toUpperCase()}
						</div>
					{/if}
					<span class="pulse-dot inline-block rounded-full" style="width:7px;height:7px;background:var(--yield);"></span>
					<span class="tnum text-[12.5px] font-semibold" style="color:var(--text-muted);">{short(address)}</span>
				</button>
			</header>

			<!-- ── Hero total balance ── -->
			<HeroCard {assets} {usdToEur} />

			<!-- ── Position cards ── -->
			<div class="mb-4 flex gap-2.5 px-4">
				{#each positions as asset (asset.id)}
					<PositionCard
						{asset}
						{address}
						eurRate={eurRateFor(asset)}
						onChanged={() => loadData(address!)}
					/>
				{/each}
			</div>

			<!-- ── Wallet asset list ── -->
			<div class="mb-4 px-4">
				<div class="mb-2 flex justify-between px-1 text-[11.5px] font-black uppercase tracking-widest" style="color:var(--text-dim);">
					<span>Wallet</span><span>Balance</span>
				</div>
				<div class="overflow-hidden rounded-[var(--r-lg)]" style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);">
					{#each walletAssets as a, i (a.id)}
						<div class="flex items-center px-4 py-3.5" style="border-top:{i ? 'var(--row-sep)' : 'none'};">
							<!-- Token logo -->
							<div class="mr-3">
								<TokenLogo symbol={a.symbol} logoUrl={a.logoUrl} size={36} />
							</div>
							<div class="flex-1">
								<div class="text-[15px] font-bold leading-tight" style="color:var(--text);">{a.symbol}</div>
								<div class="text-[12px] font-medium" style="color:var(--text-muted);">
									{a.symbol === 'EURe' ? 'Euro' : a.symbol === 'USDC.e' ? 'USD Coin' : 'Circles'}
								</div>
							</div>
							<div class="text-right">
								<div class="tnum text-[15px] font-bold" style="color:var(--text);">
									{a.walletAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
								</div>
								{#if a.symbol !== 'CRC' && a.eurVal > 0}
									<div class="tnum text-[11.5px]" style="color:var(--text-dim);">≈€{a.eurVal.toFixed(2)}</div>
								{/if}
							</div>
						</div>
					{/each}
					<!-- CRC balance from Circles -->
					{#if crcBalance > 0}
						<div class="flex items-center px-4 py-3.5" style="border-top:var(--row-sep);">
							<div class="mr-3"><TokenLogo symbol="CRC" logoUrl="/img/crc-logo.webp" size={36} /></div>
							<div class="flex-1">
								<div class="text-[15px] font-bold leading-tight" style="color:var(--text);">CRC</div>
								<div class="text-[12px] font-medium" style="color:var(--text-muted);">Circles</div>
							</div>
							<div class="tnum text-right text-[15px] font-bold" style="color:var(--text);">
								{crcBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- ── Yield Pot CTA ── -->
			<div class="mb-4 px-4">
				<YieldPotCard address={address} onOpen={() => (yieldPotOpen = true)} />
			</div>

			<!-- ── Builder / tip footer ── -->
			<div class="mx-4 mb-8 overflow-hidden rounded-[var(--r-lg)] p-4"
				style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);">
				<!-- Builder row -->
				<div class="flex items-center gap-3">
					<img src="/tekr0x-avatar.jpg" alt="Tekr0x.eth"
						class="h-10 w-10 shrink-0 rounded-full object-cover"
						style="border:2px solid var(--accent);" />
					<div class="flex-1">
						<p class="text-[15px] font-bold leading-tight" style="color:var(--text);">Tekr0x.eth</p>
						<a href="https://x.com/tekr0x" target="_blank" rel="noopener noreferrer"
							class="text-[12px] font-medium" style="color:var(--text-muted);">@tekr0x on X ↗</a>
					</div>
					<a href="https://app.gnosis.io/p/0x15BE89708053Cbc405F29095ECf803D51b5812C7"
						target="_blank" rel="noopener noreferrer"
						class="shrink-0 rounded-[var(--r-md)] px-3 py-2 text-[13px] font-bold text-white"
						style="background:var(--accent);box-shadow:var(--accent-shadow);">
						Join my circle ✦
					</a>
				</div>
				<!-- Tip jar -->
				<div class="mt-4 border-t pt-4" style="border-color:var(--border);">
					<TipJar {address} />
				</div>
			</div>
		{/if}

	</div>
</main>

{#if yieldPotOpen && address}
	<YieldPotSheet address={address} onClose={() => (yieldPotOpen = false)} />
{/if}

{#if walletOpen && address}
	<WalletSheet
		{address}
		{assets}
		profileName={profileName}
		profileImageUrl={profileImageUrl}
		{trustCount}
		{crcBalance}
		onClose={() => (walletOpen = false)}
		onWithdrawDone={() => { walletOpen = false; loadData(address!); }}
	/>
{/if}
