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
	import { WBTC_ADDRESS, WETH_ADDRESS, GNO_ADDRESS, XDAI_ADDRESS, COW_TOKEN_ADDRESS, AAVE_TOKEN_ADDRESS, ERC20_ABI, publicClient } from '$lib/chains.js';
	import HeroCard      from '../components/HeroCard.svelte';
	import PositionCard  from '../components/PositionCard.svelte';
	import TokenLogo     from '../components/TokenLogo.svelte';
	import WalletSheet   from '../components/WalletSheet.svelte';
	import YieldPotCard  from '../components/YieldPotCard.svelte';
	import YieldPotSheet from '../components/YieldPotSheet.svelte';
	import MarketsRow    from '../components/MarketsRow.svelte';
	import AssetSheet    from '../components/AssetSheet.svelte';
	import AboutSheet    from '../components/AboutSheet.svelte';

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
	let marketAsset   = $state<'BTC' | 'ETH' | 'GNO' | 'XDAI' | 'COW' | 'AAVE' | null>(null);
	let aboutOpen     = $state(false);
	let wbtcBalance   = $state(0n);
	let wethBalance   = $state(0n);
	let gnoBalance    = $state(0n);
	let xdaiBalance   = $state(0n);
	let cowBalance    = $state(0n);
	let aaveBalance   = $state(0n);
	let marketPrices  = $state<Record<string, number>>({});

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

		// Fetch market token balances (non-blocking)
		Promise.allSettled([
			publicClient.readContract({ address: WBTC_ADDRESS,       abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] }),
			publicClient.readContract({ address: WETH_ADDRESS,       abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] }),
			publicClient.readContract({ address: GNO_ADDRESS,        abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] }),
			publicClient.getBalance({ address: addr }),
			publicClient.readContract({ address: COW_TOKEN_ADDRESS,  abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] }),
			publicClient.readContract({ address: AAVE_TOKEN_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [addr] }),
		]).then(([w, e, g, x, c, a]) => {
			if (id !== _loadId) return;
			if (w.status === 'fulfilled') wbtcBalance = w.value as bigint;
			if (e.status === 'fulfilled') wethBalance = e.value as bigint;
			if (g.status === 'fulfilled') gnoBalance  = g.value as bigint;
			if (x.status === 'fulfilled') xdaiBalance = x.value as bigint;
			if (c.status === 'fulfilled') cowBalance  = c.value as bigint;
			if (a.status === 'fulfilled') aaveBalance = a.value as bigint;
		});
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

			<!-- ── Markets row ── -->
			<MarketsRow address={address} onOpen={(sym) => (marketAsset = sym as typeof marketAsset)} onPrices={(p) => (marketPrices = p)} />

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
					<!-- Market token holdings -->
					{#if wbtcBalance > 0n}
						<button class="flex w-full items-center px-4 py-3.5 text-left transition-all active:scale-[0.98]" style="border-top:var(--row-sep);" onclick={() => (marketAsset = 'BTC')}>
							<div class="mr-3"><img src="/img/bitcoin.png" alt="BTC" width="36" height="36" class="rounded-full" /></div>
							<div class="flex-1">
								<div class="text-[15px] font-bold leading-tight" style="color:var(--text);">BTC</div>
								<div class="text-[12px] font-medium" style="color:var(--text-muted);">Bitcoin</div>
							</div>
							<div class="text-right">
								<div class="tnum text-[15px] font-bold" style="color:var(--text);">{(Number(wbtcBalance) / 1e8).toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 })}</div>
								{#if marketPrices.BTC}<div class="tnum text-[11.5px]" style="color:var(--text-dim);">≈€{((Number(wbtcBalance) / 1e8) * marketPrices.BTC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>{/if}
							</div>
						</button>
					{/if}
					{#if wethBalance > 0n}
						<button class="flex w-full items-center px-4 py-3.5 text-left transition-all active:scale-[0.98]" style="border-top:var(--row-sep);" onclick={() => (marketAsset = 'ETH')}>
							<div class="mr-3"><img src="/img/ethereum.png" alt="ETH" width="36" height="36" class="rounded-full" /></div>
							<div class="flex-1">
								<div class="text-[15px] font-bold leading-tight" style="color:var(--text);">ETH</div>
								<div class="text-[12px] font-medium" style="color:var(--text-muted);">Ethereum</div>
							</div>
							<div class="text-right">
								<div class="tnum text-[15px] font-bold" style="color:var(--text);">{(Number(wethBalance) / 1e18).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}</div>
								{#if marketPrices.ETH}<div class="tnum text-[11.5px]" style="color:var(--text-dim);">≈€{((Number(wethBalance) / 1e18) * marketPrices.ETH).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>{/if}
							</div>
						</button>
					{/if}
					{#if gnoBalance > 0n}
						<button class="flex w-full items-center px-4 py-3.5 text-left transition-all active:scale-[0.98]" style="border-top:var(--row-sep);" onclick={() => (marketAsset = 'GNO')}>
							<div class="mr-3"><img src="/img/gnosis.png" alt="GNO" width="36" height="36" class="rounded-full" /></div>
							<div class="flex-1">
								<div class="text-[15px] font-bold leading-tight" style="color:var(--text);">GNO</div>
								<div class="text-[12px] font-medium" style="color:var(--text-muted);">Gnosis</div>
							</div>
							<div class="text-right">
								<div class="tnum text-[15px] font-bold" style="color:var(--text);">{(Number(gnoBalance) / 1e18).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}</div>
								{#if marketPrices.GNO}<div class="tnum text-[11.5px]" style="color:var(--text-dim);">≈€{((Number(gnoBalance) / 1e18) * marketPrices.GNO).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>{/if}
							</div>
						</button>
					{/if}
					{#if xdaiBalance > 0n}
						<button class="flex w-full items-center px-4 py-3.5 text-left transition-all active:scale-[0.98]" style="border-top:var(--row-sep);" onclick={() => (marketAsset = 'XDAI')}>
							<div class="mr-3"><img src="/img/xdai.png" alt="XDAI" width="36" height="36" class="rounded-full" /></div>
							<div class="flex-1">
								<div class="text-[15px] font-bold leading-tight" style="color:var(--text);">XDAI</div>
								<div class="text-[12px] font-medium" style="color:var(--text-muted);">xDAI</div>
							</div>
							<div class="text-right">
								<div class="tnum text-[15px] font-bold" style="color:var(--text);">{(Number(xdaiBalance) / 1e18).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
								{#if marketPrices.XDAI}<div class="tnum text-[11.5px]" style="color:var(--text-dim);">≈€{((Number(xdaiBalance) / 1e18) * marketPrices.XDAI).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>{/if}
							</div>
						</button>
					{/if}
					{#if cowBalance > 0n}
						<button class="flex w-full items-center px-4 py-3.5 text-left transition-all active:scale-[0.98]" style="border-top:var(--row-sep);" onclick={() => (marketAsset = 'COW')}>
							<div class="mr-3"><img src="/img/cow.png" alt="COW" width="36" height="36" class="rounded-full" /></div>
							<div class="flex-1">
								<div class="text-[15px] font-bold leading-tight" style="color:var(--text);">COW</div>
								<div class="text-[12px] font-medium" style="color:var(--text-muted);">CoW Protocol</div>
							</div>
							<div class="text-right">
								<div class="tnum text-[15px] font-bold" style="color:var(--text);">{(Number(cowBalance) / 1e18).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
								{#if marketPrices.COW}<div class="tnum text-[11.5px]" style="color:var(--text-dim);">≈€{((Number(cowBalance) / 1e18) * marketPrices.COW).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>{/if}
							</div>
						</button>
					{/if}
					{#if aaveBalance > 0n}
						<button class="flex w-full items-center px-4 py-3.5 text-left transition-all active:scale-[0.98]" style="border-top:var(--row-sep);" onclick={() => (marketAsset = 'AAVE')}>
							<div class="mr-3"><img src="/img/aave.png" alt="AAVE" width="36" height="36" class="rounded-full" /></div>
							<div class="flex-1">
								<div class="text-[15px] font-bold leading-tight" style="color:var(--text);">AAVE</div>
								<div class="text-[12px] font-medium" style="color:var(--text-muted);">Aave</div>
							</div>
							<div class="text-right">
								<div class="tnum text-[15px] font-bold" style="color:var(--text);">{(Number(aaveBalance) / 1e18).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
								{#if marketPrices.AAVE}<div class="tnum text-[11.5px]" style="color:var(--text-dim);">≈€{((Number(aaveBalance) / 1e18) * marketPrices.AAVE).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>{/if}
							</div>
						</button>
					{/if}
				</div>
			</div>

			<!-- ── Yield Pot CTA ── -->
			<div class="mb-4 px-4">
				<YieldPotCard address={address} onOpen={() => (yieldPotOpen = true)} />
			</div>

			<!-- ── About button ── -->
			<div class="mb-8 flex justify-center px-4">
				<button
					onclick={() => (aboutOpen = true)}
					class="rounded-full px-5 py-2 text-[13px] font-semibold transition-all active:scale-95"
					style="background:var(--ghost-bg);color:var(--text-muted);border:var(--card-border);"
				>About</button>
			</div>
		{/if}

	</div>
</main>

{#if yieldPotOpen && address}
	<YieldPotSheet address={address} onClose={() => (yieldPotOpen = false)} />
{/if}

{#if aboutOpen && address}
	<AboutSheet address={address} onClose={() => (aboutOpen = false)} />
{/if}

{#if marketAsset && address}
	<AssetSheet
		sym={marketAsset as 'BTC' | 'ETH' | 'GNO' | 'XDAI' | 'COW' | 'AAVE'}
		address={address}
		eureBalance={assets.find(a => a.symbol === 'EURe')?.balance ?? 0n}
		onClose={() => (marketAsset = null)}
		onDone={() => { marketAsset = null; loadData(address!); }}
	/>
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
