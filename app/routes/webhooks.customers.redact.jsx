import { authenticate } from "../shopify.server";
import db from "../db.server";

// GDPR: Customer redact.
// Delete any customer-specific records this app stored for the given
// customer. We don't keep customer PII in our DB (warranty registrations
// and claims live in Shopify metaobjects), but we do keep transient OTP
// rows keyed by email — purge those for safety.
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  const customerEmail = payload?.customer?.email;
  if (customerEmail) {
    try {
      await db.otpToken.deleteMany({
        where: { shop, email: customerEmail },
      });
    } catch (err) {
      console.error(`[GDPR] Failed to purge OTPs for ${customerEmail}:`, err.message);
    }
  }

  console.log(`[GDPR] ${topic} processed for ${shop}`, {
    customer_id: payload?.customer?.id,
  });

  return new Response();
};
