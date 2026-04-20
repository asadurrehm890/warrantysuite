// app/routes/api.purchase-sources.jsx
import prisma from "../db.server";

// GET /api/purchase-sources?shop=checkcos.myshopify.com
export async function loader({ request }) {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");

  // You can require shopParam or fall back to a default
  const shopDomain = shopParam;

  const sources = await prisma.purchaseSource.findMany({
    where: { shop: shopDomain },
    orderBy: { createdAt: "asc" },
  });

  return new Response(JSON.stringify({ sources }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}