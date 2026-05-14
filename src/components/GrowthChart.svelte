<script lang="ts">
	interface Props {
		principal: number;
		apy: number;
	}
	let { principal, apy }: Props = $props();

	type Period = '3M' | '1Y' | '5Y';
	const PERIODS: Period[] = ['3M', '1Y', '5Y'];
	const MONTHS: Record<Period, number> = { '3M': 3, '1Y': 12, '5Y': 60 };

	let period = $state<Period>('1Y');

	const W = 320, H = 130;
	const PAD = { t: 10, r: 4, b: 22, l: 4 };
	const CW = W - PAD.l - PAD.r;
	const CH = H - PAD.t - PAD.b;
	const N = 120;

	const pts = $derived.by(() => {
		const months = MONTHS[period];
		const stepsPerYear = N / (months / 12);

		// Discrete integration: each step uses a locally-varying APY.
		// The rate oscillates (fast / slow periods) but is always positive,
		// so the balance NEVER decreases — it just grows at different paces.
		let balance = principal;
		const vals: number[] = [principal];

		for (let i = 1; i <= N; i++) {
			const t = i / N;
			// Local APY swings ±60 % of base APY — always stays positive
			const localApy = apy * (1 + 0.6 * Math.sin(t * 18.7 + 0.5) * Math.sin(t * 7.3 + 1.3));
			const annualRate = Math.max(0, localApy) / 100;
			balance *= 1 + annualRate / stepsPerYear;
			vals.push(balance);
		}

		// Scale to SVG: start (principal) sits at bottom, end at top
		const minV = vals[0];
		const maxV = vals[vals.length - 1];
		const range = maxV - minV || Math.max(principal * 0.002, 0.01);

		return vals.map((v, i) => ({
			x: PAD.l + (i / N) * CW,
			// Leave 8 % margin top, 5 % bottom so dots don't clip
			y: PAD.t + CH * 0.92 - ((v - minV) / range) * CH * 0.87,
			val: v
		}));
	});

	// Smooth path via midpoint quadratic bezier
	const linePath = $derived.by(() => {
		if (pts.length < 2) return '';
		let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
		for (let i = 1; i < pts.length - 1; i++) {
			const mx = ((pts[i].x + pts[i + 1].x) / 2).toFixed(1);
			const my = ((pts[i].y + pts[i + 1].y) / 2).toFixed(1);
			d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx} ${my}`;
		}
		const last = pts[pts.length - 1];
		d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
		return d;
	});

	const areaPath = $derived(
		`${linePath} L ${W - PAD.r} ${PAD.t + CH} L ${PAD.l} ${PAD.t + CH} Z`
	);

	const endVal = $derived(pts[pts.length - 1]?.val ?? principal);
	const profit = $derived(endVal - principal);

	const midLabel: Record<Period, string> = { '3M': '6W', '1Y': '6M', '5Y': '2.5Y' };

	function fmtK(v: number): string {
		if (v >= 1000) return '€' + (v / 1000).toFixed(1) + 'k';
		return '€' + v.toLocaleString('en', { maximumFractionDigits: 0 });
	}

	function fmtProfit(v: number): string {
		if (v < 0.005) return '+€0';
		if (v < 1) return '+€' + v.toFixed(2);
		return '+€' + v.toLocaleString('en', { maximumFractionDigits: 2 });
	}
</script>

<div>
	<!-- Header row -->
	<div class="mb-3 flex items-end justify-between">
		<div>
			<p class="text-xs" style="color: var(--text-dim)">Starting with {fmtK(principal)}</p>
			<div class="flex items-baseline gap-1.5">
				<span class="text-xl font-black tabular-nums" style="color: var(--green)">
					{fmtK(endVal)}
				</span>
				<span
					class="rounded-full px-2 py-0.5 text-xs font-bold"
					style="background: var(--green-light); color: var(--green)"
				>
					{fmtProfit(profit)}
				</span>
			</div>
		</div>
		<div class="flex gap-1">
			{#each PERIODS as p}
				<button
					onclick={() => (period = p)}
					class="rounded-full px-2.5 py-1 text-xs font-bold transition-all active:scale-95"
					style={period === p
						? 'background: var(--green); color: white; box-shadow: 0 2px 8px var(--green-shadow)'
						: 'background: var(--surface-2); color: var(--text-dim)'}
				>
					{p}
				</button>
			{/each}
		</div>
	</div>

	<!-- Chart -->
	<svg viewBox="0 0 {W} {H}" class="w-full overflow-visible" style="color: var(--text-dim)">
		<defs>
			<linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="#16a34a" stop-opacity="0.25" />
				<stop offset="100%" stop-color="#16a34a" stop-opacity="0.02" />
			</linearGradient>
		</defs>

		<!-- Subtle grid lines -->
		{#each [0.25, 0.5, 0.75] as t}
			<line
				x1={PAD.l} y1={PAD.t + CH * (1 - t)}
				x2={W - PAD.r} y2={PAD.t + CH * (1 - t)}
				stroke="currentColor" stroke-width="0.5" opacity="0.12" stroke-dasharray="4 3"
			/>
		{/each}

		<!-- Area fill -->
		<path d={areaPath} fill="url(#areaGrad)" />

		<!-- Wavy line — no animation -->
		<path
			d={linePath}
			fill="none"
			stroke="#16a34a"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>

		<!-- Start dot -->
		{#if pts.length > 0}
			<circle cx={pts[0].x} cy={pts[0].y} r="3" fill="white" stroke="#16a34a" stroke-width="2" />
		{/if}

		<!-- End dot -->
		{#if pts.length > 0}
			{@const last = pts[pts.length - 1]}
			<circle cx={last.x} cy={last.y} r="9" fill="#16a34a" opacity="0.12" />
			<circle cx={last.x} cy={last.y} r="4.5" fill="#16a34a" stroke="white" stroke-width="2.5" />
		{/if}

		<!-- X axis labels -->
		<text x={PAD.l + 2} y={H - 5} font-size="9" fill="currentColor">now</text>
		<text x={W / 2} y={H - 5} font-size="9" fill="currentColor" text-anchor="middle">
			{midLabel[period]}
		</text>
		<text x={W - PAD.r - 2} y={H - 5} font-size="9.5" fill="#16a34a" text-anchor="end" font-weight="700">
			{period}
		</text>
	</svg>
</div>
