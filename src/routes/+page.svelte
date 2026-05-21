<script lang="ts">
	import { onMount } from 'svelte';
	import { isMiniappMode, onWalletChange } from '@aboutcircles/miniapp-sdk';
	import { Sdk } from '@aboutcircles/sdk';
	import { fetchAllBalances } from '$lib/balances.js';
	import { fetchAaveApys, type PoolData } from '$lib/defilama.js';
	import { getATokenAddress, getATokenBalance } from '$lib/aave.js';
	import type { AppPhase, AssetInfo } from '$lib/types.js';
	import AssetTable from '../components/AssetTable.svelte';
	import DepositedTable from '../components/DepositedTable.svelte';
	import DepositCard from '../components/DepositCard.svelte';
	import LiveCounter from '../components/LiveCounter.svelte';
	import WalletSheet from '../components/WalletSheet.svelte';

	let phase         = $state<AppPhase>('idle');
	let address       = $state<`0x${string}` | null>(null);
	let assets        = $state<AssetInfo[]>([]);
	let selectedAsset = $state<AssetInfo | null>(null);
	let walletOpen    = $state(false);

	// Circles identity
	let profileName     = $state<string | undefined>(undefined);
	let profileImageUrl = $state<string | undefined>(undefined);
	let trustCount      = $state(0);
	let crcBalance      = $state(0);

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
			const p = prof.value as Record<string, unknown>;
			const raw = (p.picture ?? p.imageUrl ?? null) as string | null;
			profileImageUrl = raw?.startsWith('ipfs://')
				? raw.replace('ipfs://', 'https://ipfs.io/ipfs/')
				: raw ?? undefined;
		}
		if (trusted.status === 'fulfilled') trustCount = trusted.value.length;
		if (bal.status === 'fulfilled')     crcBalance = Number(bal.value) / 1e18;
	}

	let _loadId = 0;

	async function loadData(addr: `0x${string}`) {
		const id = ++_loadId;
		phase = 'loading';

		// Balances + APYs in parallel
		const [balancesResult, apysResult] = await Promise.allSettled([
			fetchAllBalances(addr),
			fetchAaveApys()
		]);

		if (id !== _loadId) return;

		let list: AssetInfo[] = balancesResult.status === 'fulfilled'
			? balancesResult.value
			: [];

		const apyMap = apysResult.status === 'fulfilled' ? apysResult.value : new Map<string, PoolData>();

		// aToken addresses in parallel with APY application
		const aTokenResults = await Promise.allSettled(
			list.map(a => getATokenAddress(a.address))
		);

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

		// Deposited (aToken) balances in parallel
		const depositedResults = await Promise.allSettled(
			list.map(a => a.aTokenAddress
				? getATokenBalance(addr, a.aTokenAddress)
				: Promise.resolve(0n)
			)
		);

		if (id !== _loadId) return;

		list = list.map((a, i) => ({
			...a,
			depositedBalance: depositedResults[i].status === 'fulfilled'
				? (depositedResults[i] as PromiseFulfilledResult<bigint>).value
				: 0n
		}));

		assets = list;
		phase  = 'table';
	}

	async function handleEarn(asset: AssetInfo) {
		if (!address || !asset.aTokenAddress) return;

		selectedAsset = asset;

		// Check if user already has deposits for this asset
		const deposited = await getATokenBalance(address, asset.aTokenAddress);
		if (deposited > 0n) {
			phase = 'deposited';
		} else {
			phase = 'deposit';
		}
	}

	function handleDeposited() {
		if (address && selectedAsset) {
			// Refresh assets in background, go straight to counter
			phase = 'deposited';
			loadData(address);
		}
	}

	function backToTable() {
		selectedAsset = null;
		phase = 'table';
	}

	onMount(() => {
		if (isMiniappMode()) {
			onWalletChange(async (addr) => {
				if (!addr) { phase = 'idle'; address = null; return; }
				address = addr as `0x${string}`;
				loadProfile(address);
				await loadData(address);
			});
		} else {
			address = '0x0000000000000000000000000000000000000001' as `0x${string}`;
			loadProfile(address);
			loadData(address);
		}
	});

	// Keep selectedAsset in sync with latest asset data
	$effect(() => {
		if (selectedAsset) {
			const updated = assets.find(a => a.id === selectedAsset!.id);
			if (updated) selectedAsset = updated;
		}
	});
</script>

<svelte:head>
	<title>Yield · Aave v3</title>
</svelte:head>

