import { useEffect } from "react";
import {
  useLoaderData,
  useActionData,
  useNavigation,
  Form,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// Loader: just ensure the user is an authenticated admin
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { planName: "Warranty Activation Suite - Annual Plan", price: 9 };
};

// Action: create the $9/year subscription and redirect to Shopify billing approval
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Where Shopify should send the merchant back after approving/declining
  const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/billing/callback`;

  const response = await admin.graphql(
    `#graphql
    mutation CreateAnnualSubscription($name: String!, $returnUrl: URL!) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: 9.0, currencyCode: USD }
                interval: ANNUAL
              }
            }
          }
        ]
      ) {
        userErrors {
          field
          message
        }
        confirmationUrl
        appSubscription {
          id
        }
      }
    }
    `,
    {
      variables: {
        name: "Warranty Activation Suite - Annual Plan",
        returnUrl,
      },
    },
  );

  const json = await response.json();
  const result = json?.data?.appSubscriptionCreate;

  if (!result) {
    return {
      ok: false,
      error: "Unexpected billing response from Shopify.",
    };
  }

  const userErrors = result.userErrors || [];
  if (userErrors.length > 0) {
    console.error("Billing user errors:", userErrors);
    return {
      ok: false,
      error:
        userErrors.map((e) => e.message).join(", ") ||
        "Unable to create subscription.",
      userErrors,
    };
  }

  const confirmationUrl = result.confirmationUrl;
  if (!confirmationUrl) {
    return {
      ok: false,
      error: "No confirmation URL returned from Shopify.",
    };
  }

  // Don't return a 302 here — the embedded app iframe would try to load
  // Shopify's billing approval page inline and get blocked by frame-ancestors.
  // Hand the URL back to the client so App Bridge can do a top-level redirect.
  return { ok: true, confirmationUrl };
};

export default function BillingPage() {
  const { planName, price } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isSubmitting = navigation.state === "submitting";

  // Show a toast on error
  useEffect(() => {
    if (actionData?.ok === false && actionData.error && shopify?.toast?.show) {
      shopify.toast.show(actionData.error);
    }
  }, [actionData, shopify]);

  // Break out of the embedded iframe and send the merchant to Shopify's
  // billing approval page at the top level.
  useEffect(() => {
    if (actionData?.ok && actionData.confirmationUrl) {
      if (typeof window !== "undefined") {
        window.open(actionData.confirmationUrl, "_top");
      }
    }
  }, [actionData]);

  return (
    <s-page heading="Billing">
      <s-section heading="Activate your plan">
        <s-stack direction="block" gap="base">
          <s-text>
            To enable Warranty Activation Suite features (warranty registration
            form and warranty claim form), you need to activate the annual
            subscription below.
          </s-text>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-heading>{planName}</s-heading>
            <s-text type="subdued">${price} per year</s-text>
            <s-stack direction="block" gap="none">
              <s-text>- Warranty registration forms for your customers</s-text>
              <s-text>- Warranty claim submission and tracking</s-text>
              <s-text>- Stored in Shopify metaobjects & metafields</s-text>
            </s-stack>
          </s-box>

          {actionData?.ok === false && actionData.error && (
            <s-text tone="critical">{actionData.error}</s-text>
          )}

          <Form method="post">
            <s-button
              type="submit"
              {...(isSubmitting ? { loading: true } : {})}
            >
              {isSubmitting ? "Redirecting to billing..." : "Activate $9/year plan"}
            </s-button>
          </Form>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};