<script lang="ts">
	import type { AssetInfo } from '$lib/types.js';

	interface Props {
		assets: AssetInfo[];
		usdToEur: number;
	}
	let { assets, usdToEur }: Props = $props();

	function eurRate(a: AssetInfo) {
		return a.symbol === 'EURe' ? 1.0 : usdToEur;
	}

	const totalEur = $derived(
		assets.reduce((s, a) => s + (Number(a.depositedBalance) / 10 ** a.decimals) * eurRate(a), 0)
	);

	const blendedApy = $derived.by(() => {
		if (totalEur <= 0) return 0;
		return assets.reduce((s, a) => {
			const eur = (Number(a.depositedBalance) / 10 ** a.decimals) * eurRate(a);
			return s + eur * (a.apy ?? 0);
		}, 0) / totalEur;
	});

	const todayEarned = $derived(totalEur * (blendedApy / 100) / 365);
	const bestApy     = $derived(Math.max(0, ...assets.map(a => a.apy ?? 0)));

	let live = $state(0);

	$effect(() => {
		live = totalEur;
		if (totalEur <= 0) return;
		const base   = totalEur;
		const perSec = base * (blendedApy / 100) / (365 * 24 * 3600);
		const t0     = Date.now();
		const id     = setInterval(() => {
			live = base + perSec * ((Date.now() - t0) / 1000) * 6000;
		}, 80);
		return () => clearInterval(id);
	});

	// Split display value into parts
	const intPart  = $derived(Math.floor(live).toLocaleString('en-US'));
	const decPart  = $derived((live % 1).toFixed(2).slice(1));
	const microPart = $derived(
		Math.max(0, live - Math.floor(live * 100) / 100)
			.toFixed(8).slice(2, 8)
	);

	// Simple sparkline — deterministic pseudo-random
	function sparklinePath(w: number, h: number): string {
		let r = 3 * 9301 + 49297;
		const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
		const n = 11;
		const pts: string[] = [];
		let y = h * 0.7;
		for (let i = 0; i < n; i++) {
			const trend = -i * (h * 0.42 / n);
			y = Math.max(3, Math.min(h - 3, h * 0.7 + trend + (rand() - 0.5) * h * 0.18));
			pts.push(`${i === 0 ? 'M' : 'L'}${((i / (n - 1)) * w).toFixed(1)} ${y.toFixed(1)}`);
		}
		return pts.join(' ');
	}

	const spLine = sparklinePath(96, 34);
	const spLast = (() => {
		let r = 3 * 9301 + 49297;
		const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
		let y = 34 * 0.7;
		for (let i = 0; i < 11; i++) y = Math.max(3, Math.min(31, 34 * 0.7 + -i * (34 * 0.42 / 11) + (rand() - 0.5) * 34 * 0.18));
		return { x: 96, y };
	})();
</script>

{#if totalEur > 0}
	<!-- Earning state -->
	<div
		class="anim-float mx-4 mb-4 overflow-hidden rounded-[var(--r-lg)] p-5"
		style="background: var(--card); border: var(--card-border); box-shadow: var(--shadow); position: relative;"
	>
		<!-- Soft accent glow -->
		<div style="position:absolute;right:-30px;top:-30px;width:180px;height:180px;background:radial-gradient(circle,var(--accent-soft),transparent 70%);opacity:.7;pointer-events:none;"></div>

		<!-- Status row -->
		<div class="relative mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="pulse-dot inline-block rounded-full" style="width:8px;height:8px;background:var(--yield);box-shadow:0 0 0 3px var(--yield-soft);"></span>
				<span class="text-[11px] font-black uppercase tracking-widest" style="color:var(--yield);">Deposited · Earning</span>
			</div>
			<span class="tnum text-[12px] font-bold" style="color:var(--text-muted);">{blendedApy.toFixed(2)}% APY</span>
		</div>

		<!-- Live balance -->
		<div class="tnum relative mb-4 flex items-baseline leading-none" style="letter-spacing:-0.03em;">
			<span class="text-[54px] font-bold" style="color:var(--text);">€{intPart}{decPart}</span>
			<span class="ml-0.5 text-[22px] font-semibold" style="color:var(--text-dim);">{microPart}</span>
		</div>

		<!-- Today + sparkline row -->
		<div class="relative flex items-end justify-between">
			<div
				class="tnum flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-bold"
				style="background:var(--yield-soft);color:var(--yield);"
			>
				<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
					<path d="M2 9l4-4 2 2 2-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				+€{todayEarned < 0.0001 ? '0.0000' : todayEarned.toFixed(4)} today
			</div>
			<svg width="96" height="34" viewBox="0 0 96 34" style="display:block;overflow:visible;">
				<path d="{spLine} L96 34 L0 34 Z" fill="url(#sp-fill)" />
				<defs>
					<linearGradient id="sp-fill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="var(--yield)" stop-opacity="0.22"/>
						<stop offset="100%" stop-color="var(--yield)" stop-opacity="0"/>
					</linearGradient>
				</defs>
				<path d={spLine} fill="none" stroke="var(--yield)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
					style="stroke-dasharray:400;stroke-dashoffset:400;animation:drawLine 1.3s cubic-bezier(0.22,1,0.36,1) 0.15s forwards;" />
				<circle cx={spLast.x} cy={spLast.y} r="3" fill="var(--yield)"
					style="animation:popIn 0.4s ease 1.2s both;" />
			</svg>
		</div>
	</div>
{:else}
	<!-- Fresh / ready-to-earn state -->
	<div
		class="anim-float mx-4 mb-4 rounded-[var(--r-lg)] p-5"
		style="background: var(--card); border: var(--card-border); box-shadow: var(--shadow);"
	>
		<div class="mb-2 text-[11px] font-black uppercase tracking-widest" style="color:var(--text-muted);">Ready to earn</div>
		<div class="tnum mb-3 text-[52px] font-bold leading-none" style="color:var(--text);letter-spacing:-0.03em;">€0.00</div>
		<div class="text-sm font-medium leading-relaxed" style="color:var(--text-muted);">
			Put your idle EURe &amp; USDC.e to work — up to
			<strong style="color:var(--yield);">{bestApy > 0 ? bestApy.toFixed(2) : '—'}% APY</strong>,
			withdraw anytime.
		</div>
	</div>
{/if}
