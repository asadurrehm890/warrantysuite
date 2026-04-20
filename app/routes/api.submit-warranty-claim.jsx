import shopify from "../shopify.server";

export async function action({ request }) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();

  const email = String(body.email || "").trim();
  const warrantyId = String(body.warrantyId || "").trim();
  const warranty = body.warranty || {};
  const claimType = String(body.claimType || "").trim();
  const claimDescription = String(body.claimDescription || "").trim();
  const fileUrls = body.fileUrls || [];

  if (!email || !warrantyId || !claimType || !claimDescription) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  const shopDomain = shopParam;

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

  // First, find the customer by email to get their ID
  const customerResult = await findCustomerByEmail(session, email);
  
  if (!customerResult.ok || !customerResult.customerId) {
    return new Response(JSON.stringify({ error: "Customer not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const customerId = customerResult.customerId;

  // Create the warranty claim metaobject
  const claimResult = await createWarrantyClaimMetaobject(session, {
    customerEmail: email,
    customerId,
    warrantyId,
    warrantyDetails: warranty,
    claimType,
    claimDescription,
    fileUrls,
    status: "Pending Review",
  });

  if (!claimResult.ok) {
    return new Response(JSON.stringify({ error: claimResult.error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const claimMetaobjectId = claimResult.metaobjectId;

  // Append this claim to the customer's claims list metafield
  const metafieldResult = await appendCustomerClaimMetaobject(
    session,
    customerId,
    claimMetaobjectId
  );

  if (!metafieldResult.ok) {
    return new Response(JSON.stringify({ error: metafieldResult.error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Optionally, update the original warranty status
  if (warrantyId) {
    await updateWarrantyStatus(session, warrantyId, "Claim Submitted");
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

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

async function findCustomerByEmail(session, email) {
  const searchQuery = `#graphql
    query FindCustomerByEmail($query: String!) {
      customers(first: 1, query: $query) {
        nodes { 
          id
          email
        }
      }
    }`;

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

async function createWarrantyClaimMetaobject(session, input) {
  const claimHandle = `claim-${Date.now()}-${input.warrantyId.slice(-8)}`
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, "-");

  const mutation = `#graphql
    mutation CreateWarrantyClaim(
      $handle: MetaobjectHandleInput!
      $customerEmail: String!
      $customerId: String!
      $warrantyId: String!
      $warrantyDetails: String!
      $claimType: String!
      $claimDescription: String!
      $fileUrls: String!
      $status: String!
      $submittedAt: String!
    ) {
      metaobjectUpsert(
        handle: $handle
        metaobject: {
          fields: [
            { key: "customer_email",    value: $customerEmail }
            { key: "customer_id",       value: $customerId }
            { key: "warranty_id",       value: $warrantyId }
            { key: "warranty_details",  value: $warrantyDetails }
            { key: "claim_type",        value: $claimType }
            { key: "claim_description", value: $claimDescription }
            { key: "file_urls",         value: $fileUrls }
            { key: "status",            value: $status }
            { key: "submitted_at",      value: $submittedAt }
          ]
        }
      ) {
        metaobject { id }
        userErrors { field message }
      }
    }`;

  const res = await callAdminGraphQL(session, mutation, {
    handle: {
      type: "$app:warranty_claim",
      handle: claimHandle,
    },
    customerEmail: input.customerEmail,
    customerId: input.customerId,
    warrantyId: input.warrantyId,
    warrantyDetails: JSON.stringify(input.warrantyDetails),
    claimType: input.claimType,
    claimDescription: input.claimDescription,
    fileUrls: JSON.stringify(input.fileUrls),
    status: input.status,
    // Use JS here, NOT inside the GraphQL string:
    submittedAt: new Date().toISOString(),
  });

  if (!res.ok) {
    return { ok: false, error: `metaobjectUpsert failed: ${res.error}` };
  }

  const userErrors =
    res.data &&
    res.data.metaobjectUpsert &&
    res.data.metaobjectUpsert.userErrors;

  if (userErrors && userErrors.length > 0) {
    console.error("metaobjectUpsert userErrors", userErrors);
    return {
      ok: false,
      error: `metaobjectUpsert errors: ${JSON.stringify(userErrors)}`,
    };
  }

  const metaobjectId =
    res.data &&
    res.data.metaobjectUpsert &&
    res.data.metaobjectUpsert.metaobject &&
    res.data.metaobjectUpsert.metaobject.id;

  if (!metaobjectId) {
    return { ok: false, error: "metaobjectUpsert returned no metaobject id" };
  }

  return { ok: true, metaobjectId };
}

async function appendCustomerClaimMetaobject(
  session,
  customerId,
  newClaimMetaobjectId
) {
  // Load current claims list
  const query = `#graphql
    query GetCustomerClaims($id: ID!) {
      customer(id: $id) {
        id
        warrantyClaims: metafield(key: "warranty_claims") {
          id
          type
          value
        }
      }
    }`;

  const queryRes = await callAdminGraphQL(session, query, { id: customerId });

  if (!queryRes.ok) {
    return {
      ok: false,
      error: `Load warranty claims metafield failed: ${queryRes.error}`,
    };
  }

  const metafield =
    queryRes.data &&
    queryRes.data.customer &&
    queryRes.data.customer.warrantyClaims;

  let ids = [];

  if (metafield && metafield.value) {
    try {
      const parsed = JSON.parse(metafield.value);
      if (Array.isArray(parsed)) {
        ids = parsed;
      }
    } catch (_err) {
      ids = [];
    }
  }

  // Append new claim ID
  if (!ids.includes(newClaimMetaobjectId)) {
    ids.push(newClaimMetaobjectId);
  }

  const claimsIdsJson = JSON.stringify(ids);

  // Save updated list
  const mutation = `#graphql
    mutation SetCustomerClaimsList(
      $customerId: ID!
      $claimsIdsJson: String!
    ) {
      metafieldsSet(
        metafields: [
          {
            ownerId: $customerId
            key: "warranty_claims"
            type: "list.metaobject_reference"
            value: $claimsIdsJson
          }
        ]
      ) {
        metafields {
          id
          key
          type
          value
        }
        userErrors {
          field
          message
        }
      }
    }`;

  const setRes = await callAdminGraphQL(session, mutation, {
    customerId,
    claimsIdsJson,
  });

  if (!setRes.ok) {
    return { ok: false, error: `metafieldsSet failed: ${setRes.error}` };
  }

  const userErrors =
    setRes.data &&
    setRes.data.metafieldsSet &&
    setRes.data.metafieldsSet.userErrors;

  if (userErrors && userErrors.length > 0) {
    console.error("metafieldsSet userErrors", userErrors);
    return {
      ok: false,
      error: `metafieldsSet errors: ${JSON.stringify(userErrors)}`,
    };
  }

  return { ok: true };
}

async function updateWarrantyStatus(session, warrantyId, status) {
  // This would update the original warranty metaobject status
  // Implementation depends on how you want to track status changes
  return { ok: true };
}