// app/routes/api.check-customer.jsx
import shopify from "../shopify.server";

// Reuse the same pattern you use in api.submit-warranty.jsx
async function callAdminGraphQL(session, query, variables = {}) {
  const endpoint = `https://${session.shop}/admin/api/2024-07/graphql.json`;

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    console.error("Network error calling Admin API:", err);
    return { ok: false, error: `Network error: ${err.message}` };
  }

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (err) {
    console.error("Failed to parse Admin API response:", text);
    return { ok: false, error: "Invalid JSON from Admin API" };
  }

  if (!res.ok) {
    console.error("Admin API HTTP error", res.status, json);
    return {
      ok: false,
      error: `Admin API HTTP ${res.status}: ${JSON.stringify(json)}`,
    };
  }

  if (json.errors) {
    console.error("Admin API GraphQL errors", json.errors);
    return {
      ok: false,
      error: `GraphQL errors: ${JSON.stringify(json.errors)}`,
    };
  }

  return { ok: true, data: json.data };
}

// GraphQL query: find customer by email, and return phone + default address
// Based on the `customers` query docs:
// https://shopify.dev/docs/api/admin-graphql/latest/queries/customers
const FIND_CUSTOMER_BY_EMAIL = `
  query FindCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      nodes {
        id
        displayName
        defaultPhoneNumber {
          phoneNumber
        }
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

export async function action({ request }) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error("Invalid JSON body for /api/check-customer:", err);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email = String(body.email || "").trim();
  const shopDomain = String(body.shop || "").trim();

  if (!email || !shopDomain) {
    return new Response(
      JSON.stringify({ error: "Missing email or shop parameter" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Get offline session for this shop (same pattern you use in submit-warranty)
  const sessions = await shopify.sessionStorage.findSessionsByShop(shopDomain);
  const session = sessions && sessions[0];

  if (!session || !session.accessToken) {
    console.error("No offline session found for shop", shopDomain, sessions);
    return new Response(
      JSON.stringify({ error: "App is not installed or token missing" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Build the search query for customers API using email filter
  // For exact match, the docs recommend quoting the email:
  //   email:"user@example.com"
  const searchQuery = `email:"${email}"`;

  const gqlRes = await callAdminGraphQL(session, FIND_CUSTOMER_BY_EMAIL, {
    query: searchQuery,
  });

  if (!gqlRes.ok) {
    console.error("FindCustomerByEmail failed:", gqlRes.error);
    return new Response(
      JSON.stringify({ error: `Customer lookup failed: ${gqlRes.error}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const nodes = gqlRes.data?.customers?.nodes || [];
  const existing = nodes[0];

  if (!existing) {
    // No customer found for this email
    return new Response(JSON.stringify({ exists: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract phone and default address if present
  const phone = existing.defaultPhoneNumber?.phoneNumber || "";
  const addr = existing.defaultAddress || null;

  const responsePayload = {
    exists: true,
    customerId: existing.id,
    displayName: existing.displayName,
    phone,
    address: addr
      ? {
          street: addr.address1 || "",
          town: addr.city || "",
          country: addr.country || "",
          postal_code: addr.zip || "",
        }
      : null,
  };

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}