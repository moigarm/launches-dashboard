# Apify Migration Plan — Launch Dashboard

## Overview

Migrate the Launch Dashboard from direct X API, LinkedIn API, Prospeo, Hunter.io, Apollo.io, and Crunchbase integrations to a **unified Apify-based scraping layer**. This consolidates 6+ API keys into a single `APIFY_TOKEN` and uses Apify Actors for all data extraction.

---

## Current Architecture

```mermaid
graph TD
    subgraph Frontend
        A[Dashboard Page]
        B[Poor Performers Page]
        C[Funding Page]
    end

    subgraph API Routes
        D[/api/pull-launches]
        E[/api/pull-funding]
        F[/api/enrich-contact]
        G[/api/draft-dm]
    end

    subgraph Service Layer
        H[src/lib/x-api.ts]
        I[src/lib/linkedin-api.ts]
        J[src/lib/crunchbase.ts]
        K[src/lib/enrichment.ts]
        L[src/lib/ai.ts]
    end

    subgraph External APIs
        M[X API v2]
        N[LinkedIn UGC API]
        O[Google News RSS]
        P[YC Algolia]
        Q[TechCrunch RSS]
        R[Prospeo API]
        S[Hunter.io API]
        T[Apollo.io API]
    end

    A --> D
    A --> F
    B --> G
    C --> E

    D --> H --> M
    D --> I --> N
    E --> J --> O
    E --> J --> P
    E --> J --> Q
    F --> K --> R
    F --> K --> S
    F --> K --> T
```

## Target Architecture

```mermaid
graph TD
    subgraph Frontend - Unchanged
        A[Dashboard Page]
        B[Poor Performers Page]
        C[Funding Page]
    end

    subgraph API Routes - Minor Changes
        D[/api/pull-launches]
        E[/api/pull-funding]
        F[/api/enrich-contact]
        G[/api/draft-dm]
    end

    subgraph Service Layer - Refactored
        H2[src/lib/apify.ts - Core Client]
        I2[src/lib/x-scraper.ts - X via Apify]
        J2[src/lib/linkedin-scraper.ts - LinkedIn via Apify]
        K2[src/lib/funding-scraper.ts - Funding sources]
        L2[src/lib/enrichment.ts - Contact via Apify]
        M2[src/lib/ai.ts - Unchanged]
    end

    subgraph External Services
        N2[Apify Platform]
        O2[Google News RSS - kept]
        P2[YC Algolia - kept]
        Q2[TechCrunch RSS - kept]
    end

    A --> D
    A --> F
    B --> G
    C --> E

    D --> I2 --> H2 --> N2
    D --> J2 --> H2
    E --> K2 --> O2
    E --> K2 --> P2
    E --> K2 --> Q2
    F --> L2 --> H2 --> N2
```

---

## File-by-File Change Plan

### New Files

| File | Purpose |
|------|---------|
| `src/lib/apify.ts` | Core Apify client — wraps the Apify REST API to run Actors and fetch results. Single source of truth for `APIFY_TOKEN` handling. |
| `src/lib/x-scraper.ts` | Replaces `x-api.ts` — uses Apify actors to scrape X/Twitter posts instead of the official X API v2. |
| `src/lib/linkedin-scraper.ts` | Replaces `linkedin-api.ts` — uses Apify actors to scrape LinkedIn posts/profiles. |

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/enrichment.ts` | Replace Prospeo/Hunter/Apollo calls with `vdrmota/contact-info-scraper` Apify actor. Keep the `EnrichedContact` interface and `enrichContact()` signature unchanged so consumers are unaffected. |
| `src/lib/crunchbase.ts` | Rename to `src/lib/funding-scraper.ts`. Keep Google News RSS, YC Algolia, and TechCrunch RSS as-is since they are free and keyless. Optionally add an Apify-based Google Search actor for broader funding news discovery. |
| `src/routes/api/pull-launches/+server.ts` | Update imports from `x-api` → `x-scraper` and `linkedin-api` → `linkedin-scraper`. The data shape returned by the new modules must match the current contract. |
| `src/routes/api/pull-funding/+server.ts` | Update import from `crunchbase` → `funding-scraper`. No logic changes needed if the `FundingEvent` interface stays the same. |
| `src/routes/api/enrich-contact/+server.ts` | No changes needed — it already calls `enrichContact()` from `enrichment.ts`, which will be refactored internally. |
| `.env.example` | Remove: `X_API_KEY`, `X_API_SECRET`, `X_BEARER_TOKEN`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`, `CRUNCHBASE_API_KEY`, `APOLLO_API_KEY`, `HUNTER_API_KEY`, `CLEARBIT_API_KEY`, `PROSPEO_API_KEY`. Add: `APIFY_TOKEN`. |
| `prisma/schema.prisma` | No structural changes required. The `Launch.platform` field already supports arbitrary strings. Consider adding a `source` field to `Contact` model to track which Apify actor provided the data. |