<main class="min-h-screen px-4 py-6" style="background-color: var(--bg);">
	<div class="mx-auto w-full max-w-md">

		<!-- Header -->
		<header class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-xl font-black" style="color: var(--text)">Yield</h1>
				<p class="flex items-center gap-1 text-xs" style="color: var(--text-muted)">Earn on <img src="/img/aave-aave-logo.png" alt="Aave" class="h-3 w-3" />Aave v3 · Gnosis Chain</p>
			</div>

			{#if address}
				<button
					onclick={() => (walletOpen = true)}
					class="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-all active:scale-95"
					style="background: var(--surface); border: 1px solid var(--border)"
				>
					{#if profileImageUrl}
						<img src={profileImageUrl} alt="" class="h-7 w-7 rounded-full object-cover" style="border: 1.5px solid var(--green)" />
					{:else}
						<div class="flex h-7 w-7 items-center justify-center rounded-full" style="background: var(--blue); border: 1.5px solid var(--green)">
							<span class="text-[10px] font-black text-white">{(profileName || address).slice(0, 2).toUpperCase()}</span>
						</div>
					{/if}
					<div class="h-1.5 w-1.5 rounded-full" style="background: var(--green)"></div>
					<span class="font-mono text-xs font-semibold" style="color: var(--text-muted)">{address.slice(0,6)}…{address.slice(-4)}</span>
				</button>
			{/if}
		</header>

		<!-- Phases -->
		{#if phase === 'idle' || phase === 'loading'}
			<div class="flex flex-col items-center gap-4 py-24 text-center">
				<div class="relative">
					<div
						class="h-12 w-12 animate-spin rounded-full border-2 border-transparent"
						style="border-top-color: var(--blue); border-right-color: var(--blue)"
					></div>
					<span class="sparkle absolute -right-1 -top-1 text-xs" style="color: var(--orange)">✦</span>
				</div>
				<p class="text-sm" style="color: var(--text-muted)">
					{phase === 'idle' ? 'Connecting wallet…' : 'Loading balances…'}
				</p>
			</div>

		{:else if phase === 'table'}
			<DepositedTable
				{assets}
				address={address!}
				onWithdrawDone={() => loadData(address!)}
				onDeposited={() => loadData(address!)}
			/>
			<div class="my-4 border-t" style="border-color: var(--border)"></div>
			<AssetTable {assets} address={address!} onDeposited={() => loadData(address!)} />

		{:else if phase === 'deposit' && selectedAsset && address}
			<DepositCard
				{address}
				asset={selectedAsset}
				onDeposited={handleDeposited}
				onBack={backToTable}
			/>

		{:else if phase === 'deposited' && selectedAsset && address}
			<LiveCounter {address} asset={selectedAsset} />

			<div class="mt-3 flex flex-col gap-2">
				<button
					onclick={() => { if (selectedAsset) phase = 'deposit'; }}
					class="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all active:scale-95"
					style="background: var(--surface); border: 1.5px solid var(--border); color: var(--text-muted)"
					onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)'; }}
					onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
				>
					Deposit More {selectedAsset.symbol}
				</button>
				<button
					onclick={backToTable}
					class="text-xs transition-opacity hover:opacity-60"
					style="color: var(--text-dim)"
				>
					← All assets
				</button>
			</div>
		{/if}

		<!-- Footer -->
		<footer
			class="mt-8 rounded-2xl p-4"
			style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 2px 8px rgba(55,55,200,0.06)"
		>
			<p class="mb-3 text-center text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">
				Built by
			</p>
			<div class="flex items-center gap-3">
				<img
					src="/tekr0x-avatar.jpg"
					alt="Tekr0x.eth"
					class="h-9 w-9 shrink-0 rounded-full object-cover"
					style="border: 2px solid var(--blue)"
				/>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-bold" style="color: var(--text)">Tekr0x.eth</p>
					<a
						href="https://x.com/tekr0x"
						target="_blank"
						rel="noopener noreferrer"
						class="text-xs transition-colors"
						style="color: var(--text-dim)"
						onmouseenter={(e) => (e.currentTarget.style.color = 'var(--blue)')}
						onmouseleave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
					>
						@tekr0x on X ↗
					</a>
				</div>
				<a
					href="https://app.gnosis.io/p/0x15BE89708053Cbc405F29095ECf803D51b5812C7"
					target="_blank"
					rel="noopener noreferrer"
					class="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all active:scale-95"
					style="background: var(--blue); box-shadow: 0 4px 12px var(--blue-shadow)"
					onmouseenter={(e) => (e.currentTarget.style.background = 'var(--blue-hover)')}
					onmouseleave={(e) => (e.currentTarget.style.background = 'var(--blue)')}
				>
					Join my circle ✦
				</a>
			</div>
		</footer>

	</div>
</main>

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
