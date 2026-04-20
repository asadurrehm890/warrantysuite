// app/routes/api.warranty-settings.jsx
import prisma from "../db.server";

const DEFAULT_MARKETING_TEXT =
  "Keep me updated with warranty status updates and follow-ups, which may include occasional offers and tech tips. You can unsubscribe anytime.";

const DEFAULT_CLAIM_MARKETING_TEXT =
  "Keep me updated on my claim status via email";

export async function loader({ request }) {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  // Fallback shop domain if not provided in URL (adjust if needed)
  const shopDomain = shopParam || "checkcos.myshopify.com";

  const settings = await prisma.warrantySettings.findUnique({
    where: { shop: shopDomain },
  });

  const marketingText = settings?.marketingText ?? DEFAULT_MARKETING_TEXT;
  const claimMarketingText =
    settings?.claimMarketingText ?? DEFAULT_CLAIM_MARKETING_TEXT;

  return new Response(
    JSON.stringify({
      marketingText,
      claimMarketingText,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}