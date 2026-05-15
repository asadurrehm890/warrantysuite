import { authenticate } from "../shopify.server";
import db from "../db.server";

// GDPR: Shop redact.
// Fired 48 hours after the merchant uninstalls the app. Delete every
// piece of shop-scoped data we hold so nothing lingers.
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] ${topic} for ${shop}`, { shop_id: payload?.shop_id });

  try {
    await db.$transaction([
      db.session.deleteMany({ where: { shop } }),
      db.purchaseSource.deleteMany({ where: { shop } }),
      db.warrantySettings.deleteMany({ where: { shop } }),
      db.emailTemplate.deleteMany({ where: { shop } }),
      db.otpToken.deleteMany({ where: { shop } }),
    ]);
  } catch (err) {
    console.error(`[GDPR] shop/redact cleanup failed for ${shop}:`, err.message);
  }

  return new Response();
};
