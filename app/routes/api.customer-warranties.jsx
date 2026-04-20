import shopify from "../shopify.server";

export async function loader({ request }) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const shopParam = url.searchParams.get("shop");

  if (!email || !shopParam) {
    return new Response(
      JSON.stringify({ error: "Email and shop are required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const sessions = await shopify.sessionStorage.findSessionsByShop(shopParam);
  const session = sessions && sessions[0];

  if (!session || !session.accessToken) {
    return new Response(
      JSON.stringify({ error: "App is not installed or token missing" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 1. Find the customer by email
  const customerResult = await findCustomerByEmail(session, email);

  if (!customerResult.ok || !customerResult.customerId) {
    // No customer found: return an empty list of warranties
    return new Response(JSON.stringify({ warranties: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const customerId = customerResult.customerId;

  // 2. Fetch their warranty registrations, excluding ones that already have claims
  //    and only include warranties whose status is "Approved".
  const warranties = await fetchCustomerWarrantiesExcludingClaimed(
    session,
    customerId
  );

  return new Response(JSON.stringify({ warranties }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Find a customer by email, returning the GraphQL ID.
 */
async function findCustomerByEmail(session, email) {
  const searchQuery = `#graphql
    query FindCustomerByEmail($query: String!) {
      customers(first: 1, query: $query) {
        nodes { 
          id
          email
        }
      }
    }
  `;

  const searchRes = await callAdminGraphQL(session, searchQuery, {
    query: `email:${email}`,
  });

  if (!searchRes.ok) {
    return { ok: false, error: `Customer search failed: ${searchRes.error}` };
  }

  const nodes =
    searchRes.data &&
    searchRes.data.customers &&
    searchRes.data.customers.nodes;

  const existing = nodes && nodes[0];
  if (existing && existing.id) {
    return { ok: true, customerId: existing.id };
  }

  return { ok: false, error: "Customer not found" };
}

/**
 * Fetch customer warranties, but exclude any warranties that are already present
 * in the customer's warranty claims metaobject(s), and only include
 * warranties whose status is "Approved".
 *
 * Data model assumptions:
 * - customer.metafield key "warranty_registration":
 *   - type: list.metaobject_reference (stored as JSON array of warranty metaobject IDs)
 * - customer.metafield key "warranty_claims":
 *   - type: list.metaobject_reference (stored as JSON array of warranty-claim metaobject IDs)
 * - Each warranty-claim metaobject has a field "warranty_id" containing the original warranty metaobject ID.
 * - Each warranty_registration metaobject has a field "status" (single_line_text_field)
 *   defined in shopify.app.toml as:
 *
 *   [metaobjects.app.warranty_registration.fields.status]
 *   name = "Warranty Status"
 *   type = "single_line_text_field"
 *   required = false
 */
async function fetchCustomerWarrantiesExcludingClaimed(session, customerId) {
  // 1. Get both the warranty_registration and warranty_claims metafields in one query
  const query = `#graphql
    query GetCustomerWarrantyAndClaims($id: ID!) {
      customer(id: $id) {
        id
        warrantyRegistration: metafield(key: "warranty_registration") {
          value
        }
        warrantyClaims: metafield(key: "warranty_claims") {
          value
        }
      }
    }
  `;

  const queryRes = await callAdminGraphQL(session, query, { id: customerId });

  if (!queryRes.ok) {
    console.error(
      "Error loading customer warranty/claims metafields:",
      queryRes.error
    );
    return [];
  }

  const customer = queryRes.data?.customer;
  if (!customer) {
    return [];
  }

  const warrantyRegistrationValue =
    customer.warrantyRegistration?.value || null;
  const warrantyClaimsValue = customer.warrantyClaims?.value || null;

  // 2. Parse warranty IDs from warranty_registration metafield
  let warrantyIds = [];
  if (warrantyRegistrationValue) {
    try {
      const parsed = JSON.parse(warrantyRegistrationValue);
      if (Array.isArray(parsed)) {
        warrantyIds = parsed;
      }
    } catch (e) {
      console.error(
        "Failed to parse warranty_registration metafield value:",
        e
      );
      warrantyIds = [];
    }
  }

  if (warrantyIds.length === 0) {
    return [];
  }

  // 3. Parse claim metaobject IDs from warranty_claims metafield
  let claimMetaobjectIds = [];
  if (warrantyClaimsValue) {
    try {
      const parsed = JSON.parse(warrantyClaimsValue);
      if (Array.isArray(parsed)) {
        claimMetaobjectIds = parsed;
      }
    } catch (e) {
      console.error("Failed to parse warranty_claims metafield value:", e);
      claimMetaobjectIds = [];
    }
  }

  // 4. Build a set of warranty IDs that already have at least one claim
  const claimedWarrantyIds = new Set();

  for (const claimId of claimMetaobjectIds) {
    const claimQuery = `#graphql
      query GetWarrantyClaim($id: ID!) {
        metaobject(id: $id) {
          id
          fields {
            key
            value
          }
        }
      }
    `;

    const claimRes = await callAdminGraphQL(session, claimQuery, {
      id: claimId,
    });

    if (claimRes.ok && claimRes.data?.metaobject) {
      const claimMetaobject = claimRes.data.metaobject;

      const claimFields = {};
      claimMetaobject.fields.forEach((field) => {
        claimFields[field.key] = field.value;
      });

      const warrantyIdFromClaim = claimFields["warranty_id"];
      if (warrantyIdFromClaim) {
        claimedWarrantyIds.add(warrantyIdFromClaim);
      }
    }
  }

  // 5. Fetch each warranty metaobject and:
  //    - skip those already claimed
  //    - skip those whose status is NOT "Approved"
  const warranties = [];

  for (const id of warrantyIds) {
    // If this warranty ID is already referenced in any claim, skip it
    if (claimedWarrantyIds.has(id)) {
      continue;
    }

    const warrantyQuery = `#graphql
      query GetWarranty($id: ID!) {
        metaobject(id: $id) {
          id
          fields {
            key
            value
          }
        }
      }
    `;

    const warrantyRes = await callAdminGraphQL(session, warrantyQuery, {
      id,
    });

    if (warrantyRes.ok && warrantyRes.data?.metaobject) {
      const warranty = warrantyRes.data.metaobject;
      const warrantyData = {};

      warranty.fields.forEach((field) => {
        warrantyData[field.key] = field.value;
      });

      // Only include warranties whose metaobject field "status" is "Approved"
      if ((warrantyData.status || "").toLowerCase() !== "approved") {
        continue;
      }

      // This object is what the frontend receives in /api/customer-warranties
      warranties.push({
        id: warranty.id,
        ...warrantyData,
      });
    }
  }

  return warranties;
}

/**
 * Helper to call the Shopify Admin GraphQL API
 */
async function callAdminGraphQL(session, query, variables = {}) {
  const endpoint = `https://${session.shop}/admin/api/2024-07/graphql.json`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (err) {
      console.error("Failed to parse Admin API response JSON:", text);
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
      return { ok: false, error: json.errors };
    }

    return { ok: true, data: json.data };
  } catch (err) {
    console.error("Error calling Admin API:", err);
    return { ok: false, error: err.message };
  }
}