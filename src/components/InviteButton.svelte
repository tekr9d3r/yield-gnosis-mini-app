<script lang="ts">
	import { onDestroy } from 'svelte';

	interface Props { address: string; }
	let { address }: Props = $props();

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout>;

	function invite() {
		const url = `https://circles.gnosis.io/miniapps/yield-gnosis?ref=${address}`;
		navigator.clipboard.writeText(url);
		copied = true;
		clearTimeout(copyTimeout);
		copyTimeout = setTimeout(() => (copied = false), 2000);
	}

	onDestroy(() => clearTimeout(copyTimeout));
</script>

<div class="pt-5 pb-1 text-center">
	<p class="mb-2.5 text-xs" style="color: var(--text-dim)">Know someone who'd like to earn yield?</p>
	<button
		onclick={invite}
		class="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-bold transition-all"
		style="background: transparent; border: 1.5px solid var(--border); color: var(--text-muted)"
		onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)'; e.currentTarget.style.background = 'rgba(55,55,200,0.06)'; }}
		onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
	>
		{#if copied}
			✓ Link copied!
		{:else}
			Share invite link
		{/if}
	</button>
</div>
