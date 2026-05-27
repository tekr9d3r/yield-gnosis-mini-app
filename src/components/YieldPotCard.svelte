<script lang="ts">
	import { onMount } from 'svelte';
	import { YIELDPOT_GROUP } from '$lib/chains.js';

	interface Props {
		address: `0x${string}`;
		onOpen: () => void;
	}
	let { address, onOpen }: Props = $props();

	const CIRCLES_RPC = 'https://rpc.aboutcircles.com/';

	let memberCount = $state<number | null>(null);
	let isMember    = $state(false);

	onMount(async () => {
		try {
			const [membersRes, membershipsRes] = await Promise.allSettled([
				fetch(CIRCLES_RPC, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'circles_getGroupMembers', params: [YIELDPOT_GROUP, 50, null] })
				}).then(r => r.json()),
				fetch(CIRCLES_RPC, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'circles_getGroupMemberships', params: [address, 50, null] })
				}).then(r => r.json())
			]);

			if (membersRes.status === 'fulfilled') {
				memberCount = (membersRes.value.result?.results ?? []).length;
			}
			if (membershipsRes.status === 'fulfilled') {
				const rows: { group: string }[] = membershipsRes.value.result?.results ?? [];
				isMember = rows.some(r => r.group.toLowerCase() === YIELDPOT_GROUP.toLowerCase());
			}
		} catch { /* silent */ }
	});
</script>

<button
	onclick={onOpen}
	class="w-full rounded-2xl p-4 text-left transition-all active:scale-[0.99]"
	style="background: linear-gradient(135deg, rgba(55,55,200,0.08), rgba(139,92,246,0.08)); border: 1.5px solid rgba(55,55,200,0.2)"
	onmouseenter={(e) => (e.currentTarget.style.borderColor = 'rgba(55,55,200,0.4)')}
	onmouseleave={(e) => (e.currentTarget.style.borderColor = 'rgba(55,55,200,0.2)')}
>
	<div class="flex items-center gap-3">
		<!-- Logo -->
		<img
			src="/img/logo-yield-pot.png"
			alt="Yield Pot"
			class="h-11 w-11 shrink-0 rounded-xl object-cover"
			style="box-shadow: 0 4px 12px var(--blue-shadow)"
		/>

		<!-- Text -->
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<p class="text-sm font-bold" style="color: var(--text)">Yield Pot Prize Pool</p>
				{#if isMember}
					<span class="rounded-full px-1.5 py-0.5 text-[9px] font-black" style="background: rgba(22,163,74,0.12); color: var(--green)">MEMBER</span>
				{/if}
			</div>
			<p class="text-xs" style="color: var(--text-muted)">
				{#if memberCount === null}
					Weekly draw · Join with CRC
				{:else}
					{memberCount} {memberCount === 1 ? 'member' : 'members'} · weekly prize draw
				{/if}
			</p>
		</div>

		<!-- Arrow -->
		<span class="shrink-0 text-sm font-bold" style="color: var(--blue)">→</span>
	</div>
</button>
