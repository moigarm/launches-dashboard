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
	let toast = $state<{ message: string; type: "success" | "error" } | null>(null);
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
	let minXLikes = $state(parseInt($page.url.searchParams.get("minXLikes") || "0"));
	let minLinkedInLikes = $state(parseInt($page.url.searchParams.get("minLinkedInLikes") || "0"));

	let isRefreshing = $state(false);
	let refreshStatus = $state("");

	function formatAmount(n: number): string {
		if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
		if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
		return `$${n.toLocaleString()}`;
	}

	async function refreshData() {
		isRefreshing = true;
		refreshStatus = "Fetching launches...";
		try {
			let totalLaunches = 0;
			let nextToken: string | null = null;
			let linkedInNextToken: string | null = null;
			const MAX_PAGES = 2;

			for (let page = 0; page < MAX_PAGES; page++) {
				refreshStatus = `Fetching launches (page ${page + 1})...`;
				const res = await fetch("/api/pull-launches", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ nextToken, linkedInNextToken, limit: 100 }),
				});
				const result = await res.json();
				totalLaunches += result.newLaunches || 0;
				nextToken = result.nextToken || null;
				linkedInNextToken = result.linkedInNextToken || null;
				if (!nextToken && !linkedInNextToken) break;
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
			showToast("Couldn't find contact info for this company at the moment.", "error");
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
		if (minLinkedInLikes > 0) params.set("minLinkedInLikes", minLinkedInLikes.toString());
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

<div class="page-bg">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8 flex items-start justify-between fade-in">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-white text-glow">
					Launch Dashboard
				</h1>
				<p class="mt-1.5 text-sm text-slate-500">
					Companies tracked across X and LinkedIn
				</p>
			</div>
			<div class="flex flex-col items-end gap-2">
				<button onclick={refreshData} disabled={isRefreshing} class="btn-primary">
					{#if isRefreshing}
						<span class="pulse-glow">Refreshing…</span>
					{:else}
						Refresh Data
					{/if}
				</button>
				{#if refreshStatus}
					<span class="text-xs text-slate-500">{refreshStatus}</span>
				{/if}
			</div>
		</div>

		<!-- Filters -->
		<div class="glass-card mb-6 p-5 fade-in" style="animation-delay:.05s">
			<h2 class="label-dark mb-4 text-base">Filters & Sorting</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div>
					<label for="search" class="label-dark">Company Name</label>
					<input
						id="search"
						type="text"
						bind:value={searchQuery}
						placeholder="Search companies..."
						class="input-dark"
					/>
				</div>
				<div>
					<label for="minXLikes" class="label-dark">Min X Likes</label>
					<input
						id="minXLikes"
						type="number"
						bind:value={minXLikes}
						min="0"
						class="input-dark"
					/>
				</div>
				<div>
					<label for="minLinkedInLikes" class="label-dark">Min LinkedIn Likes</label>
					<input
						id="minLinkedInLikes"
						type="number"
						bind:value={minLinkedInLikes}
						min="0"
						class="input-dark"
					/>
				</div>
				<div>
					<label for="sortBy" class="label-dark">Sort By</label>
					<select id="sortBy" bind:value={sortBy} class="select-dark">
						<option value="name">Company Name</option>
						<option value="totalRaised">Total Raised</option>
						<option value="xLikes">X Likes</option>
						<option value="linkedInLikes">LinkedIn Likes</option>
					</select>
				</div>
				<div>
					<label for="sortOrder" class="label-dark">Sort Order</label>
					<select id="sortOrder" bind:value={sortOrder} class="select-dark">
						<option value="asc">Ascending</option>
						<option value="desc">Descending</option>
					</select>
				</div>
				<div class="flex items-end gap-2">
					<button onclick={() => applyFilters()} class="btn-primary flex-1">
						Apply
					</button>
					<button onclick={resetFilters} class="btn-secondary flex-1">
						Reset
					</button>
				</div>
			</div>
		</div>

		<!-- Table -->
		<div class="glass-card overflow-hidden fade-in" style="animation-delay:.1s">
			<table class="table-dark">
				<thead>
					<tr>
						<th>Company</th>
						<th>Total Raised</th>
						<th>X Likes</th>
						<th>LinkedIn Likes</th>
						<th>Contacts</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.companies as company}
						<tr>
							<td>
								<div class="text-sm font-semibold text-slate-200">{company.name}</div>
								{#if company.domain}
									<div class="text-xs text-slate-500">{company.domain}</div>
								{/if}
							</td>
							<td>
								<span class="text-sm font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
									{formatAmount(company.totalRaised)}
								</span>
							</td>
							<td class="text-sm text-cyan-400 font-semibold">
								{company.launches.filter((l) => l.platform === "X").reduce((sum, l) => sum + l.likes, 0).toLocaleString()}
							</td>
							<td class="text-sm text-blue-400 font-semibold">
								{company.launches.filter((l) => l.platform === "LinkedIn").reduce((sum, l) => sum + l.likes, 0).toLocaleString()}
							</td>
							<td>
								{#if company.contacts.length > 0}
									<div class="space-y-0.5 text-xs text-slate-400">
										{#if company.contacts[0].email}
											<div>📧 {company.contacts[0].email}</div>
										{/if}
										{#if company.contacts[0].linkedin}
											<div>💼 LinkedIn</div>
										{/if}
										{#if company.contacts[0].xHandle}
											<div>🐦 @{company.contacts[0].xHandle}</div>
										{/if}
									</div>
								{:else}
									<button
										onclick={() => enrichContact(company.id)}
										class="link-accent text-xs"
									>
										Enrich Contact
									</button>
								{/if}
							</td>
							<td>
								<button
									onclick={() => openModal(company)}
									class="link-accent text-sm"
								>
									View Details
								</button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="py-16 text-center">
								<p class="mb-2 text-4xl">📊</p>
								<p class="text-sm text-slate-500">
									No companies found. Click <strong class="text-indigo-400">Refresh Data</strong> to fetch launches.
								</p>
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
	<CompanyModal company={selectedCompany} isOpen={isModalOpen} onclose={closeModal} />
{/if}

<!-- Toast notification -->
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
