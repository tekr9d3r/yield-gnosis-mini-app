<script lang="ts">
	interface Props { id: string; }
	let { id }: Props = $props();
	const gradId = $derived(`gl-${id}`);
</script>

<svg
	viewBox="0 0 200 44"
	preserveAspectRatio="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	style="width:100%;height:36px;display:block;overflow:visible"
>
	<defs>
		<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="rgba(22,163,74,0.14)" />
			<stop offset="100%" stop-color="rgba(22,163,74,0)" />
		</linearGradient>
	</defs>

	<!-- Fill under curve -->
	<path
		d="M0,40 C50,38 90,28 130,18 S175,7 200,4 L200,44 L0,44 Z"
		fill="url(#{gradId})"
	/>

	<!-- Growing line -->
	<path
		d="M0,40 C50,38 90,28 130,18 S175,7 200,4"
		fill="none"
		stroke="rgba(22,163,74,0.5)"
		stroke-width="1.5"
		stroke-linecap="round"
		class="gline"
	/>

	<!-- Tip dot -->
	<circle cx="200" cy="4" r="2.5" fill="rgba(22,163,74,0.85)" class="gdot" />
</svg>

<style>
	.gline {
		stroke-dasharray: 310;
		stroke-dashoffset: 310;
		animation: gline-draw 2.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
	}

	.gdot {
		opacity: 0;
		transform-box: fill-box;
		transform-origin: center;
		animation:
			gdot-in    0.3s ease-out 2.5s forwards,
			gdot-pulse 2.4s ease-in-out 2.8s infinite;
	}

	@keyframes gline-draw {
		to { stroke-dashoffset: 0; }
	}

	@keyframes gdot-in {
		to { opacity: 1; }
	}

	@keyframes gdot-pulse {
		0%, 100% { opacity: 0.5; transform: scale(1);   }
		50%       { opacity: 1;   transform: scale(1.6); }
	}
</style>
