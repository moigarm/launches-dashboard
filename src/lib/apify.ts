/**
 * Core Apify REST client.
 *
 * Every scraper module delegates to {@link runActor} which starts an Actor run,
 * waits for it to finish, and returns the dataset items.
 *
 * Requires `APIFY_TOKEN` in the environment (via `.env`).
 */
import { APIFY_TOKEN } from '$env/static/private';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ApifyRunOptions {
	/** Maximum run duration in seconds (default 120). */
	timeoutSecs?: number;
	/** Memory allocated to the Actor in MB (default 256). */
	memoryMbytes?: number;
	/** Cap the number of dataset items returned (default unlimited). */
	maxItems?: number;
	/** Polling interval in ms while waiting for the run to finish (default 3 000). */
	pollIntervalMs?: number;
}

export interface ApifyRunResult<T = Record<string, unknown>> {
	items: T[];
	runId: string;
	status: string;
	datasetId: string;
}

interface ActorRunResponse {
	data: {
		id: string;
		status: string;
		defaultDatasetId: string;
	};
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.apify.com/v2';
const DEFAULT_TIMEOUT_SECS = 300;
const DEFAULT_MEMORY_MBYTES = 4096;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED']);

// ─── Helpers ────────────────────────────────────────────────────────────────────

function authHeaders(): HeadersInit {
	return {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${APIFY_TOKEN}`
	};
}

async function apifyFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const url = `${BASE_URL}${path}`;
	const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...init?.headers } });

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`Apify API ${res.status}: ${body}`);
	}

	return res.json() as Promise<T>;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Run an Apify Actor synchronously (start → poll → fetch dataset).
 *
 * @param actorId  e.g. `"vdrmota/contact-info-scraper"`
 * @param input    Actor-specific input object
 * @param options  Timeout, memory, max items, poll interval
 * @returns        The dataset items typed as `T[]`
 */
export async function runActor<T = Record<string, unknown>>(
	actorId: string,
	input: Record<string, unknown>,
	options: ApifyRunOptions = {}
): Promise<ApifyRunResult<T>> {
	if (!APIFY_TOKEN) {
		throw new Error('APIFY_TOKEN is not configured. Add it to your .env file.');
	}

	const {
		timeoutSecs = DEFAULT_TIMEOUT_SECS,
		memoryMbytes = DEFAULT_MEMORY_MBYTES,
		maxItems,
		pollIntervalMs = DEFAULT_POLL_INTERVAL_MS
	} = options;

	// 1. Start the Actor run
	const encodedId = encodeURIComponent(actorId);
	const startPath = `/acts/${encodedId}/runs?timeout=${timeoutSecs}&memory=${memoryMbytes}`;

	const { data: run } = await apifyFetch<ActorRunResponse>(startPath, {
		method: 'POST',
		body: JSON.stringify(input)
	});

	// 2. Poll until terminal status
	let status = run.status;
	const runId = run.id;
	const datasetId = run.defaultDatasetId;

	while (!TERMINAL_STATUSES.has(status)) {
		await new Promise((r) => setTimeout(r, pollIntervalMs));
		const poll = await apifyFetch<ActorRunResponse>(`/actor-runs/${runId}`);
		status = poll.data.status;
	}

	if (status !== 'SUCCEEDED') {
		throw new Error(`Apify Actor ${actorId} run ${runId} ended with status: ${status}`);
	}

	// 3. Fetch dataset items
	let itemsPath = `/datasets/${datasetId}/items?format=json`;
	if (maxItems) {
		itemsPath += `&limit=${maxItems}`;
	}

	const items = await apifyFetch<T[]>(itemsPath);

	return { items, runId, status, datasetId };
}

// ─── Google Search Scraper helpers ──────────────────────────────────────────────

/** A single organic result from the Google Search Scraper. */
export interface GoogleOrganicResult {
	title: string;
	url: string;
	displayedUrl?: string;
	description: string;
	emphasizedKeywords?: string[];
	siteLinks?: unknown[];
	productInfo?: Record<string, unknown>;
	tweetCards?: unknown[];
	type?: string;
	position?: number;
	date?: string;
}

/** A source from the AI Overview section. */
export interface GoogleAIOverviewSource {
	url: string;
	title: string;
	description: string;
}

/** The AI Overview object returned by Google Search Scraper. */
export interface GoogleAIOverview {
	type?: string;
	content?: string;
	sources?: GoogleAIOverviewSource[];
}

/** A single dataset item from the Google Search Scraper (one per search query). */
export interface GoogleSearchDatasetItem {
	searchQuery?: Record<string, unknown>;
	resultsTotal?: number | null;
	relatedQueries?: unknown[];
	aiOverview?: GoogleAIOverview;
	paidResults?: unknown[];
	paidProducts?: unknown[];
	organicResults?: GoogleOrganicResult[];
	// Flat fallback fields (some actor versions return flat results)
	title?: string;
	url?: string;
	description?: string;
	date?: string;
}

/**
 * Flatten Google Search Scraper dataset items into organic results.
 *
 * The Google Search Scraper returns one dataset item per search query,
 * each containing nested `organicResults[]` and optionally `aiOverview.sources[]`.
 * This helper extracts all organic results and AI overview sources into a
 * single flat array of `GoogleOrganicResult`.
 *
 * @param items  Raw dataset items from `runActor<GoogleSearchDatasetItem>(...)`
 * @param includeAIOverview  Whether to include AI Overview sources (default true)
 */
export function flattenGoogleSearchResults(
	items: GoogleSearchDatasetItem[],
	includeAIOverview = true
): GoogleOrganicResult[] {
	const results: GoogleOrganicResult[] = [];

	for (const item of items) {
		// Extract organic results
		if (item.organicResults && Array.isArray(item.organicResults)) {
			results.push(...item.organicResults);
		}

		// Extract AI Overview sources as pseudo-organic results
		if (includeAIOverview && item.aiOverview?.sources) {
			for (const source of item.aiOverview.sources) {
				results.push({
					title: source.title,
					url: source.url,
					description: source.description,
					type: 'aiOverview'
				});
			}
		}

		// Handle flat fallback (some actor versions or configurations)
		if (!item.organicResults && item.url && item.title) {
			results.push({
				title: item.title,
				url: item.url,
				description: item.description || '',
				date: item.date
			});
		}
	}

	return results;
}

/**
 * Search the Apify Store for actors matching given keywords.
 * Useful for discovering actors at runtime.
 */
export async function searchActors(
	keywords: string,
	limit = 10
): Promise<Array<{ id: string; name: string; description: string }>> {
	if (!APIFY_TOKEN) {
		throw new Error('APIFY_TOKEN is not configured.');
	}

	const params = new URLSearchParams({
		search: keywords,
		limit: limit.toString(),
		sortBy: 'relevance'
	});

	interface StoreItem {
		username: string;
		name: string;
		title: string;
		description: string;
	}

	const res = await apifyFetch<{ data: { items: StoreItem[] } }>(
		`/store?${params.toString()}`
	);

	return (res.data?.items ?? []).map((a) => ({
		id: `${a.username}/${a.name}`,
		name: a.title,
		description: a.description
	}));
}
