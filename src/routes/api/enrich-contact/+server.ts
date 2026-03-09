import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { enrichContact } from '$lib/enrichment';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { companyId } = await request.json();

		if (!companyId) {
			return json({ success: false, error: 'Company ID is required' }, { status: 400 });
		}

		const company = await prisma.company.findUnique({
			where: { id: companyId }
		});

		if (!company) {
			return json({ success: false, error: 'Company not found' }, { status: 404 });
		}

		const contactData = await enrichContact(company.name, company.domain || undefined);

		if (!contactData) {
			return json({ success: false, error: 'Failed to enrich contact' }, { status: 500 });
		}

		// upsert by companyId (not a unique field, so use findFirst + update/create)
		const existing = await prisma.contact.findFirst({ where: { companyId } });
		const contact = existing
			? await prisma.contact.update({ where: { id: existing.id }, data: contactData })
			: await prisma.contact.create({ data: { companyId, ...contactData } });

		return json({ success: true, contact });
	} catch (error) {
		console.error('Error enriching contact:', error);
		return json({ success: false, error: 'Failed to enrich contact' }, { status: 500 });
	}
};
