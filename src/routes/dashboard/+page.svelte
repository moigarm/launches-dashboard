<script lang="ts">
	import type { PageData } from "./$types";
	import Pagination from "$lib/components/Pagination.svelte";
	import CompanyModal from "$lib/components/CompanyModal.svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";

	let { data }: { data: PageData } = $props();

	let selectedCompany = $state<(typeof data.companies)[0] | null>(null);
	let isModalOpen = $state(false);

	// Toast notification
	let toast = $state<{ message: string; type: "success" | "error" } | null>(
		null,
	);
	let toastTimer: ReturnType<typeof setTimeout>;

	function showToast(message: string, type: "success" | "error" = "error") {
		clearTimeout(toastTimer);
		toast = { message, type };
		toastTimer = setTimeout(() => (toast = null), 4000);
	}

	// Filter and sort state
	let searchQuery = $state($page.url.searchParams.get("search") || "");
	let sortBy = $state($page.url.searchParams.get("sortBy") || "name");
	let sortOrder = $state($page.url.searchParams.get("sortOrder") || "asc");
	let minXLikes = $state(
		parseInt($page.url.searchParams.get("minXLikes") || "0"),
	);
	let minLinkedInLikes = $state(
		parseInt($page.url.searchParams.get("minLinkedInLikes") || "0"),
	);

	let isRefreshing = $state(false);
	let refreshStatus = $state("");

	async function refreshData() {
		isRefreshing = true;
		refreshStatus = "Fetching launches...";
		try {
			let totalLaunches = 0;
			let nextToken: string | null = null;
			const MAX_PAGES = 2; // fetch up to 2 pages = ~100 posts

			for (let page = 0; page < MAX_PAGES; page++) {
				refreshStatus = `Fetching launches (page ${page + 1})...`;
				const res = await fetch("/api/pull-launches", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ nextToken, limit: 100 }),
				});
				const result = await res.json();
				totalLaunches += result.newLaunches || 0;
				nextToken = result.nextToken || null;
				if (!nextToken) break; // no more pages
			}

			refreshStatus = "Fetching funding data...";
			await fetch("/api/pull-funding", { method: "POST" });

			refreshStatus = `Done! Saved ${totalLaunches} launches.`;
			await new Promise((r) => setTimeout(r, 1500));
			window.location.reload();
		} catch (e) {
			refreshStatus = "Error during refresh.";
		} finally {
			isRefreshing = false;
		}
	}

	async function enrichContact(companyId: number) {
		const response = await fetch("/api/enrich-contact", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ companyId }),
		});
		const result = await response.json();
		if (result.success) {
			showToast("Contact info found!", "success");
			await new Promise((r) => setTimeout(r, 800));
			window.location.reload();
		} else {
			showToast(
				"Couldn't find contact info for this company at the moment.",
				"error",
			);
		}
	}

	function handlePageChange(page: number) {
		applyFilters(page);
	}

	function openModal(company: (typeof data.companies)[0]) {
		selectedCompany = company;
		isModalOpen = true;
	}

	function closeModal() {
		isModalOpen = false;
		selectedCompany = null;
	}

	function applyFilters(pageNum: number = 1) {
		const params = new URLSearchParams();
		params.set("page", pageNum.toString());
		if (searchQuery) params.set("search", searchQuery);
		if (sortBy) params.set("sortBy", sortBy);
		if (sortOrder) params.set("sortOrder", sortOrder);
		if (minXLikes > 0) params.set("minXLikes", minXLikes.toString());
		if (minLinkedInLikes > 0)
			params.set("minLinkedInLikes", minLinkedInLikes.toString());
		goto(`/dashboard?${params.toString()}`);
	}

	function resetFilters() {
		searchQuery = "";
		sortBy = "name";
		sortOrder = "asc";
		minXLikes = 0;
		minLinkedInLikes = 0;
		goto("/dashboard");
	}
