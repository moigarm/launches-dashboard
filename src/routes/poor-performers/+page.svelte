<script lang="ts">
	import type { PageData } from './$types';
	import Pagination from '$lib/components/Pagination.svelte';
	import CompanyModal from '$lib/components/CompanyModal.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();
	let selectedProvider = $state<'openai' | 'grok' | 'gemini'>('openai');
	let draftedMessages = $state<Record<number, string>>({});
	let loading = $state<Record<number, boolean>>({});

	let selectedCompany = $state<typeof data.poorPerformers[0]['company'] | null>(null);
	let isModalOpen = $state(false);

	// Filter and sort state
	let searchQuery = $state($page.url.searchParams.get('search') || '');
	let sortBy = $state($page.url.searchParams.get('sortBy') || 'likes');
	let sortOrder = $state($page.url.searchParams.get('sortOrder') || 'asc');
	let platformFilter = $state($page.url.searchParams.get('platform') || 'all');

	// Toast
	let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);

	function showToast(message: string, type: 'success' | 'error' = 'success') {
		toast = { message, type };
		setTimeout(() => (toast = null), 3000);
	}

	async function draftMessage(companyId: number) {
		loading[companyId] = true;
		try {
			const response = await fetch('/api/draft-dm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ companyId, provider: selectedProvider })
			});
			const result = await response.json();
			if (result.success) {
				draftedMessages[companyId] = result.dmText;
			}
		} finally {
			loading[companyId] = false;
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		showToast('Copied to clipboard!', 'success');
	}

	function handlePageChange(pageNum: number) {
		applyFilters(pageNum);
	}

	function openModal(company: typeof data.poorPerformers[0]['company']) {
		selectedCompany = company;
		isModalOpen = true;
	}

	function closeModal() {
		isModalOpen = false;
		selectedCompany = null;
	}

	function applyFilters(pageNum: number = 1) {
		const params = new URLSearchParams();
		params.set('page', pageNum.toString());
		if (searchQuery) params.set('search', searchQuery);
		if (sortBy) params.set('sortBy', sortBy);
		if (sortOrder) params.set('sortOrder', sortOrder);
		if (platformFilter !== 'all') params.set('platform', platformFilter);
		goto(`/poor-performers?${params.toString()}`);
	}

	function resetFilters() {
		searchQuery = '';
		sortBy = 'likes';
		sortOrder = 'asc';
		platformFilter = 'all';
		goto('/poor-performers');
	}
</script>

