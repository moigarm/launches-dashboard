<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { useSession } from '$lib/auth-client';

	const session = useSession();

	onMount(() => {
		if ($session.data) {
			goto('/dashboard');
		} else {
			goto('/login');
		}
	});
</script>

<div class="page-bg flex min-h-screen items-center justify-center">
	<div class="text-center fade-in">
		<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl shadow-lg shadow-indigo-500/20">
			🚀
		</div>
		<h1 class="text-4xl font-bold tracking-tight text-white text-glow">
			Launch<span class="text-indigo-400">Dash</span>
		</h1>
		<p class="mt-3 text-slate-500 pulse-glow">Redirecting…</p>
	</div>
</div>
