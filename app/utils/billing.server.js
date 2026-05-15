// Deprecated. Billing checks now use the App Proxy auth context inside
// app/routes/api.billing-status.jsx (calls admin.graphql directly with
// the offline session resolved from the signed proxy request).
//
// Kept as a stub so an accidental import is caught at runtime.
export function getBillingStatus() {
  throw new Error(
    "getBillingStatus() is deprecated. Use authenticate.public.appProxy in your route instead."
  );
}
