// app/routes/api.warranty-settings.jsx
// Storefront endpoint — called via App Proxy.
// Returns ONLY the marketing-text fields. Never returns the Brevo API
// key or Cloudinary secret.
import prisma from "../db.server";
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

const DEFAULT_MARKETING_TEXT =
  "Keep me updated with warranty status updates and follow-ups, which may include occasional offers and tech tips. You can unsubscribe anytime.";

const DEFAULT_CLAIM_MARKETING_TEXT =
  "Keep me updated on my claim status via email";

export const loader = proxyEndpoint(async ({ session }) => {
  const settings = await prisma.warrantySettings.findUnique({
    where: { shop: session.shop },
  });

  return {
    marketingText: settings?.marketingText ?? DEFAULT_MARKETING_TEXT,
    claimMarketingText:
      settings?.claimMarketingText ?? DEFAULT_CLAIM_MARKETING_TEXT,
  };
});
