// app/routes/api.customer-warranties.jsx
// Storefront endpoint — called via App Proxy.
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

export const loader = proxyEndpoint(async ({ admin, request }) => {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  const customerId = await findCustomerIdByEmail(admin, email);
  if (!customerId) return { warranties: [] };

  const warranties = await fetchCustomerWarrantiesExcludingClaimed(
    admin,
    customerId
  );
  return { warranties };
});

async function findCustomerIdByEmail(admin, email) {
  const escaped = email.replace(/"/g, '\\"');
  const res = await admin.graphql(
    `#graphql
      query FindCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          nodes { id }
        }
      }`,
    { variables: { query: `email:"${escaped}"` } }
  );
  const json = await res.json();
  return json.data?.customers?.nodes?.[0]?.id || null;
}

async function fetchCustomerWarrantiesExcludingClaimed(admin, customerId) {
  const metaRes = await admin.graphql(
    `#graphql
      query GetCustomerWarrantyAndClaims($id: ID!) {
        customer(id: $id) {
          id
          warrantyRegistration: metafield(key: "warranty_registration") { value }
          warrantyClaims: metafield(key: "warranty_claims") { value }
        }
      }`,
    { variables: { id: customerId } }
  );
  const metaJson = await metaRes.json();
  const customer = metaJson.data?.customer;
  if (!customer) return [];

  const warrantyIds = parseIdList(customer.warrantyRegistration?.value);
  const claimIds = parseIdList(customer.warrantyClaims?.value);
  if (warrantyIds.length === 0) return [];

  const claimedWarrantyIds = new Set();
  for (const claimId of claimIds) {
    const claimRes = await admin.graphql(
      `#graphql
        query GetWarrantyClaim($id: ID!) {
          metaobject(id: $id) { id fields { key value } }
        }`,
      { variables: { id: claimId } }
    );
    const claimJson = await claimRes.json();
    const fields = claimJson.data?.metaobject?.fields || [];
    const warrantyIdField = fields.find((f) => f.key === "warranty_id");
    if (warrantyIdField?.value) claimedWarrantyIds.add(warrantyIdField.value);
  }

  const warranties = [];
  for (const id of warrantyIds) {
    if (claimedWarrantyIds.has(id)) continue;

    const wRes = await admin.graphql(
      `#graphql
        query GetWarranty($id: ID!) {
          metaobject(id: $id) { id fields { key value } }
        }`,
      { variables: { id } }
    );
    const wJson = await wRes.json();
    const wMeta = wJson.data?.metaobject;
    if (!wMeta) continue;

    const wData = {};
    for (const f of wMeta.fields) wData[f.key] = f.value;

    if ((wData.status || "").toLowerCase() !== "approved") continue;

    warranties.push({ id: wMeta.id, ...wData });
  }

  return warranties;
}

function parseIdList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
