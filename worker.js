// Cloudflare Worker: thin CORS-enabled proxy in front of mirror.hinamizawa.ai
//
// Deploy this behind its own *.workers.dev hostname so devices/networks that
// block hinamizawa.ai by domain/DNS still reach the data — the worker makes
// the actual request to hinai from Cloudflare's edge, not from the client.
//
// Usage from the browser once deployed:
//   https://<your-worker>.workers.dev/proxy/api/v1/hinai/search?query=&mode=1&status=1
// forwards to:
//   https://mirror.hinamizawa.ai/api/v1/hinai/search?query=&mode=1&status=1

const UPSTREAM = "https://mirror.hinamizawa.ai";
const PROXY_PREFIX = "/proxy";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (!url.pathname.startsWith(PROXY_PREFIX)) {
      return new Response("Not found. Use /proxy/<hinai path>", { status: 404 });
    }

    const upstreamPath = url.pathname.slice(PROXY_PREFIX.length); // strip "/proxy"
    const upstreamUrl = UPSTREAM + upstreamPath + url.search;

    try {
      const upstreamRes = await fetch(upstreamUrl, {
        method: "GET",
        headers: { "User-Agent": "TaikoSongSelectDemo/1.0 (cf-worker-proxy)" },
        cf: { cacheTtl: 30, cacheEverything: true }, // light edge caching, matches hinai's own 30-60s TTLs
      });

      const body = await upstreamRes.text();
      return new Response(body, {
        status: upstreamRes.status,
        headers: {
          ...corsHeaders(),
          "Content-Type": upstreamRes.headers.get("Content-Type") || "application/json",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "proxy fetch failed", detail: String(err) }), {
        status: 502,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
  },
};
