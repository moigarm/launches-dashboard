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
		alert('Copied to clipboard!');
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

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900">Poor Performing Launches</h1>
			<p class="text-gray-600 mt-1">Launches with less than 500 likes</p>
			
			<div class="mt-4">
				<label class="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
				<select
					bind:value={selectedProvider}
					class="border border-gray-300 rounded-md px-3 py-2"
				>
					<option value="openai">OpenAI</option>
					<option value="grok">Grok</option>
					<option value="gemini">Gemini</option>
				</select>
			</div>
		</div>

		<!-- Filters -->
		<div class="bg-white shadow-md rounded-lg p-6 mb-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Filters & Sorting</h2>
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div>
					<label for="search" class="block text-sm font-medium text-gray-700 mb-1">
						Company Name
					</label>
					<input
						id="search"
						type="text"
						bind:value={searchQuery}
						placeholder="Search companies..."
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
					/>
				</div>

				<div>
					<label for="platform" class="block text-sm font-medium text-gray-700 mb-1">
						Platform
					</label>
					<select
						id="platform"
						bind:value={platformFilter}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
					>
						<option value="all">All Platforms</option>
						<option value="X">X (Twitter)</option>
						<option value="LinkedIn">LinkedIn</option>
					</select>
				</div>

				<div>
					<label for="sortBy" class="block text-sm font-medium text-gray-700 mb-1">
						Sort By
					</label>
					<select
						id="sortBy"
						bind:value={sortBy}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
					>
						<option value="likes">Likes</option>
						<option value="timestamp">Date</option>
						<option value="companyName">Company Name</option>
					</select>
				</div>

				<div>
					<label for="sortOrder" class="block text-sm font-medium text-gray-700 mb-1">
						Sort Order
					</label>
					<select
						id="sortOrder"
						bind:value={sortOrder}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
					>
						<option value="asc">Ascending</option>
						<option value="desc">Descending</option>
					</select>
				</div>
			</div>

			<div class="flex gap-2 mt-4">
				<button
					onclick={() => applyFilters()}
					class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium"
				>
					Apply Filters
				</button>
				<button
					onclick={resetFilters}
					class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md font-medium"
				>
					Reset
				</button>
			</div>
		</div>

		<div class="space-y-6">
			{#each data.poorPerformers as launch}
				<div class="bg-white shadow-md rounded-lg p-6">
					<div class="flex justify-between items-start mb-4">
						<div>
							<div class="flex items-center gap-2">
								<h3 class="text-xl font-semibold text-gray-900">{launch.company.name}</h3>
								<button
									onclick={() => openModal(launch.company)}
									class="text-sm text-indigo-600 hover:text-indigo-800"
								>
									View Details
								</button>
							</div>
							<p class="text-sm text-gray-500">
								{launch.platform} • {launch.likes} likes • {new Date(launch.timestamp).toLocaleDateString()}
							</p>
							{#if launch.videoUrl}
								<a href={launch.videoUrl} target="_blank" class="text-blue-600 hover:underline text-sm">
									View Launch Post
								</a>
							{/if}
						</div>
						<button
							onclick={() => draftMessage(launch.company.id)}
							disabled={loading[launch.company.id]}
							class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
						>
							{loading[launch.company.id] ? 'Drafting...' : 'Draft DM'}
						</button>
					</div>

					{#if draftedMessages[launch.company.id]}
						<div class="mt-4 p-4 bg-gray-50 rounded-lg">
							<div class="flex justify-between items-start mb-2">
								<h4 class="font-medium text-gray-900">Drafted Message:</h4>
								<button
									onclick={() => copyToClipboard(draftedMessages[launch.company.id])}
									class="text-sm text-blue-600 hover:text-blue-800"
								>
									Copy
								</button>
							</div>
							<p class="text-gray-700 whitespace-pre-wrap">{draftedMessages[launch.company.id]}</p>
						</div>
					{/if}

					{#if launch.company.contacts.length > 0}
						<div class="mt-4 pt-4 border-t border-gray-200">
							<h4 class="font-medium text-gray-900 mb-2">Contact Information:</h4>
							<div class="text-sm text-gray-600 space-y-1">
								{#if launch.company.contacts[0].email}
									<div>📧 {launch.company.contacts[0].email}</div>
								{/if}
								{#if launch.company.contacts[0].linkedin}
									<div>💼 <a href={launch.company.contacts[0].linkedin} target="_blank" class="text-blue-600 hover:underline">LinkedIn</a></div>
								{/if}
								{#if launch.company.contacts[0].xHandle}
									<div>🐦 @{launch.company.contacts[0].xHandle}</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="bg-white shadow-md rounded-lg p-6 text-center text-gray-500">
					No poor performing launches found.
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
