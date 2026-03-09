# API Documentation

## Database Setup

Your PostgreSQL database `launch_dashboard` is now configured with the following tables:

### Tables Created

1. **User** - Authentication users
2. **Company** - Companies tracked in the system
3. **Launch** - Launch posts from X and LinkedIn
4. **FundingEvent** - Funding rounds and announcements
5. **Contact** - Enriched contact information

### Database Migration

The database schema has been pushed to your PostgreSQL database. All tables are created and ready to use.

To verify:
```bash
psql -U user -d launch_dashboard -c "\dt"
```

## API Endpoints

### 1. GET /api/dashboard

Fetches all companies with their launches, funding events, and contacts.

**Response:**
```json
{
  "success": true,
  "companies": [
    {
      "id": 1,
      "name": "Company Name",
      "domain": "example.com",
      "totalRaised": 1000000,
      "launches": [...],
      "funding": [...],
      "contacts": [...]
    }
  ]
}
```

### 2. POST /api/pull-launches

Fetches new launch videos from X and LinkedIn.

**Implementation:**
- Calls X API v2 to search for launch posts with videos
- Calls LinkedIn API to search for launch posts
- Creates/updates Company records
- Creates/updates Launch records with likes and video URLs

**Response:**
```json
{
  "success": true,
  "newLaunches": 15,
  "xPosts": 10,
  "linkedInPosts": 5
}
```

**Required Environment Variables:**
- `X_BEARER_TOKEN` - X API Bearer Token
- `LINKEDIN_ACCESS_TOKEN` - LinkedIn Access Token

### 3. POST /api/pull-funding

Fetches funding announcements from Crunchbase.

**Implementation:**
- Calls Crunchbase API v4 to search for recent funding rounds
- Creates/updates Company records
- Creates FundingEvent records
- Updates Company.totalRaised

**Response:**
```json
{
  "success": true,
  "newEvents": 8
}
```

**Required Environment Variables:**
- `CRUNCHBASE_API_KEY` - Crunchbase API Key

### 4. POST /api/draft-dm

Generates AI-powered DM for a company.

**Request Body:**
```json
{
  "companyId": 1,
  "provider": "openai"  // or "grok", "gemini"
}
```

**Implementation:**
- Fetches company and latest launch data
- Calls OpenAI API with customized prompt
- Returns generated DM text

**Response:**
```json
{
  "success": true,
  "dmText": "Hey @company, saw your launch..."
}
```

**Required Environment Variables:**
- `OPENAI_API_KEY` - OpenAI API Key

### 5. POST /api/enrich-contact

Enriches contact information for a company.

**Request Body:**
```json
{
  "companyId": 1
}
```

**Implementation:**
- Tries Apollo.io API first
- Falls back to Hunter.io if Apollo fails
- Creates/updates Contact record

**Response:**
```json
{
  "success": true,
  "contact": {
    "email": "founder@company.com",
    "phone": "+1234567890",
    "linkedin": "https://linkedin.com/in/founder",
    "xHandle": "founder"
  }
}
```

**Required Environment Variables:**
- `APOLLO_API_KEY` - Apollo.io API Key (preferred)
- `HUNTER_API_KEY` - Hunter.io API Key (fallback)

## External API Implementations

### X (Twitter) API

**File:** `src/lib/x-api.ts`

**Functions:**
- `searchLaunchPosts(query, limit)` - Search for launch posts with videos
- `getPostMetrics(postId)` - Get metrics for a specific post

**API Used:** X API v2
**Endpoint:** `https://api.twitter.com/2/tweets/search/recent`

**Setup:**
1. Create a Twitter Developer account
2. Create a new app
3. Generate Bearer Token
4. Add to `.env`: `X_BEARER_TOKEN=your_token`

### LinkedIn API

**File:** `src/lib/linkedin-api.ts`

**Functions:**
- `searchLinkedInPosts(query, limit)` - Search for launch posts
- `getLinkedInProfile(profileId)` - Get organization profile

**API Used:** LinkedIn UGC Posts API
**Endpoint:** `https://api.linkedin.com/v2/ugcPosts`

