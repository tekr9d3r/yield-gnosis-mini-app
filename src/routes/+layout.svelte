<script lang="ts">
	import '../app.css';
	import { inject } from '@vercel/analytics';
	import { onMount } from 'svelte';
	let { children } = $props();
	onMount(() => inject());
</script>

{@render children()}
