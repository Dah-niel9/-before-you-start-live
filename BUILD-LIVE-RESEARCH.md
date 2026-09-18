# Live Research build notes

This repository keeps the original live-research ZIP as the source archive while Cloudflare Workers Builds expands it during the build.

## Cloudflare Workers Builds

Build command:
```sh
unzip -o Before_You_Start_LIVE_RESEARCH_WORKER.zip -d . && cp index.html public/index.html && cp worker-live.js src/index.js
```

Deploy command:
```sh
npx wrangler deploy
```

The ZIP supplies the existing `public/assets/` files and Wrangler configuration. The build command then overlays the corrected Worker and live-research client before deployment.

## Runtime secret

Create a Cloudflare Worker secret named:

`TAVILY_API_KEY`

Never put the actual key in this repository.

The browser calls `/api/research`; the Worker calls Tavily server-side.
