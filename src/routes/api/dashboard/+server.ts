import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const companies = await prisma.company.findMany({
			include: {
				launches: {
					orderBy: { timestamp: 'desc' }
				},
				funding: {
					orderBy: { date: 'desc' }
				},
				contacts: true
			},
			orderBy: { totalRaised: 'desc' }
		});

		return json({ success: true, companies });
	} catch (error) {
		console.error('Error fetching dashboard data:', error);
		return json({ success: false, error: 'Failed to fetch dashboard data' }, { status: 500 });
	}
};
