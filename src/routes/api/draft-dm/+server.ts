import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { draftDM, type AIProvider } from '$lib/ai';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { companyId, provider = 'openai' } = await request.json();

		if (!companyId) {
			return json({ success: false, error: 'Company ID is required' }, { status: 400 });
		}

		const company = await prisma.company.findUnique({
			where: { id: companyId },
			include: {
				launches: {
					orderBy: { timestamp: 'desc' },
					take: 1
				}
			}
		});

		if (!company) {
			return json({ success: false, error: 'Company not found' }, { status: 404 });
		}

		const latestLaunch = company.launches[0];
		const likes = latestLaunch?.likes || 0;

		const dmText = await draftDM(company.name, likes, provider as AIProvider);

		return json({ success: true, dmText });
	} catch (error) {
		console.error('Error drafting DM:', error);
		return json({ success: false, error: 'Failed to draft DM' }, { status: 500 });
	}
};
