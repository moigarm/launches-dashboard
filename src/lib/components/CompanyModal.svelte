<script lang="ts">
	interface Props {
		company: {
			id: number;
			name: string;
			domain: string | null;
			totalRaised: number;
			launches: Array<{
				id: number;
				platform: string;
				postId: string;
				videoUrl: string | null;
				likes: number;
				timestamp: Date;
			}>;
			funding: Array<{
				id: number;
				amount: number;
				source: string;
				date: Date;
			}>;
			contacts: Array<{
				id: number;
				email: string | null;
				phone: string | null;
				linkedin: string | null;
				xHandle: string | null;
			}>;
		};
		isOpen: boolean;
		onclose: () => void;
	}

	let { company, isOpen, onclose }: Props = $props();

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	const xLikes = $derived(
		company.launches.filter((l) => l.platform === 'X').reduce((sum, l) => sum + l.likes, 0)
	);

	const linkedInLikes = $derived(
		company.launches.filter((l) => l.platform === 'LinkedIn').reduce((sum, l) => sum + l.likes, 0)
	);
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
		onclick={handleBackdropClick}
		role="presentation"
	></div>

	<!-- Slide-over panel -->
	<div
		class="fixed inset-y-0 right-0 z-50 w-full max-w-xl flex flex-col bg-white shadow-2xl transform transition-transform duration-300"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white shrink-0">
			<div>
				<h2 id="modal-title" class="text-xl font-bold text-gray-900">{company.name}</h2>
				{#if company.domain}
					<p class="text-sm text-gray-500 mt-0.5">{company.domain}</p>
				{/if}
			</div>
			<button
				onclick={onclose}
				class="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
				aria-label="Close panel"
			>
				<svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
				</svg>
			</button>
		</div>

		<!-- Scrollable body -->
		<div class="flex-1 overflow-y-auto px-6 py-6 space-y-8">
			<!-- Stats -->
			<div class="grid grid-cols-2 gap-4">
				<div class="bg-indigo-50 rounded-xl p-4 text-center">
					<p class="text-xs font-medium text-indigo-500 uppercase tracking-wider">Total Raised</p>
					<p class="mt-1 text-xl font-bold text-indigo-900">${company.totalRaised.toLocaleString()}</p>
				</div>
				<div class="bg-sky-50 rounded-xl p-4 text-center">
					<p class="text-xs font-medium text-sky-500 uppercase tracking-wider">X Likes</p>
					<p class="mt-1 text-xl font-bold text-sky-900">{xLikes.toLocaleString()}</p>
				</div>
				<div class="bg-blue-50 rounded-xl p-4 text-center">
					<p class="text-xs font-medium text-blue-500 uppercase tracking-wider">LinkedIn Likes</p>
					<p class="mt-1 text-xl font-bold text-blue-900">{linkedInLikes.toLocaleString()}</p>
				</div>
				<div class="bg-green-50 rounded-xl p-4 text-center">
					<p class="text-xs font-medium text-green-500 uppercase tracking-wider">Launches</p>
					<p class="mt-1 text-xl font-bold text-green-900">{company.launches.length}</p>
				</div>
			</div>

			<!-- Launches -->
			<div>
				<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Launches</h3>
				<div class="space-y-3">
					{#each company.launches as launch}
						<div class="border border-gray-200 rounded-xl p-4 flex items-start justify-between">
							<div>
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
									{launch.platform}
								</span>
								<p class="mt-2 text-sm text-gray-600">
									❤️ {launch.likes.toLocaleString()} likes · {new Date(launch.timestamp).toLocaleDateString()}
								</p>
							</div>
							{#if launch.videoUrl}
								<a
									href={launch.videoUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="ml-4 shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-800"
								>
									View Post →
								</a>
							{/if}
						</div>
					{:else}
						<p class="text-sm text-gray-400 italic">No launches found</p>
					{/each}
				</div>
			</div>

			<!-- Funding -->
			<div>
				<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Funding History</h3>
				<div class="space-y-3">
					{#each company.funding as funding}
						<div class="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
							<div>
								<p class="text-sm font-semibold text-gray-900">${funding.amount.toLocaleString()}</p>
								<p class="text-xs text-gray-500">{funding.source}</p>
							</div>
							<p class="text-sm text-gray-500">{new Date(funding.date).toLocaleDateString()}</p>
						</div>
					{:else}
						<p class="text-sm text-gray-400 italic">No funding information available</p>
					{/each}
				</div>
			</div>

			<!-- Contacts -->
			<div>
				<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Contacts</h3>
				{#if company.contacts.length > 0}
					<div class="space-y-3">
						{#each company.contacts as contact}
							<div class="border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
								{#if contact.email}
									<div class="flex items-center gap-2">
										<span>📧</span>
										<a href="mailto:{contact.email}" class="text-indigo-600 hover:text-indigo-800">
											{contact.email}
										</a>
									</div>
								{/if}
								{#if contact.phone}
									<div class="flex items-center gap-2">
										<span>📞</span>
										<span class="text-gray-900">{contact.phone}</span>
									</div>
								{/if}
								{#if contact.linkedin}
									<div class="flex items-center gap-2">
										<span>💼</span>
										<a href={contact.linkedin} target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800">
											LinkedIn Profile
										</a>
									</div>
								{/if}
								{#if contact.xHandle}
									<div class="flex items-center gap-2">
										<span>🐦</span>
										<a href="https://x.com/{contact.xHandle}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800">
											@{contact.xHandle}
										</a>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-gray-400 italic">No contact information available</p>
				{/if}
			</div>
		</div>

		<!-- Footer -->
		<div class="shrink-0 border-t border-gray-200 px-6 py-4 bg-gray-50">
			<button
				onclick={onclose}
				class="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
			>
				Close
			</button>
		</div>
	</div>
{/if}
