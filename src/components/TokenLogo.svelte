<script lang="ts">
	interface Props {
		symbol: string;
		logoUrl: string;
		size?: number;
	}

	let { symbol, logoUrl, size = 36 }: Props = $props();

	const FALLBACK_BG: Record<string, string> = {
		EURe:   'rgba(55,55,200,0.12)',
		'USDC.e': 'rgba(39,117,202,0.12)',
		WXDAI:  'rgba(249,176,0,0.15)',
		WETH:   'rgba(98,126,234,0.15)',
		GNO:    'rgba(22,163,74,0.15)'
	};

	const FALLBACK_COLOR: Record<string, string> = {
		EURe:   'var(--blue)',
		'USDC.e': '#2775ca',
		WXDAI:  '#c99400',
		WETH:   '#627eea',
		GNO:    '#16a34a'
	};

	const fb = $derived({
		bg:    FALLBACK_BG[symbol]    ?? 'var(--surface-2)',
		color: FALLBACK_COLOR[symbol] ?? 'var(--text-muted)'
	});

	let imgFailed = $state(false);
</script>

{#if logoUrl && !imgFailed}
	<img
		src={logoUrl}
		alt={symbol}
		width={size}
		height={size}
		class="shrink-0 rounded-full object-cover"
		style="width:{size}px;height:{size}px"
		onerror={() => (imgFailed = true)}
	/>
{:else}
	<div
		class="flex shrink-0 items-center justify-center rounded-full text-xs font-black"
		style="width:{size}px;height:{size}px;background:{fb.bg};color:{fb.color}"
	>
		{symbol.slice(0, 1)}
	</div>
{/if}
