<script lang="ts">
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";

    let { data }: { data: PageData } = $props();

    let sortBy = $state($page.url.searchParams.get("sortBy") || "date");
    let sortOrder = $state($page.url.searchParams.get("sortOrder") || "desc");
    let source = $state($page.url.searchParams.get("source") || "all");
    let isPulling = $state(false);
    let pullStatus = $state("");

    function formatAmount(amount: number): string {
        if (amount >= 1_000_000_000)
            return `$${(amount / 1_000_000_000).toFixed(1)}B`;
        if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
        if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
        return `$${amount.toLocaleString()}`;
    }

    function sourceColor(src: string) {
        if (src.startsWith("YC")) return "bg-orange-100 text-orange-800";
        if (src === "TechCrunch") return "bg-green-100 text-green-800";
        if (src === "Google News") return "bg-blue-100 text-blue-800";
        return "bg-gray-100 text-gray-700";
    }

    function applyFilters() {
        const params = new URLSearchParams();
        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);
        if (source !== "all") params.set("source", source);
        goto(`/funding?${params.toString()}`);
    }

    async function pullFunding() {
        isPulling = true;
        pullStatus = "Fetching funding announcements...";
        try {
            const res = await fetch("/api/pull-funding", { method: "POST" });
            const result = await res.json();
            if (result.success) {
                pullStatus = `✅ ${result.newEvents} new · ${result.skipped} skipped · ${result.enriched} contacts enriched`;
            } else {
                pullStatus = "⚠️ Error fetching funding data";
            }
            await new Promise((r) => setTimeout(r, 2000));
            window.location.reload();
        } finally {
            isPulling = false;
        }
    }
</script>

<div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="flex justify-between items-start mb-8">
            <div>
                <h1 class="text-3xl font-bold text-gray-900">Funding Events</h1>
                <p class="text-gray-500 mt-1">
                    Startup funding announcements from Google News, YC, and
                    TechCrunch
                </p>
            </div>
            <div class="flex flex-col items-end gap-1">
                <button
                    onclick={pullFunding}
                    disabled={isPulling}
                    class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-medium transition-opacity"
                >
                    {isPulling ? "Fetching..." : "Fetch Funding"}
                </button>
                {#if pullStatus}
                    <span class="text-xs text-gray-500">{pullStatus}</span>
                {/if}
            </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div
                class="bg-white rounded-xl shadow-sm p-5 border border-gray-100"
            >
                <p
                    class="text-xs font-semibold text-gray-400 uppercase tracking-wider"
                >
                    Total Events
                </p>
                <p class="text-3xl font-bold text-gray-900 mt-1">
                    {data.totalEvents.toLocaleString()}
                </p>
            </div>
            <div
                class="bg-white rounded-xl shadow-sm p-5 border border-gray-100"
            >
                <p
                    class="text-xs font-semibold text-gray-400 uppercase tracking-wider"
                >
                    Total Raised (tracked)
                </p>
                <p class="text-3xl font-bold text-indigo-600 mt-1">
                    {formatAmount(data.totalRaised)}
                </p>
            </div>
            <div
                class="bg-white rounded-xl shadow-sm p-5 border border-gray-100"
            >
                <p
                    class="text-xs font-semibold text-gray-400 uppercase tracking-wider"
                >
                    Sources
                </p>
                <div class="flex flex-wrap gap-1 mt-2">
                    {#each data.sources as src}
                        <span
                            class="text-xs px-2 py-0.5 rounded-full font-medium {sourceColor(
                                src,
                            )}">{src}</span
                        >
                    {/each}
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div
            class="bg-white rounded-xl shadow-sm p-5 mb-6 border border-gray-100"
        >
            <div class="flex flex-wrap gap-4 items-end">
                <div>
                    <label
                        for="source"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >Source</label
                    >
                    <select
                        id="source"
                        bind:value={source}
                        class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                        <option value="all">All Sources</option>
                        {#each data.sources as src}
                            <option value={src}>{src}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <label
                        for="sortBy"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >Sort By</label
                    >
                    <select
                        id="sortBy"
                        bind:value={sortBy}
                        class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                        <option value="date">Date</option>
                        <option value="amount">Amount</option>
                        <option value="company">Company</option>
                    </select>
                </div>
                <div>
                    <label
                        for="sortOrder"
                        class="block text-sm font-medium text-gray-700 mb-1"
                        >Order</label
                    >
                    <select
                        id="sortOrder"
                        bind:value={sortOrder}
                        class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                        <option value="desc">Newest / Largest first</option>
                        <option value="asc">Oldest / Smallest first</option>
                    </select>
                </div>
                <button
                    onclick={applyFilters}
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md font-medium"
                >
                    Apply
                </button>
            </div>
        </div>

        <!-- Table -->
        <div
            class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100"
        >
            {#if data.events.length === 0}
                <div class="py-20 text-center text-gray-400">
                    <p class="text-5xl mb-4">💰</p>
                    <p class="text-lg font-medium">No funding events yet</p>
                    <p class="text-sm mt-1">
                        Click <strong>Fetch Funding</strong> to pull announcements
                        from Google News, YC, and TechCrunch.
                    </p>
                </div>
            {:else}
                <table class="min-w-full divide-y divide-gray-100">
                    <thead class="bg-gray-50">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                >Company</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                >Amount Raised</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                >Source</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                >Date</th
                            >
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                        {#each data.events as event}
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td class="px-6 py-4">
                                    <div
                                        class="text-sm font-semibold text-gray-900"
                                    >
                                        {event.company.name}
                                    </div>
                                    {#if event.company.domain}
                                        <div class="text-xs text-gray-400">
                                            {event.company.domain}
                                        </div>
                                    {/if}
                                </td>
                                <td class="px-6 py-4">
                                    <span
                                        class="text-sm font-bold text-indigo-600"
                                        >{formatAmount(event.amount)}</span
                                    >
                                </td>
                                <td class="px-6 py-4">
                                    <span
                                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {sourceColor(
                                            event.source,
                                        )}"
                                    >
                                        {event.source}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-500">
                                    {new Date(event.date).toLocaleDateString(
                                        "en-US",
                                        {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                        },
                                    )}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>

                <!-- Pagination info -->
                {#if data.totalCount > data.itemsPerPage}
                    <div
                        class="px-6 py-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500"
                    >
                        <span
                            >Showing {(data.currentPage - 1) *
                                data.itemsPerPage +
                                1}–{Math.min(
                                data.currentPage * data.itemsPerPage,
                                data.totalCount,
                            )} of {data.totalCount} events</span
                        >
                        <div class="flex gap-2">
                            {#if data.currentPage > 1}
                                <a
                                    href="/funding?page={data.currentPage -
                                        1}&sortBy={sortBy}&sortOrder={sortOrder}&source={source}"
                                    class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
                                    >← Prev</a
                                >
                            {/if}
                            {#if data.currentPage * data.itemsPerPage < data.totalCount}
                                <a
                                    href="/funding?page={data.currentPage +
                                        1}&sortBy={sortBy}&sortOrder={sortOrder}&source={source}"
                                    class="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                                    >Next →</a
                                >
                            {/if}
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</div>
