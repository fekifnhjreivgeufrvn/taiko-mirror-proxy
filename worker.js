// Cloudflare Worker: thin CORS-enabled proxy in front of mirror.hinamizawa.ai
//
// Deploy this behind its own *.workers.dev hostname so devices/networks that
// block hinamizawa.ai by domain/DNS still reach the data — the worker makes
// the actual request to hinai from Cloudflare's edge, not from the client.
//
// Usage from the browser once deployed:
//   https://<your-worker>.workers.dev/beatmaps/search?query=&mode=1&status=1
// forwards to:
//   https://mirror.hinamizawa.ai/api/v1/hinai/search?query=&mode=1&status=1

const UPSTREAM = "https://mirror.hinamizawa.ai";

// Obfuscated route map: client-facing paths deliberately avoid any "hinai"/mirror-related
// keyword, in case a content blocker is matching on URL substrings rather than hostname.
const ROUTES = {
  "/beatmaps/search": "/api/v1/hinai/search",
  "/beatmaps/download": "/api/v1/hinai/d",
};

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

    const matchedRoute = Object.keys(ROUTES).find(r => url.pathname === r || url.pathname.startsWith(r + "/"));
    if (!matchedRoute) {
      return new Response("Not found. Known routes: " + Object.keys(ROUTES).join(", "), { status: 404 });
    }

    const upstreamPath = ROUTES[matchedRoute] + url.pathname.slice(matchedRoute.length);
    const upstreamUrl = UPSTREAM + upstreamPath + url.search;

    try {
      const upstreamRes = await fetch(upstreamUrl, {
        method: "GET",
        headers: { "User-Agent": "TaikoSongSelectDemo/1.0 (cf-worker-proxy)" },
        cf: { cacheTtl: 30, cacheEverything: true }, // light edge caching, matches hinai's own 30-60s TTLs
      });

      // arrayBuffer (not text!) so binary .osz downloads pass through byte-for-byte —
      // decoding as text and re-encoding would corrupt the zip.
      const body = await upstreamRes.arrayBuffer();
      const headers = {
        ...corsHeaders(),
        "Content-Type": upstreamRes.headers.get("Content-Type") || "application/octet-stream",
      };
      const disposition = upstreamRes.headers.get("Content-Disposition");
      if (disposition) headers["Content-Disposition"] = disposition;

      return new Response(body, { status: upstreamRes.status, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: "proxy fetch failed", detail: String(err) }), {
        status: 502,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
  },
};
