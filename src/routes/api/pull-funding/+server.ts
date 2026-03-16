import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { searchFundingEvents } from '$lib/funding-scraper';
import { enrichContact } from '$lib/enrichment';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	try {
		const fundingEvents = await searchFundingEvents();

		let newEvents = 0;
		let skipped = 0;
		let enriched = 0;

		for (const event of fundingEvents) {
			try {
				// Upsert company — store domain if we have one from the funding source
				const company = await prisma.company.upsert({
					where: { name: event.companyName },
					update: {
						// Only set domain if we have a better one from this source
						...(event.domain ? { domain: event.domain } : {})
					},
					create: {
						name: event.companyName,
						domain: event.domain || null
					}
				});

				// ── Dedup: skip if this exact event (company + source + amount) already exists ──
				const existing = await prisma.fundingEvent.findFirst({
					where: {
						companyId: company.id,
						source: event.source,
						amount: event.amount
					}
				});

				if (existing) {
					skipped++;
					continue;
				}

				// Create new funding event
				await prisma.fundingEvent.create({
					data: {
						companyId: company.id,
						amount: event.amount,
						source: event.source,
						date: event.date
					}
				});
				newEvents++;

				// Update company totalRaised
				const agg = await prisma.fundingEvent.aggregate({
					where: { companyId: company.id },
					_sum: { amount: true }
				});
				await prisma.company.update({
					where: { id: company.id },
					data: { totalRaised: agg._sum.amount || 0 }
				});

				// ── Auto-enrich contact if company has a domain and no contact yet ──
				if (company.domain) {
					const hasContact = await prisma.contact.findFirst({
						where: { companyId: company.id }
					});

					if (!hasContact) {
						const contactData = await enrichContact(company.name, company.domain);
						if (contactData) {
							await prisma.contact.create({
								data: { companyId: company.id, ...contactData }
							});
							enriched++;
						}
					}
				}
			} catch (error) {
				console.error('Error processing funding event:', error);
			}
		}

		return json({ success: true, newEvents, skipped, enriched });
	} catch (error) {
		console.error('Error pulling funding data:', error);
		return json({ success: false, error: 'Failed to pull funding data' }, { status: 500 });
	}
};
