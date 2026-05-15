// Deprecated. Storefront-facing endpoints now use
// `authenticate.public.appProxy(request)` to obtain a per-request admin
// client that's bound to the verified shop session.
//
// Kept as a stub so an accidental import is caught at runtime.
export function getAdminClientForShop() {
  throw new Error(
    "getAdminClientForShop() is deprecated. Use authenticate.public.appProxy or authenticate.admin in your route instead."
  );
}
