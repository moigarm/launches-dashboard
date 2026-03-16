<script lang="ts">
	interface Props {
		currentPage: number;
		totalItems: number;
		itemsPerPage: number;
		onPageChange: (page: number) => void;
	}

	let { currentPage, totalItems, itemsPerPage, onPageChange }: Props = $props();

	const totalPages = $derived(Math.ceil(totalItems / itemsPerPage));
	const startItem = $derived((currentPage - 1) * itemsPerPage + 1);
	const endItem = $derived(Math.min(currentPage * itemsPerPage, totalItems));

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			onPageChange(page);
		}
	}
</script>

<div class="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 sm:px-6">
	<!-- Mobile -->
	<div class="flex flex-1 justify-between sm:hidden">
		<button
			onclick={() => goToPage(currentPage - 1)}
			disabled={currentPage === 1}
			class="btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
		>
			Previous
		</button>
		<button
			onclick={() => goToPage(currentPage + 1)}
			disabled={currentPage === totalPages}
			class="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
		>
			Next
		</button>
	</div>

	<!-- Desktop -->
	<div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
		<div>
			<p class="text-sm text-slate-500">
				Showing
				<span class="font-semibold text-slate-300">{startItem}</span>
				to
				<span class="font-semibold text-slate-300">{endItem}</span>
				of
				<span class="font-semibold text-slate-300">{totalItems}</span>
				results
			</p>
		</div>
		<div>
			<nav
				class="isolate inline-flex -space-x-px rounded-lg"
				aria-label="Pagination"
			>
				<!-- Prev -->
				<button
					onclick={() => goToPage(currentPage - 1)}
					disabled={currentPage === 1}
					class="relative inline-flex items-center rounded-l-lg border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
				>
					<span class="sr-only">Previous</span>
					<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>

				{#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
					{#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
						<button
							onclick={() => goToPage(page)}
							class="relative inline-flex items-center border px-4 py-2 text-sm font-semibold transition-all
								{page === currentPage
								? 'z-10 border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
								: 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-white'}"
						>
							{page}
						</button>
					{:else if page === currentPage - 2 || page === currentPage + 2}
						<span
							class="relative inline-flex items-center border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-600"
						>
							...
						</span>
					{/if}
				{/each}

				<!-- Next -->
				<button
					onclick={() => goToPage(currentPage + 1)}
					disabled={currentPage === totalPages}
					class="relative inline-flex items-center rounded-r-lg border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
				>
					<span class="sr-only">Next</span>
					<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</nav>
		</div>
	</div>
</div>
