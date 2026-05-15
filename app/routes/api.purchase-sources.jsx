// app/routes/api.purchase-sources.jsx
// Storefront endpoint — called via App Proxy.
import prisma from "../db.server";
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

export const loader = proxyEndpoint(async ({ session }) => {
  const sources = await prisma.purchaseSource.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "asc" },
  });
  return { sources };
});
