/**
 * LinkedIn scraping via Apify actors.
 *
 * Tries multiple LinkedIn scraper actors in order of preference:
 *   1. `dev_fusion/linkedin-posts-scraper` — free, returns post data with likes
 *   2. `anchor/linkedin-scraper` — free alternative
 *   3. `apify/google-search-scraper` with `site:linkedin.com` — fallback
 *
 * All results are filtered to exclude military/war/political content
 * and normalised to the `LinkedInPost` shape.
 */
import { runActor, flattenGoogleSearchResults } from '$lib/apify';
import type { GoogleSearchDatasetItem, GoogleOrganicResult } from '$lib/apify';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface LinkedInPost {
	postId: string;
	companyName: string;
	text: string;
	likes: number;
	comments: number;
	shares: number;
	videoUrl: string;
	timestamp: Date;
	platform: 'LinkedIn';
}

export interface LinkedInProfile {
	name: string;
	website: string | null;
	description: string | null;
}

/** Generic LinkedIn post shape — covers multiple actor output formats. */
interface LinkedInScraperResult {
	urn?: string;
	activityUrn?: string;
	postUrl?: string;
	url?: string;
	text?: string;
	commentary?: string;
	content?: string;
	author?: { name?: string; headline?: string; profileUrl?: string; url?: string };
	authorName?: string;
	authorProfile?: string;
	companyName?: string;
	numLikes?: number;
	likesCount?: number;
	likes?: number;
	totalReactionCount?: number;
	numComments?: number;
	commentsCount?: number;
	comments?: number;
	numShares?: number;
	sharesCount?: number;
	shares?: number;
	repostCount?: number;
	postedAt?: string;
	createdAt?: string;
	publishedAt?: string;
	postedDate?: string;
	postedDateTimestamp?: number;
	hasVideo?: boolean;
	mediaType?: string;
	type?: string;
	action?: string;
}

// ─── Content filter ─────────────────────────────────────────────────────────────

const EXCLUDED_KEYWORDS = [
	'military', 'missile', 'rocket launch', 'nasa', 'spacex',
	'defense', 'weapon', 'army', 'navy', 'combat', 'warfare',
	'soldier', 'troops', 'pentagon', 'iran', 'war ', 'warzone',
	'air force', 'nuclear', 'sanctions', 'invasion', 'bombing',
	'nfl', 'nba', 'fifa', 'election', 'congress', 'senate',
	'trump', 'biden', 'political'
];

function isExcludedContent(text: string): boolean {
	const lower = text.toLowerCase();
	return EXCLUDED_KEYWORDS.some((kw) => lower.includes(kw));
}

