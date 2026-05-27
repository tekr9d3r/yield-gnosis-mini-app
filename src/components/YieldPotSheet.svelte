<script lang="ts">
	import { onMount } from 'svelte';
	import { Sdk } from '@aboutcircles/sdk';
	import { YIELDPOT_GROUP, YIELDPOT_TREASURY } from '$lib/chains.js';

	interface Props {
		address: `0x${string}`;
		onClose: () => void;
	}
	let { address, onClose }: Props = $props();

	const CIRCLES_RPC = 'https://rpc.aboutcircles.com/';
	const GNOSIS_GROUP_URL = 'https://app.gnosis.io/0xA7b485Eae7EC8793f29C1ebb268455705c5B67AF';

	type ContributorRow = { member: string; timestamp: number; amount: number };
	type MemberProfile = { name?: string; imageUrl?: string };

	type Status = 'loading' | 'ready';
	let status         = $state<Status>('loading');
	let members        = $state<ContributorRow[]>([]);
	let memberProfiles = $state(new Map<string, MemberProfile>());
	let treasuryCrc    = $state(0);


	let _sdk: Sdk | null = null;
	function getSdk() { if (!_sdk) _sdk = new Sdk(); return _sdk; }

	async function fetchContributors(): Promise<ContributorRow[]> {
		const url = `https://gnosis.blockscout.com/api/v2/addresses/${YIELDPOT_TREASURY}/token-transfers?type=ERC-1155&filter=to`;
		const res = await fetch(url);
		if (!res.ok) return [];
		const data = await res.json();

		type Transfer = { from: { hash: string }; timestamp: string; total: { value: string } };
		const items: Transfer[] = data.items ?? [];

		const agg = new Map<string, { timestamp: number; amount: bigint }>();
		for (const item of items) {
			const addr = item.from?.hash?.toLowerCase() ?? '';
			if (!addr || addr === '0x0000000000000000000000000000000000000000') continue;
			const ts  = Math.floor(new Date(item.timestamp).getTime() / 1000);
			const val = BigInt(item.total?.value ?? '0');
			const prev = agg.get(addr);
			agg.set(addr, { timestamp: Math.max(ts, prev?.timestamp ?? 0), amount: (prev?.amount ?? 0n) + val });
		}

		return Array.from(agg.entries())
			.map(([member, { timestamp, amount }]) => ({ member, timestamp, amount: Number(amount) / 1e18 }))
			.sort((a, b) => b.amount - a.amount);
	}

	async function rpcCall(method: string, params: unknown[]) {
		const res = await fetch(CIRCLES_RPC, {
			method:  'POST',
			headers: { 'Content-Type': 'application/json' },
			body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
		});
		return (await res.json()).result;
	}

	async function load() {
		status = 'loading';
		const [contributorsRes, treasuryRes] = await Promise.allSettled([
			fetchContributors(),
			rpcCall('circles_getTokenBalances', [YIELDPOT_TREASURY])
		]);

		if (contributorsRes.status === 'fulfilled') {
			members = contributorsRes.value;
		}

		if (treasuryRes.status === 'fulfilled') {
			type T = { circles: number };
			const tokens: T[] = treasuryRes.value ?? [];
			treasuryCrc = tokens.reduce((s, t) => s + t.circles, 0);
		}

		status = 'ready';

		// Load contributor profiles progressively
		const sdk = getSdk();
		for (const m of members) {
			sdk.rpc.profile.getProfileByAddress(m.member as `0x${string}`)
				.then(p => {
					if (!p) return;
					const pAny = p as unknown as Record<string, unknown>;
					const raw = (pAny.picture ?? pAny.imageUrl ?? null) as string | null;
					const imageUrl = raw?.startsWith('ipfs://')
						? raw.replace('ipfs://', 'https://ipfs.io/ipfs/')
						: raw ?? undefined;
					const profile: MemberProfile = { name: p.name ?? undefined, imageUrl };
					memberProfiles = new Map(memberProfiles).set(m.member.toLowerCase(), profile);
				})
				.catch(() => {});
		}
	}

	function short(addr: string): string { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }

	onMount(load);
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-end justify-center"
	style="background: rgba(10,10,46,0.4); backdrop-filter: blur(2px)"
	role="presentation"
	onclick={onClose}
