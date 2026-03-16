/**
 * Funding data from free sources: Google News RSS + Y Combinator directory + TechCrunch RSS.
 *
 * Renamed from `crunchbase.ts` — no API keys required for any source.
 * Optionally enhanced with Apify Google Search for broader funding news discovery.
 */
import { runActor, flattenGoogleSearchResults } from '$lib/apify';
import type { GoogleSearchDatasetItem, GoogleOrganicResult } from '$lib/apify';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface FundingEvent {
	companyName: string;
	amount: number;
	source: string;
	date: Date;
	domain?: string | null;
}

/** Google Search types are imported from apify.ts */

// ─── Google News RSS ───────────────────────────────────────────────────────────
// Parses Google News RSS for startup funding announcements.
// Google News RSS is public and requires no API key.

async function fetchGoogleNewsFunding(query: string): Promise<FundingEvent[]> {
	try {
		const encoded = encodeURIComponent(query);
		const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;

		const response = await fetch(url, {
			headers: { 'User-Agent': 'Mozilla/5.0' }
		});

		if (!response.ok) {
			console.warn('Google News RSS error:', response.status);
			return [];
		}

		const xml = await response.text();
		const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

		const events: FundingEvent[] = [];

		for (const item of items) {
			const title =
				item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
				item.match(/<title>(.*?)<\/title>/)?.[1] ||
				'';
			const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

			if (!title) continue;

			// Extract company name: usually the part before "raises" / "secures" / "funding"
			const companyMatch = title.match(
				/^([^,]+?)\s+(?:raises?|secures?|closes?|lands?|gets?|bags?|pulls?)/i
			);
			if (!companyMatch) continue;

			const companyName = companyMatch[1].trim();

			// Extract dollar amount from headline, e.g. "$5M", "$12 million", "£3m"
			const amountMatch = title.match(
				/[\$£€](\d+(?:\.\d+)?)\s*(B|M|K|billion|million|thousand)?/i
			);
			if (!amountMatch) continue;

			let amount = parseFloat(amountMatch[1]);
			const unit = (amountMatch[2] || '').toLowerCase();
			if (unit === 'b' || unit === 'billion') amount *= 1_000_000_000;
			else if (unit === 'm' || unit === 'million') amount *= 1_000_000;
			else if (unit === 'k' || unit === 'thousand') amount *= 1_000;

			const date = pubDate ? new Date(pubDate) : new Date();

			events.push({
				companyName,
				amount,
				source: 'Google News',
				date
			});
		}

		return events;
	} catch (error) {
		console.error('Error fetching Google News funding:', error);
		return [];
	}
}

// ─── Y Combinator Directory ────────────────────────────────────────────────────
// YC exposes their company database via a public Algolia API — no key needed.

async function fetchYCFunding(
	batches: string[] = ['W25', 'S24', 'W24']
): Promise<FundingEvent[]> {
	const events: FundingEvent[] = [];

	for (const batch of batches) {
		try {
			// YC's public Algolia search index — no API key required
			const response = await fetch(
				'https://45bwzj1sgc-dsn.algolia.net/1/indexes/*/queries',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-algolia-application-id': '45BWZJ1SGC',
						'x-algolia-api-key':
							'Zjk5ZmU5OTU4ZmExMGMxNTNhZTdhZmFiOGY4NDk2MTI5NzJjNWQxNzg1YTlhNTU0YTMxMzliMjBlNTdlYzE0NWZpbHRlcnM9JnJlc3RyaWN0SW5kaWNlcz15Y19jb21wYW55XzE='
					},
					body: JSON.stringify({
						requests: [
							{
								indexName: 'yc_company_1',
								params: `query=&hitsPerPage=50&filters=batch:${batch}`
							}
						]
					})
				}
			);

			if (!response.ok) continue;

			const data = await response.json();
			const hits = data.results?.[0]?.hits || [];

			for (const company of hits) {
				// YC companies all receive $500K standard deal (as of recent years)
				const website = company.website || company.url || null;
				const domain = website
					? website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
					: null;
				events.push({
					companyName: company.name || 'Unknown',
					amount: 500_000,
					source: `YC ${batch}`,
					date: new Date(),
					domain
				});
			}
		} catch (error) {
			console.error(`Error fetching YC batch ${batch}:`, error);
		}
	}

	return events;
}

// ─── TechCrunch RSS ───────────────────────────────────────────────────────────
// TechCrunch's funding RSS feed is public and highly reliable for startup news.

