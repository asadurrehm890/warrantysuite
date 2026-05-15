// CORS helper for storefront-facing endpoints called via App Proxy.
//
// The warranty/warranty-claims pages are loaded inside an iframe whose
// origin is our app's URL (warrantysuite.vercel.app). When that iframe
// makes fetch() calls to the App Proxy URL on the storefront origin
// (https://<shop>.myshopify.com/apps/warranty/api/...), the request is
// cross-origin from the browser's perspective. Shopify forwards the
// request to our app and forwards our response back, including any
// CORS headers we set.

const ALLOWED_ORIGIN =
  process.env.PUBLIC_APP_ORIGIN || process.env.SHOPIFY_APP_URL || "*";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...extra,
  };
}

// Wrap a Response to add CORS headers in place.
export function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Handle CORS preflight (OPTIONS) requests.
// Returns a Response if this is a preflight, otherwise null.
export function handlePreflight(request) {
  if (request.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders() });
}
