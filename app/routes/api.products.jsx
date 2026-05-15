// app/routes/api.products.jsx
// Storefront-facing endpoint, called via App Proxy
// (https://<shop>.myshopify.com/apps/warranty/api/products).
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

const PRODUCTS_QUERY = `#graphql
  query WarrantyProducts($first: Int!, $query: String!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        handle
        vendor
      }
    }
  }
`;

export const loader = proxyEndpoint(async ({ admin }) => {
  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first: 200, query: "" },
  });
  const json = await response.json();

  if (json.errors) {
    console.error("Admin API GraphQL errors:", json.errors);
    return Response.json({ error: "Failed to load products" }, { status: 500 });
  }

  const nodes = json.data?.products?.nodes ?? [];
  const products = nodes.map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
  }));

  return { products };
});
