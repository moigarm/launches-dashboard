<script lang="ts">
	import { page } from "$app/stores";
	import { signOut } from "$lib/auth-client";
	import { goto } from "$app/navigation";

	interface Props {
		user?: {
			name: string | null;
			email: string;
		};
	}

	let { user }: Props = $props();
	let mobileOpen = $state(false);

	const navItems = [
		{ href: "/dashboard", label: "Dashboard", icon: "📊" },
		{ href: "/funding", label: "Funding Events", icon: "💰" },
		{ href: "/poor-performers", label: "Poor Performers", icon: "📉" },
	];

	async function handleLogout() {
		await signOut();
		await goto("/login");
	}

	function toggleMobile() {
		mobileOpen = !mobileOpen;
	}
</script>

<nav class="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0e1a]/80 backdrop-blur-xl">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo + Desktop Links -->
			<div class="flex items-center gap-8">
				<a
					href="/"
					class="flex items-center gap-2 text-lg font-bold tracking-tight text-white transition-opacity hover:opacity-80"
				>
					<span class="inline-block h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-center text-sm leading-7"
						>🚀</span
					>
					<span>Launch<span class="text-indigo-400">Dash</span></span>
				</a>

				<div class="hidden sm:flex sm:items-center sm:gap-1">
					{#each navItems as item}
						<a
							href={item.href}
							class="relative rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
								{$page.url.pathname === item.href
								? 'bg-indigo-500/10 text-indigo-300'
								: 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}"
						>
							<span class="mr-1.5">{item.icon}</span>
							{item.label}
							{#if $page.url.pathname === item.href}
								<span
									class="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
								></span>
							{/if}
						</a>
					{/each}
				</div>
			</div>

			<!-- User area -->
			<div class="hidden sm:flex sm:items-center sm:gap-3">
				{#if user}
					<span class="text-sm text-slate-400">{user.name || user.email}</span>
					<button onclick={handleLogout} class="btn-primary text-xs">
						Logout
					</button>
				{:else}
					<a
						href="/login"
						class="text-sm font-medium text-slate-400 transition-colors hover:text-white"
					>
						Login
					</a>
					<a href="/register" class="btn-primary text-xs"> Sign up </a>
				{/if}
			</div>

			<!-- Mobile hamburger -->
			<button
				class="sm:hidden rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
				onclick={toggleMobile}
				aria-label="Toggle menu"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					{#if mobileOpen}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					{/if}
				</svg>
			</button>
		</div>
	</div>

	<!-- Mobile menu -->
	{#if mobileOpen}
		<div class="border-t border-white/[0.06] sm:hidden fade-in">
			<div class="space-y-1 px-4 py-3">
				{#each navItems as item}
					<a
						href={item.href}
						onclick={() => (mobileOpen = false)}
						class="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
							{$page.url.pathname === item.href
							? 'bg-indigo-500/10 text-indigo-300'
							: 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}"
					>
						<span class="mr-3 text-base">{item.icon}</span>
						{item.label}
					</a>
				{/each}
			</div>
			{#if user}
				<div class="border-t border-white/[0.06] px-4 py-4">
					<div class="mb-3 flex items-center gap-3">
						<span
							class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white"
						>
							{user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
						</span>
						<div>
							<div class="text-sm font-medium text-slate-200">{user.name || "User"}</div>
							<div class="text-xs text-slate-500">{user.email}</div>
						</div>
					</div>
					<button
						onclick={handleLogout}
						class="w-full rounded-lg bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
					>
						Logout
					</button>
				</div>
			{/if}
		</div>
	{/if}
</nav>