async function fetchTechCrunchFunding(): Promise<FundingEvent[]> {
	try {
		// TechCrunch venture capital tag feed — more reliable than the category feed
		const url = 'https://techcrunch.com/tag/venture-capital/feed/';

		const response = await fetch(url, {
			headers: { 'User-Agent': 'Mozilla/5.0' }
		});

		if (!response.ok) {
			console.warn('TechCrunch RSS error:', response.status);
			return [];
		}

		const xml = await response.text();
		const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

		const events: FundingEvent[] = [];

		for (const item of items) {
			const title =
				item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
				item.match(/<title>(.*?)<\/title>/)?.[1] ||
				'';
			const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

			// Only process headlines that mention fundraising
			if (!/(raise[sd]?|fund(s|ing|ed)|round|invest|secures?|closes?)/i.test(title))
				continue;

			const companyMatch = title.match(
				/^([^,]+?)\s+(?:raises?|secures?|closes?|lands?|gets?)/i
			);
			if (!companyMatch) continue;

			const companyName = companyMatch[1].trim();

			const amountMatch = title.match(
				/[\$£€](\d+(?:\.\d+)?)\s*(B|M|K|billion|million|thousand)?/i
			);
			if (!amountMatch) continue;

			let amount = parseFloat(amountMatch[1]);
			const unit = (amountMatch[2] || '').toLowerCase();
			if (unit === 'b' || unit === 'billion') amount *= 1_000_000_000;
			else if (unit === 'm' || unit === 'million') amount *= 1_000_000;
			else if (unit === 'k' || unit === 'thousand') amount *= 1_000;

			events.push({
				companyName,
				amount,
				source: 'TechCrunch',
				date: pubDate ? new Date(pubDate) : new Date()
			});
		}

		return events;
	} catch (error) {
		console.error('Error fetching TechCrunch funding:', error);
		return [];
	}
}

// ─── Apify Google Search (optional enhancement) ────────────────────────────────
// Uses Apify's Google Search Scraper for broader funding news discovery.
// Dynamically builds date-filtered queries so repeated calls fetch fresh results.

async function fetchApifyFundingNews(): Promise<FundingEvent[]> {
	try {
		// Build a date range for the last 30 days to avoid re-scraping old results
		const now = new Date();
		const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
		const afterDate = monthAgo.toISOString().slice(0, 10); // YYYY-MM-DD
		const year = now.getFullYear();

		const { items: rawItems } = await runActor<GoogleSearchDatasetItem>(
			'apify/google-search-scraper',
			{
				queries: [
					`startup raises funding seed "Series A" ${year} after:${afterDate}`,
					`startup secures funding round ${year} after:${afterDate}`
				].join('\n'),
				maxPagesPerQuery: 2,
				resultsPerPage: 10,
				languageCode: 'en',
				countryCode: 'us'
			},
			{ timeoutSecs: 300, memoryMbytes: 4096, maxItems: 40 }
		);

		// Flatten nested organicResults + aiOverview sources
		const flatResults = flattenGoogleSearchResults(rawItems);

		const events: FundingEvent[] = [];

		for (const item of flatResults) {
			const title = item.title ?? '';
			// Also check description for funding info (AI Overview sources have rich descriptions)
			const textToSearch = `${title} ${item.description ?? ''}`;

			const companyMatch = title.match(
				/^([^,]+?)\s+(?:raises?|secures?|closes?|lands?|gets?|bags?)/i
			) || item.description?.match(
				/^([^,]+?)\s+(?:raises?|secures?|closes?|lands?|gets?|bags?)/i
			);
			if (!companyMatch) continue;

			const companyName = companyMatch[1].trim();

			const amountMatch = textToSearch.match(
				/[\$£€](\d+(?:\.\d+)?)\s*(B|M|K|billion|million|thousand)?/i
			);
			if (!amountMatch) continue;

			let amount = parseFloat(amountMatch[1]);
			const unit = (amountMatch[2] || '').toLowerCase();
			if (unit === 'b' || unit === 'billion') amount *= 1_000_000_000;
			else if (unit === 'm' || unit === 'million') amount *= 1_000_000;
			else if (unit === 'k' || unit === 'thousand') amount *= 1_000;

			events.push({
				companyName,
				amount,
				source: item.type === 'aiOverview' ? 'AI Overview' : 'Google Search',
				date: item.date ? new Date(item.date) : new Date()
			});
		}

		return events;
	} catch (error) {
		console.warn('Apify funding news search failed (non-critical):', error);
		return [];
	}
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function searchFundingEvents(): Promise<FundingEvent[]> {
	const [googleNews, ycFunding, techCrunch, apifyNews] = await Promise.all([
		fetchGoogleNewsFunding('startup raises funding seed "Series A" 2025'),
		fetchYCFunding(['W25', 'S24', 'W24']),
		fetchTechCrunchFunding(),
		fetchApifyFundingNews()
	]);

	// Deduplicate by company name (keep highest amount)
	const byCompany = new Map<string, FundingEvent>();
	for (const event of [...googleNews, ...ycFunding, ...techCrunch, ...apifyNews]) {
		const key = event.companyName.toLowerCase().trim();
		const existing = byCompany.get(key);
		if (!existing || event.amount > existing.amount) {
			byCompany.set(key, event);
		}
	}

	return Array.from(byCompany.values());
}

// Kept for compatibility with pull-funding server route
export async function getCompanyFunding(_companyName: string) {
	return { totalRaised: 0, rounds: [] };
}

export async function searchYCCompanies(batch?: string) {
	return fetchYCFunding(batch ? [batch] : ['W25', 'S24', 'W24']);
}