<div class="page-bg">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8 fade-in">
			<h1 class="text-3xl font-bold tracking-tight text-white text-glow">
				Poor Performing Launches
			</h1>
			<p class="mt-1.5 text-sm text-slate-500">
				Launches with less than 500 likes — opportunities for outreach
			</p>

			<div class="mt-4 flex items-center gap-3">
				<label class="label-dark whitespace-nowrap">AI Provider</label>
				<select bind:value={selectedProvider} class="select-dark w-auto">
					<option value="openai">OpenAI</option>
					<option value="grok">Grok</option>
					<option value="gemini">Gemini</option>
				</select>
			</div>
		</div>

		<!-- Filters -->
		<div class="glass-card mb-6 p-5 fade-in" style="animation-delay:.05s">
			<h2 class="label-dark mb-4 text-base">Filters & Sorting</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
				<div>
					<label for="pp-search" class="label-dark">Company Name</label>
					<input id="pp-search" type="text" bind:value={searchQuery} placeholder="Search companies..." class="input-dark" />
				</div>
				<div>
					<label for="pp-platform" class="label-dark">Platform</label>
					<select id="pp-platform" bind:value={platformFilter} class="select-dark">
						<option value="all">All Platforms</option>
						<option value="X">X (Twitter)</option>
						<option value="LinkedIn">LinkedIn</option>
					</select>
				</div>
				<div>
					<label for="pp-sortBy" class="label-dark">Sort By</label>
					<select id="pp-sortBy" bind:value={sortBy} class="select-dark">
						<option value="likes">Likes</option>
						<option value="timestamp">Date</option>
						<option value="companyName">Company Name</option>
					</select>
				</div>
				<div>
					<label for="pp-sortOrder" class="label-dark">Sort Order</label>
					<select id="pp-sortOrder" bind:value={sortOrder} class="select-dark">
						<option value="asc">Ascending</option>
						<option value="desc">Descending</option>
					</select>
				</div>
			</div>
			<div class="mt-4 flex gap-2">
				<button onclick={() => applyFilters()} class="btn-primary flex-1">Apply</button>
				<button onclick={resetFilters} class="btn-secondary flex-1">Reset</button>
			</div>
		</div>

		<!-- Cards -->
		<div class="space-y-4">
			{#each data.poorPerformers as launch, i}
				<div class="glass-card p-5 fade-in" style="animation-delay:{0.1 + i * 0.03}s">
					<div class="flex items-start justify-between gap-4">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<h3 class="text-lg font-semibold text-white truncate">{launch.company.name}</h3>
								<button onclick={() => openModal(launch.company)} class="link-accent text-xs shrink-0">
									View
								</button>
							</div>
							<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
								<span class="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-slate-400">
									{launch.platform === 'X' ? '𝕏' : '💼'} {launch.platform}
								</span>
								<span class="text-red-400/80 font-semibold">{launch.likes} likes</span>
								<span>•</span>
								<span>{new Date(launch.timestamp).toLocaleDateString()}</span>
								{#if launch.videoUrl}
									<a href={launch.videoUrl} target="_blank" class="link-accent">View Post ↗</a>
								{/if}
							</div>
						</div>
						<button
							onclick={() => draftMessage(launch.company.id)}
							disabled={loading[launch.company.id]}
							class="btn-primary shrink-0 text-sm"
						>
							{loading[launch.company.id] ? 'Drafting…' : 'Draft DM'}
						</button>
					</div>

					{#if draftedMessages[launch.company.id]}
						<div class="mt-4 rounded-lg border border-indigo-500/20 bg-indigo-950/30 p-4">
							<div class="mb-2 flex items-center justify-between">
								<h4 class="text-sm font-semibold text-indigo-300">Drafted Message</h4>
								<button onclick={() => copyToClipboard(draftedMessages[launch.company.id])} class="link-accent text-xs">
									Copy
								</button>
							</div>
							<p class="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">{draftedMessages[launch.company.id]}</p>
						</div>
					{/if}

					{#if launch.company.contacts.length > 0}
						<div class="mt-4 border-t border-white/[0.06] pt-3">
							<h4 class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</h4>
							<div class="flex flex-wrap gap-3 text-xs text-slate-400">
								{#if launch.company.contacts[0].email}
									<span>📧 {launch.company.contacts[0].email}</span>
								{/if}
								{#if launch.company.contacts[0].linkedin}
									<a href={launch.company.contacts[0].linkedin} target="_blank" class="link-accent">💼 LinkedIn</a>
								{/if}
								{#if launch.company.contacts[0].xHandle}
									<span>🐦 @{launch.company.contacts[0].xHandle}</span>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="glass-card py-16 text-center">
					<p class="mb-2 text-4xl">🎯</p>
					<p class="text-sm text-slate-500">No poor performing launches found.</p>
				</div>
			{/each}
		</div>

		{#if data.totalCount > 0}
			<div class="mt-6">
				<Pagination
					currentPage={data.currentPage}
					totalItems={data.totalCount}
					itemsPerPage={data.itemsPerPage}
					onPageChange={handlePageChange}
				/>
			</div>
		{/if}
	</div>
</div>

{#if selectedCompany}
	<CompanyModal company={selectedCompany} isOpen={isModalOpen} onclose={closeModal} />
{/if}

{#if toast}
	<div
		class="fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-xl px-5 py-4 shadow-2xl shadow-black/40 max-w-sm transition-all duration-300 border fade-in
			{toast.type === 'success'
			? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
			: 'bg-red-950/80 border-red-500/30 text-red-300'}"
		role="alert"
	>
		<span class="text-xl leading-none mt-0.5">
			{toast.type === "success" ? "✅" : "⚠️"}
		</span>
		<p class="text-sm font-medium leading-snug flex-1">{toast.message}</p>
		<button
			onclick={() => (toast = null)}
			class="ml-2 opacity-60 hover:opacity-100 text-lg leading-none shrink-0 transition-opacity"
			aria-label="Dismiss">×</button
		>
	</div>
{/if}
