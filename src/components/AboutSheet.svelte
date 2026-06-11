<script lang="ts">
	import TipJar from './TipJar.svelte';

	let { address, onClose }: {
		address: string;
		onClose: () => void;
	} = $props();

	const FEATURES = [
		{
			icon: '📈',
			title: 'Earn yield',
			desc: 'Deposit EURe or USDC.e into Aave v3 on Gnosis Chain and earn interest automatically.'
		},
		{
			icon: '🎯',
			title: 'Weekly YieldPot',
			desc: 'All deposited yield goes into a shared pot. One contributor wins the full pot every week — no-loss lottery.'
		},
		{
			icon: '🔄',
			title: 'Invest',
			desc: 'Buy and sell BTC, ETH, and GNO directly from your Circles wallet via CoW Swap — best price, MEV protected.'
		},
		{
			icon: '🔐',
			title: 'Passkey secured',
			desc: 'Powered by Circles on Gnosis Chain. Your wallet is a Gnosis Safe secured by your device passkey — no seed phrase.'
		},
	];
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-end justify-center"
	style="background:rgba(10,10,46,0.45);backdrop-filter:blur(3px);"
	role="dialog"
	aria-modal="true"
>
	<div class="slide-up w-full max-w-md overflow-hidden rounded-t-[28px]" style="background:var(--card);">

		<!-- Grab handle -->
		<div class="flex justify-center pt-3 pb-1">
			<div class="h-1 w-10 rounded-full" style="background:var(--border);"></div>
		</div>

		<!-- Header -->
		<div class="flex items-center justify-between px-5 pt-3 pb-4">
			<span class="text-[11.5px] font-black uppercase tracking-widest" style="color:var(--text-dim);">About Yield</span>
			<button
				onclick={onClose}
				class="flex h-8 w-8 items-center justify-center rounded-full text-[16px] transition-all active:scale-90"
				style="background:var(--ghost-bg);color:var(--text-muted);"
			>✕</button>
		</div>

		<div class="overflow-y-auto px-5" style="max-height:75dvh;padding-bottom:max(env(safe-area-inset-bottom),32px);">

			<!-- App description -->
			<p class="mb-5 text-[14px] leading-relaxed" style="color:var(--text-muted);">
				Yield is a DeFi miniapp built on <strong style="color:var(--text);">Circles</strong> and <strong style="color:var(--text);">Gnosis Chain</strong> — earn interest, win the weekly pot, and invest in crypto assets, all from your Circles wallet.
			</p>

			<!-- Features -->
			<div class="mb-5 flex flex-col gap-3">
				{#each FEATURES as f}
					<div class="flex items-start gap-3 rounded-[var(--r-md)] px-4 py-3" style="background:var(--inline-bg);">
						<span class="mt-0.5 text-[20px] leading-none">{f.icon}</span>
						<div>
							<div class="text-[13.5px] font-bold" style="color:var(--text);">{f.title}</div>
							<div class="mt-0.5 text-[12px] leading-relaxed" style="color:var(--text-muted);">{f.desc}</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Divider -->
			<div class="mb-5 border-t" style="border-color:var(--border);"></div>

			<!-- Builder row -->
			<div class="mb-4 flex items-center gap-3">
				<img src="/tekr0x-avatar.jpg" alt="Tekr0x.eth"
					class="h-12 w-12 shrink-0 rounded-full object-cover"
					style="border:2px solid var(--accent);" />
				<div class="flex-1">
					<p class="text-[15px] font-bold leading-tight" style="color:var(--text);">Built by Tekr0x.eth</p>
					<a href="https://x.com/tekr0x" target="_blank" rel="noopener noreferrer"
						class="text-[12px] font-medium" style="color:var(--text-muted);">@tekr0x on X ↗</a>
				</div>
			</div>

			<!-- Action buttons -->
			<div class="mb-5 flex gap-2.5">
				<a href="https://app.gnosis.io/p/0x15BE89708053Cbc405F29095ECf803D51b5812C7"
					target="_blank" rel="noopener noreferrer"
					class="flex flex-1 items-center justify-center rounded-[var(--r-md)] py-3 text-[13px] font-bold text-white transition-all active:scale-95"
					style="background:var(--accent);box-shadow:var(--accent-shadow);">
					Join my circle ✦
				</a>
				<a href="https://x.com/tekr0x"
					target="_blank" rel="noopener noreferrer"
					class="flex flex-1 items-center justify-center rounded-[var(--r-md)] py-3 text-[13px] font-bold transition-all active:scale-95"
					style="background:var(--ghost-bg);color:var(--text);">
					Follow on X
				</a>
			</div>

			<!-- Tip jar -->
			<div class="border-t pt-5" style="border-color:var(--border);">
				<TipJar {address} />
			</div>
		</div>
	</div>
</div>
