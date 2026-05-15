// app/routes/api.billing-status.jsx
// Storefront endpoint — called via App Proxy.
import { boundary } from "@shopify/shopify-app-react-router/server";
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

const PLAN_NAME = "Warranty Activation Suite - Annual Plan";

const CURRENT_SUBSCRIPTION_QUERY = `#graphql
  query CurrentAppSubscription {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
      }
    }
  }
`;

export const loader = proxyEndpoint(async ({ admin }) => {
  try {
    const res = await admin.graphql(CURRENT_SUBSCRIPTION_QUERY);
    const json = await res.json();
    const subs = json.data?.currentAppInstallation?.activeSubscriptions ?? [];
    const active = subs.some(
      (s) => s.status === "ACTIVE" && s.name === PLAN_NAME
    );
    return { active };
  } catch (error) {
    console.error("Error checking billing status:", error.message);
    return { active: false, error: "Unable to verify billing status" };
  }
});

export default function BillingStatusApiRoute() {
  return null;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
