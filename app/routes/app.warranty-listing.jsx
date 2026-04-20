// app/routes/app.warranty-listing.jsx

import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  sendWarrantyApprovedEmail,
  sendWarrantyDisapprovedEmail,
} from "../emailTemplates.server";

const WARRANTY_CUSTOMERS_QUERY = `#graphql
  query WarrantyCustomers($first: Int!) {
    customers(first: $first, query: "tag:warranty_registered") {
      nodes {
        id
        displayName
        email
        tags
        warrantyRegistration: metafield(key: "warranty_registration") {
          id
          type
          value
          references(first: 50) {
            nodes {
              ... on Metaobject {
                id
                handle
                type
                productName: field(key: "product_name") { value }
                orderNumber: field(key: "order_number") { value }
                serialNumber: field(key: "serial_number") { value }
                warrantyStartDate: field(key: "warranty_start_date") { value }
                warrantyEndDate: field(key: "warranty_end_date") { value }
                status: field(key: "status") { value }
              }
            }
          }
        }
      }
    }
  }
`;

// NOTE: we don't rely on returned fields, we just echo back the values we sent.
// So we keep the selection minimal.
const UPDATE_WARRANTY_MUTATION = `#graphql
  mutation UpdateWarrantyMetaobject(
    $id: ID!
    $warrantyStartDate: String!
    $warrantyEndDate: String!
    $status: String!
  ) {
    metaobjectUpdate(
      id: $id
      metaobject: {
        fields: [
          { key: "warranty_start_date", value: $warrantyStartDate }
          { key: "warranty_end_date", value: $warrantyEndDate }
          { key: "status", value: $status }
        ]
      }
    ) {
      metaobject {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Loader: fetch customers with warranties
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(WARRANTY_CUSTOMERS_QUERY, {
    variables: { first: 50 },
  });

  const json = await response.json();

  const customers = json.data?.customers?.nodes || [];

  // Flatten warranty metaobjects per customer into a simpler shape
  const data = customers.map((customer) => {
    const metafield = customer.warrantyRegistration;
    const references = metafield?.references?.nodes || [];

    return {
      id: customer.id,
      displayName: customer.displayName,
      email: customer.email,
      tags: customer.tags,
      warranties: references.map((mo) => ({
        id: mo.id,
        productName: mo.productName?.value || "",
        orderNumber: mo.orderNumber?.value || "",
        serialNumber: mo.serialNumber?.value || "",
        warrantyStartDate: mo.warrantyStartDate?.value || "",
        warrantyEndDate: mo.warrantyEndDate?.value || "",
        status: mo.status?.value || "",
      })),
    };
  });

  return { customers: data, shop: session.shop };
};

// Action: update a single warranty metaobject and send emails
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("_intent");

  // Handle warranty update
  if (intent === "update_warranty") {
    const id = String(formData.get("metaobjectId") || "").trim();
    const warrantyStartDate = String(
      formData.get("warrantyStartDate") || ""
    ).trim();
    const warrantyEndDate = String(
      formData.get("warrantyEndDate") || ""
    ).trim();
    const status = String(formData.get("status") || "").trim();

    if (!id) {
      return { error: "Missing warranty metaobject ID" };
    }

    // Always send strings (no nulls) to match String! variables
    const response = await admin.graphql(UPDATE_WARRANTY_MUTATION, {
      variables: {
        id,
        warrantyStartDate: warrantyStartDate || "",
        warrantyEndDate: warrantyEndDate || "",
        status: status || "",
      },
    });

    const json = await response.json();

    const userErrors =
      json.data?.metaobjectUpdate?.userErrors || [];

    if (userErrors.length > 0) {
      return {
        error: userErrors.map((e) => e.message).join(", "),
      };
    }

    // We know the update succeeded; echo back the values we just saved
    return {
      updated: {
        id,
        warrantyStartDate,
        warrantyEndDate,
        status,
      },
    };
  }

  // Handle sending warranty approved email
  if (intent === "send_warranty_approved_email") {
    const customerEmail = formData.get("customerEmail");
    const customerName = formData.get("customerName");
    const warrantyId = formData.get("warrantyId");
    const productName = formData.get("productName");
    const orderNumber = formData.get("orderNumber");
    const serialNumber = formData.get("serialNumber");
    const warrantyStartDate = formData.get("warrantyStartDate");
    const warrantyEndDate = formData.get("warrantyEndDate");

    if (!customerEmail || !warrantyId) {
      return { error: "Missing required email information" };
    }

    try {
      await sendWarrantyApprovedEmail({
        customerEmail,
        customerName,
        warrantyDetails: {
          productName,
          orderNumber,
          serialNumber,
          warrantyStartDate,
          warrantyEndDate,
        },
        shopDomain: session.shop,
      });

      return {
        emailSent: true,
        warrantyId,
        emailType: "approved",
      };
    } catch (error) {
      console.error("Failed to send warranty approved email:", error);
      return {
        error: "Failed to send approval email: " + error.message,
      };
    }
  }

  // Handle sending warranty disapproved email
  if (intent === "send_warranty_disapproved_email") {
    const customerEmail = formData.get("customerEmail");
    const customerName = formData.get("customerName");
    const warrantyId = formData.get("warrantyId");
    const productName = formData.get("productName");
    const orderNumber = formData.get("orderNumber");
    const serialNumber = formData.get("serialNumber");

    if (!customerEmail || !warrantyId) {
      return { error: "Missing required email information" };
    }

    try {
      await sendWarrantyDisapprovedEmail({
        customerEmail,
        customerName,
        warrantyDetails: {
          productName,
          orderNumber,
          serialNumber,
        },
        shopDomain: session.shop,
      });

      return {
        emailSent: true,
        warrantyId,
        emailType: "disapproved",
      };
    } catch (error) {
      console.error("Failed to send warranty disapproved email:", error);
      return {
        error: "Failed to send disapproval email: " + error.message,
      };
    }
  }

  return { error: "Unknown intent" };
};

export default function WarrantyListingPage() {
  const { customers: initialCustomers, shop } = useLoaderData();
  const [customers, setCustomers] = useState(initialCustomers || []);

  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isSubmitting =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  // Track which warranty is currently being emailed
  const [emailingWarrantyId, setEmailingWarrantyId] = useState(null);

  // Local editable state: map metaobjectId -> { start, end, status }
  const [edits, setEdits] = useState(() => {
    const map = {};
    for (const customer of customers) {
      for (const w of customer.warranties) {
        map[w.id] = {
          warrantyStartDate: w.warrantyStartDate || "",
          warrantyEndDate: w.warrantyEndDate || "",
          status: w.status || "",
        };
      }
    }
    return map;
  });

  // Active tab: 0 = Incomplete, 1 = Approved, 2 = Disapproved
  const [activeTab, setActiveTab] = useState(0);

  // Handle action responses (update warranty and email sends)
  useEffect(() => {
    if (!fetcher.data) return;

    if (fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
      setEmailingWarrantyId(null);
      return;
    }

    if (fetcher.data.updated) {
      const { id, warrantyStartDate, warrantyEndDate, status } =
        fetcher.data.updated;

      // Update edits map
      setEdits((prev) => ({
        ...prev,
        [id]: {
          warrantyStartDate: warrantyStartDate || "",
          warrantyEndDate: warrantyEndDate || "",
          status: status || "",
        },
      }));

      // Update customers array
      setCustomers((prev) =>
        prev.map((customer) => ({
          ...customer,
          warranties: customer.warranties.map((w) =>
            w.id === id
              ? {
                  ...w,
                  warrantyStartDate,
                  warrantyEndDate,
                  status,
                }
              : w
          ),
        }))
      );

      shopify.toast.show("Warranty updated");
    }

    if (fetcher.data.emailSent) {
      const emailType = fetcher.data.emailType === "approved" ? "approval" : "disapproval";
      shopify.toast.show(`Warranty ${emailType} email sent to customer`);
      setEmailingWarrantyId(null);
    }
  }, [fetcher.data, shopify]);

  const handleEditChange = (metaobjectId, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [metaobjectId]: {
        ...prev[metaobjectId],
        [field]: value,
      },
    }));
  };

  const handleSave = (event, metaobjectId) => {
    event.preventDefault();

    const edit = edits[metaobjectId] || {
      warrantyStartDate: "",
      warrantyEndDate: "",
      status: "",
    };

    const formData = new FormData();
    formData.set("_intent", "update_warranty");
    formData.set("metaobjectId", metaobjectId);
    formData.set("warrantyStartDate", edit.warrantyStartDate || "");
    formData.set("warrantyEndDate", edit.warrantyEndDate || "");
    formData.set("status", edit.status || "");

    fetcher.submit(formData, { method: "POST" });
  };

  const handleSendEmail = (warranty, customer, emailType) => {
    setEmailingWarrantyId(warranty.id);

    const formData = new FormData();
    
    if (emailType === "approved") {
      formData.set("_intent", "send_warranty_approved_email");
      formData.set("warrantyStartDate", warranty.warrantyStartDate || "");
      formData.set("warrantyEndDate", warranty.warrantyEndDate || "");
    } else {
      formData.set("_intent", "send_warranty_disapproved_email");
    }

    formData.set("customerEmail", customer.email);
    formData.set("customerName", customer.displayName || "");
    formData.set("warrantyId", warranty.id);
    formData.set("productName", warranty.productName || "");
    formData.set("orderNumber", warranty.orderNumber || "");
    formData.set("serialNumber", warranty.serialNumber || "");

    fetcher.submit(formData, { method: "POST" });
  };

  // Categorization helpers
  const isIncomplete = (w) =>
    (w.status || "").toLowerCase() != "approved" && (w.status || "").toLowerCase() != "disapproved";

  const isApproved = (w) =>
    (w.status || "").toLowerCase() === "approved";

  const isDisapproved = (w) =>
    (w.status || "").toLowerCase() === "disapproved";

  // Build per-tab customer lists with only relevant warranties
  const incompleteCustomers = customers
    .map((customer) => {
      const warranties = customer.warranties.filter(isIncomplete);
      return { ...customer, warranties };
    })
    .filter((customer) => customer.warranties.length > 0);

  const approvedCustomers = customers
    .map((customer) => {
      const warranties = customer.warranties.filter(isApproved);
      return { ...customer, warranties };
    })
    .filter((customer) => customer.warranties.length > 0);

  const disapprovedCustomers = customers
    .map((customer) => {
      const warranties = customer.warranties.filter(isDisapproved);
      return { ...customer, warranties };
    })
    .filter((customer) => customer.warranties.length > 0);

  const tabs = [
    {
      id: "incomplete",
      label: "Incomplete warranties",
      customers: incompleteCustomers,
      description:
        "Customers with warranty_registered tag whose warranties have empty start date, end date, and status.",
    },
    {
      id: "approved",
      label: "Approved warranties",
      customers: approvedCustomers,
      description:
        "Customers with warranty_registered tag whose warranties are approved.",
    },
    {
      id: "disapproved",
      label: "Disapproved warranties",
      customers: disapprovedCustomers,
      description:
        "Customers with warranty_registered tag whose warranties are disapproved.",
    },
  ];

  const activeTabData = tabs[activeTab];

  // Check if a specific email is being sent
  const isEmailingWarranty = (warrantyId) => 
    emailingWarrantyId === warrantyId && 
    ["loading", "submitting"].includes(fetcher.state);

  return (
    <s-page heading="Warranty listings">
      <s-section heading="Customers with warranties">
        {/* Tab bar */}
        <s-stack gap="base">
        <s-stack direction="inline" gap="base">
          {tabs.map((tab, index) => (
            <s-button
              key={tab.id}
              variant={activeTab === index ? "primary" : "secondary"}
              onClick={() => setActiveTab(index)}
            >
              {tab.label}
            </s-button>
          ))}
        </s-stack>
        
    
          <s-paragraph>
            {activeTabData.description}
          </s-paragraph>
        


        {/* Tab content */}
        {activeTabData.customers.length === 0 ? (
          <s-paragraph style={{ marginTop: "1rem" }}>
            No customers found for this tab.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base" style={{ marginTop: "1rem" }}>
            {activeTabData.customers.map((customer) => (
              <s-box
                key={customer.id}
                padding="base"
                border="small subdued solid"
                borderRadius="base"
                background="transparent"
              >
                <s-stack direction="block" gap="base">
                  <div>
                    <s-text type="strong">
                      {customer.displayName || customer.email}
                    </s-text>
                    <s-paragraph>
                      {customer.email} – Tags: {customer.tags.join(", ")}
                    </s-paragraph>
                  </div>

                  {customer.warranties.length === 0 ? (
                    <s-paragraph>
                      No warranties for this tab (should not happen).
                    </s-paragraph>
                  ) : (
                    <s-stack direction="block" gap="base">
                      {customer.warranties.map((warranty) => {
                        const edit = edits[warranty.id] || {
                          warrantyStartDate:
                            warranty.warrantyStartDate || "",
                          warrantyEndDate: warranty.warrantyEndDate || "",
                          status: warranty.status || "",
                        };

                        return (
                          <s-box
                            key={warranty.id}
                            padding="small"
                            border="small subdued solid"
                            borderRadius="base"
                            background="transparent"
                          >
                            <form
                              onSubmit={(event) =>
                                handleSave(event, warranty.id)
                              }
                            >
                              <s-stack direction="block" gap="base">
                                <div>
                                  <s-text type="strong">
                                    {warranty.productName || "Product"}
                                  </s-text>
                                  <s-paragraph>
                                    Order:{" "}
                                    <s-text type="strong">
                                      {warranty.orderNumber || "—"}
                                    </s-text>{" "}
                                    • Serial:{" "}
                                    <s-text type="strong">
                                      {warranty.serialNumber || "—"}
                                    </s-text>
                                  </s-paragraph>
                                </div>

                                <s-stack direction="inline" gap="base">
                                  <s-stack gap="small" direction="inline" alignItems="center">
                                    <s-text type="strong">
                                      Warranty start date
                                    </s-text>
                                    <input
                                      type="date"
                                      value={edit.warrantyStartDate || ""}
                                      onChange={(e) =>
                                        handleEditChange(
                                          warranty.id,
                                          "warrantyStartDate",
                                          e.target.value
                                        )
                                      }
                                      style={{
                                        marginTop: "0.25rem",
                                        padding: "0.25rem",
                                        borderRadius: "4px",
                                        border:
                                          "1px solid var(--p-color-border-subdued, #d2d5d8)",
                                      }}
                                    />
                                  </s-stack>

                                  <s-stack gap="small" direction="inline" alignItems="center">
                                    <s-text type="strong">
                                      Warranty end date
                                    </s-text>
                                    <input
                                      type="date"
                                      value={edit.warrantyEndDate || ""}
                                      onChange={(e) =>
                                        handleEditChange(
                                          warranty.id,
                                          "warrantyEndDate",
                                          e.target.value
                                        )
                                      }
                                      style={{
                                        marginTop: "0.25rem",
                                        padding: "0.25rem",
                                        borderRadius: "4px",
                                        border:
                                          "1px solid var(--p-color-border-subdued, #d2d5d8)",
                                      }}
                                    />
                                  </s-stack>

                                   <s-stack gap="small" direction="inline" alignItems="center">
                                    <s-text type="strong">
                                      Warranty status
                                    </s-text>
                                    <select
                                      value={edit.status || ""}
                                      onChange={(e) =>
                                        handleEditChange(
                                          warranty.id,
                                          "status",
                                          e.target.value
                                        )
                                      }
                                      style={{
                                        marginTop: "0.25rem",
                                        padding: "0.25rem",
                                        borderRadius: "4px",
                                        border:
                                          "1px solid var(--p-color-border-subdued, #d2d5d8)",
                                        minWidth: "140px",
                                      }}
                                    >
                                      <option value="">
                                        Select status
                                      </option>
                                      <option value="approved">
                                        Approved
                                      </option>
                                      <option value="disapproved">
                                        Disapproved
                                      </option>
                                    </select>
                                  </s-stack>
                                </s-stack>

                                <s-stack direction="inline" gap="base" alignment="center">
                                  <s-button
                                    type="submit"
                                    variant="primary"
                                    {...(isSubmitting && !emailingWarrantyId
                                      ? { loading: true }
                                      : {})}
                                  >
                                    Save warranty
                                  </s-button>

                                  {/* Email buttons - only show for approved/disapproved warranties */}
                                  {warranty.status?.toLowerCase() === "approved" && (
                                    <s-button
                                      type="button"
                                      variant="secondary"
                                      onClick={() => handleSendEmail(warranty, customer, "approved")}
                                      disabled={isEmailingWarranty(warranty.id)}
                                      {...(isEmailingWarranty(warranty.id) ? { loading: true } : {})}
                                    >
                                      Send approval email
                                    </s-button>
                                  )}

                                  {warranty.status?.toLowerCase() === "disapproved" && (
                                    <s-button
                                      type="button"
                                      variant="secondary"
                                      onClick={() => handleSendEmail(warranty, customer, "disapproved")}
                                      disabled={isEmailingWarranty(warranty.id)}
                                      {...(isEmailingWarranty(warranty.id) ? { loading: true } : {})}
                                    >
                                      Send disapproval email
                                    </s-button>
                                  )}
                                </s-stack>
                              </s-stack>
                            </form>
                          </s-box>
                        );
                      })}
                    </s-stack>
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
         </s-stack> 
      </s-section>

      <s-section slot="aside" heading="About this listing">
        <s-paragraph>
          This page lists customers with the{" "}
          <s-text type="strong">warranty_registered</s-text> tag and categorizes
          their warranty metaobjects into:
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>
            Incomplete: no start date, end date, or status
          </s-list-item>
          <s-list-item>
            Approved: status is &quot;approved&quot;
          </s-list-item>
          <s-list-item>
            Disapproved: status is &quot;disapproved&quot;
          </s-list-item>
        </s-unordered-list>
        <s-paragraph style={{ marginTop: "1rem" }}>
          When you approve or disapprove a warranty, you can send an email notification to the customer using the corresponding email button.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};