### Files to Remove

| File | Reason |
|------|--------|
| `src/lib/x-api.ts` | Replaced by `src/lib/x-scraper.ts` |
| `src/lib/linkedin-api.ts` | Replaced by `src/lib/linkedin-scraper.ts` |
| `src/lib/crunchbase.ts` | Renamed to `src/lib/funding-scraper.ts` |

### Files Unchanged

| File | Reason |
|------|--------|
| `src/lib/ai.ts` | AI DM drafting is independent of data scraping |
| `src/lib/db.ts` | Database client unchanged |
| `src/lib/auth.ts` | Auth unchanged |
| `src/lib/auth-client.ts` | Auth client unchanged |
| `src/lib/auth-utils.ts` | Auth utils unchanged |
| `src/hooks.server.ts` | Auth hooks unchanged |
| `src/routes/dashboard/+page.svelte` | UI unchanged — data shape preserved |
| `src/routes/dashboard/+page.server.ts` | Server load unchanged — reads from Prisma |
| `src/routes/poor-performers/*` | Unchanged — reads from Prisma |
| `src/routes/funding/*` | Unchanged — reads from Prisma |
| `src/routes/api/draft-dm/+server.ts` | Unchanged — uses `ai.ts` |
| `src/routes/api/dashboard/+server.ts` | Unchanged — reads from Prisma |
| `prisma/schema.prisma` | Minimal or no changes |

---

## Detailed Design: New Modules

### 1. `src/lib/apify.ts` — Core Apify Client

This is the foundation module. All other scrapers delegate to it.

**Responsibilities:**
- Read `APIFY_TOKEN` from `$env/static/private`
- Provide a `runActor(actorId, input, options?)` function that:
  1. Calls the Apify REST API to start an Actor run
  2. Polls for completion or uses the synchronous run endpoint
  3. Fetches and returns the dataset items
- Provide a `searchActors(keywords)` utility for discovering new actors
- Handle errors, timeouts, and rate limiting centrally
- Export TypeScript types for Actor run results

**Key types:**
```typescript
interface ApifyRunOptions {
  timeoutSecs?: number;
  memoryMbytes?: number;
  maxItems?: number;
}

interface ApifyRunResult<T> {
  items: T[];
  runId: string;
  status: string;
  datasetId: string;
}
```

**API endpoints used:**
- `POST https://api.apify.com/v2/acts/{actorId}/runs` — start a run
- `GET https://api.apify.com/v2/actor-runs/{runId}` — check status
- `GET https://api.apify.com/v2/datasets/{datasetId}/items` — fetch results

### 2. `src/lib/x-scraper.ts` — X/Twitter Scraping via Apify

**Replaces:** `src/lib/x-api.ts`

**Apify Actors to use:**
- Primary: `apify/instagram-search-scraper` — No, for X we need a Twitter actor. Search Apify store for "Twitter scraper" or "X scraper"
- Likely candidates from Apify store: search for actors with keywords "twitter" or "X posts"
- The skill mentions `apify/google-search-scraper` which could be used to find launch posts via Google search as a fallback

**Strategy:**
Since the Apify skill does not list a dedicated Twitter/X actor, we have two approaches:
1. **Google Search approach**: Use `apify/google-search-scraper` with `site:x.com` or `site:twitter.com` queries to find launch posts
2. **Apify Store search**: At runtime, search for the best X/Twitter actor using the `search-actors` mcpc command

**Exported functions — same signatures as current `x-api.ts`:**
```typescript
export async function searchLaunchPosts(query?, limit?, nextToken?, startTime?): Promise<{ posts: LaunchPost[], nextToken: string | null }>
export async function getPostMetrics(postId: string): Promise<PostMetrics>
```

**Data mapping:** The Apify actor output will be normalized to match the existing `LaunchPost` shape that `pull-launches/+server.ts` expects.

### 3. `src/lib/linkedin-scraper.ts` — LinkedIn Scraping via Apify

**Replaces:** `src/lib/linkedin-api.ts`

**Apify Actors to use:**
- Similar to X, LinkedIn is not in the skill's listed actors. Search Apify store for "LinkedIn posts" or "LinkedIn scraper"
- Fallback: Use `apify/google-search-scraper` with `site:linkedin.com` queries

**Exported functions — same signatures:**
```typescript
export async function searchLinkedInPosts(query?, limit?): Promise<LinkedInPost[]>
export async function getLinkedInProfile(profileId: string): Promise<LinkedInProfile | null>
```

### 4. `src/lib/enrichment.ts` — Contact Enrichment via Apify

**Modifies:** existing `src/lib/enrichment.ts`

**Apify Actor:** `vdrmota/contact-info-scraper`
- This actor scrapes contact information from company websites
- Input: URLs of company websites
- Output: emails, phone numbers, social media links

