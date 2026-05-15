// app/routes/api.check-customer.jsx
// Storefront endpoint — called via App Proxy.
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

const FIND_CUSTOMER_BY_EMAIL = `#graphql
  query FindCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      nodes {
        id
        displayName
        defaultPhoneNumber { phoneNumber }
        defaultAddress {
          address1
          city
          country
          zip
        }
      }
    }
  }
`;

export const action = proxyEndpoint(async ({ admin, request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  if (!email) {
    return Response.json({ error: "Missing email" }, { status: 400 });
  }

  const escaped = email.replace(/"/g, '\\"');
  const response = await admin.graphql(FIND_CUSTOMER_BY_EMAIL, {
    variables: { query: `email:"${escaped}"` },
  });
  const json = await response.json();

  if (json.errors) {
    console.error("FindCustomerByEmail errors:", json.errors);
    return Response.json({ error: "Customer lookup failed" }, { status: 500 });
  }

  const existing = json.data?.customers?.nodes?.[0];
  if (!existing) return { exists: false };

  const addr = existing.defaultAddress;
  return {
    exists: true,
    customerId: existing.id,
    displayName: existing.displayName,
    phone: existing.defaultPhoneNumber?.phoneNumber || "",
    address: addr
      ? {
          street: addr.address1 || "",
          town: addr.city || "",
          country: addr.country || "",
          postal_code: addr.zip || "",
        }
      : null,
  };
});
