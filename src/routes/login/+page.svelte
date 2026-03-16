<script lang="ts">
	import { signIn } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const result = await signIn.email({ email, password });
			if (result.error) {
				error = result.error.message || 'Invalid email or password';
			} else {
				await goto('/dashboard');
			}
		} catch (err) {
			error = 'An error occurred. Please try again.';
			console.error(err);
		} finally {
			loading = false;
		}
	}
</script>

<div class="page-bg flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8 fade-in">
		<!-- Logo -->
		<div class="text-center">
			<div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl shadow-lg shadow-indigo-500/20">
				🚀
			</div>
			<h2 class="text-2xl font-bold tracking-tight text-white">
				Sign in to <span class="text-indigo-400">LaunchDash</span>
			</h2>
			<p class="mt-2 text-sm text-slate-500">Track launches and discover opportunities</p>
		</div>

		<form class="glass-card space-y-5 p-6" onsubmit={handleSubmit}>
			{#if error}
				<div class="rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3">
					<p class="text-sm text-red-300">{error}</p>
				</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label for="email-address" class="label-dark">Email address</label>
					<input
						id="email-address"
						name="email"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						class="input-dark"
						placeholder="you@example.com"
					/>
				</div>
				<div>
					<label for="password" class="label-dark">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
						bind:value={password}
						class="input-dark"
						placeholder="••••••••"
					/>
				</div>
			</div>

			<button type="submit" disabled={loading} class="btn-primary w-full">
				{loading ? 'Signing in…' : 'Sign in'}
			</button>

			<div class="text-center">
				<a href="/register" class="link-accent text-sm">
					Don't have an account? <span class="font-semibold">Sign up</span>
				</a>
			</div>
		</form>
	</div>
</div>