**Setup:**
1. Create LinkedIn Developer app
2. Request access to Marketing Developer Platform
3. Generate Access Token
4. Add to `.env`: 
   - `LINKEDIN_CLIENT_ID=your_client_id`
   - `LINKEDIN_ACCESS_TOKEN=your_access_token`

### Crunchbase API

**File:** `src/lib/crunchbase.ts`

**Functions:**
- `searchFundingEvents(query, limit)` - Search for funding rounds
- `getCompanyFunding(companyName)` - Get all funding for a company

**API Used:** Crunchbase API v4
**Endpoint:** `https://api.crunchbase.com/api/v4/searches/funding_rounds`

**Setup:**
1. Sign up for Crunchbase Pro
2. Get API key from account settings
3. Add to `.env`: `CRUNCHBASE_API_KEY=your_key`

### Contact Enrichment

**File:** `src/lib/enrichment.ts`

**Functions:**
- `enrichContact(companyName, domain)` - Main enrichment function
- `enrichWithApollo(companyName, domain)` - Apollo.io enrichment
- `enrichWithHunter(domain)` - Hunter.io enrichment
- `enrichWithClearbit(domain)` - Clearbit enrichment (optional)

**APIs Used:**
- Apollo.io API: `https://api.apollo.io/v1/mixed_people/search`
- Hunter.io API: `https://api.hunter.io/v2/domain-search`
- Clearbit API: `https://company.clearbit.com/v2/companies/find`

**Setup:**

**Apollo.io:**
1. Sign up at apollo.io
2. Get API key from settings
3. Add to `.env`: `APOLLO_API_KEY=your_key`

**Hunter.io:**
1. Sign up at hunter.io
2. Get API key from dashboard
3. Add to `.env`: `HUNTER_API_KEY=your_key`

### AI for DM Drafting

**File:** `src/lib/ai.ts`

**Functions:**
- `draftDM(companyName, likes, provider)` - Generate DM using AI

**APIs Used:**
- OpenAI API (implemented)
- Grok API (placeholder)
- Gemini API (placeholder)

**Setup:**
1. Get OpenAI API key from platform.openai.com
2. Add to `.env`: `OPENAI_API_KEY=your_key`

## Testing the APIs

### 1. Test Database Connection

```bash
psql -U user -d launch_dashboard -c "SELECT * FROM \"Company\";"
```

### 2. Test Pull Launches

```bash
curl -X POST http://localhost:5173/api/pull-launches
```

### 3. Test Pull Funding

```bash
curl -X POST http://localhost:5173/api/pull-funding
```

### 4. Test Draft DM

```bash
curl -X POST http://localhost:5173/api/draft-dm \
  -H "Content-Type: application/json" \
  -d '{"companyId": 1, "provider": "openai"}'
```

### 5. Test Enrich Contact

```bash
curl -X POST http://localhost:5173/api/enrich-contact \
  -H "Content-Type: application/json" \
  -d '{"companyId": 1}'
```

## Rate Limits

### X API
- 450 requests per 15 minutes (app auth)
- 180 requests per 15 minutes (user auth)

### LinkedIn API
- 100 requests per day (free tier)
- 500 requests per day (paid tier)

### Crunchbase API
- 200 requests per minute
- 5000 requests per day

### Apollo.io
- 50 credits per month (free tier)
- 1000+ credits per month (paid tiers)

### Hunter.io
- 50 searches per month (free tier)
- 500+ searches per month (paid tiers)

### OpenAI API
- Rate limits based on tier
- GPT-4: 10,000 TPM (tokens per minute)

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

HTTP Status Codes:
- 200: Success
- 400: Bad Request (missing parameters)
- 404: Not Found (resource doesn't exist)
- 500: Internal Server Error

## Best Practices

1. **API Keys**: Never commit API keys to version control
2. **Rate Limiting**: Implement delays between requests to avoid rate limits
3. **Error Handling**: Always check API responses and handle errors gracefully
4. **Caching**: Consider caching API responses to reduce API calls
5. **Monitoring**: Log API calls and errors for debugging

## Next Steps

1. Add your API keys to `.env` file
2. Test each endpoint individually
3. Set up cron jobs for automated data pulls
4. Monitor API usage and costs
5. Implement additional error handling as needed
