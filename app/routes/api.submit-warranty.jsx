// app/routes/api.submit-warranty.jsx
// Storefront endpoint — called via App Proxy.
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

export const action = proxyEndpoint(async ({ admin, request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();

  const email = String(body.email || "").trim();
  const fullName = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim();
  const street = String(body.street || "").trim();
  const town = String(body.town || "").trim();
  const country = String(body.country || "").trim();
  const postalCode = String(body.postal_code || "").trim();

  const marketingConsentGiven = Boolean(body.termsformarketing);

  const purchaseSource = String(body.purchase_source || "").trim();
  const purchaseDate = String(body.purchase_date || "").trim();
  const orderNumber = String(body.order_number || "").trim();
  const productId = String(body.product_id || "").trim();
  const productName = String(body.product_title || "").trim();
  const serialNumber = String(body.serial_number || "").trim();

  if (
    !email ||
    !fullName ||
    !phone ||
    !street ||
    !town ||
    !country ||
    !postalCode ||
    !purchaseSource ||
    !purchaseDate ||
    !orderNumber ||
    !productId ||
    !serialNumber
  ) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || "Customer";

  const customerResult = await findOrCreateCustomer(
    admin,
    email,
    firstName,
    lastName,
    phone,
    { address1: street, city: town, country, zip: postalCode }
  );
  if (!customerResult.ok) {
    return Response.json({ error: customerResult.error }, { status: 500 });
  }
  const customerId = customerResult.customerId;

  const warrantyResult = await createWarrantyMetaobject(admin, {
    customerEmail: email,
    productName,
    purchaseSource,
    purchaseDate,
    orderNumber,
    serialNumber,
  });
  if (!warrantyResult.ok) {
    return Response.json({ error: warrantyResult.error }, { status: 500 });
  }

  const metafieldResult = await appendCustomerWarrantyMetaobject(
    admin,
    customerId,
    warrantyResult.metaobjectId
  );
  if (!metafieldResult.ok) {
    return Response.json({ error: metafieldResult.error }, { status: 500 });
  }

  if (marketingConsentGiven) {
    const marketingRes = await updateCustomerEmailMarketingConsent(
      admin,
      customerId
    );
    if (!marketingRes.ok) {
      console.error(
        "Failed to update email marketing consent",
        marketingRes.error
      );
    }
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

async function findOrCreateCustomer(
  admin,
  email,
  firstName,
  lastName,
  phone,
  address
) {
  const escaped = email.replace(/"/g, '\\"');
  const search = await adminGraphQL(
    admin,
    `#graphql
      query FindCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          nodes { id }
        }
      }`,
    { query: `email:"${escaped}"` }
  );
  if (!search.ok) {
    return { ok: false, error: `Customer search failed: ${search.error}` };
  }

  const existing = search.data?.customers?.nodes?.[0];
  if (existing?.id) return { ok: true, customerId: existing.id };

  const create = await adminGraphQL(
    admin,
    `#graphql
      mutation CreateCustomer(
        $email: String!
        $firstName: String!
        $lastName: String!
        $phone: String
        $addresses: [MailingAddressInput!]!
      ) {
        customerCreate(
          input: {
            email: $email
            firstName: $firstName
            lastName: $lastName
            phone: $phone
            addresses: $addresses
            tags: ["warranty_registered"]
          }
        ) {
          customer { id tags }
          userErrors { field message }
        }
      }`,
    { email, firstName, lastName, phone, addresses: [address] }
  );
  if (!create.ok) {
    return { ok: false, error: `Customer create failed: ${create.error}` };
  }

  const userErrors = create.data?.customerCreate?.userErrors;
  if (userErrors?.length) {
    return {
      ok: false,
      error: `customerCreate errors: ${JSON.stringify(userErrors)}`,
    };
  }

  const customerId = create.data?.customerCreate?.customer?.id;
  if (!customerId) {
    return { ok: false, error: "customerCreate returned no customer id" };
  }
  return { ok: true, customerId };
}

async function createWarrantyMetaobject(admin, input) {
  const warrantyHandle = `warranty-${input.orderNumber}-${input.serialNumber}`
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, "-");

  const res = await adminGraphQL(
    admin,
    `#graphql
      mutation CreateWarrantyRegistration(
        $handle: MetaobjectHandleInput!
        $customerEmail: String!
        $productName: String!
        $purchaseSource: String!
        $purchaseDate: String!
        $orderNumber: String!
        $serialNumber: String!
      ) {
        metaobjectUpsert(
          handle: $handle
          metaobject: {
            fields: [
              { key: "product_name",     value: $productName }
              { key: "customer_email",   value: $customerEmail }
              { key: "purchase_source",  value: $purchaseSource }
              { key: "purchase_date",    value: $purchaseDate }
              { key: "order_number",     value: $orderNumber }
              { key: "serial_number",    value: $serialNumber }
              { key: "status",           value: "Pending" }
            ]
          }
        ) {
          metaobject { id }
          userErrors { field message }
        }
      }`,
    {
      handle: { type: "$app:warranty_registration", handle: warrantyHandle },
      customerEmail: input.customerEmail,
      productName: input.productName,
      purchaseSource: input.purchaseSource,
      purchaseDate: input.purchaseDate,
      orderNumber: input.orderNumber,
      serialNumber: input.serialNumber,
    }
  );
  if (!res.ok) return { ok: false, error: `metaobjectUpsert failed: ${res.error}` };

  const userErrors = res.data?.metaobjectUpsert?.userErrors;
  if (userErrors?.length) {
    return {
      ok: false,
      error: `metaobjectUpsert errors: ${JSON.stringify(userErrors)}`,
    };
  }

  const metaobjectId = res.data?.metaobjectUpsert?.metaobject?.id;
  if (!metaobjectId) {
    return { ok: false, error: "metaobjectUpsert returned no metaobject id" };
  }
  return { ok: true, metaobjectId };
}

async function updateCustomerEmailMarketingConsent(admin, customerId) {
  const res = await adminGraphQL(
    admin,
    `#graphql
      mutation CustomerEmailMarketingConsentSubscribe(
        $input: CustomerEmailMarketingConsentUpdateInput!
      ) {
        customerEmailMarketingConsentUpdate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }`,
    {
      input: {
        customerId,
        emailMarketingConsent: {
          marketingState: "SUBSCRIBED",
          marketingOptInLevel: "SINGLE_OPT_IN",
          consentUpdatedAt: new Date().toISOString(),
        },
      },
    }
  );
  if (!res.ok) return { ok: false, error: res.error };

  const userErrors = res.data?.customerEmailMarketingConsentUpdate?.userErrors;
  if (userErrors?.length) {
    return { ok: false, error: JSON.stringify(userErrors) };
  }
  return { ok: true };
}

async function appendCustomerWarrantyMetaobject(
  admin,
  customerId,
  newWarrantyMetaobjectId
) {
  const queryRes = await adminGraphQL(
    admin,
    `#graphql
      query GetCustomerWarrantyList($id: ID!) {
        customer(id: $id) {
          id
          warrantyRegistration: metafield(key: "warranty_registration") {
            id type value
          }
        }
      }`,
    { id: customerId }
  );
  if (!queryRes.ok) {
    return { ok: false, error: `Load warranty metafield failed: ${queryRes.error}` };
  }

  const value = queryRes.data?.customer?.warrantyRegistration?.value;
  let ids = [];
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) ids = parsed;
    } catch {
      ids = [];
    }
  }
  if (!ids.includes(newWarrantyMetaobjectId)) ids.push(newWarrantyMetaobjectId);

  const setRes = await adminGraphQL(
    admin,
    `#graphql
      mutation SetCustomerWarrantyList(
        $customerId: ID!
        $warrantyIdsJson: String!
      ) {
        metafieldsSet(
          metafields: [
            {
              ownerId: $customerId
              key: "warranty_registration"
              type: "list.metaobject_reference"
              value: $warrantyIdsJson
            }
          ]
        ) {
          metafields { id }
          userErrors { field message }
        }
      }`,
    { customerId, warrantyIdsJson: JSON.stringify(ids) }
  );
  if (!setRes.ok) return { ok: false, error: `metafieldsSet failed: ${setRes.error}` };

  const userErrors = setRes.data?.metafieldsSet?.userErrors;
  if (userErrors?.length) {
    return { ok: false, error: JSON.stringify(userErrors) };
  }
  return { ok: true };
}
