// LinkedIn API integration
import { LINKEDIN_CLIENT_ID, LINKEDIN_ACCESS_TOKEN } from '$env/static/private';
interface LinkedInPost {
	id: string;
	author: string;
	commentary: string;
	created: {
		time: number;
	};
	content?: {
		media?: {
			id: string;
			mediaType: string;
		}[];
	};
	socialDetail?: {
		totalSocialActivityCounts: {
			numLikes: number;
			numComments: number;
			numShares: number;
		};
	};
}

export async function searchLinkedInPosts(query: string = 'launch', limit: number = 50) {
	if (!LINKEDIN_CLIENT_ID || !LINKEDIN_ACCESS_TOKEN) {
		console.warn('LINKEDIN credentials not configured');
		return [];
	}

	// Use module-level imports
	const accessToken = LINKEDIN_ACCESS_TOKEN;

	try {
		// LinkedIn API endpoint for searching posts
		// Note: LinkedIn's API has restrictions. This uses the UGC Posts API
		const url = 'https://api.linkedin.com/v2/ugcPosts';
		const params = new URLSearchParams({
			q: 'authors',
			count: Math.min(limit, 50).toString()
		});

		const response = await fetch(`${url}?${params}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
				'X-Restli-Protocol-Version': '2.0.0'
			}
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('LinkedIn API error:', response.status, error);
			return [];
		}

		const data = await response.json();
		const posts = data.elements || [];

		return posts
			.filter((post: LinkedInPost) => {
				// Filter for posts with video content and launch-related keywords
				const hasVideo = post.content?.media?.some((m) => m.mediaType === 'VIDEO');
				const text = post.commentary?.toLowerCase() || '';

				// Exclude military/war content
				const militaryKeywords = [
					'military', 'missile', 'war', 'defense', 'weapon',
					'army', 'navy', 'air force', 'combat', 'warfare',
					'soldier', 'troops', 'pentagon'
				];

				const hasMilitaryContent = militaryKeywords.some(keyword => text.includes(keyword));

				if (hasMilitaryContent) {
					return false;
				}

				// More comprehensive SaaS/product launch keywords
				const launchKeywords = [
					'launch', 'launching', 'product launch', 'new product',
					'introducing', 'excited to announce', 'proud to announce',
					'unveiling', 'releasing', 'now available'
				];

				const productKeywords = [
					'saas', 'software', 'app', 'platform', 'tool',
					'service', 'product', 'solution', 'feature',
					'update', 'version', 'release'
				];

				const hasLaunchKeyword = launchKeywords.some(keyword => text.includes(keyword));
				const hasProductKeyword = productKeywords.some(keyword => text.includes(keyword));

				return hasVideo && hasLaunchKeyword && hasProductKeyword;
			})
			.map((post: LinkedInPost) => {
				const metrics = post.socialDetail?.totalSocialActivityCounts;

				return {
					postId: post.id,
					companyName: extractCompanyName(post.author),
					text: post.commentary || '',
					likes: metrics?.numLikes || 0,
					comments: metrics?.numComments || 0,
					shares: metrics?.numShares || 0,
					videoUrl: `https://www.linkedin.com/feed/update/${post.id}`,
					timestamp: new Date(post.created.time),
					platform: 'LinkedIn'
				};
			});
	} catch (error) {
		console.error('Error fetching LinkedIn posts:', error);
		return [];
	}
}

function extractCompanyName(authorUrn: string): string {
	// Extract company name from LinkedIn URN
	// Format: urn:li:organization:12345 or urn:li:person:12345
	const parts = authorUrn.split(':');
	return parts[parts.length - 1] || 'Unknown';
}

export async function getLinkedInProfile(profileId: string) {
	if (!LINKEDIN_ACCESS_TOKEN) {
		console.warn('LINKEDIN_ACCESS_TOKEN not configured');
		return null;
	}

	const accessToken = LINKEDIN_ACCESS_TOKEN;

	try {
		const url = `https://api.linkedin.com/v2/organizations/${profileId}`;

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			console.error('LinkedIn API error:', response.status);
			return null;
		}

		const data = await response.json();

		return {
			name: data.localizedName || 'Unknown',
			website: data.websiteUrl || null,
			description: data.localizedDescription || null
		};
	} catch (error) {
		console.error('Error fetching LinkedIn profile:', error);
		return null;
	}
}
