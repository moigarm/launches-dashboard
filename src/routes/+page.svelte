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

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
	<div class="text-center">
		<h1 class="text-4xl font-bold text-gray-900 mb-4">Launch Dashboard</h1>
		<p class="text-gray-600">Redirecting...</p>
	</div>
</div>
