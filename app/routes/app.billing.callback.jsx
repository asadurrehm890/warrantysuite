// app/routes/app.billing.callback.jsx
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// Loader: after billing, just ensure session is valid then redirect
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // After returning from Shopify billing, send merchant to your main app page
  return new Response(null, {
    status: 302,
    headers: { Location: "/app" },
  });
};

export default function BillingCallbackPage() {
  // This page won't actually render; loader redirects immediately.
  return null;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};