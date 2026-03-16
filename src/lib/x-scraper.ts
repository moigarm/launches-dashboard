/**
 * X (Twitter) scraping via Apify actors.
 *
 * Tries multiple Twitter/X scraper actors in order of preference:
 *   1. `microworlds/twitter-scraper` — free, active, returns tweet data
 *   2. `apidojo/tweet-scraper` — free alternative
 *   3. `apify/google-search-scraper` with `site:x.com` — fallback
 *
 * All results are filtered to exclude military/war/political content
 * and normalised to the `LaunchPost` shape.
 */
import { runActor, flattenGoogleSearchResults } from '$lib/apify';
import type { GoogleSearchDatasetItem, GoogleOrganicResult } from '$lib/apify';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface LaunchPost {
	postId: string;
	companyName: string;
	username: string;
	text: string;
	likes: number;
	retweets: number;
	replies: number;
	videoUrl: string;
	timestamp: Date;
	platform: 'X';
}

/** Generic tweet shape — covers multiple actor output formats. */
interface TweetResult {
	id?: string;
	id_str?: string;
	full_text?: string;
	text?: string;
	tweet_text?: string;
	user?: { name?: string; screen_name?: string };
	author?: { name?: string; userName?: string; screen_name?: string };
	user_name?: string;
	user_screen_name?: string;
	screen_name?: string;
	name?: string;
	favorite_count?: number;
	retweet_count?: number;
	reply_count?: number;
	likes?: number;
	retweets?: number;
	replies?: number;
	created_at?: string;
	createdAt?: string;
	date?: string;
	url?: string;
	tweetUrl?: string;
	tweet_url?: string;
	entities?: {
		media?: Array<{ type?: string; video_info?: { variants?: Array<{ url?: string; bitrate?: number }> } }>;
		user_mentions?: Array<{ screen_name?: string; name?: string }>;
	};
	extendedEntities?: {
		media?: Array<{ type?: string; video_info?: { variants?: Array<{ url?: string; bitrate?: number }> } }>;
	};
	hasVideo?: boolean;
	isRetweet?: boolean;
	is_retweet?: boolean;
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

/**
 * Returns true if the text contains military, war, political, or sports content.
 */
function isExcludedContent(text: string): boolean {
	const lower = text.toLowerCase();
	return EXCLUDED_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function extractCompanyFromTweet(
	text: string,
	authorName: string,
	authorUsername: string,
	mentions?: Array<{ screen_name?: string; name?: string }>
): { companyName: string; companyUsername: string } {
	const fallback = { companyName: authorName || authorUsername, companyUsername: authorUsername };

	const companyMention = mentions?.find(
		(m) => m.screen_name?.toLowerCase() !== authorUsername.toLowerCase()
	);

	const introMatch = text.match(
		/(?:introducing|launching|announcing|presenting)\s+([A-Z][\w\s.!-]{1,25}?)(?:[,.]|\s+the\s|\s+is\s|\s+v\d)/i
	);
	const withMatch = text.match(/^With\s+([A-Z][\w.]+)/m);
	const extractedName = introMatch?.[1]?.trim() || withMatch?.[1]?.trim() || null;

	if (companyMention) {
		return {
			companyName: companyMention.name || extractedName || authorName,
			companyUsername: companyMention.screen_name || authorUsername
		};
	}

	if (extractedName) {
		return { companyName: extractedName, companyUsername: authorUsername };
	}

	return fallback;
}

function normaliseTweet(tweet: TweetResult): LaunchPost | null {
	const id = tweet.id_str || tweet.id?.toString() || '';
	if (!id) return null;

	const text = tweet.full_text || tweet.text || tweet.tweet_text || '';

	// Filter out excluded content
	if (isExcludedContent(text)) return null;

	const authorName = tweet.user?.name || tweet.author?.name || tweet.name || tweet.user_name || 'Unknown';
	const authorUsername =
		tweet.user?.screen_name || tweet.author?.userName || tweet.author?.screen_name ||
		tweet.user_screen_name || tweet.screen_name || 'unknown';

	const mentions = tweet.entities?.user_mentions;
	const { companyName, companyUsername } = extractCompanyFromTweet(
		text, authorName, authorUsername, mentions
	);

	// Get video URL
	let videoUrl = tweet.tweetUrl || tweet.tweet_url || tweet.url || `https://x.com/${companyUsername}/status/${id}`;
	const videoMedia =
		tweet.extendedEntities?.media?.find((m) => m.type === 'video') ||
		tweet.entities?.media?.find((m) => m.type === 'video');
	if (videoMedia?.video_info?.variants) {
		const mp4s = videoMedia.video_info.variants
			.filter((v) => v.url?.includes('.mp4'))
			.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
		if (mp4s[0]?.url) videoUrl = mp4s[0].url;
	}

	const likes = tweet.favorite_count ?? tweet.likes ?? 0;
	const retweets = tweet.retweet_count ?? tweet.retweets ?? 0;
	const replies = tweet.reply_count ?? tweet.replies ?? 0;

	const timestamp = tweet.created_at ? new Date(tweet.created_at)
		: tweet.createdAt ? new Date(tweet.createdAt)
		: tweet.date ? new Date(tweet.date) : new Date();

	return {
		postId: id, companyName, username: companyUsername, text,
		likes, retweets, replies, videoUrl, timestamp, platform: 'X'
	};
}

// ─── Google Search fallback helpers ─────────────────────────────────────────────

function extractPostId(url: string): string | null {
	const match = url.match(/(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i);
	return match?.[1] ?? null;
}

function extractUsername(url: string): string {
	const match = url.match(/(?:x\.com|twitter\.com)\/([^/?\s]+)/i);
	return match?.[1] ?? 'unknown';
}

function extractCompanyNameFromTitle(title: string, username: string): string {
	const onXMatch = title.match(/^(.+?)\s+on\s+X\s*:/i);
	if (onXMatch) return onXMatch[1].trim();
	const handleMatch = title.match(/^(.+?)\s+\(@/i);
	if (handleMatch) return handleMatch[1].trim();
	return username.charAt(0).toUpperCase() + username.slice(1);
}

function estimateLikes(text: string): number {
	const match = text.match(/([\d,.]+)\s*[Kk]?\s*(?:likes?|❤)/i);
	if (!match) return 0;
	let num = parseFloat(match[1].replace(/,/g, ''));
	if (/k/i.test(match[0])) num *= 1_000;
	return Math.round(num);
}

// ─── Actor configurations (tried in order) ──────────────────────────────────────

const TWITTER_ACTORS = [
	{
		// 132M+ runs, most popular X scraper on Apify
		id: 'apidojo/tweet-scraper',
		buildInput: (query: string, limit: number) => ({
			startUrls: [`https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`],
			maxItems: limit,
			sort: 'Latest'
		})
	}
];

const LAUNCH_SEARCH_QUERY =
	'("just launched" OR "we shipped" OR "now live" OR "introducing" OR "we built" OR "excited to share") (AI OR SaaS OR startup OR "product hunt" OR API OR SDK) -is:retweet lang:en';

// ─── Public API ─────────────────────────────────────────────────────────────────

export async function searchLaunchPosts(
	query?: string,
	limit: number = 50,
	nextToken?: string,
	startTime?: string
): Promise<{ posts: LaunchPost[]; nextToken: string | null }> {
	const searchQuery = query || LAUNCH_SEARCH_QUERY;

	// Try each Twitter actor in order
	for (const actor of TWITTER_ACTORS) {
		try {
			let offset = 0;
			if (nextToken?.startsWith('offset:')) {
				offset = parseInt(nextToken.slice(7), 10) || 0;
			}

			const { items } = await runActor<TweetResult>(
				actor.id,
				actor.buildInput(searchQuery, limit + offset),
				{ timeoutSecs: 300, memoryMbytes: 4096, maxItems: limit + offset }
			);

			const sliced = items.slice(offset, offset + limit);

			const posts: LaunchPost[] = sliced
				.filter((tweet) => !tweet.isRetweet && !tweet.is_retweet)
				.map(normaliseTweet)
				.filter((p): p is LaunchPost => p !== null)
				.slice(0, limit);

			const hasMore = posts.length >= Math.floor(limit * 0.5);
			return { posts, nextToken: hasMore ? `offset:${offset + limit}` : null };
		} catch (error) {
			console.warn(`Twitter actor ${actor.id} failed:`, error);
			continue; // Try next actor
		}
	}

	// All Twitter actors failed — fall back to Google Search
	console.warn('All Twitter actors failed, falling back to Google Search');
	return await searchWithGoogleFallback(query, limit, nextToken, startTime);
}

async function searchWithGoogleFallback(
	query?: string,
	limit: number = 50,
	nextToken?: string,
	startTime?: string
): Promise<{ posts: LaunchPost[]; nextToken: string | null }> {
	try {
		const defaultQueries = [
			'site:x.com "just launched" OR "we shipped" OR "now live" AI OR SaaS OR startup',
			'site:x.com "we built" OR introducing startup OR SaaS OR "open source"'
		];
		const queries = query ? [`site:x.com ${query}`] : defaultQueries;

		let currentPage = 1;
		if (nextToken?.startsWith('page:')) {
			currentPage = parseInt(nextToken.slice(5), 10) || 1;
		}

		const pagesPerQuery = Math.min(2, Math.max(1, Math.ceil(limit / 20)));
		const dateFilter = startTime ? ` after:${startTime.slice(0, 10)}` : '';

		const { items: rawItems } = await runActor<GoogleSearchDatasetItem>(
			'apify/google-search-scraper',
			{
				queries: queries.map((q) => `${q}${dateFilter}`).join('\n'),
				maxPagesPerQuery: pagesPerQuery,
				resultsPerPage: 10,
				startPage: currentPage,
				languageCode: 'en',
				countryCode: 'us'
			},
			{ timeoutSecs: 300, memoryMbytes: 4096, maxItems: limit * 3 }
		);

		const flatResults = flattenGoogleSearchResults(rawItems);

		const posts: LaunchPost[] = flatResults
			.filter((item: GoogleOrganicResult) => {
				if (!/(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/i.test(item.url ?? '')) return false;
				// Filter out excluded content
				const text = `${item.title ?? ''} ${item.description ?? ''}`;
				return !isExcludedContent(text);
			})
			.map((item: GoogleOrganicResult) => {
				const postId = extractPostId(item.url) ?? item.url;
				const username = extractUsername(item.url);
				const companyName = extractCompanyNameFromTitle(item.title ?? '', username);
				const text = item.description ?? item.title ?? '';

				return {
					postId,
					companyName,
					username,
					text,
					likes: estimateLikes(text),
					retweets: 0,
					replies: 0,
					videoUrl: item.url,
					timestamp: item.date ? new Date(item.date) : new Date(),
					platform: 'X' as const
				};
			})
			.slice(0, limit);

		const hasMore = posts.length >= Math.floor(limit * 0.5);
		const nextPage = hasMore ? `page:${currentPage + pagesPerQuery}` : null;

		return { posts, nextToken: nextPage };
	} catch (error) {
		console.error('Error fetching X posts via Google Search fallback:', error);
		return { posts: [], nextToken: null };
	}
}

export async function getPostMetrics(
	_postId: string
): Promise<{ likes: number; retweets: number; replies: number }> {
	return { likes: 0, retweets: 0, replies: 0 };
}