</script>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="flex justify-between items-start mb-8">
			<h1 class="text-3xl font-bold text-gray-900">Launch Dashboard</h1>
			<div class="flex flex-col items-end gap-1">
				<button
					onclick={refreshData}
					disabled={isRefreshing}
					class="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-opacity"
				>
					{isRefreshing ? "Refreshing..." : "Refresh Data"}
				</button>
				{#if refreshStatus}
					<span class="text-xs text-gray-500">{refreshStatus}</span>
				{/if}
			</div>
		</div>

		<!-- Filters -->
		<div class="bg-white shadow-md rounded-lg p-6 mb-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">
				Filters & Sorting
			</h2>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label
						for="search"
						class="block text-sm font-medium text-gray-700 mb-1"
					>
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
					<label
						for="minXLikes"
						class="block text-sm font-medium text-gray-700 mb-1"
					>
						Min X Likes
					</label>
					<input
						id="minXLikes"
						type="number"
						bind:value={minXLikes}
						min="0"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
					/>
				</div>

				<div>
					<label
						for="minLinkedInLikes"
						class="block text-sm font-medium text-gray-700 mb-1"
					>
						Min LinkedIn Likes
					</label>
					<input
						id="minLinkedInLikes"
						type="number"
						bind:value={minLinkedInLikes}
						min="0"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
					/>
				</div>

				<div>
					<label
						for="sortBy"
						class="block text-sm font-medium text-gray-700 mb-1"
					>
						Sort By
					</label>
					<select
						id="sortBy"
						bind:value={sortBy}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
					>
						<option value="name">Company Name</option>
						<option value="totalRaised">Total Raised</option>
						<option value="xLikes">X Likes</option>
						<option value="linkedInLikes">LinkedIn Likes</option>
					</select>
				</div>

				<div>
					<label
						for="sortOrder"
						class="block text-sm font-medium text-gray-700 mb-1"
					>
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

				<div class="flex items-end gap-2">
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
		</div>

		<div class="bg-white shadow-md rounded-lg overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
						>
							Company
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
						>
							Total Raised
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
						>
							X Likes
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
						>
							LinkedIn Likes
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
						>
							Contacts
						</th>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
						>
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each data.companies as company}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900">
									{company.name}
								</div>
								{#if company.domain}
									<div class="text-sm text-gray-500">
										{company.domain}
									</div>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900">
									${company.totalRaised.toLocaleString()}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900">
									{company.launches
										.filter((l) => l.platform === "X")
										.reduce((sum, l) => sum + l.likes, 0)}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900">
									{company.launches
										.filter(
											(l) => l.platform === "LinkedIn",
										)
										.reduce((sum, l) => sum + l.likes, 0)}
								</div>
							</td>
							<td class="px-6 py-4">
								{#if company.contacts.length > 0}
									<div class="text-sm text-gray-900">
										{#if company.contacts[0].email}
											<div>
												📧 {company.contacts[0].email}
											</div>
										{/if}
										{#if company.contacts[0].linkedin}
											<div>💼 LinkedIn</div>
										{/if}
										{#if company.contacts[0].xHandle}
											<div>
												🐦 @{company.contacts[0]
													.xHandle}
											</div>
										{/if}
									</div>
								{:else}
									<button
										onclick={() =>
											enrichContact(company.id)}
										class="text-blue-600 hover:text-blue-800 text-sm"
									>
										Enrich Contact
									</button>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">
								<button
									onclick={() => openModal(company)}
									class="text-indigo-600 hover:text-indigo-900"
								>
									View Details
								</button>
							</td>
						</tr>
					{:else}
						<tr>
							<td
								colspan="6"
								class="px-6 py-4 text-center text-gray-500"
							>
								No companies found. Click "Refresh Data" to
								fetch launches.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<Pagination
				currentPage={data.currentPage}
				totalItems={data.totalCount}
				itemsPerPage={data.itemsPerPage}
				onPageChange={handlePageChange}
			/>
		</div>
	</div>
</div>

{#if selectedCompany}
	<CompanyModal
		company={selectedCompany}
		isOpen={isModalOpen}
		onclose={closeModal}
	/>
{/if}

<!-- Toast notification -->
{#if toast}
	<div
		class="fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-xl px-5 py-4 shadow-2xl max-w-sm transition-all duration-300
			{toast.type === 'success'
			? 'bg-green-600 text-white'
			: 'bg-red-600 text-white'}"
		role="alert"
	>
		<span class="text-xl leading-none mt-0.5">
			{toast.type === "success" ? "✅" : "⚠️"}
		</span>
		<p class="text-sm font-medium leading-snug flex-1">{toast.message}</p>
		<button
			onclick={() => (toast = null)}
			class="ml-2 text-white/70 hover:text-white text-lg leading-none shrink-0"
			aria-label="Dismiss">×</button
		>
	</div>
{/if}
