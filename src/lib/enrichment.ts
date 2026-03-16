/**
 * Contact enrichment via Apify actors.
 *
 * Replaces the Prospeo / Hunter.io / Apollo.io integrations with a single
 * Apify-based approach using `vdrmota/contact-info-scraper`.
 *
 * The public API (`enrichContact`, `searchCompanyContacts`, `bulkEnrichContacts`)
 * keeps the same signatures so consumers are unaffected.
 */
import { runActor } from '$lib/apify';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface EnrichedContact {
	email: string | null;
	phone: string | null;
	linkedin: string | null;
	xHandle: string | null;
}

/** Shape returned by `vdrmota/contact-info-scraper`. */
interface ContactInfoResult {
	url?: string;
	domain?: string;
	emails?: Array<{ value: string; type?: string }>;
	phones?: Array<{ value: string; type?: string }>;
	linkedIns?: string[];
	twitters?: string[];
	facebooks?: string[];
	instagrams?: string[];
	youtubes?: string[];
	// Some versions return flat fields
	email?: string;
	phone?: string;
	linkedin?: string;
	twitter?: string;
}

// ─── Domain candidates ─────────────────────────────────────────────────────────

function buildDomainCandidates(companyName: string, knownDomain?: string): string[] {
	const candidates: string[] = [];

	if (knownDomain) {
		// Strip protocol/www if present
		candidates.push(knownDomain.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);
	}

	// Slug from company name
	const slug = companyName
		.toLowerCase()
		.replace(/\b(inc|corp|llc|ltd|co\.?|company|technologies|tech|labs|hq|app|ai)\b/gi, '')
		.replace(/[^a-z0-9]+/g, '')
		.trim();

	if (slug.length > 2) {
		candidates.push(`${slug}.com`);
		candidates.push(`${slug}.io`);
		candidates.push(`${slug}.ai`);
	}

	return [...new Set(candidates)]; // deduplicate
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function extractHandle(url: string): string | null {
	const match = url.match(/(?:twitter\.com|x\.com)\/([^/?\s]+)/i);
	return match ? match[1] : null;
}

/**
 * Normalise the Apify contact-info-scraper output into our `EnrichedContact` shape.
 */
function normaliseContactResult(result: ContactInfoResult): EnrichedContact {
	// Email: prefer structured array, fall back to flat field
	const email =
		result.emails?.[0]?.value ??
		result.email ??
		null;

	// Phone: prefer structured array, fall back to flat field
	const phone =
		result.phones?.[0]?.value ??
		result.phone ??
		null;

	// LinkedIn: prefer array, fall back to flat field
	const linkedin =
		result.linkedIns?.[0] ??
		result.linkedin ??
		null;

	// X/Twitter handle: prefer array, fall back to flat field, extract handle from URL
	const twitterUrl =
		result.twitters?.[0] ??
		result.twitter ??
		null;
	const xHandle = twitterUrl ? (extractHandle(twitterUrl) ?? twitterUrl) : null;

	return { email, phone, linkedin, xHandle };
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Enrich a company's contact information using Apify's contact-info-scraper.
 *
 * Builds domain candidates from the company name, then scrapes those URLs
 * for emails, phones, LinkedIn profiles, and X handles.
 */
export async function enrichContact(
	companyName: string,
	domain?: string
): Promise<EnrichedContact | null> {
	const domains = buildDomainCandidates(companyName, domain);

	if (domains.length === 0) return null;

	// Build URLs to scrape — the actor expects full URLs
	const startUrls = domains.map((d) => ({ url: `https://${d}` }));

	try {
		const { items } = await runActor<ContactInfoResult>(
			'vdrmota/contact-info-scraper',
			{
				startUrls,
				maxRequestsPerStartUrl: 3,
				maxDepth: 2,
				sameDomain: true
			},
			{ timeoutSecs: 120, maxItems: 10 }
		);

		if (items.length === 0) return null;

		// Merge results from all scraped pages — first non-null value wins
		const contacts = items.map(normaliseContactResult);

		return {
			email: contacts.map((c) => c.email).find(Boolean) ?? null,
			phone: contacts.map((c) => c.phone).find(Boolean) ?? null,
			linkedin: contacts.map((c) => c.linkedin).find(Boolean) ?? null,
			xHandle: contacts.map((c) => c.xHandle).find(Boolean) ?? null
		};
	} catch (error) {
		console.warn('Apify contact enrichment failed:', error);
		return null;
	}
}

/**
 * Search for contacts/people at a company.
 *
 * Uses the contact-info-scraper to find people listed on the company website.
 * Returns a simplified list of contacts found.
 */
export async function searchCompanyContacts(domain: string, limit: number = 10) {
	try {
		const { items } = await runActor<ContactInfoResult>(
			'vdrmota/contact-info-scraper',
			{
				startUrls: [{ url: `https://${domain}` }],
				maxRequestsPerStartUrl: 10,
				maxDepth: 3,
				sameDomain: true
			},
			{ timeoutSecs: 120, maxItems: 50 }
		);

		// Collect all unique emails found across pages
		const emailSet = new Set<string>();
		const contacts: Array<{
			email: string | null;
			firstName: string;
			lastName: string;
			position: string;
			linkedin: string | null;
		}> = [];

		for (const item of items) {
			const emails = item.emails ?? (item.email ? [{ value: item.email }] : []);
			for (const emailObj of emails) {
				if (emailObj.value && !emailSet.has(emailObj.value)) {
					emailSet.add(emailObj.value);
					contacts.push({
						email: emailObj.value,
						firstName: '',
						lastName: '',
						position: '',
						linkedin: item.linkedIns?.[0] ?? item.linkedin ?? null
					});
				}
			}
		}

		return contacts.slice(0, limit);
	} catch {
		return [];
	}
}

/**
 * Bulk enrichment with rate limiting.
 *
 * Processes companies sequentially with a 1-second delay between each
 * to avoid overwhelming the Apify platform.
 */
export async function bulkEnrichContacts(companies: Array<{ name: string; domain?: string }>) {
	const results = [];
	for (const company of companies) {
		const contact = await enrichContact(company.name, company.domain);
		results.push({ companyName: company.name, contact });
		await new Promise((r) => setTimeout(r, 1000));
	}
	return results;
}
