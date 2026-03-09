import { prisma } from '$lib/db';
import type { PageServerLoad } from './$types';

const ITEMS_PER_PAGE = 25;

export const load: PageServerLoad = async ({ locals, url }) => {
	// Session is already validated in hooks.server.ts
	// If we reach here, user is authenticated
	
	const page = parseInt(url.searchParams.get('page') || '1');
	const skip = (page - 1) * ITEMS_PER_PAGE;
	
	// Get filter parameters
	const searchQuery = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'likes';
	const sortOrder = url.searchParams.get('sortOrder') || 'asc';
	const platformFilter = url.searchParams.get('platform') || 'all';

	// Build where clause
	const where: any = {
		likes: {
			lt: 500
		}
	};

	if (platformFilter !== 'all') {
		where.platform = platformFilter;
	}

	if (searchQuery) {
		where.company = {
			name: {
				contains: searchQuery,
				mode: 'insensitive'
			}
		};
	}

	// Build orderBy clause
	let orderBy: any;
	switch (sortBy) {
		case 'likes':
			orderBy = { likes: sortOrder };
			break;
		case 'timestamp':
			orderBy = { timestamp: sortOrder };
			break;
		case 'companyName':
			orderBy = { company: { name: sortOrder } };
			break;
		default:
			orderBy = { likes: sortOrder };
	}

	const [poorPerformers, totalCount] = await Promise.all([
		prisma.launch.findMany({
			where,
			include: {
				company: {
					include: {
						contacts: true,
						launches: true,
						funding: true
					}
				}
			},
			orderBy,
			skip,
			take: ITEMS_PER_PAGE
		}),
		prisma.launch.count({
			where
		})
	]);

	return {
		poorPerformers,
		totalCount,
		currentPage: page,
		itemsPerPage: ITEMS_PER_PAGE,
		user: locals.user
	};
};
