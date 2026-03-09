// Contact enrichment — runs all 3 APIs and merges the best result per field:
// - Prospeo: best for LinkedIn + xHandle (company enrichment)
// - Hunter.io: best for email + phone (domain-based)
// - Apollo.io: best for phone + LinkedIn (org database)
import { PROSPEO_API_KEY, HUNTER_API_KEY, APOLLO_API_KEY } from '$env/static/private';

export interface EnrichedContact {
	email: string | null;
	phone: string | null;
	linkedin: string | null;
	xHandle: string | null;
}

export async function enrichContact(
	companyName: string,
	domain?: string
): Promise<EnrichedContact | null> {
	const domains = buildDomainCandidates(companyName, domain);
	const primaryDomain = domains[0];

	// Run all APIs in parallel — don't stop at first hit, merge the best field from each
	const [prospeoResult, hunterResults, apolloResults] = await Promise.all([
		PROSPEO_API_KEY ? enrichWithProspeo(companyName, primaryDomain) : null,
		HUNTER_API_KEY
			? Promise.all(domains.map((d) => enrichWithHunter(d)))
			: Promise.resolve([]),
		APOLLO_API_KEY
			? Promise.all(domains.map((d) => enrichWithApollo(companyName, d)))
			: Promise.resolve([])
	]);

	const hunterResult = (hunterResults as (EnrichedContact | null)[]).find(Boolean) || null;
	const apolloResult = (apolloResults as (EnrichedContact | null)[]).find(Boolean) || null;

	const sources = [prospeoResult, hunterResult, apolloResult].filter(Boolean) as EnrichedContact[];

	if (sources.length === 0) return null;

	// Merge: first non-null value for each field wins
	return {
		email: sources.map((s) => s.email).find(Boolean) ?? null,
		phone: sources.map((s) => s.phone).find(Boolean) ?? null,
		linkedin: sources.map((s) => s.linkedin).find(Boolean) ?? null,
		xHandle: sources.map((s) => s.xHandle).find(Boolean) ?? null
	};
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

// ─── Prospeo ───────────────────────────────────────────────────────────────────

async function enrichWithProspeo(
	companyName: string,
	domain?: string
): Promise<EnrichedContact | null> {
	try {
		const data: Record<string, string> = { company_name: companyName };
		if (domain) data.company_website = domain;

		const response = await fetch('https://api.prospeo.io/enrich-company', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-KEY': PROSPEO_API_KEY },
			body: JSON.stringify({ data })
		});

		if (!response.ok) {
			const body = await response.json().catch(() => ({}));
			if (body?.error_code === 'NO_MATCH') return null; // expected — not an error
			console.warn('Prospeo error:', response.status, body);
			return null;
		}

		const result = await response.json();
		const company = result.response?.company;
		if (!company) return null;

		return {
			email: company.email || null,
			phone: null,
			linkedin: company.linkedin_url || null,
			xHandle: company.twitter_url ? extractHandle(company.twitter_url) : null
		};
	} catch (e) {
		console.warn('Prospeo exception:', e);
		return null;
	}
}

// ─── Hunter.io ─────────────────────────────────────────────────────────────────

async function enrichWithHunter(domain: string): Promise<EnrichedContact | null> {
	try {
		const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=1&api_key=${HUNTER_API_KEY}`;
		const response = await fetch(url);

		if (!response.ok) return null;

		const data = await response.json();
		const orgData = data.data || {};
		const emails: Array<{ value: string; linkedin?: string; phone_number?: string }> = orgData.emails || [];

		if (emails.length === 0 && !orgData.linkedin && !orgData.twitter) return null;

		return {
			email: emails[0]?.value || null,
			phone: orgData.phone_number || emails[0]?.phone_number || null,
			linkedin: orgData.linkedin || emails[0]?.linkedin || null,
			xHandle: orgData.twitter || null
		};
	} catch (e) {
		console.warn('Hunter.io exception:', e);
		return null;
	}
}

// ─── Apollo.io ─────────────────────────────────────────────────────────────────

async function enrichWithApollo(
	companyName: string,
	domain?: string
): Promise<EnrichedContact | null> {
	try {
		const params = new URLSearchParams({ api_key: APOLLO_API_KEY });
		if (domain) params.set('domain', domain);
		else params.set('name', companyName);

		const response = await fetch(
			`https://api.apollo.io/api/v1/organizations/enrich?${params.toString()}`,
			{ headers: { 'Cache-Control': 'no-cache' } }
		);

		if (!response.ok) return null;

		const data = await response.json();
		const org = data.organization;
		if (!org) return null;

		// Apollo returns twitter_url like https://twitter.com/handle
		const xHandle = org.twitter_url ? extractHandle(org.twitter_url) : null;

		// Apollo org enrichment: phone comes from primary_phone object
		const phone =
			org.primary_phone?.number ||
			org.sanitized_phone ||
			org.phone ||
			null;

		return {
			email: org.email || null,
			phone,
			linkedin: org.linkedin_url || null,
			xHandle
		};
	} catch (e) {
		console.warn('Apollo.io exception:', e);
		return null;
	}
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function extractHandle(url: string): string | null {
	const match = url.match(/(?:twitter\.com|x\.com)\/([^/?\s]+)/i);
	return match ? match[1] : null;
}

// Search for contacts/people at a company (used elsewhere in the app)
export async function searchCompanyContacts(domain: string, limit: number = 10) {
	if (!PROSPEO_API_KEY) return [];

	try {
		const response = await fetch('https://api.prospeo.io/search-person', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-KEY': PROSPEO_API_KEY },
			body: JSON.stringify({
				filters: { company_website: { include: [domain] } },
				page: 1
			})
		});

		if (!response.ok) return [];

		const data = await response.json();
		const people = data.response?.profiles || [];

		return people.slice(0, limit).map((p: Record<string, string>) => ({
			email: p.email || null,
			firstName: p.first_name || '',
			lastName: p.last_name || '',
			position: p.job_title || '',
			linkedin: p.linkedin_url || null
		}));
	} catch {
		return [];
	}
}

// Bulk enrichment with rate limiting
export async function bulkEnrichContacts(companies: Array<{ name: string; domain?: string }>) {
	const results = [];
	for (const company of companies) {
		const contact = await enrichContact(company.name, company.domain);
		results.push({ companyName: company.name, contact });
		await new Promise((r) => setTimeout(r, 1000));
	}
	return results;
}
