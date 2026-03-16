<script lang="ts">
	import { signUp } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let name = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 8) {
			error = 'Password must be at least 8 characters long';
			return;
		}

		loading = true;

		try {
			const result = await signUp.email({ email, password, name });
			if (result.error) {
				error = result.error.message || 'Failed to create account';
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
				Create your <span class="text-indigo-400">account</span>
			</h2>
			<p class="mt-2 text-sm text-slate-500">Get started with LaunchDash</p>
		</div>

		<form class="glass-card space-y-5 p-6" onsubmit={handleSubmit}>
			{#if error}
				<div class="rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3">
					<p class="text-sm text-red-300">{error}</p>
				</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label for="name" class="label-dark">Full name</label>
					<input
						id="name"
						name="name"
						type="text"
						autocomplete="name"
						required
						bind:value={name}
						class="input-dark"
						placeholder="John Doe"
					/>
				</div>
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
						autocomplete="new-password"
						required
						bind:value={password}
						class="input-dark"
						placeholder="Min 8 characters"
					/>
				</div>
				<div>
					<label for="confirm-password" class="label-dark">Confirm Password</label>
					<input
						id="confirm-password"
						name="confirm-password"
						type="password"
						autocomplete="new-password"
						required
						bind:value={confirmPassword}
						class="input-dark"
						placeholder="Repeat password"
					/>
				</div>
			</div>

			<button type="submit" disabled={loading} class="btn-primary w-full">
				{loading ? 'Creating account…' : 'Sign up'}
			</button>

			<div class="text-center">
				<a href="/login" class="link-accent text-sm">
					Already have an account? <span class="font-semibold">Sign in</span>
				</a>
			</div>
		</form>
	</div>
</div>