function isProductLaunch(text: string): boolean {
	if (isExcludedContent(text)) return false;
	const lower = text.toLowerCase();
	const launchKeywords = [
		'launch', 'launching', 'introducing', 'excited to announce',
		'proud to announce', 'now available', 'just shipped',
		'we built', 'now live', 'check out'
	];
	return launchKeywords.some((kw) => lower.includes(kw));
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function extractPostId(result: LinkedInScraperResult): string {
	if (result.urn) return result.urn;
	if (result.activityUrn) return result.activityUrn;
	if (result.postUrl || result.url) {
		const urlStr = result.postUrl || result.url || '';
		const match = urlStr.match(/activity[:\-](\d+)/i);
		if (match) return match[1];
		const slugMatch = urlStr.match(/\/posts\/([^/?]+)/i);
		if (slugMatch) return slugMatch[1];
	}
	return `li-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normaliseLinkedInPost(result: LinkedInScraperResult): LinkedInPost | null {
	const text = result.text || result.commentary || result.content || '';
	if (!text || !isProductLaunch(text)) return null;

	const postId = extractPostId(result);
	const companyName = result.companyName || result.author?.name || result.authorName || 'Unknown';
	const likes = result.numLikes ?? result.likesCount ?? result.likes ?? result.totalReactionCount ?? 0;
	const comments = result.numComments ?? result.commentsCount ?? result.comments ?? 0;
	const shares = result.numShares ?? result.sharesCount ?? result.shares ?? result.repostCount ?? 0;
	const videoUrl = result.postUrl || result.url || `https://www.linkedin.com/feed/update/${postId}`;

	let timestamp: Date;
	if (result.postedDateTimestamp) {
		timestamp = new Date(result.postedDateTimestamp);
	} else if (result.postedAt) {
		timestamp = new Date(result.postedAt);
	} else if (result.createdAt) {
		timestamp = new Date(result.createdAt);
	} else if (result.publishedAt) {
		timestamp = new Date(result.publishedAt);
	} else if (result.postedDate) {
		timestamp = new Date(result.postedDate);
	} else {
		timestamp = new Date();
	}

	return { postId, companyName, text, likes, comments, shares, videoUrl, timestamp, platform: 'LinkedIn' };
}

// ─── Google Search fallback helpers ─────────────────────────────────────────────

function extractPostIdFromUrl(url: string): string {
	const urnMatch = url.match(/activity[:\-](\d+)/i);
	if (urnMatch) return urnMatch[1];
	const slugMatch = url.match(/\/posts\/([^/?]+)/i);
	if (slugMatch) return slugMatch[1];
	return url;
}

function extractCompanyNameFromTitle(title: string): string {
	const onLinkedIn = title.match(/^(.+?)\s+on\s+LinkedIn\s*:/i);
	if (onLinkedIn) return onLinkedIn[1].trim();
	const pipeLinkedIn = title.match(/^(.+?)\s*\|\s*LinkedIn/i);
	if (pipeLinkedIn) return pipeLinkedIn[1].trim();
	return title.slice(0, 40).trim() || 'Unknown';
}

function estimateLikes(text: string): number {
	// Try to find reaction counts like "58 reactions" or "1.2K likes"
	const reactMatch = text.match(/([\d,.]+)\s*[Kk]?\s*(?:reactions?|likes?|❤)/i);
	if (reactMatch) {
		let num = parseFloat(reactMatch[1].replace(/,/g, ''));
		if (/k/i.test(reactMatch[0])) num *= 1_000;
		return Math.round(num);
	}
	// Try standalone numbers near engagement indicators
	const numMatch = text.match(/(\d+)\s*·\s*\d+\s*comment/i);
	if (numMatch) return parseInt(numMatch[1], 10);
	return 0;
}

// ─── Actor configurations (tried in order) ──────────────────────────────────────

const LINKEDIN_ACTORS = [
	{
		// 3.8M runs, "No cookies, $1 per 1k" — rent at https://console.apify.com/actors/supreme_coder~linkedin-post
		id: 'supreme_coder/linkedin-post',
		buildInput: (query: string, limit: number) => ({
			keyword: query,
			maxResults: limit
		})
	},
	{
		// No cookies variant
		id: 'harvestapi/linkedin-post-search',
		buildInput: (query: string, limit: number) => ({
			keyword: query,
			deepScrape: false,
			maxResults: limit
		})
	},
	{
		// 5.1M runs — rent at https://console.apify.com/actors/curious_coder~linkedin-post-search-scraper
		id: 'curious_coder/linkedin-post-search-scraper',
		buildInput: (query: string, limit: number) => ({
			searchUrl: `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}&origin=GLOBAL_SEARCH_HEADER`,
			maxResults: limit,
			deepScrape: false
		})
	}
];

// ─── Public API ─────────────────────────────────────────────────────────────────

export async function searchLinkedInPosts(
	query: string = 'launch',
	limit: number = 50,
	pageToken?: string
): Promise<{ posts: LinkedInPost[]; nextToken: string | null }> {
	const searchQuery = query === 'launch'
		? 'launching OR "just launched" OR "we shipped" OR introducing startup SaaS AI'
		: query;

	// Try each LinkedIn actor in order
	for (const actor of LINKEDIN_ACTORS) {
		try {
			let offset = 0;
			if (pageToken?.startsWith('offset:')) {
				offset = parseInt(pageToken.slice(7), 10) || 0;
			}

			const { items } = await runActor<LinkedInScraperResult>(
				actor.id,
				actor.buildInput(searchQuery, limit + offset),
				{ timeoutSecs: 300, memoryMbytes: 4096, maxItems: limit + offset }
			);

			// Log first item's keys to help debug field mapping
			if (items.length > 0) {
				console.log(`LinkedIn actor ${actor.id} returned ${items.length} items. Sample keys:`, Object.keys(items[0]));
				console.log('Sample item (first 500 chars):', JSON.stringify(items[0]).slice(0, 500));
			}

			const sliced = items.slice(offset, offset + limit);
			const posts: LinkedInPost[] = sliced
				.map(normaliseLinkedInPost)
				.filter((p: LinkedInPost | null): p is LinkedInPost => p !== null)
				.slice(0, limit);

			const hasMore = posts.length >= Math.floor(limit * 0.5);
			return { posts, nextToken: hasMore ? `offset:${offset + limit}` : null };
		} catch (error) {
			console.warn(`LinkedIn actor ${actor.id} failed:`, error);
			continue; // Try next actor
		}
	}

	// All LinkedIn actors failed — fall back to Google Search
	console.warn('All LinkedIn actors failed, falling back to Google Search');
	return await searchWithGoogleFallback(query, limit, pageToken);
}

async function searchWithGoogleFallback(
	query: string,
	limit: number,
	pageToken?: string
): Promise<{ posts: LinkedInPost[]; nextToken: string | null }> {
	try {
		const defaultQueries = [
			'site:linkedin.com/posts "just launched" OR "we shipped" OR "now live" AI OR SaaS OR startup',
			'site:linkedin.com/posts "we built" OR introducing OR "proud to announce" startup OR SaaS'
		];
		const queries = query === 'launch' ? defaultQueries : [`site:linkedin.com ${query}`];

		let currentPage = 1;
		if (pageToken?.startsWith('page:')) {
			currentPage = parseInt(pageToken.slice(5), 10) || 1;
		}

		const pagesPerQuery = Math.min(2, Math.max(1, Math.ceil(limit / 20)));

		const { items: rawItems } = await runActor<GoogleSearchDatasetItem>(
			'apify/google-search-scraper',
			{
				queries: queries.join('\n'),
				maxPagesPerQuery: pagesPerQuery,
				resultsPerPage: 10,
				startPage: currentPage,
				languageCode: 'en',
				countryCode: 'us'
			},
			{ timeoutSecs: 300, memoryMbytes: 4096, maxItems: limit * 3 }
		);

		const flatResults = flattenGoogleSearchResults(rawItems);

		const posts: LinkedInPost[] = flatResults
			.filter((item: GoogleOrganicResult) => {
				const url = item.url ?? '';
				const isPost = /linkedin\.com\/posts\//i.test(url) || /linkedin\.com\/feed\/update\//i.test(url);
				if (!isPost) return false;
				return isProductLaunch(`${item.title ?? ''} ${item.description ?? ''}`);
			})
			.map((item: GoogleOrganicResult) => ({
				postId: extractPostIdFromUrl(item.url),
				companyName: extractCompanyNameFromTitle(item.title ?? ''),
				text: item.description ?? item.title ?? '',
				likes: estimateLikes(`${item.title ?? ''} ${item.description ?? ''}`),
				comments: 0,
				shares: 0,
				videoUrl: item.url,
				timestamp: item.date ? new Date(item.date) : new Date(),
				platform: 'LinkedIn' as const
			}))
			.slice(0, limit);

		const hasMore = posts.length >= Math.floor(limit * 0.5);
		return { posts, nextToken: hasMore ? `page:${currentPage + pagesPerQuery}` : null };
	} catch (error) {
		console.error('Error fetching LinkedIn posts via Google Search:', error);
		return { posts: [], nextToken: null };
	}
}

export async function getLinkedInProfile(profileId: string): Promise<LinkedInProfile | null> {
	try {
		const { items: rawItems } = await runActor<GoogleSearchDatasetItem>(
			'apify/google-search-scraper',
			{
				queries: `site:linkedin.com/company/${profileId}`,
				maxPagesPerQuery: 1,
				resultsPerPage: 5,
				languageCode: 'en',
				countryCode: 'us'
			},
			{ timeoutSecs: 120, memoryMbytes: 4096, maxItems: 5 }
		);

		const flatResults = flattenGoogleSearchResults(rawItems, false);

		const companyResult = flatResults.find((item: GoogleOrganicResult) =>
			/linkedin\.com\/company\//i.test(item.url ?? '')
		);
		if (!companyResult) return null;

		const name = companyResult.title?.replace(/\s*\|\s*LinkedIn.*$/i, '').trim() || profileId;
		return { name, website: null, description: companyResult.description || null };
	} catch (error) {
		console.error('Error fetching LinkedIn profile via Apify:', error);
		return null;
	}
}
