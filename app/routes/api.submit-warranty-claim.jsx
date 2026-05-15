// app/routes/api.submit-warranty-claim.jsx
// Storefront endpoint — called via App Proxy.
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

export const action = proxyEndpoint(async ({ admin, request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const email = String(body.email || "").trim();
  const warrantyId = String(body.warrantyId || "").trim();
  const warranty = body.warranty || {};
  const claimType = String(body.claimType || "").trim();
  const claimDescription = String(body.claimDescription || "").trim();
  const fileUrls = body.fileUrls || [];

  if (!email || !warrantyId || !claimType || !claimDescription) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const customerResult = await findCustomerByEmail(admin, email);
  if (!customerResult.ok || !customerResult.customerId) {
    return Response.json({ error: "Customer not found" }, { status: 404 });
  }
  const customerId = customerResult.customerId;

  const claimResult = await createWarrantyClaimMetaobject(admin, {
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
    return Response.json({ error: claimResult.error }, { status: 500 });
  }

  const metafieldResult = await appendCustomerClaimMetaobject(
    admin,
    customerId,
    claimResult.metaobjectId
  );
  if (!metafieldResult.ok) {
    return Response.json({ error: metafieldResult.error }, { status: 500 });
  }

  return { success: true };
});

async function adminGraphQL(admin, query, variables = {}) {
  try {
    const res = await admin.graphql(query, { variables });
    const json = await res.json();
    if (json.errors) {
      console.error("Admin API GraphQL errors:", json.errors);
      return { ok: false, error: "GraphQL error" };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    console.error("Admin API call failed:", err);
    return { ok: false, error: err.message };
  }
}

async function findCustomerByEmail(admin, email) {
  const escaped = email.replace(/"/g, '\\"');
  const res = await adminGraphQL(
    admin,
    `#graphql
      query FindCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          nodes { id }
        }
      }`,
    { query: `email:"${escaped}"` }
  );
  if (!res.ok) return { ok: false, error: res.error };

  const existing = res.data?.customers?.nodes?.[0];
  if (!existing?.id) return { ok: false, error: "Customer not found" };
  return { ok: true, customerId: existing.id };
}

async function createWarrantyClaimMetaobject(admin, input) {
  const claimHandle = `claim-${Date.now()}-${input.warrantyId.slice(-8)}`
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, "-");

  const res = await adminGraphQL(
    admin,
    `#graphql
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
      }`,
    {
      handle: { type: "$app:warranty_claim", handle: claimHandle },
      customerEmail: input.customerEmail,
      customerId: input.customerId,
      warrantyId: input.warrantyId,
      warrantyDetails: JSON.stringify(input.warrantyDetails),
      claimType: input.claimType,
      claimDescription: input.claimDescription,
      fileUrls: JSON.stringify(input.fileUrls),
      status: input.status,
      submittedAt: new Date().toISOString(),
    }
  );
  if (!res.ok) return { ok: false, error: `metaobjectUpsert failed: ${res.error}` };

  const userErrors = res.data?.metaobjectUpsert?.userErrors;
  if (userErrors?.length) {
    return { ok: false, error: JSON.stringify(userErrors) };
  }
  const metaobjectId = res.data?.metaobjectUpsert?.metaobject?.id;
  if (!metaobjectId) return { ok: false, error: "no metaobject id" };
  return { ok: true, metaobjectId };
}

async function appendCustomerClaimMetaobject(admin, customerId, claimMetaobjectId) {
  const queryRes = await adminGraphQL(
    admin,
    `#graphql
      query GetCustomerClaims($id: ID!) {
        customer(id: $id) {
          id
          warrantyClaims: metafield(key: "warranty_claims") { id type value }
        }
      }`,
    { id: customerId }
  );
  if (!queryRes.ok) return { ok: false, error: queryRes.error };

  const value = queryRes.data?.customer?.warrantyClaims?.value;
  let ids = [];
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) ids = parsed;
    } catch {
      ids = [];
    }
  }
  if (!ids.includes(claimMetaobjectId)) ids.push(claimMetaobjectId);

  const setRes = await adminGraphQL(
    admin,
    `#graphql
      mutation SetCustomerClaimsList($customerId: ID!, $claimsIdsJson: String!) {
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
          metafields { id }
          userErrors { field message }
        }
      }`,
    { customerId, claimsIdsJson: JSON.stringify(ids) }
  );
  if (!setRes.ok) return { ok: false, error: setRes.error };

  const userErrors = setRes.data?.metafieldsSet?.userErrors;
  if (userErrors?.length) {
    return { ok: false, error: JSON.stringify(userErrors) };
  }
  return { ok: true };
}
