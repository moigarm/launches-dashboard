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
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = url.searchParams.get('sortOrder') || 'asc';
	const minXLikes = parseInt(url.searchParams.get('minXLikes') || '0');
	const minLinkedInLikes = parseInt(url.searchParams.get('minLinkedInLikes') || '0');

	// Build where clause for filtering
	const where: any = {};
	
	if (searchQuery) {
		where.name = {
			contains: searchQuery,
			mode: 'insensitive'
		};
	}

	// Fetch all companies with filters (we'll filter likes in memory since it's aggregated)
	const allCompanies = await prisma.company.findMany({
		where,
		include: {
			launches: {
				orderBy: { timestamp: 'desc' }
			},
			funding: {
				orderBy: { date: 'desc' }
			},
			contacts: true
		}
	});

	// Filter by likes (calculated from launches)
	let filteredCompanies = allCompanies.filter(company => {
		const xLikes = company.launches
			.filter(l => l.platform === 'X')
			.reduce((sum, l) => sum + l.likes, 0);
		const linkedInLikes = company.launches
			.filter(l => l.platform === 'LinkedIn')
			.reduce((sum, l) => sum + l.likes, 0);
		
		return xLikes >= minXLikes && linkedInLikes >= minLinkedInLikes;
	});

	// Sort companies
	filteredCompanies.sort((a, b) => {
		let aValue: any, bValue: any;
		
		switch (sortBy) {
			case 'name':
				aValue = a.name.toLowerCase();
				bValue = b.name.toLowerCase();
				break;
			case 'totalRaised':
				aValue = a.totalRaised;
				bValue = b.totalRaised;
				break;
			case 'xLikes':
				aValue = a.launches.filter(l => l.platform === 'X').reduce((sum, l) => sum + l.likes, 0);
				bValue = b.launches.filter(l => l.platform === 'X').reduce((sum, l) => sum + l.likes, 0);
				break;
			case 'linkedInLikes':
				aValue = a.launches.filter(l => l.platform === 'LinkedIn').reduce((sum, l) => sum + l.likes, 0);
				bValue = b.launches.filter(l => l.platform === 'LinkedIn').reduce((sum, l) => sum + l.likes, 0);
				break;
			default:
				aValue = a.name.toLowerCase();
				bValue = b.name.toLowerCase();
		}
		
		if (sortOrder === 'asc') {
			return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
		} else {
			return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
		}
	});

	// Apply pagination
	const totalCount = filteredCompanies.length;
	const companies = filteredCompanies.slice(skip, skip + ITEMS_PER_PAGE);

	return {
		companies,
		totalCount,
		currentPage: page,
		itemsPerPage: ITEMS_PER_PAGE,
		user: locals.user
	};
};
