import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { searchLaunchPosts } from '$lib/x-api';
import { searchLinkedInPosts } from '$lib/linkedin-api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const { nextToken, limit = 50 } = body;

		// Fetch from X with pagination
		const xResult = await searchLaunchPosts(undefined, limit, nextToken);
		const xPosts = xResult.posts || [];
		const xNextToken = xResult.nextToken;

		// Fetch from LinkedIn
		const linkedInPosts = await searchLinkedInPosts();

		let newLaunches = 0;

		// Process X posts
		for (const post of xPosts) {
			try {
				// Guess a domain from the X username (e.g. "livekit" → "livekit.io")
				const domainGuess = post.username
					? `${post.username.toLowerCase().replace(/[^a-z0-9]/g, '')}.io`
					: null;

				// Find or create company
				const company = await prisma.company.upsert({
					where: { name: post.companyName },
					update: {
						// Update domain only if we now have one and didn't before
						...(domainGuess ? { domain: domainGuess } : {})
					},
					create: {
						name: post.companyName,
						domain: domainGuess
					}
				});

				// Create or update launch
				await prisma.launch.upsert({
					where: {
						companyId_postId: {
							companyId: company.id,
							postId: post.postId
						}
					},
					update: {
						likes: post.likes,
						videoUrl: post.videoUrl
					},
					create: {
						companyId: company.id,
						platform: 'X',
						postId: post.postId,
						videoUrl: post.videoUrl,
						likes: post.likes,
						timestamp: post.timestamp
					}
				});

				newLaunches++;
			} catch (error) {
				console.error('Error processing X post:', error);
			}
		}

		// Process LinkedIn posts
		for (const post of linkedInPosts) {
			try {
				// Find or create company
				const company = await prisma.company.upsert({
					where: { name: post.companyName },
					update: {},
					create: {
						name: post.companyName,
						domain: null
					}
				});

				// Create or update launch
				await prisma.launch.upsert({
					where: {
						companyId_postId: {
							companyId: company.id,
							postId: post.postId
						}
					},
					update: {
						likes: post.likes,
						videoUrl: post.videoUrl
					},
					create: {
						companyId: company.id,
						platform: 'LinkedIn',
						postId: post.postId,
						videoUrl: post.videoUrl,
						likes: post.likes,
						timestamp: post.timestamp
					}
				});

				newLaunches++;
			} catch (error) {
				console.error('Error processing LinkedIn post:', error);
			}
		}

		return json({
			success: true,
			newLaunches,
			xPosts: xPosts.length,
			linkedInPosts: linkedInPosts.length,
			nextToken: xNextToken,
			hasMore: !!xNextToken
		});
	} catch (error) {
		console.error('Error pulling launches:', error);
		return json({ success: false, error: 'Failed to pull launches' }, { status: 500 });
	}
};
