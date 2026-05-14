<script lang="ts">
	import { formatUnits } from 'viem';
	import GrowthChart from './GrowthChart.svelte';

	interface Props {
		eureBalance: bigint;
		totalEur: number;       // EUR value of all tokens combined
		apy: number;
		onDeposit: () => void;
		onBack: () => void;
	}

	let { eureBalance, totalEur, apy, onDeposit, onBack }: Props = $props();

	const eureAmount = $derived(parseFloat(formatUnits(eureBalance, 18)));
	const hasOtherTokens = $derived(totalEur > eureAmount + 0.5);

	// Earnings on EURe only (what can actually be deposited now)
	const eureYearlyEur  = $derived(eureAmount * (apy / 100));
	const eureMonthlyEur = $derived(eureYearlyEur / 12);

	// Earnings on full wallet (the simulation)
	const totalYearlyEur  = $derived(totalEur * (apy / 100));
	const totalMonthlyEur = $derived(totalYearlyEur / 12);
	const totalWeeklyEur  = $derived(totalYearlyEur / 52);
	const totalDailyEur   = $derived(totalYearlyEur / 365);

	function fmtEarning(val: number): string {
		if (val < 0.001) return '<€0.001';
		if (val < 1) return '€' + val.toFixed(3);
		return '€' + val.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<div class="slide-up flex flex-col gap-3">

	<!-- Back -->
	<button
		onclick={onBack}
		class="flex items-center gap-1.5 self-start text-xs font-semibold transition-opacity hover:opacity-60"
		style="color: var(--text-muted)"
	>
		← Back
	</button>

	<!-- Growth chart card — uses full wallet total -->
	<div
		class="relative overflow-hidden rounded-2xl p-5"
		style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(55,55,200,0.06)"
	>
		<span class="float-sparkle absolute right-5 top-3 text-base" style="color: rgba(249,115,22,0.4)">✦</span>
		<span class="float-sparkle-3 absolute right-12 top-7 text-xs" style="color: rgba(22,163,74,0.35)">✦</span>

		<p class="mb-1 text-xs font-bold uppercase tracking-widest" style="color: var(--text-dim)">
			{hasOtherTokens ? 'Full wallet simulated as EURe' : 'Simulated growth on Aave v3'}
		</p>
		<div class="mb-4 flex items-baseline gap-2">
			<span class="text-3xl font-black tabular-nums" style="color: var(--text)">
				€{Math.round(totalEur).toLocaleString('en')}
			</span>
			{#if hasOtherTokens}
				<span class="text-xs" style="color: var(--text-muted)">all tokens converted</span>
			{/if}
		</div>

		<GrowthChart principal={totalEur} {apy} />
	</div>

	<!-- Earnings breakdown card -->
	<div
		class="rounded-2xl p-5"
		style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 4px 16px rgba(55,55,200,0.06)"
	>
		<div class="mb-3 flex items-center gap-2">
			<span class="sparkle text-sm" style="color: var(--orange)">✦</span>
			<p class="text-sm font-bold" style="color: var(--text)">
				At <span style="color: var(--green)">{apy.toFixed(2)}% APY</span> you'd earn:
			</p>
		</div>

		<!-- Featured: monthly on total -->
		<div
			class="mb-2 flex items-center justify-between rounded-xl px-4 py-4"
			style="background: var(--green-light); border: 1px solid rgba(22,163,74,0.22)"
		>
			<div>
				<p class="text-xs font-semibold" style="color: var(--green)">every month</p>
				{#if hasOtherTokens}
					<p class="text-xs" style="color: var(--text-dim)">full wallet</p>
				{/if}
			</div>
			<p class="count-in text-2xl font-black tabular-nums" style="color: var(--green)">
				+{fmtEarning(totalMonthlyEur)}
			</p>
		</div>

		<!-- Other periods -->
		<div class="flex flex-col gap-1.5">
			{#each [
				{ label: 'per year',  value: totalYearlyEur, color: 'var(--orange)' },
				{ label: 'per week',  value: totalWeeklyEur, color: 'var(--blue)' },
				{ label: 'per day',   value: totalDailyEur,  color: 'var(--text-muted)' }
			] as row}
				<div class="flex items-center justify-between px-1 py-1.5">
					<span class="text-xs font-semibold" style="color: var(--text-dim)">{row.label}</span>
					<span class="text-sm font-bold tabular-nums" style="color: {row.color}">
						+{fmtEarning(row.value)}
					</span>
				</div>
			{/each}
		</div>

		<!-- EURe-only note when user has other tokens -->
		{#if hasOtherTokens}
			<div
				class="mt-3 rounded-xl px-3 py-2.5"
				style="background: var(--blue-light); border: 1px solid rgba(55,55,200,0.12)"
			>
				<p class="text-xs leading-relaxed" style="color: var(--text-muted)">
					You have <strong style="color: var(--blue)">€{eureAmount.toLocaleString('en', { maximumFractionDigits: 2 })} in EURe</strong>
					ready to deposit now. Convert xDAI/USDC to EURe on a DEX to unlock the full potential.
				</p>
			</div>
		{:else}
			<div
				class="mt-3 rounded-xl px-3 py-2.5"
				style="background: var(--surface-2); border: 1px solid var(--border)"
			>
				<p class="text-xs leading-relaxed" style="color: var(--text-muted)">
					Your EURe goes into <strong style="color: var(--text)">Aave v3</strong> on Gnosis Chain.
					Withdraw anytime, no lock-up.
				</p>
			</div>
		{/if}
	</div>

	<!-- CTA -->
	<button
		onclick={onDeposit}
		class="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all active:scale-95"
		style="background: var(--green); box-shadow: 0 4px 16px var(--green-shadow)"
		onmouseenter={(e) => (e.currentTarget.style.opacity = '0.88')}
		onmouseleave={(e) => (e.currentTarget.style.opacity = '1')}
	>
		Deposit €{eureAmount.toLocaleString('en', { maximumFractionDigits: 2 })} in EURe  ✦
	</button>

</div>
