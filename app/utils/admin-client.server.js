import shopify from "../shopify.server";

/**
 * Get an Admin GraphQL client using the offline session for a shop.
 */
export async function getAdminClientForShop(shop) {
  // Uses Shopify's helper to compute the offline session id
  const offlineId = shopify.api.session.getOfflineId(shop);

  const session = await shopify.sessionStorage.loadSession(offlineId);
  if (!session) {
    throw new Error(`No offline session found for shop ${shop}`);
  }

  const client = new shopify.api.clients.Graphql({ session });
  return client;
}