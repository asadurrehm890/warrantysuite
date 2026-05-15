import { authenticate } from "../shopify.server";

// GDPR: Customer data request.
// Shopify forwards this when a merchant or buyer requests the data we
// hold for a given customer. We acknowledge the webhook and log the
// request so the merchant's support team can compile the data.
//
// We do NOT store customer PII directly — warranty registrations and
// claims live in Shopify metaobjects/metafields owned by the merchant,
// so the data is already accessible from the Shopify admin.
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] ${topic} for ${shop}`, {
    shop_id: payload.shop_id,
    customer_id: payload.customer?.id,
    customer_email: payload.customer?.email,
    orders_requested: payload.orders_requested,
    data_request_id: payload.data_request?.id,
  });

  return new Response();
};