**Strategy:**
1. Build domain candidates from company name (reuse existing `buildDomainCandidates()`)
2. Run `vdrmota/contact-info-scraper` with the candidate URLs
3. Parse results into the existing `EnrichedContact` interface
4. Keep the same `enrichContact()`, `searchCompanyContacts()`, and `bulkEnrichContacts()` signatures

**Fallback chain:**
- Primary: `vdrmota/contact-info-scraper` via Apify
- Secondary: `poidata/google-maps-email-extractor` for businesses with physical locations
- Tertiary: `compass/crawler-google-places` → `vdrmota/contact-info-scraper` chain for lead enrichment

### 5. `src/lib/funding-scraper.ts` — Funding Data

**Renames:** `src/lib/crunchbase.ts` → `src/lib/funding-scraper.ts`

**Changes:** Minimal. The current implementation already uses free, keyless sources:
- Google News RSS — keep as-is
- YC Algolia — keep as-is
- TechCrunch RSS — keep as-is

**Optional enhancement:** Add `apify/google-search-scraper` as an additional funding news source to complement RSS feeds.

---

## Environment Variable Changes

### Remove from `.env.example`:
```
X_API_KEY=""
X_API_SECRET=""
X_BEARER_TOKEN=""
LINKEDIN_CLIENT_ID=""
LINKEDIN_CLIENT_SECRET=""
LINKEDIN_ACCESS_TOKEN=""
CRUNCHBASE_API_KEY=""
GOOGLE_NEWS_API_KEY=""
APOLLO_API_KEY=""
HUNTER_API_KEY=""
CLEARBIT_API_KEY=""
PROSPEO_API_KEY=""
```

### Add to `.env.example`:
```
# Apify — single token for all scraping
APIFY_TOKEN=""
```

### Keep unchanged:
```
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (OAuth)
OPENAI_API_KEY
GROK_API_KEY
GEMINI_API_KEY
```

---

## Migration Strategy

### Phase 1: Foundation
1. Create `src/lib/apify.ts` core client
2. Add `APIFY_TOKEN` to `.env.example`
3. Install any needed dependencies (likely none — just `fetch`)

### Phase 2: Contact Enrichment
4. Refactor `src/lib/enrichment.ts` to use `vdrmota/contact-info-scraper`
5. Remove Prospeo/Hunter/Apollo imports and functions
6. Test via `/api/enrich-contact` endpoint

### Phase 3: Social Media Scraping
7. Create `src/lib/x-scraper.ts` using Apify actors
8. Create `src/lib/linkedin-scraper.ts` using Apify actors
9. Update `src/routes/api/pull-launches/+server.ts` imports
10. Delete `src/lib/x-api.ts` and `src/lib/linkedin-api.ts`

### Phase 4: Funding (Optional Enhancement)
11. Rename `src/lib/crunchbase.ts` → `src/lib/funding-scraper.ts`
12. Update import in `src/routes/api/pull-funding/+server.ts`
13. Optionally add Apify Google Search actor for broader coverage

### Phase 5: Cleanup & Documentation
14. Update `.env.example` — remove old keys, add `APIFY_TOKEN`
15. Update `README.md`, `API_DOCUMENTATION.md`, `PROJECT_SUMMARY.md`
16. Remove dead code and unused imports
17. Run `pnpm check` to verify TypeScript compilation

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Apify actors for X/LinkedIn may not exist or may be unreliable | Use `apify/google-search-scraper` with `site:` queries as fallback; search Apify store at implementation time |
| Data shape differences between Apify output and current interfaces | Create normalizer functions in each scraper module that map Apify output to existing TypeScript interfaces |
| Apify rate limits or costs | Add configurable `maxItems` and `timeoutSecs` to all actor runs; implement caching |
| Actor schema changes over time | Pin actor versions in the `runActor()` calls; add schema validation with Zod |
| No pagination support in Apify like X API `next_token` | Implement offset-based pagination using `maxItems` and multiple runs if needed |

---

## Dependency Changes

### Add:
- None required — Apify REST API is called via `fetch`

### Remove (optional cleanup):
- No npm packages to remove — current external API calls also use `fetch`

### Keep:
- All existing dependencies in `package.json` remain valid

---

## Open Questions

1. **X/Twitter Actor availability**: The Apify skill does not list a dedicated X/Twitter actor. We need to search the Apify store during implementation to find the best one. Fallback is Google Search with `site:x.com`.

2. **LinkedIn Actor availability**: Same situation as X. LinkedIn scrapers exist on Apify but are not in the skill's curated list. Need to search at implementation time.

3. **Apify pricing**: Running multiple actors per data pull may have cost implications. Should we add result caching or rate limiting?

4. **Pagination**: The current X API supports cursor-based pagination (`nextToken`). Apify actors may handle pagination differently. The `pull-launches` endpoint exposes `nextToken` to the frontend — we may need to adapt this.
