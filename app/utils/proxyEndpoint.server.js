// Wrapper for storefront-facing API endpoints called via App Proxy.
// Handles:
//   - OPTIONS preflight requests
//   - HMAC signature verification via authenticate.public.appProxy
//   - CORS headers on every response (for iframe origin → proxy origin)
import { authenticate } from "../shopify.server";
import { withCors, handlePreflight } from "./cors.server";

// `handler(ctx, args)` — ctx contains `{ admin, session, liquid, request }`.
export function proxyEndpoint(handler) {
  return async (args) => {
    const { request } = args;

    // 1. CORS preflight
    const preflight = handlePreflight(request);
    if (preflight) return preflight;

    // 2. Verify Shopify-signed App Proxy request
    let ctx;
    try {
      const auth = await authenticate.public.appProxy(request);
      ctx = { ...auth, request };
    } catch (err) {
      return withCors(
        Response.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    // 3. Run handler, wrap any thrown response/error
    try {
      const result = await handler(ctx, args);
      // Allow handlers to return either a Response or a plain object/value
      if (result instanceof Response) return withCors(result);
      return withCors(Response.json(result));
    } catch (err) {
      // If handler threw a Response (e.g. from `throw Response.json(...)`),
      // honor it.
      if (err instanceof Response) return withCors(err);
      console.error("Proxy endpoint error:", err);
      return withCors(
        Response.json({ error: "Internal server error" }, { status: 500 })
      );
    }
  };
}
