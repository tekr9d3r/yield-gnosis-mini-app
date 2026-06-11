<script lang="ts">
	import TipJar from './TipJar.svelte';

	let { address, onClose }: {
		address: string;
		onClose: () => void;
	} = $props();
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
			<span class="text-[11.5px] font-black uppercase tracking-widest" style="color:var(--text-dim);">About</span>
			<button
				onclick={onClose}
				class="flex h-8 w-8 items-center justify-center rounded-full text-[16px] transition-all active:scale-90"
				style="background:var(--ghost-bg);color:var(--text-muted);"
			>✕</button>
		</div>

		<div class="px-5 pb-8">
			<!-- Builder row -->
			<div class="flex items-center gap-3">
				<img src="/tekr0x-avatar.jpg" alt="Tekr0x.eth"
					class="h-12 w-12 shrink-0 rounded-full object-cover"
					style="border:2px solid var(--accent);" />
				<div class="flex-1">
					<p class="text-[16px] font-bold leading-tight" style="color:var(--text);">Tekr0x.eth</p>
					<a href="https://x.com/tekr0x" target="_blank" rel="noopener noreferrer"
						class="text-[12.5px] font-medium" style="color:var(--text-muted);">@tekr0x on X ↗</a>
				</div>
			</div>

			<!-- Action buttons -->
			<div class="mt-4 flex gap-2.5">
				<a href="https://app.gnosis.io/p/0x15BE89708053Cbc405F29095ECf803D51b5812C7"
					target="_blank" rel="noopener noreferrer"
					class="flex flex-1 items-center justify-center rounded-[var(--r-md)] py-3 text-[13.5px] font-bold text-white transition-all active:scale-95"
					style="background:var(--accent);box-shadow:var(--accent-shadow);">
					Join my circle ✦
				</a>
				<a href="https://x.com/tekr0x"
					target="_blank" rel="noopener noreferrer"
					class="flex flex-1 items-center justify-center rounded-[var(--r-md)] py-3 text-[13.5px] font-bold transition-all active:scale-95"
					style="background:var(--ghost-bg);color:var(--text);">
					Follow on X
				</a>
			</div>

			<!-- Tip jar -->
			<div class="mt-5 border-t pt-5" style="border-color:var(--border);">
				<TipJar {address} />
			</div>
		</div>
	</div>
</div>
