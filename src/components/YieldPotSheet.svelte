<script lang="ts">
	import { onMount } from 'svelte';
	import { Sdk } from '@aboutcircles/sdk';
	import { YIELDPOT_GROUP, YIELDPOT_TREASURY } from '$lib/chains.js';

	interface Props {
		address: `0x${string}`;
		onClose: () => void;
	}
	let { address, onClose }: Props = $props();

	const CIRCLES_RPC      = 'https://rpc.aboutcircles.com/';
	const GNOSIS_GROUP_URL = 'https://app.gnosis.io/0xA7b485Eae7EC8793f29C1ebb268455705c5B67AF';

	// Week 1 winner — image fetched via SDK same as member profiles
	const WINNER_ADDRESS     = '0x833304482EB6F0435B62b6B7cC67e5cF3e1F134b' as `0x${string}`;
	const WINNER_PROFILE_URL = 'https://app.gnosis.io/0x833304482EB6F0435B62b6B7cC67e5cF3e1F134b';
	const WINNER_TX_URL      = 'https://gnosis.blockscout.com/tx/0x1bc3d8cbd751fa76d3bdcf13ba1775a08cc4d446df76ed5e1f10517d37defd35';
	let winnerName     = $state('Robinson');
	let winnerImageUrl = $state<string | undefined>(undefined);

	// Week 2: starts June 7 2026 00:00 UTC, runs 7 days
	const WEEK2_START_TS = 1780790400; // 2026-06-07 00:00:00 UTC
	const WEEK2_END_TS   = WEEK2_START_TS + 7 * 24 * 3600;

	type ContributorRow  = { member: string; timestamp: number; amount: number };
	type MemberProfile   = { name?: string; imageUrl?: string };

	type Status = 'loading' | 'ready';
	let status         = $state<Status>('loading');
	let members        = $state<ContributorRow[]>([]);
	let memberProfiles = $state(new Map<string, MemberProfile>());
	let treasuryCrc    = $state(0);

	// Deterministic avatar gradient
	const GRADS = [
		['#f59e0b','#ef4444'],['#8b5cf6','#6366f1'],['#10b981','#059669'],
		['#f43f5e','#fb7185'],['#0ea5e9','#2563eb'],['#14b8a6','#0d9488'],
		['#a855f7','#d946ef'],['#f97316','#ea580c'],['#22c55e','#16a34a'],
	];
	function addrGrad(addr: string): string {
		let h = 0;
		for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
		const [a, b] = GRADS[h % GRADS.length];
		return `linear-gradient(135deg,${a},${b})`;
	}

	// Week progress based on fixed Week 2 window
	const weekProgress = $derived.by(() => {
		const now = Date.now() / 1000;
		return Math.min(1, Math.max(0, (now - WEEK2_START_TS) / (WEEK2_END_TS - WEEK2_START_TS)));
	});
	const timeLeft = $derived.by(() => {
		const secsLeft = Math.max(0, WEEK2_END_TS - Date.now() / 1000);
		const d = Math.floor(secsLeft / 86400);
		const h = Math.floor((secsLeft % 86400) / 3600);
		return `${d}d ${h}h`;
	});

	// Draw ring SVG
	const RING_SIZE   = 110;
	const RING_R      = RING_SIZE / 2 - 9;
	const RING_CIRC   = $derived(2 * Math.PI * RING_R);
	const RING_TARGET = $derived(RING_CIRC * (1 - weekProgress));

	// Live treasury accrual (very slow growth for visual effect)
	let livePot = $state(0);
	$effect(() => {
		livePot = treasuryCrc;
		if (treasuryCrc <= 0) return;
		const base = treasuryCrc;
		const id = setInterval(() => {
			livePot = base + (Date.now() % 10000) / 1e7;
		}, 300);
		return () => clearInterval(id);
	});

	let _sdk: Sdk | null = null;
	function getSdk() { if (!_sdk) _sdk = new Sdk(); return _sdk; }

	function resolveImage(raw: string | null | undefined): string | undefined {
		if (!raw) return undefined;
		return raw.startsWith('ipfs://')
			? raw.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/')
			: raw;
	}

	async function fetchContributors(): Promise<ContributorRow[]> {
		const url  = `https://gnosis.blockscout.com/api/v2/addresses/${YIELDPOT_TREASURY}/token-transfers?type=ERC-1155&filter=to`;
		const res  = await fetch(url);
		if (!res.ok) return [];
		const data = await res.json();

		type Transfer = { from: { hash: string }; timestamp: string; total: { value: string } };
		const items: Transfer[] = data.items ?? [];

		const agg = new Map<string, { timestamp: number; amount: bigint }>();
		for (const item of items) {
			const addr = item.from?.hash?.toLowerCase() ?? '';
			if (!addr || addr === '0x0000000000000000000000000000000000000000') continue;
			const ts  = Math.floor(new Date(item.timestamp).getTime() / 1000);
			if (ts < WEEK2_START_TS) continue; // only Week 2 onwards
			const val  = BigInt(item.total?.value ?? '0');
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
		const [contributorsRes] = await Promise.allSettled([
			fetchContributors()
		]);

		if (contributorsRes.status === 'fulfilled') {
			members = contributorsRes.value;
			// Pot = sum of Week 2 contributions only
			treasuryCrc = members.reduce((s, m) => s + m.amount, 0);
		}

		status = 'ready';

		const sdk = getSdk();

		// Fetch winner profile image
		sdk.rpc.profile.getProfileByAddress(WINNER_ADDRESS)
			.then(p => {
				if (!p) return;
				if (p.name) winnerName = p.name;
				winnerImageUrl = resolveImage(p.imageUrl ?? p.previewImageUrl ?? null);
			})
			.catch(() => {});

		// Load member profiles progressively
		for (const m of members) {
			sdk.rpc.profile.getProfileByAddress(m.member as `0x${string}`)
				.then(p => {
					if (!p) return;
					memberProfiles = new Map(memberProfiles).set(m.member.toLowerCase(), {
						name:     p.name ?? undefined,
						imageUrl: resolveImage(p.imageUrl ?? p.previewImageUrl ?? null)
					});
				})
				.catch(() => {});
		}
	}

	function short(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }

	onMount(load);
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-end justify-center"
	style="background:rgba(10,10,46,0.45);backdrop-filter:blur(3px);"
	role="presentation"
	onclick={onClose}
>
	<!-- Sheet -->
	<div
		class="slide-up w-full max-w-md rounded-t-[28px] pb-8"
		style="background:var(--bg);max-height:92vh;overflow-y:auto;"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
	>
		<!-- Handle -->
		<div class="mx-auto mb-1 mt-3 h-1 w-10 rounded-full" style="background:var(--border);"></div>

		<!-- ── Nav ── -->
		<div class="flex items-center gap-3 px-4 py-3">
			<button onclick={onClose} aria-label="Close"
				class="flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-95"
				style="background:var(--ghost-bg);border:1px solid var(--border);">
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<path d="M12 3L6 9l6 6" stroke="var(--text)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
			<span class="text-[20px] font-black" style="color:var(--text);letter-spacing:-0.02em;">Yield Pot</span>
		</div>

		<!-- ── Week 1 Winner ── -->
		<div class="mx-4 mb-4 overflow-hidden rounded-[var(--r-lg)] p-4"
			style="background:linear-gradient(135deg,#fef9c3,#fef3c7);border:1.5px solid #fbbf24;box-shadow:var(--shadow);">
			<div class="mb-2 flex items-center gap-2">
				<span class="text-[13px] font-black uppercase tracking-widest" style="color:#92400e;">🏆 Week 1 Winner</span>
			</div>
			<div class="flex items-center gap-3">
				{#if winnerImageUrl}
					<img src={winnerImageUrl} alt={winnerName}
						class="h-12 w-12 shrink-0 rounded-full object-cover"
						style="border:2.5px solid #f59e0b;" />
				{:else}
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
						style="background:{addrGrad(WINNER_ADDRESS)};border:2.5px solid #f59e0b;">
						{WINNER_ADDRESS.slice(2, 4).toUpperCase()}
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<a href={WINNER_PROFILE_URL} target="_blank" rel="noopener noreferrer"
						class="text-[16px] font-black leading-tight" style="color:#92400e;">
						{winnerName} ↗
					</a>
					<div class="mt-0.5 text-[12px] font-mono" style="color:#b45309;">{short(WINNER_ADDRESS)}</div>
				</div>
				<a href={WINNER_TX_URL} target="_blank" rel="noopener noreferrer"
					class="shrink-0 rounded-[var(--r-md)] px-3 py-1.5 text-[12px] font-bold"
					style="background:#fbbf24;color:#78350f;">
					Tx ↗
				</a>
			</div>
		</div>

		<!-- ── Pot hero ── -->
		<div class="anim-float mx-4 mb-4 overflow-hidden rounded-[var(--r-lg)] p-5"
			style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);position:relative;">
			<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 80% 0%,var(--accent-soft),transparent 60%);pointer-events:none;"></div>

			<div class="relative flex items-center gap-5">
				<!-- Draw ring -->
				<div style="position:relative;width:{RING_SIZE}px;height:{RING_SIZE}px;flex-shrink:0;">
					<svg width={RING_SIZE} height={RING_SIZE} viewBox="0 0 {RING_SIZE} {RING_SIZE}">
						<circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={RING_R}
							fill="none" stroke="var(--ghost-bg)" stroke-width="9" />
						<circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={RING_R}
							fill="none" stroke="var(--accent)" stroke-width="9" stroke-linecap="round"
							transform="rotate(-90 {RING_SIZE/2} {RING_SIZE/2})"
							style="--circ:{RING_CIRC};--target:{RING_TARGET};stroke-dasharray:{RING_CIRC};stroke-dashoffset:{RING_CIRC};animation:ringGrow 1.4s cubic-bezier(0.22,1,0.36,1) 0.2s forwards;" />
					</svg>
					<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
						<img src="/img/logo-yield-pot.png" alt="Yield Pot" style="width:36px;height:36px;border-radius:10px;object-fit:cover;" />
						<span class="tnum mt-1 text-[10.5px] font-black uppercase tracking-wider" style="color:var(--text-muted);">{timeLeft}</span>
					</div>
				</div>

				<!-- Pot amount -->
				<div class="flex-1">
					<div class="mb-1 text-[12px] font-black uppercase tracking-widest" style="color:var(--text-muted);">Current pot</div>
					<div class="tnum text-[38px] font-black leading-none" style="color:var(--text);letter-spacing:-0.03em;">
						{#if status === 'loading'}—{:else}{livePot < 0.01 ? '0' : livePot.toFixed(1)}{/if}
					</div>
					<div class="mt-1 text-[13px] font-bold" style="color:var(--accent);">CRC · weekly draw</div>
				</div>
			</div>

			<!-- Stats row -->
			<div class="mt-4 flex gap-2.5">
				{#each [
					['Contributors', status === 'loading' ? '—' : String(members.length), false],
					['CRC Pool', status === 'loading' ? '—' : (treasuryCrc < 0.01 ? '0' : treasuryCrc.toFixed(1)), true],
					['Prize draw', 'Weekly', false],
				] as [label, val, accent]}
					<div class="flex-1 rounded-[var(--r-md)] py-3 text-center"
						style="background:var(--ghost-bg);border:1px solid var(--border);">
						<div class="tnum text-[20px] font-black" style="color:{accent ? 'var(--accent)' : 'var(--text)'}">{val}</div>
						<div class="text-[10.5px] font-black uppercase tracking-widest" style="color:var(--text-muted);">{label}</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- ── Face grid: Who's in ── -->
		{#if status === 'ready' && members.length > 0}
			<div class="mx-4 mb-4">
				<p class="mb-2.5 px-1 text-[12.5px] font-black uppercase tracking-widest" style="color:var(--text-dim);">Who's in this week</p>
				<div class="rounded-[var(--r-lg)] p-4" style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);">
					<div class="flex flex-wrap gap-3.5">
						{#each members.slice(0, 12) as m, i (m.member)}
							{@const profile = memberProfiles.get(m.member.toLowerCase())}
							{@const isMe    = m.member.toLowerCase() === address.toLowerCase()}
							{@const name    = profile?.name ?? short(m.member)}
							<div class="flex flex-col items-center gap-1.5" style="width:52px;animation:popIn 0.4s cubic-bezier(0.22,1,0.36,1) {i*0.03}s both;">
								{#if profile?.imageUrl}
									<img src={profile.imageUrl} alt={name}
										class="h-11 w-11 rounded-full object-cover"
										style="border:2px solid {isMe ? 'var(--accent)' : 'var(--border)'};" />
								{:else}
									<div class="flex h-11 w-11 items-center justify-center rounded-full text-[11px] font-black text-white"
										style="background:{isMe ? 'var(--accent)' : addrGrad(m.member)};border:2px solid {isMe ? 'var(--accent)' : 'transparent'};">
										{m.member.slice(2, 4).toUpperCase()}
									</div>
								{/if}
								<span class="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[10.5px] font-semibold" style="color:var(--text-muted);">
									{isMe ? 'You' : (profile?.name?.split(' ')[0] ?? short(m.member))}
								</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- ── Leaderboard ── -->
		<div class="mx-4 mb-4">
			<p class="mb-2.5 px-1 text-[12.5px] font-black uppercase tracking-widest" style="color:var(--text-dim);">
				Top contributors
			</p>

			{#if status === 'loading'}
				<div class="flex items-center justify-center py-10">
					<div class="h-6 w-6 animate-spin rounded-full border-2 border-transparent"
						style="border-top-color:var(--accent);border-right-color:var(--accent);"></div>
				</div>
			{:else if members.length === 0}
				<p class="py-4 text-center text-sm" style="color:var(--text-dim);">No contributions yet this week. Be the first!</p>
			{:else}
				<div class="overflow-hidden rounded-[var(--r-lg)]" style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);">
					{#each members as m, i (m.member)}
						{@const profile = memberProfiles.get(m.member.toLowerCase())}
						{@const isMe    = m.member.toLowerCase() === address.toLowerCase()}
						<div class="flex items-center px-3.5 py-3"
							style="border-top:{i ? 'var(--row-sep)' : 'none'};background:{isMe ? 'var(--accent-soft)' : 'transparent'};">
							<span class="tnum mr-3 w-5 shrink-0 text-[13px] font-black"
								style="color:{i < 3 ? 'var(--accent)' : 'var(--text-dim)'};">{i + 1}</span>
							{#if profile?.imageUrl}
								<img src={profile.imageUrl} alt={profile.name ?? ''}
									class="h-8 w-8 shrink-0 rounded-full object-cover"
									style="border:1.5px solid {isMe ? 'var(--accent)' : 'transparent'};" />
							{:else}
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
									style="background:{isMe ? 'var(--accent)' : addrGrad(m.member)};">
									{m.member.slice(2, 4).toUpperCase()}
								</div>
							{/if}
							<div class="ml-2.5 min-w-0 flex-1">
								<div class="flex items-center gap-1.5 text-[14px] font-bold" style="color:var(--text);">
									{isMe ? 'You' : (profile?.name ?? short(m.member))}
									{#if isMe}
										<span class="rounded-full px-2 py-0.5 text-[10px] font-black"
											style="background:var(--accent-soft);color:var(--accent);">you</span>
									{/if}
								</div>
								{#if profile?.name}
									<div class="font-mono text-[11.5px]" style="color:var(--text-muted);">{short(m.member)}</div>
								{/if}
							</div>
							<span class="tnum shrink-0 text-[14px] font-bold" style="color:var(--text);">
								{m.amount < 0.01 ? '<0.01' : m.amount.toLocaleString('en', { maximumFractionDigits: 2 })}
								<span class="text-[11px] font-semibold" style="color:var(--text-dim);">CRC</span>
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- ── How to participate ── -->
		<div class="mx-4 mb-4 rounded-[var(--r-lg)] p-4"
			style="background:var(--card);border:var(--card-border);box-shadow:var(--shadow);">
			<p class="mb-3 text-[15px] font-black" style="color:var(--text);">How to participate</p>
			{#each [
				['1', 'Open the Yield Pot group in the Gnosis app'],
				['2', 'Tap the ★ star button (top right) to join'],
				['3', 'Every week one member wins the whole pot'],
			] as [n, txt]}
				<div class="mb-3 flex items-start gap-3">
					<div class="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
						style="background:var(--accent-soft);color:var(--accent);width:22px;height:22px;">{n}</div>
					<p class="pt-0.5 text-[13.5px] font-medium leading-snug" style="color:var(--text-muted);">{txt}</p>
				</div>
			{/each}
			<a
				href={GNOSIS_GROUP_URL}
				target="_blank"
				rel="noopener noreferrer"
				class="mt-1 flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] py-3.5 text-[14.5px] font-bold text-white transition-all active:scale-95"
				style="background:var(--accent);box-shadow:var(--accent-shadow);"
			>
				Open Yield Pot in Gnosis App ↗
			</a>
		</div>

	</div>
</div>
