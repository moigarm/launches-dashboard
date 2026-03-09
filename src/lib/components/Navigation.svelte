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

	const navItems = [
		{ href: "/dashboard", label: "Dashboard", icon: "📊" },
		{ href: "/funding", label: "Funding Events", icon: "💰" },
		{ href: "/poor-performers", label: "Poor Performers", icon: "📉" },
	];

	async function handleLogout() {
		await signOut();
		await goto("/login");
	}
</script>

<nav class="bg-white shadow-sm border-b border-gray-200">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between h-16">
			<div class="flex">
				<div class="flex-shrink-0 flex items-center">
					<a href="/" class="text-xl font-bold text-indigo-600"
						>Launch Dashboard</a
					>
				</div>
				<div class="hidden sm:ml-6 sm:flex sm:space-x-8">
					{#each navItems as item}
						<a
							href={item.href}
							class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium {$page
								.url.pathname === item.href
								? 'border-indigo-500 text-gray-900'
								: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
						>
							<span class="mr-2">{item.icon}</span>
							{item.label}
						</a>
					{/each}
				</div>
			</div>
			<div class="hidden sm:ml-6 sm:flex sm:items-center">
				{#if user}
					<div class="flex items-center space-x-4">
						<span class="text-sm text-gray-700">
							{user.name || user.email}
						</span>
						<button
							onclick={handleLogout}
							class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
						>
							Logout
						</button>
					</div>
				{:else}
					<div class="flex items-center space-x-4">
						<a
							href="/login"
							class="text-sm font-medium text-gray-700 hover:text-gray-900"
						>
							Login
						</a>
						<a
							href="/register"
							class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
						>
							Sign up
						</a>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Mobile menu -->
	<div class="sm:hidden">
		<div class="pt-2 pb-3 space-y-1">
			{#each navItems as item}
				<a
					href={item.href}
					class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium {$page
						.url.pathname === item.href
						? 'bg-indigo-50 border-indigo-500 text-indigo-700'
						: 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'}"
				>
					<span class="mr-2">{item.icon}</span>
					{item.label}
				</a>
			{/each}
		</div>
		{#if user}
			<div class="pt-4 pb-3 border-t border-gray-200">
				<div class="flex items-center px-4">
					<div class="flex-shrink-0">
						<span
							class="inline-block h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center"
						>
							{user.name?.[0]?.toUpperCase() ||
								user.email[0].toUpperCase()}
						</span>
					</div>
					<div class="ml-3">
						<div class="text-base font-medium text-gray-800">
							{user.name || "User"}
						</div>
						<div class="text-sm font-medium text-gray-500">
							{user.email}
						</div>
					</div>
				</div>
				<div class="mt-3 space-y-1">
					<button
						onclick={handleLogout}
						class="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
					>
						Logout
					</button>
				</div>
			</div>
		{/if}
	</div>
</nav>
