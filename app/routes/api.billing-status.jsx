import { boundary } from "@shopify/shopify-app-react-router/server";
import { getBillingStatus } from "../utils/billing.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return new Response(
      JSON.stringify({ error: "Missing shop parameter", active: false }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const status = await getBillingStatus(shop);

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error checking billing status:", error);
    // Fail-safe: treat as not active if we can't verify
    return new Response(
      JSON.stringify({
        active: false,
        error: "Unable to verify billing status",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export default function BillingStatusApiRoute() {
  // Not used; this is a data endpoint only.
  return null;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};