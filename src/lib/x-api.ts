// X (Twitter) API integration
import { X_BEARER_TOKEN } from '$env/static/private';

interface XPost {
	id: string;
	text: string;
	author_id: string;
	created_at: string;
	public_metrics: {
		like_count: number;
		retweet_count: number;
		reply_count: number;
	};
	attachments?: {
		media_keys: string[];
	};
	entities?: {
		mentions?: Array<{ username: string; id: string; name: string }>;
	};
}

interface XUser {
	id: string;
	name: string;
	username: string;
}

interface XMedia {
	media_key: string;
	type: string;
	url?: string;
}

// Highly targeted query for SaaS/AI/startup product launches only.
// Requires BOTH a launch keyword AND a tech/product keyword.
// Aggressively excludes military, sports, space, political, and rocket launches.
const LAUNCH_QUERY = [
	// Must have a launch/announce keyword
	'(introducing OR "we built" OR "now live" OR "just launched" OR "we launched" OR "excited to share" OR "we\'re live" OR "check out our" OR "we shipped")',
	// Must have a SaaS/AI/tech product context
	'(AI OR "machine learning" OR SaaS OR startup OR "product hunt" OR "YC" OR YCombinator OR "open source" OR API OR SDK OR app OR dashboard)',
	// Exclude noise
	'-military -missile -rocket -NASA -SpaceX -defense -weapon -army -navy -combat -warfare -soldier -troops -pentagon -sports -NFL -NBA -FIFA -election -Congress -Senate',
	// Engagement filter and video
	'has:videos -is:retweet lang:en'
].join(' ');

// Detect the real company from a tweet — often the author is an advocate/founder
// tagging the company account, not the company itself posting.
function extractCompanyFromPost(
	text: string,
	author: XUser | undefined,
	mentionedUsers: XUser[]
): { companyName: string; companyUsername: string } {
	const fallback = {
		companyName: author?.name || 'Unknown',
		companyUsername: author?.username || ''
	};

	// First non-author @mention is most likely the company being announced
	const companyMention = mentionedUsers.find((u) => u.username !== author?.username);

	// Extract company name from text patterns:
	// "we're introducing Spectre I" / "introducing Deveillance" / "With Acme,"
	const introMatch = text.match(
		/(?:introducing|launching|announcing|presenting)\s+([A-Z][\w\s.!-]{1,25}?)(?:[,.]|\s+the\s|\s+is\s|\s+v\d)/i
	);
	const withMatch = text.match(/^With\s+([A-Z][\w.]+)/m);
	const extractedName = introMatch?.[1]?.trim() || withMatch?.[1]?.trim() || null;

	if (companyMention) {
		// Prefer the @mention's display name; fall back to text-extracted name
		return {
			companyName: companyMention.name || extractedName || author?.name || 'Unknown',
			companyUsername: companyMention.username
		};
	}

	if (extractedName) {
		return { companyName: extractedName, companyUsername: author?.username || '' };
	}

	return fallback;
}

export async function searchLaunchPosts(
	query: string = LAUNCH_QUERY,
	limit: number = 50,
	nextToken?: string,
	startTime?: string // ISO 8601, e.g. 2025-02-01T00:00:00Z
) {
	if (!X_BEARER_TOKEN) {
		console.warn('X_BEARER_TOKEN not configured');
		return { posts: [], nextToken: null };
	}

	try {
		const url = new URL('https://api.twitter.com/2/tweets/search/recent');
		url.searchParams.append('query', query);
		url.searchParams.append('max_results', Math.min(limit, 100).toString());
		url.searchParams.append('tweet.fields', 'created_at,public_metrics,author_id,attachments,entities');
		url.searchParams.append('expansions', 'author_id,attachments.media_keys,entities.mentions.username');
		url.searchParams.append('media.fields', 'url,type');
		url.searchParams.append('user.fields', 'name,username,description,url');

		if (nextToken) {
			url.searchParams.append('next_token', nextToken);
		}

		// Only fetch posts from the last 30 days by default (X free tier allows 7 days)
		if (startTime) {
			url.searchParams.append('start_time', startTime);
		}

		const response = await fetch(url.toString(), {
			headers: {
				Authorization: `Bearer ${X_BEARER_TOKEN}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('X API error:', response.status, error);
			return { posts: [], nextToken: null };
		}

		const data = await response.json();

		const posts = data.data || [];
		const users: XUser[] = data.includes?.users || [];
		const media: XMedia[] = data.includes?.media || [];

		const results = posts.map((post: XPost) => {
			const author = users.find((u) => u.id === post.author_id);
			const postMedia = post.attachments?.media_keys
				?.map((key) => media.find((m) => m.media_key === key))
				.filter((m): m is XMedia => m?.type === 'video');

			// Extract @mentions from the tweet (already expanded into users list)
			const mentionedUsernames: string[] = (
				post.entities?.mentions?.map((m: { username: string }) => m.username) || []
			);
			const mentionedUsers = mentionedUsernames
				.map((u) => users.find((user) => user.username.toLowerCase() === u.toLowerCase()))
				.filter(Boolean) as XUser[];

			// Try to detect the real company from tweet text
			const { companyName, companyUsername } = extractCompanyFromPost(
				post.text,
				author,
				mentionedUsers
			);

			return {
				postId: post.id,
				companyName,
				username: companyUsername,
				text: post.text,
				likes: post.public_metrics.like_count,
				retweets: post.public_metrics.retweet_count,
				replies: post.public_metrics.reply_count,
				videoUrl:
					postMedia?.[0]?.url ||
					`https://twitter.com/${companyUsername}/status/${post.id}`,
				timestamp: new Date(post.created_at),
				platform: 'X'
			};
		});

		return {
			posts: results,
			nextToken: data.meta?.next_token || null
		};
	} catch (error) {
		console.error('Error fetching X posts:', error);
		return { posts: [], nextToken: null };
	}
}

export async function getPostMetrics(postId: string) {
	if (!X_BEARER_TOKEN) {
		console.warn('X_BEARER_TOKEN not configured');
		return { likes: 0, retweets: 0, replies: 0 };
	}

	try {
		const url = `https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`;

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${X_BEARER_TOKEN}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			console.error('X API error:', response.status);
			return { likes: 0, retweets: 0, replies: 0 };
		}

		const data = await response.json();
		const metrics = data.data?.public_metrics || {};

		return {
			likes: metrics.like_count || 0,
			retweets: metrics.retweet_count || 0,
			replies: metrics.reply_count || 0
		};
	} catch (error) {
		console.error('Error fetching post metrics:', error);
		return { likes: 0, retweets: 0, replies: 0 };
	}
}
