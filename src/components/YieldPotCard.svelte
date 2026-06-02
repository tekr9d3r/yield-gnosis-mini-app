<script lang="ts">
	import { onMount } from 'svelte';
	import { Sdk } from '@aboutcircles/sdk';
	import { YIELDPOT_GROUP } from '$lib/chains.js';

	interface Props {
		address: `0x${string}`;
		onOpen: () => void;
	}
	let { address, onOpen }: Props = $props();

	const CIRCLES_RPC = 'https://rpc.aboutcircles.com/';

	type AvatarInfo = { addr: string; imageUrl?: string; name?: string };

	let memberCount = $state<number | null>(null);
	let avatars     = $state<AvatarInfo[]>([]);

	// Fallback gradient for members without a profile pic
	const GRADS = [
		['#f59e0b','#ef4444'],['#8b5cf6','#6366f1'],['#10b981','#059669'],
		['#f43f5e','#fb7185'],['#0ea5e9','#2563eb'],['#14b8a6','#0d9488'],
		['#a855f7','#d946ef'],['#f97316','#ea580c'],
	];
	function addrGrad(addr: string): string {
		let h = 0;
		for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
		const [a, b] = GRADS[h % GRADS.length];
		return `linear-gradient(135deg,${a},${b})`;
	}

	let _sdk: Sdk | null = null;
	function getSdk() { if (!_sdk) _sdk = new Sdk(); return _sdk; }

	onMount(async () => {
		try {
			const res  = await fetch(CIRCLES_RPC, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'circles_getGroupMembers', params: [YIELDPOT_GROUP, 20, null] })
			});
			const json = await res.json();
			const results: { member: string }[] = json.result?.results ?? [];
			memberCount = results.length;

			// Seed with addresses first so stack appears instantly
			const addrs = results.slice(0, 5).map(r => r.member);
			avatars = addrs.map(addr => ({ addr }));

			// Load profile images progressively — prioritise members with pictures
			const sdk = getSdk();
			const profiles = await Promise.allSettled(
				addrs.map(addr => sdk.rpc.profile.getProfileByAddress(addr as `0x${string}`))
			);

			const enriched: AvatarInfo[] = addrs.map((addr, i) => {
				const p = profiles[i].status === 'fulfilled' ? profiles[i].value : null;
				if (!p) return { addr };
				const raw = p.imageUrl ?? p.previewImageUrl ?? null;
				const imageUrl = raw?.startsWith('ipfs://')
					? raw.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/')
					: raw ?? undefined;
				return { addr, imageUrl, name: p.name ?? undefined };
			});

			// Sort: members with profile pics first so they're visible in the stack
			avatars = [
				...enriched.filter(a => a.imageUrl),
				...enriched.filter(a => !a.imageUrl),
			].slice(0, 4);
		} catch { /* silent */ }
	});
</script>

<button
	onclick={onOpen}
	class="w-full rounded-[var(--r-lg)] p-4 text-left transition-all active:scale-[0.99]"
	style="background:var(--pot-bg);border:1.5px solid rgba(79,70,229,0.15);box-shadow:var(--shadow);"
	onmouseenter={(e) => (e.currentTarget.style.borderColor = 'rgba(79,70,229,0.35)')}
	onmouseleave={(e) => (e.currentTarget.style.borderColor = 'rgba(79,70,229,0.15)')}
>
	<div class="flex items-center gap-3">
		<!-- Logo -->
		<img src="/img/logo-yield-pot.png" alt="Yield Pot"
			class="h-11 w-11 shrink-0 rounded-xl object-cover"
			style="box-shadow:0 4px 12px var(--accent-shadow);" />

		<!-- Text -->
		<div class="min-w-0 flex-1">
			<p class="mb-1.5 text-[15px] font-bold leading-tight" style="color:var(--text);">Yield Pot Prize Pool</p>

			<!-- Avatar stack + count -->
			<div class="flex items-center gap-2">
				{#if avatars.length > 0}
					<div class="flex items-center">
						{#each avatars as av, i (av.addr)}
							{#if av.imageUrl}
								<img
									src={av.imageUrl}
									alt={av.name ?? av.addr}
									class="h-5 w-5 shrink-0 rounded-full object-cover"
									style="margin-left:{i === 0 ? '0' : '-6px'};border:1.5px solid var(--pot-bg);z-index:{5-i};"
								/>
							{:else}
								<div
									class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-black text-white"
									style="background:{addrGrad(av.addr)};margin-left:{i === 0 ? '0' : '-6px'};border:1.5px solid var(--pot-bg);z-index:{5-i};"
								>{av.addr.slice(2, 4).toUpperCase()}</div>
							{/if}
						{/each}
					</div>
				{/if}
				<span class="text-[12px] font-medium" style="color:var(--text-muted);">
					{memberCount === null
						? 'Weekly draw · Join with CRC'
						: `${memberCount} ${memberCount === 1 ? 'member' : 'members'} · weekly draw`}
				</span>
			</div>
		</div>

		<!-- Arrow -->
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" class="shrink-0">
			<path d="M6 3l6 6-6 6" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</div>
</button>
