<script lang="ts">
	interface Props {
		address: string;
		name?: string;
		imageUrl?: string;
		trustCount: number;
		crcBalance: number;
	}

	let { address, name, imageUrl, trustCount, crcBalance }: Props = $props();

	let imgError = $state(false);

	const displayName = $derived(name || `${address.slice(0, 6)}…${address.slice(-4)}`);

	function fmtCrc(n: number): string {
		if (n === 0) return '0';
		if (n < 0.01) return '<0.01';
		return n.toLocaleString('en', { maximumFractionDigits: 2 });
	}
</script>

<div class="flex items-center gap-2.5">
	<!-- Avatar -->
	{#if imageUrl && !imgError}
		<img
			src={imageUrl}
			alt={displayName}
			class="h-9 w-9 shrink-0 rounded-full object-cover"
			style="border: 2px solid var(--green)"
			onerror={() => (imgError = true)}
		/>
	{:else}
		<div
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
			style="background: var(--blue); border: 2px solid var(--green)"
		>
			<span class="text-xs font-black text-white">{displayName.slice(0, 2).toUpperCase()}</span>
		</div>
	{/if}

	<!-- Info -->
	<div class="min-w-0">
		<p class="truncate text-sm font-bold" style="color: var(--text)">{displayName}</p>
		<div class="flex flex-wrap items-center gap-1">
			{#if trustCount > 0}
				<span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style="background: rgba(22,163,74,0.12); color: var(--green)">👥 {trustCount}</span>
			{/if}
			{#if crcBalance > 0}
				<span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style="background: rgba(55,55,200,0.1); color: var(--blue)">{fmtCrc(crcBalance)} CRC</span>
			{/if}
			<span class="flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold" style="background: rgba(255,255,255,0.05); border-color: var(--border); color: var(--text-dim)">
				<span class="dot h-1.5 w-1.5 rounded-full" style="background: var(--green)"></span>
				connected
			</span>
		</div>
	</div>
</div>

<style>
	.dot { animation: pulse 2s ease-in-out infinite; }
	@keyframes pulse {
		0%,100% { opacity: 1; }
		50%      { opacity: 0.4; }
	}
</style>
