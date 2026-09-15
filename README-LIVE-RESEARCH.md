# Before You Start — Live Research Worker

This package keeps the existing V1 website as static assets and adds a Cloudflare Worker API at `/api/research`.

## Security
- The browser never receives the Tavily API key.
- Cloudflare Worker code reads the key from the `TAVILY_API_KEY` secret.
- Do not put the Tavily key in `index.html`, JavaScript sent to browsers, or this repository/package.

## Deployment shape
- `public/` = existing V1 site, unchanged except for the small live-research client hook.
- `src/index.js` = server-side Worker and Tavily proxy.
- `wrangler.toml` = tells Cloudflare to run the Worker and serve `public/` as assets.

## Endpoint
POST `/api/research`

Body:
```json
{
  "name": "Opportunity name",
  "claim": "What it claims to offer",
  "url": "https://example.com",
  "profile": {
    "devices": ["Android phone"],
    "budget": "₦0",
    "goal": "Extra Cash"
  }
}
```

The endpoint returns Tavily's research answer plus up to five source summaries.
