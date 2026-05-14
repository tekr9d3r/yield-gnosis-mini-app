<script lang="ts">
	interface Props {
		apy: number | null;
		loading: boolean;
		error: string | null;
	}
	let { apy, loading, error }: Props = $props();
</script>

{#if loading}
	<span
		class="animate-pulse rounded-full px-3 py-1 text-xs font-semibold"
		style="background: var(--blue-light); color: var(--blue); border: 1px solid rgba(55,55,200,0.15)"
	>
		Loading APY…
	</span>
{:else if error}
	<span
		class="rounded-full px-3 py-1 text-xs font-semibold"
		style="background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.2)"
	>
		APY unavailable
	</span>
{:else if apy !== null}
	<span
		class="rounded-full px-3 py-1 text-xs font-bold"
		style="background: var(--green-light); color: var(--green); border: 1px solid rgba(22,163,74,0.2)"
	>
		✦ {apy.toFixed(2)}% APY
	</span>
{/if}
