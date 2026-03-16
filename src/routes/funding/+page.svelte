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
        if (src.startsWith("YC")) return "badge-amber";
        if (src === "TechCrunch") return "badge-emerald";
        if (src === "Google News") return "badge-blue";
        return "badge-violet";
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

<div class="page-bg">
    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <!-- Header -->
        <div class="mb-8 flex items-start justify-between fade-in">
            <div>
                <h1 class="text-3xl font-bold tracking-tight text-white text-glow">
                    Funding Events
                </h1>
                <p class="mt-1.5 text-sm text-slate-500">
                    Startup funding announcements from Google News, YC, and TechCrunch
                </p>
            </div>
            <div class="flex flex-col items-end gap-2">
                <button
                    onclick={pullFunding}
                    disabled={isPulling}
                    class="btn-primary"
                >
                    {#if isPulling}
                        <span class="pulse-glow">Fetching…</span>
                    {:else}
                        Fetch Funding
                    {/if}
                </button>
                {#if pullStatus}
                    <span class="text-xs text-slate-500">{pullStatus}</span>
                {/if}
            </div>
        </div>

        <!-- Stat Cards -->
        <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 fade-in" style="animation-delay:.05s">
            <!-- Total Events -->
            <div class="stat-card p-5">
                <p class="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">
                    Total Events
                </p>
                <p class="mt-1 text-3xl font-extrabold text-white">
                    {data.totalEvents.toLocaleString()}
                </p>
            </div>

            <!-- Total Raised -->
            <div class="stat-card p-5">
                <p class="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">
                    Total Raised
                </p>
                <p class="mt-1 text-3xl font-extrabold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                    {formatAmount(data.totalRaised)}
                </p>
            </div>

            <!-- Sources -->
            <div class="stat-card p-5">
                <p class="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">
                    Sources
                </p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                    {#each data.sources as src}
                        <span class="badge {sourceColor(src)}">{src}</span>
                    {/each}
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="glass-card mb-6 p-5 fade-in" style="animation-delay:.1s">
            <div class="flex flex-wrap items-end gap-4">
                <div>
                    <label for="source" class="label-dark">Source</label>
                    <select
                        id="source"
                        bind:value={source}
                        class="select-dark"
                    >
                        <option value="all">All Sources</option>
                        {#each data.sources as src}
                            <option value={src}>{src}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <label for="sortBy" class="label-dark">Sort By</label>
                    <select
                        id="sortBy"
                        bind:value={sortBy}
                        class="select-dark"
                    >
                        <option value="date">Date</option>
                        <option value="amount">Amount</option>
                        <option value="company">Company</option>
                    </select>
                </div>
                <div>
                    <label for="sortOrder" class="label-dark">Order</label>
                    <select
                        id="sortOrder"
                        bind:value={sortOrder}
                        class="select-dark"
                    >
                        <option value="desc">Newest / Largest first</option>
                        <option value="asc">Oldest / Smallest first</option>
                    </select>
                </div>
                <button onclick={applyFilters} class="btn-primary">
                    Apply
                </button>
            </div>
        </div>

        <!-- Table -->
        <div class="glass-card overflow-hidden fade-in" style="animation-delay:.15s">
            {#if data.events.length === 0}
                <div class="py-20 text-center">
                    <p class="mb-3 text-5xl">💰</p>
                    <p class="text-lg font-semibold text-slate-300">
                        No funding events yet
                    </p>
                    <p class="mt-1 text-sm text-slate-500">
                        Click <strong class="text-indigo-400">Fetch Funding</strong> to
                        pull announcements from Google News, YC, and TechCrunch.
                    </p>
                </div>
            {:else}
                <table class="table-dark">
                    <thead>
                        <tr>
                            <th>Company</th>
                            <th>Amount Raised</th>
                            <th>Source</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.events as event}
                            <tr>
                                <td>
                                    <div class="text-sm font-semibold text-slate-200">
                                        {event.company.name}
                                    </div>
                                    {#if event.company.domain}
                                        <div class="text-xs text-slate-500">
                                            {event.company.domain}
                                        </div>
                                    {/if}
                                </td>
                                <td>
                                    <span class="text-sm font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                                        {formatAmount(event.amount)}
                                    </span>
                                </td>
                                <td>
                                    <span class="badge {sourceColor(event.source)}">
                                        {event.source}
                                    </span>
                                </td>
                                <td class="text-sm text-slate-500">
                                    {new Date(event.date).toLocaleDateString(
                                        "en-US",
                                        { year: "numeric", month: "short", day: "numeric" },
                                    )}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>

                <!-- Pagination -->
                {#if data.totalCount > data.itemsPerPage}
                    <div class="flex items-center justify-between border-t border-white/[0.06] px-6 py-4 text-sm text-slate-500">
                        <span>
                            Showing {(data.currentPage - 1) * data.itemsPerPage + 1}–{Math.min(
                                data.currentPage * data.itemsPerPage,
                                data.totalCount,
                            )} of {data.totalCount} events
                        </span>
                        <div class="flex gap-2">
                            {#if data.currentPage > 1}
                                <a
                                    href="/funding?page={data.currentPage - 1}&sortBy={sortBy}&sortOrder={sortOrder}&source={source}"
                                    class="btn-secondary text-xs"
                                >← Prev</a>
                            {/if}
                            {#if data.currentPage * data.itemsPerPage < data.totalCount}
                                <a
                                    href="/funding?page={data.currentPage + 1}&sortBy={sortBy}&sortOrder={sortOrder}&source={source}"
                                    class="btn-primary text-xs"
                                >Next →</a>
                            {/if}
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</div>