>
	<!-- Sheet -->
	<div
		class="slide-up w-full max-w-md rounded-t-3xl p-6"
		style="background: var(--bg); max-height: 90vh; overflow-y: auto"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
	>
		<!-- Handle -->
		<div class="mx-auto mb-5 h-1 w-10 rounded-full" style="background: var(--border)"></div>

		<!-- Group header -->
		<div class="mb-5 flex items-center gap-4">
			<img
				src="/img/logo-yield-pot.png"
				alt="Yield Pot"
				class="h-14 w-14 shrink-0 rounded-2xl object-cover"
				style="box-shadow: 0 4px 16px var(--blue-shadow)"
			/>
			<div class="min-w-0 flex-1">
				<h2 class="text-xl font-black" style="color: var(--text)">Yield Pot</h2>
				<p class="font-mono text-[10px]" style="color: var(--text-dim)">{short(YIELDPOT_GROUP)}</p>
			</div>
		</div>

		<!-- Stats row -->
		<div class="mb-5 grid grid-cols-3 gap-2">
			<div class="rounded-2xl p-3 text-center" style="background: var(--surface); border: 1px solid var(--border)">
				{#if status === 'loading'}
					<p class="text-lg font-black" style="color: var(--text)">—</p>
				{:else}
					<p class="text-lg font-black" style="color: var(--text)">{members.length}</p>
				{/if}
				<p class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--text-dim)">Contributors</p>
			</div>
			<div class="rounded-2xl p-3 text-center" style="background: var(--surface); border: 1px solid rgba(55,55,200,0.25)">
				{#if status === 'loading'}
					<p class="text-lg font-black" style="color: var(--blue)">—</p>
				{:else}
					<p class="text-lg font-black tabular-nums" style="color: var(--blue)">
						{treasuryCrc < 0.01 ? '0' : treasuryCrc.toLocaleString('en', { maximumFractionDigits: 1 })}
					</p>
				{/if}
				<p class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--text-dim)">CRC Pool</p>
			</div>
			<div class="rounded-2xl p-3 text-center" style="background: var(--surface); border: 1px solid var(--border)">
				<p class="text-lg font-black" style="color: var(--text)">Weekly</p>
				<p class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--text-dim)">Prize draw</p>
			</div>
		</div>

		<!-- How to participate -->
		<div class="mb-5 rounded-2xl p-4" style="background: var(--surface); border: 1.5px solid rgba(55,55,200,0.2)">
			<p class="mb-2 text-sm font-semibold" style="color: var(--text)">How to participate</p>
			<p class="mb-3 text-xs leading-relaxed" style="color: var(--text-muted)">
				Open the Yield Pot group in the Gnosis app and tap the <strong style="color: var(--text)">★ star</strong> button (top right corner). Donating CRC to the pool makes you eligible for the weekly prize draw.
			</p>
			<a
				href={GNOSIS_GROUP_URL}
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-95"
				style="background: linear-gradient(135deg, var(--blue), #8b5cf6); box-shadow: 0 4px 16px var(--blue-shadow)"
			>
				Open Yield Pot in Gnosis App ↗
			</a>
		</div>

		<!-- Contributors list -->
		<p class="mb-2 text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">
			Pool contributors · {status === 'loading' ? '…' : members.length}
		</p>

		{#if status === 'loading'}
			<div class="flex items-center justify-center py-8">
				<div class="h-6 w-6 animate-spin rounded-full border-2 border-transparent"
					style="border-top-color: var(--blue); border-right-color: var(--blue)"></div>
			</div>
		{:else if members.length === 0}
			<p class="py-4 text-center text-sm" style="color: var(--text-dim)">No contributions yet.</p>
		{:else}
			<div class="mb-4 flex flex-col gap-1.5">
				{#each members as m (m.member)}
					{@const profile = memberProfiles.get(m.member.toLowerCase())}
					{@const isMe = m.member.toLowerCase() === address.toLowerCase()}
					{@const initials = (profile?.name ?? m.member.slice(2, 4)).slice(0, 2).toUpperCase()}
					<div
						class="flex items-center gap-3 rounded-xl px-3 py-2.5"
						style="background: var(--surface); border: 1px solid {isMe ? 'var(--green)' : 'var(--border)'}"
					>
						{#if profile?.imageUrl}
							<img
								src={profile.imageUrl}
								alt={profile.name ?? ''}
								class="h-8 w-8 shrink-0 rounded-full object-cover"
								style="border: 1.5px solid {isMe ? 'var(--green)' : 'var(--border)'}"
							/>
						{:else}
							<div
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
								style="background: {isMe ? 'var(--green)' : 'var(--blue)'}"
							>
								{initials}
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-semibold" style="color: var(--text)">
								{profile?.name ?? short(m.member)}{isMe ? ' (you)' : ''}
							</p>
							{#if profile?.name}
								<p class="font-mono text-[10px]" style="color: var(--text-dim)">{short(m.member)}</p>
							{/if}
						</div>
						<span class="shrink-0 font-mono text-[10px] font-semibold" style="color: {isMe ? 'var(--green)' : 'var(--text-dim)'}">
							{m.amount < 0.01 ? '<0.01' : m.amount.toLocaleString('en', { maximumFractionDigits: 2 })} CRC
						</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Close -->
		<button
			onclick={onClose}
			class="w-full rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95"
			style="background: var(--surface); border: 1.5px solid var(--border); color: var(--text-muted)"
		>
			Close
		</button>
	</div>
</div>
