import React, { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// =====================
// HELPER: format label from key
// =====================

function formatLabel(key) {
  // snake_case or camelCase -> "Title case"
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

// =====================
// STATUS TABS
// =====================

const STATUS_TABS = ["Pending Review", "Approved", "Rejected", "Resolved"];

// =====================
// LOADER
// =====================

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch first 100 claim metaobjects of type "$app:warranty_claim"
  const query = `#graphql
    query ListWarrantyClaims($first: Int!, $after: String) {
      metaobjects(first: $first, after: $after, type: "$app:warranty_claim") {
        edges {
          cursor
          node {
            id
            handle
            fields {
              key
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const response = await admin.graphql(query, {
    variables: { first: 100, after: null },
  });
  const json = await response.json();

  if (json.errors) {
    console.error("Error loading warranty claims:", json.errors);
    throw new Response("Failed to load warranty claims", { status: 500 });
  }

  const edges = json.data?.metaobjects?.edges || [];

  // Map each metaobject's fields array to a plain object
  const claims = edges.map(({ node }) => {
    const fieldMap = {};
    (node.fields || []).forEach((field) => {
      fieldMap[field.key] = field.value;
    });

    return {
      id: node.id,
      handle: node.handle,
      ...fieldMap,
    };
  });

  // Group by customer_email
  const claimsByCustomer = {};
  claims.forEach((claim) => {
    const email = claim.customer_email || "Unknown";
    if (!claimsByCustomer[email]) {
      claimsByCustomer[email] = [];
    }
    claimsByCustomer[email].push(claim);
  });

  return {
    claimsByCustomer,
    shop: session.shop,
  };
};

// =====================
// ACTION
// =====================

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("_intent");

  if (intent === "update-status") {
    const claimId = formData.get("claimId");
    const newStatus = formData.get("status");
    const oldStatus = formData.get("oldStatus");
    const customerEmail = formData.get("customerEmail");
    const customerName = formData.get("customerName");

    if (!claimId || !newStatus) {
      return {
        error: "Missing claimId or status",
      };
    }

    // First, fetch the claim details to get warranty information
    const fetchQuery = `#graphql
      query GetClaimDetails($id: ID!) {
        metaobject(id: $id) {
          id
          fields {
            key
            value
          }
        }
      }
    `;

    const fetchResponse = await admin.graphql(fetchQuery, {
      variables: { id: claimId },
    });

    const fetchJson = await fetchResponse.json();
    
    if (fetchJson.errors) {
      console.error("Error fetching claim details:", fetchJson.errors);
      return {
        error: "Failed to fetch claim details",
      };
    }

    const fields = fetchJson.data?.metaobject?.fields || [];
    const claimData = {};
    fields.forEach((field) => {
      claimData[field.key] = field.value;
    });

    // Update the claim status
    const mutation = `#graphql
      mutation UpdateWarrantyClaimStatus($id: ID!, $status: String!) {
        metaobjectUpdate(
          id: $id
          metaobject: {
            fields: [
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

    const response = await admin.graphql(mutation, {
      variables: {
        id: claimId,
        status: newStatus,
      },
    });

    const json = await response.json();

    const userErrors =
      json.data?.metaobjectUpdate?.userErrors ||
      json.errors ||
      json.data?.userErrors;

    if (userErrors && userErrors.length > 0) {
      console.error("metaobjectUpdate userErrors", userErrors);
      return {
        error: "Failed to update status",
        details: userErrors,
      };
    }

    // Send appropriate email based on status change
    if (customerEmail && oldStatus !== newStatus) {
      try {
        // Parse warranty details if available
        let warrantyDetails = null;
        if (claimData.warranty_details) {
          try {
            warrantyDetails = JSON.parse(claimData.warranty_details);
          } catch (e) {
            console.error("Failed to parse warranty_details:", e);
          }
        }

        const claimDetails = {
          id: claimId,
          claim_type: claimData.claim_type || "N/A",
          claim_description: claimData.claim_description || "N/A",
          submitted_at: claimData.submitted_at || new Date().toISOString(),
          file_urls: claimData.file_urls || "[]",
        };

        // Import email functions dynamically
        const {
          sendWarrantyClaimApprovedEmail,
          sendWarrantyClaimRejectedEmail,
        } = await import("../emailTemplates.server.js");

        if (newStatus === "Approved") {
          await sendWarrantyClaimApprovedEmail({
            customerEmail,
            customerName: customerName || customerEmail.split("@")[0],
            claimDetails,
            warrantyDetails,
            shopDomain: session.shop,
          });
          console.log(`✅ Approved email sent to ${customerEmail} for claim ${claimId}`);
        } else if (newStatus === "Rejected") {
          await sendWarrantyClaimRejectedEmail({
            customerEmail,
            customerName: customerName || customerEmail.split("@")[0],
            claimDetails,
            warrantyDetails,
            shopDomain: session.shop,
          });
          console.log(`❌ Rejected email sent to ${customerEmail} for claim ${claimId}`);
        }
      } catch (emailError) {
        console.error("Failed to send status update email:", emailError);
        // Don't fail the status update if email fails
      }
    }

    return {
      success: true,
      claimId,
      status: newStatus,
    };
  }

  return {
    error: "Unknown intent",
  };
};

// =====================
// COMPONENT
// =====================

export default function ClaimWarrantiesPage() {
  const { claimsByCustomer } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [selectedStatus, setSelectedStatus] = useState("Pending Review");

  const isUpdatingStatus =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formData?.get("_intent") === "update-status";

  // Show toast on status update / error
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.status) {
      shopify.toast.show("Claim status updated successfully");
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error);
    }
  }, [fetcher.data, shopify]);

  const customerEntries = useMemo(
    () => Object.entries(claimsByCustomer || {}),
    [claimsByCustomer],
  );

  const handleStatusChange = (claimId, newStatus, oldStatus, customerEmail, customerName) => {
    const formData = new FormData();
    formData.append("_intent", "update-status");
    formData.append("claimId", claimId);
    formData.append("status", newStatus);
    formData.append("oldStatus", oldStatus);
    formData.append("customerEmail", customerEmail);
    formData.append("customerName", customerName);

    fetcher.submit(formData, { method: "post" });
  };

  return (
    <s-page heading="Warranty claims">
      <s-section>
        {customerEntries.length === 0 ? (
          <s-paragraph>No warranty claims found.</s-paragraph>
        ) : (
          <>
            {/* Status tabs */}
            <div style={{ marginBottom: "16px" }}>
              <s-stack direction="inline" gap="base">
                {STATUS_TABS.map((status) => {
                  const isActive = selectedStatus === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedStatus(status)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "4px",
                        border: isActive ? "2px solid #008060" : "1px solid #ccc",
                        backgroundColor: isActive ? "#008060" : "#fff",
                        color: isActive ? "#fff" : "#000",
                        cursor: "pointer",
                      }}
                    >
                      {status}
                    </button>
                  );
                })}
              </s-stack>
            </div>

            {/* Claims for selected status only */}
            {customerEntries
              .map(([customerEmail, claims]) => {
                // Filter this customer's claims by currently selected status
                const claimsForStatus = claims.filter(
                  (claim) =>
                    (claim.status || "Pending Review") === selectedStatus,
                );

                // If this customer has no claims in this status, skip rendering them
                if (claimsForStatus.length === 0) return null;

                return (
                  <s-box
                    key={customerEmail}
                    padding="base"
                    borderWidth="base"
                    borderRadius="base"
                    background="subdued"
                    style={{ marginBottom: "16px" }}
                  >
                    <s-stack gap="base">
                      <s-stack
                        direction="inline"
                        alignment="space-between"
                        gap="base"
                      >
                        <s-heading level="2">
                          Customer: {customerEmail}
                        </s-heading>
                      </s-stack>

                      {claimsForStatus.map((claim) => {
                        // Parse file_urls
                        let fileUrls = [];
                        try {
                          if (claim.file_urls) {
                            fileUrls = JSON.parse(claim.file_urls);
                          }
                        } catch (_e) {
                          fileUrls = [];
                        }

                        // Parse warranty_details JSON into an object
                        let warrantyDetails = null;
                        try {
                          if (claim.warranty_details) {
                            warrantyDetails = JSON.parse(
                              claim.warranty_details,
                            );
                          }
                        } catch (_e) {
                          warrantyDetails = null;
                        }

                        // Get customer name from warranty details or use email
                        const customerName = warrantyDetails?.customer_name || 
                                           warrantyDetails?.full_name || 
                                           customerEmail.split("@")[0];

                        return (
                          <s-box
                            key={claim.id}
                            padding="base"
                            borderWidth="base"
                            borderRadius="base"
                            background="transparent"
                            style={{ marginBottom: "16px" }}
                          >
                            <s-stack direction="block" gap="base">
                              <s-text variant="bodyMd" as="p">
                                <strong>Claim ID:</strong> {claim.id}
                              </s-text>

                              <s-stack direction="inline" gap="base">
                                <s-text variant="bodyMd" as="span">
                                  <strong>Status:</strong>
                                </s-text>
                                <select
                                  value={claim.status || "Pending Review"}
                                  onChange={(e) =>
                                    handleStatusChange(
                                      claim.id,
                                      e.target.value,
                                      claim.status || "Pending Review",
                                      customerEmail,
                                      customerName
                                    )
                                  }
                                  disabled={isUpdatingStatus}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    border: "1px solid #ccc",
                                  }}
                                >
                                  <option value="Pending Review">
                                    Pending Review
                                  </option>
                                  <option value="Approved">Approved</option>
                                  <option value="Rejected">Rejected</option>
                                  <option value="Resolved">Resolved</option>
                                </select>
                              </s-stack>

                              <s-text variant="bodyMd" as="p">
                                <strong>Claim type:</strong> {claim.claim_type || "N/A"}
                              </s-text>

                              <s-text variant="bodyMd" as="p">
                                <strong>Description:</strong>{" "}
                                {claim.claim_description || "N/A"}
                              </s-text>

                              <s-text variant="bodyMd" as="p">
                                <strong>Submitted at:</strong>{" "}
                                {claim.submitted_at || "N/A"}
                              </s-text>

                              {/* Warranty details: collapsible */}
                              {warrantyDetails && (
                                <details>
                                  <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
                                    Product / warranty details
                                  </summary>
                                  <div style={{ marginTop: "8px" }}>
                                    <s-stack direction="block" gap="base">
                                      {Object.entries(
                                        warrantyDetails,
                                      ).map(([key, value]) => (
                                        <s-text
                                          key={key}
                                          variant="bodyMd"
                                          as="p"
                                        >
                                          <strong>{formatLabel(key)}:</strong>{" "}
                                          {typeof value === "string" ||
                                          typeof value === "number"
                                            ? String(value)
                                            : JSON.stringify(value)}
                                        </s-text>
                                      ))}
                                    </s-stack>
                                  </div>
                                </details>
                              )}

                              {/* File URLs as images */}
                              {fileUrls.length > 0 && (
                                <div>
                                  <s-text variant="bodyMd" as="p">
                                    <strong>Attachments:</strong>
                                  </s-text>
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "8px",
                                      marginTop: "4px",
                                    }}
                                  >
                                    {fileUrls.map((url, index) => (
                                      <a
                                        key={index}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <img
                                          src={url}
                                          alt={`Claim file ${index + 1}`}
                                          style={{
                                            maxWidth: "120px",
                                            maxHeight: "120px",
                                            objectFit: "cover",
                                            borderRadius: "4px",
                                            border: "1px solid #ccc",
                                          }}
                                        />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </s-stack>
                          </s-box>
                        );
                      })}
                    </s-stack>
                  </s-box>
                );
              })}
          </>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};