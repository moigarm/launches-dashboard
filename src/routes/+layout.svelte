<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navigation from '$lib/components/Navigation.svelte';
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();

	// Don't show navigation on login/register pages
	const showNav = $derived(!$page.url.pathname.startsWith('/login') && !$page.url.pathname.startsWith('/register'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if showNav}
	<Navigation user={data.user} />
{/if}

{@render children()}
