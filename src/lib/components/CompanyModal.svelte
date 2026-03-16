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

	function formatAmount(n: number): string {
		if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
		if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
		return `$${n.toLocaleString()}`;
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
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
		onclick={handleBackdropClick}
		role="presentation"
	></div>

	<!-- Slide-over panel -->
	<div
		class="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-[#0f1629]/95 shadow-2xl shadow-indigo-500/5 backdrop-blur-xl border-l border-white/[0.06] transform transition-transform duration-300"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<!-- Header -->
		<div class="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-5">
			<div>
				<h2 id="modal-title" class="text-xl font-bold text-white">{company.name}</h2>
				{#if company.domain}
					<p class="mt-0.5 text-sm text-slate-500">{company.domain}</p>
				{/if}
			</div>
			<button
				onclick={onclose}
				class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
				aria-label="Close panel"
			>
				<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</div>

		<!-- Scrollable body -->
		<div class="flex-1 space-y-8 overflow-y-auto px-6 py-6">
			<!-- Stats grid -->
			<div class="grid grid-cols-2 gap-4">
				<div class="stat-card p-4 text-center">
					<p class="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">
						Total Raised
					</p>
					<p class="mt-1 text-xl font-extrabold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
						{formatAmount(company.totalRaised)}
					</p>
				</div>
				<div class="stat-card p-4 text-center">
					<p class="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">
						X Likes
					</p>
					<p class="mt-1 text-xl font-extrabold text-cyan-400">
						{xLikes.toLocaleString()}
					</p>
				</div>
				<div class="stat-card p-4 text-center">
					<p class="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">
						LinkedIn Likes
					</p>
					<p class="mt-1 text-xl font-extrabold text-blue-400">
						{linkedInLikes.toLocaleString()}
					</p>
				</div>
				<div class="stat-card p-4 text-center">
					<p class="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">
						Launches
					</p>
					<p class="mt-1 text-xl font-extrabold text-emerald-400">
						{company.launches.length}
					</p>
				</div>
			</div>

			<!-- Launches -->
			<div>
				<h3 class="label-dark mb-3">Launches</h3>
				<div class="space-y-3">
					{#each company.launches as launch}
						<div
							class="glass-card flex items-start justify-between p-4"
						>
							<div>
								<span
									class="badge {launch.platform === 'X'
										? 'badge-cyan'
										: 'badge-blue'}"
								>
									{launch.platform}
								</span>
								<p class="mt-2 text-sm text-slate-400">
									❤️ {launch.likes.toLocaleString()} likes ·
									{new Date(launch.timestamp).toLocaleDateString()}
								</p>
							</div>
							{#if launch.videoUrl}
								<a
									href={launch.videoUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="link-accent ml-4 shrink-0 text-sm"
								>
									View Post →
								</a>
							{/if}
						</div>
					{:else}
						<p class="text-sm italic text-slate-600">No launches found</p>
					{/each}
				</div>
			</div>

			<!-- Funding -->
			<div>
				<h3 class="label-dark mb-3">Funding History</h3>
				<div class="space-y-3">
					{#each company.funding as funding}
						<div
							class="glass-card flex items-center justify-between p-4"
						>
							<div>
								<p class="text-sm font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
									{formatAmount(funding.amount)}
								</p>
								<p class="text-xs text-slate-500">{funding.source}</p>
							</div>
							<p class="text-sm text-slate-500">
								{new Date(funding.date).toLocaleDateString()}
							</p>
						</div>
					{:else}
						<p class="text-sm italic text-slate-600">
							No funding information available
						</p>
					{/each}
				</div>
			</div>

			<!-- Contacts -->
			<div>
				<h3 class="label-dark mb-3">Contacts</h3>
				{#if company.contacts.length > 0}
					<div class="space-y-3">
						{#each company.contacts as contact}
							<div class="glass-card space-y-2 p-4 text-sm">
								{#if contact.email}
									<div class="flex items-center gap-2">
										<span>📧</span>
										<a
											href="mailto:{contact.email}"
											class="link-accent"
										>
											{contact.email}
										</a>
									</div>
								{/if}
								{#if contact.phone}
									<div class="flex items-center gap-2">
										<span>📞</span>
										<span class="text-slate-300">{contact.phone}</span>
									</div>
								{/if}
								{#if contact.linkedin}
									<div class="flex items-center gap-2">
										<span>💼</span>
										<a
											href={contact.linkedin}
											target="_blank"
											rel="noopener noreferrer"
											class="link-accent"
										>
											LinkedIn Profile
										</a>
									</div>
								{/if}
								{#if contact.xHandle}
									<div class="flex items-center gap-2">
										<span>🐦</span>
										<a
											href="https://x.com/{contact.xHandle}"
											target="_blank"
											rel="noopener noreferrer"
											class="link-accent"
										>
											@{contact.xHandle}
										</a>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm italic text-slate-600">
						No contact information available
					</p>
				{/if}
			</div>
		</div>

		<!-- Footer -->
		<div class="shrink-0 border-t border-white/[0.06] px-6 py-4">
			<button onclick={onclose} class="btn-primary w-full"> Close </button>
		</div>
	</div>
{/if}
