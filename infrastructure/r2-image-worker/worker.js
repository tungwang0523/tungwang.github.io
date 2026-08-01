const CACHE_CONTROL = "public, max-age=31536000, immutable";

function objectHeaders(object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", CACHE_CONTROL);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

function textResponse(message, status, allow) {
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  if (allow) headers.set("Allow", allow);
  return new Response(message, { status, headers });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return textResponse("Method not allowed", 405, "GET, HEAD, OPTIONS");
    }

    const url = new URL(request.url);
    let key;
    try {
      key = decodeURIComponent(url.pathname.slice(1));
    } catch {
      return textResponse("Bad request", 400);
    }

    if (!key || key.endsWith("/") || key.split("/").some((part) => part === "..")) {
      return textResponse("Not found", 404);
    }

    if (request.method === "HEAD") {
      const object = await env.IMAGES.head(key);
      if (object === null) return textResponse("Not found", 404);
      return new Response(null, { status: 200, headers: objectHeaders(object) });
    }

    const object = await env.IMAGES.get(key);
    if (object === null) return textResponse("Not found", 404);

    return new Response(object.body, {
      status: 200,
      headers: objectHeaders(object),
    });
  },
};
