# taiko-mirror-proxy

Thin CORS-enabled Cloudflare Worker that proxies requests to the hinai
osu! beatmap mirror (`mirror.hinamizawa.ai`). Exists so a browser on a
network that blocks that domain by DNS/hostname can still reach it,
since the request happens from Cloudflare's edge, not the client.

## Usage

Once deployed, call it like:

```
https://<your-worker>.workers.dev/proxy/api/v1/hinai/search?query=&mode=1&status=1&amount=30
```

Anything after `/proxy` is forwarded verbatim to `mirror.hinamizawa.ai`.

## Deploy

Connected to Cloudflare Workers Builds — pushing to `main` auto-deploys.
No manual steps needed after the initial Git connection is set up in the
Cloudflare dashboard (Workers & Pages → your worker → Settings → Builds).

Manual deploy (if you ever need it):
```
npm install -g wrangler
wrangler login
wrangler deploy
```
