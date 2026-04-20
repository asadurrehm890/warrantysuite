import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// DEFAULT text if no DB row exists yet (registration form)
const DEFAULT_MARKETING_TEXT =
  "Keep me updated with warranty status updates and follow-ups, which may include occasional offers and tech tips. You can unsubscribe anytime.";

// DEFAULT text if no DB row exists yet (claim form)
const DEFAULT_CLAIM_MARKETING_TEXT =
  "Keep me updated on my claim status via email";

// Loader: fetch purchase sources + marketing texts + email + cloud config for this shop
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [sources, settings] = await Promise.all([
    prisma.purchaseSource.findMany({
      where: { shop },
      orderBy: { createdAt: "asc" },
    }),
    prisma.warrantySettings.findUnique({
      where: { shop },
    }),
  ]);

  const marketingText = settings?.marketingText ?? DEFAULT_MARKETING_TEXT;
  const claimMarketingText =
    settings?.claimMarketingText ?? DEFAULT_CLAIM_MARKETING_TEXT;

  // Brevo email configuration (default to empty string if not set)
  const brevoApiKey = settings?.brevoApiKey ?? "";
  const brevoSenderEmail = settings?.brevoSenderEmail ?? "";

  // Cloud config (default to empty string if not set)
  const cloudName = settings?.cloudName ?? "";
  const cloudinaryKey = settings?.cloudinaryKey ?? "";
  const cloudinarySecret = settings?.cloudinarySecret ?? "";

  return {
    sources,
    marketingText,
    claimMarketingText,
    brevoApiKey,
    brevoSenderEmail,
    cloudName,
    cloudinaryKey,
    cloudinarySecret,
  };
};

// Action: handle create/delete purchase sources, update marketing texts, email config, and cloud config
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("_intent") || "create_source";

  // DELETE PURCHASE SOURCE
  if (intent === "delete_source") {
    const id = String(formData.get("id") || "").trim();
    if (!id) {
      return { error: "Missing id for delete" };
    }

    const existing = await prisma.purchaseSource.findFirst({
      where: { id, shop },
    });
    if (!existing) {
      return { error: "Purchase source not found" };
    }

    await prisma.purchaseSource.delete({
      where: { id },
    });

    return { deletedId: id };
  }

  // CREATE PURCHASE SOURCE
  if (intent === "create_source") {
    const label = String(formData.get("label") || "").trim();

    if (!label) {
      return {
        error: "Purchase source label is required",
      };
    }

    const source = await prisma.purchaseSource.create({
      data: {
        shop,
        label,
      },
    });

    return { source };
  }

  // UPDATE REGISTRATION MARKETING TEXT
  if (intent === "update_marketing_text") {
    const marketingText = String(formData.get("marketingText") || "").trim();

    if (!marketingText) {
      return { error: "Marketing text cannot be empty" };
    }

    const settings = await prisma.warrantySettings.upsert({
      where: { shop },
      update: { marketingText },
      create: { shop, marketingText },
    });

    return { updatedMarketingText: settings.marketingText };
  }

  // UPDATE CLAIM MARKETING TEXT
  if (intent === "update_claim_marketing_text") {
    const claimMarketingText = String(
      formData.get("claimMarketingText") || ""
    ).trim();

    if (!claimMarketingText) {
      return { error: "Claim marketing text cannot be empty" };
    }

    const settings = await prisma.warrantySettings.upsert({
      where: { shop },
      update: { claimMarketingText },
      create: { shop, claimMarketingText },
    });

    return {
      updatedClaimMarketingText: settings.claimMarketingText,
    };
  }

  // UPDATE EMAIL CONFIGURATION (Brevo)
  if (intent === "update_email_config") {
    const brevoApiKey = String(formData.get("brevoApiKey") || "").trim();
    const brevoSenderEmail = String(
      formData.get("brevoSenderEmail") || ""
    ).trim();

    if (!brevoApiKey) {
      return { error: "Brevo API key cannot be empty" };
    }

    if (!brevoSenderEmail) {
      return { error: "Brevo sender email cannot be empty" };
    }

    // Basic validation for email format (optional, but helpful)
    if (!brevoSenderEmail.includes("@")) {
      return { error: "Please enter a valid sender email address" };
    }

    const settings = await prisma.warrantySettings.upsert({
      where: { shop },
      update: { brevoApiKey, brevoSenderEmail },
      create: { shop, brevoApiKey, brevoSenderEmail },
    });

    return {
      updatedEmailSettings: {
        brevoApiKey: settings.brevoApiKey,
        brevoSenderEmail: settings.brevoSenderEmail,
      },
    };
  }

  // UPDATE CLOUD CONFIGURATION (Cloudflare / Cloudinary)
  if (intent === "update_cloud_config") {
    const cloudName = String(formData.get("cloudName") || "").trim();
    const cloudinaryKey = String(formData.get("cloudinaryKey") || "").trim();
    const cloudinarySecret = String(
      formData.get("cloudinarySecret") || ""
    ).trim();

    if (!cloudName) {
      return { error: "Cloud name cannot be empty" };
    }

    if (!cloudinaryKey) {
      return { error: "Cloudinary key cannot be empty" };
    }

    if (!cloudinarySecret) {
      return { error: "Cloudinary secret cannot be empty" };
    }

    const settings = await prisma.warrantySettings.upsert({
      where: { shop },
      update: { cloudName, cloudinaryKey, cloudinarySecret },
      create: { shop, cloudName, cloudinaryKey, cloudinarySecret },
    });

    return {
      updatedCloudSettings: {
        cloudName: settings.cloudName,
        cloudinaryKey: settings.cloudinaryKey,
        cloudinarySecret: settings.cloudinarySecret,
      },
    };
  }

  // Fallback (shouldn't happen)
  return { error: "Unknown action" };
};

// Email Template Editor Component
function EmailTemplateEditor() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const shopify = useAppBridge();

  // Template types with display names
  const templateTypes = [
    {
      value: "warranty_approved",
      label: "Warranty Approved",
      description: "Sent when a warranty registration is approved",
    },
    {
      value: "warranty_disapproved",
      label: "Warranty Disapproved",
      description: "Sent when a warranty registration is rejected",
    },
    {
      value: "claim_approved",
      label: "Claim Approved",
      description: "Sent when a warranty claim is approved",
    },
    {
      value: "claim_rejected",
      label: "Claim Rejected",
      description: "Sent when a warranty claim is rejected",
    },
  ];

  // Available variables for each template type
  const availableVariables = {
    warranty_approved: [
      "customerName",
      "productName",
      "orderNumber",
      "serialNumber",
      "startDate",
      "endDate",
      "shopDomain",
    ],
    warranty_disapproved: [
      "customerName",
      "productName",
      "orderNumber",
      "serialNumber",
      "shopDomain",
    ],
    claim_approved: [
      "customerName",
      "claimId",
      "claimType",
      "claimDescription",
      "shopDomain",
    ],
    claim_rejected: [
      "customerName",
      "claimId",
      "claimType",
      "claimDescription",
      "shopDomain",
    ],
  };

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/email-templates");
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      shopify.toast.show("Failed to load email templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    const formData = new FormData();
    formData.append("_intent", "save_template");
    formData.append("type", selectedTemplate.type);
    formData.append("subject", selectedTemplate.subject);
    formData.append("htmlContent", selectedTemplate.htmlContent);
    formData.append("textContent", selectedTemplate.textContent);

    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (data.success) {
        shopify.toast.show("Template saved successfully");
        fetchTemplates();
      } else {
        shopify.toast.show(data.error || "Failed to save template");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      shopify.toast.show("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleResetTemplate = async (type) => {
    if (
      !confirm("Are you sure you want to reset this template to default?")
    ) {
      return;
    }

    const formData = new FormData();
    formData.append("_intent", "reset_template");
    formData.append("type", type);

    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (data.success) {
        shopify.toast.show("Template reset to default");
        fetchTemplates();
        if (selectedTemplate?.type === type) {
          setSelectedTemplate(data.template);
        }
      } else {
        shopify.toast.show(data.error || "Failed to reset template");
      }
    } catch (error) {
      console.error("Error resetting template:", error);
      shopify.toast.show("Failed to reset template");
    }
  };

  const getTemplateForType = (type) => {
    return templates.find((t) => t.type === type);
  };

  const selectTemplateType = (type) => {
    const existing = getTemplateForType(type);
    if (existing) {
      setSelectedTemplate(existing);
    } else {
      // Create a new template object with default values
      const defaultTemplate = {
        type,
        subject: "",
        htmlContent: "",
        textContent: "",
      };
      setSelectedTemplate(defaultTemplate);
    }
  };

  if (loading) {
    return <s-paragraph>Loading templates...</s-paragraph>;
  }

  return (
    <s-stack direction="block" gap="base">
      {/* Template selector */}
      <div style={{ marginBottom: "16px" }}>
        <s-text type="strong">Select template to edit:</s-text>
        <div style={{ marginTop: "8px" }}>
          <s-stack direction="inline" gap="base">
            {templateTypes.map((type) => (
              <s-button
                key={type.value}
                variant={
                  selectedTemplate?.type === type.value
                    ? "primary"
                    : "secondary"
                }
                onClick={() => selectTemplateType(type.value)}
              >
                {type.label}
              </s-button>
            ))}
          </s-stack>
        </div>
      </div>

      {/* Template editor */}
      {selectedTemplate && (
        <s-box
          padding="base"
          border="small subdued solid"
          borderRadius="base"
          background="transparent"
        >
          <s-stack direction="block" gap="base">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <s-text type="strong">
                  Editing:{" "}
                  {
                    templateTypes.find(
                      (t) => t.value === selectedTemplate.type
                    )?.label
                  }
                </s-text>
                <s-paragraph style={{ marginTop: "4px", fontSize: "12px" }}>
                  {
                    templateTypes.find(
                      (t) => t.value === selectedTemplate.type
                    )?.description
                  }
                </s-paragraph>
              </div>
              <s-button
                variant="tertiary"
                tone="critical"
                onClick={() => handleResetTemplate(selectedTemplate.type)}
              >
                Reset to Default
              </s-button>
            </div>

            {/* Available variables hint */}
            <div
              style={{
                backgroundColor: "#f0f9ff",
                padding: "8px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <s-text type="strong">Available variables:</s-text>
              <div
                style={{
                  marginTop: "4px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {availableVariables[selectedTemplate.type]?.map((variable) => (
                  <code
                    key={variable}
                    style={{
                      backgroundColor: "#e0e7ff",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "11px",
                    }}
                  >
                    {`{{${variable}}}`}
                  </code>
                ))}
              </div>
            </div>

            {/* Subject field */}
            <div>
              <label style={{ display: "block", marginBottom: "4px" }}>
                <s-text type="strong">Email Subject</s-text>
              </label>
              <input
                type="text"
                value={selectedTemplate.subject || ""}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    subject: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #d2d5d8",
                }}
              />
            </div>

            {/* Preview/Source toggle */}
            <div>
              <s-stack direction="inline" gap="base">
                <s-button
                  variant={!previewMode ? "primary" : "secondary"}
                  onClick={() => setPreviewMode(false)}
                >
                  HTML Source
                </s-button>
                <s-button
                  variant={previewMode ? "primary" : "secondary"}
                  onClick={() => setPreviewMode(true)}
                >
                  Preview
                </s-button>
              </s-stack>
            </div>

            {/* HTML Content Editor or Preview */}
            {!previewMode ? (
              <div>
                <label style={{ display: "block", marginBottom: "4px" }}>
                  <s-text type="strong">HTML Content</s-text>
                </label>
                <textarea
                  value={selectedTemplate.htmlContent || ""}
                  onChange={(e) =>
                    setSelectedTemplate({
                      ...selectedTemplate,
                      htmlContent: e.target.value,
                    })
                  }
                  rows={20}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #d2d5d8",
                    fontFamily: "monospace",
                    fontSize: "12px",
                  }}
                />
              </div>
            ) : (
              <div>
                <label style={{ display: "block", marginBottom: "4px" }}>
                  <s-text type="strong">Preview</s-text>
                </label>
                <div
                  style={{
                    border: "1px solid #d2d5d8",
                    borderRadius: "4px",
                    padding: "16px",
                    minHeight: "400px",
                    overflow: "auto",
                  }}
                  dangerouslySetInnerHTML={{
                    __html:
                      selectedTemplate.htmlContent || "<p>No content</p>",
                  }}
                />
              </div>
            )}

            {/* Text Content */}
            <div>
              <label style={{ display: "block", marginBottom: "4px" }}>
                <s-text type="strong">Plain Text Content</s-text>
                <s-paragraph style={{ fontSize: "12px", color: "#666" }}>
                  (For email clients that don't support HTML)
                </s-paragraph>
              </label>
              <textarea
                value={selectedTemplate.textContent || ""}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    textContent: e.target.value,
                  })
                }
                rows={10}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #d2d5d8",
                  fontFamily: "monospace",
                  fontSize: "12px",
                }}
              />
            </div>

            {/* Save button */}
            <s-stack justifyContent="end">
              <s-button
                variant="primary"
                onClick={handleSaveTemplate}
                loading={saving}
              >
                Save Template
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      )}
    </s-stack>
  );
}

export default function WarrantySettingsPage() {
  const {
    sources: initialSources,
    marketingText: initialMarketingText,
    claimMarketingText: initialClaimMarketingText,
    brevoApiKey: initialBrevoApiKey,
    brevoSenderEmail: initialBrevoSenderEmail,
    cloudName: initialCloudName,
    cloudinaryKey: initialCloudinaryKey,
    cloudinarySecret: initialCloudinarySecret,
  } = useLoaderData();

  const [sources, setSources] = useState(initialSources || []);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const [marketingText, setMarketingText] = useState(
    initialMarketingText || ""
  );
  const [marketingError, setMarketingError] = useState("");

  const [claimMarketingText, setClaimMarketingText] = useState(
    initialClaimMarketingText || ""
  );
  const [claimMarketingError, setClaimMarketingError] = useState("");

  // Email configuration state (Brevo)
  const [brevoApiKey, setBrevoApiKey] = useState(initialBrevoApiKey || "");
  const [brevoSenderEmail, setBrevoSenderEmail] = useState(
    initialBrevoSenderEmail || ""
  );
  const [emailConfigError, setEmailConfigError] = useState("");

  // Cloud configuration state (Cloudflare / Cloudinary)
  const [cloudName, setCloudName] = useState(initialCloudName || "");
  const [cloudinaryKey, setCloudinaryKey] = useState(
    initialCloudinaryKey || ""
  );
  const [cloudinarySecret, setCloudinarySecret] = useState(
    initialCloudinarySecret || ""
  );
  const [cloudConfigError, setCloudConfigError] = useState("");

  const [activeTab, setActiveTab] = useState("warranty-registration");

  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isSubmitting =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  // React to action responses (create/delete source, update marketing texts, update email & cloud config)
  useEffect(() => {
    if (!fetcher.data) return;

    // New source created
    if (fetcher.data.source?.id) {
      setSources((prev) => [...prev, fetcher.data.source]);
      setLabel("");
      setError("");
      shopify.toast.show("Purchase source added");
      return;
    }

    // Source deleted
    if (fetcher.data.deletedId) {
      const deletedId = fetcher.data.deletedId;
      setSources((prev) => prev.filter((s) => s.id !== deletedId));
      setError("");
      shopify.toast.show("Purchase source removed");
      return;
    }

    // Marketing text updated (registration form)
    if (fetcher.data.updatedMarketingText) {
      setMarketingText(fetcher.data.updatedMarketingText);
      setMarketingError("");
      shopify.toast.show("Marketing text updated");
      return;
    }

    // Marketing text updated (claim form)
    if (fetcher.data.updatedClaimMarketingText) {
      setClaimMarketingText(fetcher.data.updatedClaimMarketingText);
      setClaimMarketingError("");
      shopify.toast.show("Claim marketing text updated");
      return;
    }

    // Email configuration updated
    if (fetcher.data.updatedEmailSettings) {
      const { brevoApiKey, brevoSenderEmail } =
        fetcher.data.updatedEmailSettings;

      setBrevoApiKey(brevoApiKey || "");
      setBrevoSenderEmail(brevoSenderEmail || "");
      setEmailConfigError("");
      shopify.toast.show("Email configuration updated");
      return;
    }

    // Cloud configuration updated
    if (fetcher.data.updatedCloudSettings) {
      const { cloudName, cloudinaryKey, cloudinarySecret } =
        fetcher.data.updatedCloudSettings;

      setCloudName(cloudName || "");
      setCloudinaryKey(cloudinaryKey || "");
      setCloudinarySecret(cloudinarySecret || "");
      setCloudConfigError("");
      shopify.toast.show("Cloud configuration updated");
      return;
    }

    // Generic error
    if (fetcher.data.error) {
      // For simplicity we show the same error across all areas
      setError(fetcher.data.error);
      setMarketingError(fetcher.data.error);
      setClaimMarketingError(fetcher.data.error);
      setEmailConfigError(fetcher.data.error);
      setCloudConfigError(fetcher.data.error);
    }
  }, [fetcher.data, shopify]);

  const handleSubmitCreateSource = (event) => {
    event.preventDefault();

    if (!label.trim()) {
      setError("Purchase source label is required");
      return;
    }

    const formData = new FormData();
    formData.set("_intent", "create_source");
    formData.set("label", label.trim());
    fetcher.submit(formData, { method: "POST" });
  };

  const handleDeleteSource = (id) => {
    const formData = new FormData();
    formData.set("_intent", "delete_source");
    formData.set("id", id);
    fetcher.submit(formData, { method: "POST" });
  };

  const handleSubmitMarketingText = (event) => {
    event.preventDefault();

    if (!marketingText.trim()) {
      setMarketingError("Marketing text cannot be empty");
      return;
    }

    const formData = new FormData();
    formData.set("_intent", "update_marketing_text");
    formData.set("marketingText", marketingText.trim());
    fetcher.submit(formData, { method: "POST" });
  };

  const handleSubmitClaimMarketingText = (event) => {
    event.preventDefault();

    if (!claimMarketingText.trim()) {
      setClaimMarketingError("Claim marketing text cannot be empty");
      return;
    }

    const formData = new FormData();
    formData.set("_intent", "update_claim_marketing_text");
    formData.set("claimMarketingText", claimMarketingText.trim());
    fetcher.submit(formData, { method: "POST" });
  };

  const handleSubmitEmailConfig = (event) => {
    event.preventDefault();

    if (!brevoApiKey.trim()) {
      setEmailConfigError("Brevo API key cannot be empty");
      return;
    }

    if (!brevoSenderEmail.trim()) {
      setEmailConfigError("Brevo sender email cannot be empty");
      return;
    }

    const formData = new FormData();
    formData.set("_intent", "update_email_config");
    formData.set("brevoApiKey", brevoApiKey.trim());
    formData.set("brevoSenderEmail", brevoSenderEmail.trim());

    fetcher.submit(formData, { method: "POST" });
  };

  const handleSubmitCloudConfig = (event) => {
    event.preventDefault();

    if (!cloudName.trim()) {
      setCloudConfigError("Cloud name cannot be empty");
      return;
    }

    if (!cloudinaryKey.trim()) {
      setCloudConfigError("Cloudinary key cannot be empty");
      return;
    }

    if (!cloudinarySecret.trim()) {
      setCloudConfigError("Cloudinary secret cannot be empty");
      return;
    }

    const formData = new FormData();
    formData.set("_intent", "update_cloud_config");
    formData.set("cloudName", cloudName.trim());
    formData.set("cloudinaryKey", cloudinaryKey.trim());
    formData.set("cloudinarySecret", cloudinarySecret.trim());

    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <s-page heading="Warranty settings">
      {/* TAB BAR */}
      <s-box
        padding="base"
        border="none"
        borderRadius="base"
        background="transparent"
        style={{ marginBottom: "1rem" }}
      >
        <s-stack direction="inline" gap="base">
          <s-button
            variant={
              activeTab === "warranty-registration" ? "primary" : "secondary"
            }
            onClick={() => setActiveTab("warranty-registration")}
          >
            Warranty registration form
          </s-button>

          <s-button
            variant={activeTab === "claim-warranty" ? "primary" : "secondary"}
            onClick={() => setActiveTab("claim-warranty")}
          >
            Claim warranty form
          </s-button>

          <s-button
            variant={
              activeTab === "email-configurations" ? "primary" : "secondary"
            }
            onClick={() => setActiveTab("email-configurations")}
          >
            Email configurations
          </s-button>

          <s-button
            variant={activeTab === "email-templates" ? "primary" : "secondary"}
            onClick={() => setActiveTab("email-templates")}
          >
            Email templates
          </s-button>

          {/* NEW: Cloud config tab */}
          <s-button
            variant={
              activeTab === "cloud-configurations" ? "primary" : "secondary"
            }
            onClick={() => setActiveTab("cloud-configurations")}
          >
            Cloudflare / Cloudinary configuration
          </s-button>
        </s-stack>
      </s-box>

      {/* TAB CONTENTS */}

      {/* 1) WARRANTY REGISTRATION FORM */}
      {activeTab === "warranty-registration" && (
        <>
          <s-section heading="Purchase source options">
            <s-paragraph>
              Manage the <s-strong>Purchase Source</s-strong> values that appear
              in your warranty activation form (for example: Amazon, Mobitel
              Website, Ebay).
            </s-paragraph>

            {/* Add new source */}
            <s-box
              padding="base"
              border="small subdued solid"
              borderRadius="base"
              background="transparent"
              style={{ marginTop: "1rem" }}
            >
              <form onSubmit={handleSubmitCreateSource}>
                <s-stack direction="block" gap="base">
                  <div>
                    <s-text type="strong">New purchase source</s-text>
                    <input
                      name="label"
                      value={label}
                      onChange={(e) => {
                        setLabel(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="e.g. Amazon, Mobitel Website, Ebay"
                      style={{
                        width: "100%",
                        marginTop: "0.5rem",
                        padding: "0.4rem",
                        borderRadius: "4px",
                        border:
                          "1px solid var(--p-color-border-subdued, #d2d5d8)",
                      }}
                    />
                    {error && (
                      <p
                        style={{
                          color: "var(--p-color-critical, #d72c0d)",
                          marginTop: "0.35rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        {error}
                      </p>
                    )}
                  </div>

                  <s-button
                    type="submit"
                    variant="primary"
                    {...(isSubmitting ? { loading: true } : {})}
                    disabled={!label.trim()}
                  >
                    Add purchase source
                  </s-button>
                </s-stack>
              </form>
            </s-box>

            {/* Existing sources with remove buttons */}
            <s-section
              heading="Existing purchase sources"
              style={{ marginTop: "1.5rem" }}
            >
              {sources.length === 0 ? (
                <s-paragraph>
                  No purchase sources yet. Add at least one above.
                </s-paragraph>
              ) : (
                <s-stack direction="block" gap="small">
                  {sources.map((s) => (
                    <s-box
                      key={s.id}
                      padding="small"
                      border="small subdued solid"
                      borderRadius="base"
                      background="transparent"
                    >
                      <s-stack
                        direction="inline"
                        gap="base"
                        alignItems="center"
                      >
                        <s-text>{s.label}</s-text>
                        <s-button
                          tone="critical"
                          variant="tertiary"
                          onClick={() => handleDeleteSource(s.id)}
                        >
                          Remove
                        </s-button>
                      </s-stack>
                    </s-box>
                  ))}
                </s-stack>
              )}
            </s-section>
          </s-section>

          {/* Marketing consent text editor (registration form) */}
          <s-section heading="Marketing consent text">
            <s-paragraph>
              This text appears next to the marketing consent checkbox on your
              warranty activation form.
            </s-paragraph>

            <s-box
              padding="base"
              border="small subdued solid"
              borderRadius="base"
              background="transparent"
              style={{ marginTop: "1rem" }}
            >
              <form onSubmit={handleSubmitMarketingText}>
                <s-stack direction="block" gap="base">
                  <div>
                    <s-text type="strong">Marketing consent text</s-text>
                    <textarea
                      name="marketingText"
                      value={marketingText}
                      onChange={(e) => {
                        setMarketingText(e.target.value);
                        if (marketingError) setMarketingError("");
                      }}
                      rows={4}
                      style={{
                        width: "100%",
                        marginTop: "0.5rem",
                        padding: "0.4rem",
                        borderRadius: "4px",
                        border:
                          "1px solid var(--p-color-border-subdued, #d2d5d8)",
                        resize: "vertical",
                      }}
                    />
                    {marketingError && (
                      <p
                        style={{
                          color: "var(--p-color-critical, #d72c0d)",
                          marginTop: "0.35rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        {marketingError}
                      </p>
                    )}
                  </div>

                  <s-button
                    type="submit"
                    variant="primary"
                    {...(isSubmitting ? { loading: true } : {})}
                    disabled={!marketingText.trim()}
                  >
                    Save marketing text
                  </s-button>
                </s-stack>
              </form>
            </s-box>
          </s-section>
        </>
      )}

      {/* 2) CLAIM WARRANTY FORM TAB */}
      {activeTab === "claim-warranty" && (
        <s-section heading="Claim warranty form">
          <s-paragraph>
            This text appears next to the marketing consent checkbox on your
            <s-strong> claim warranty form</s-strong>.
          </s-paragraph>

          <s-box
            padding="base"
            border="small subdued solid"
            borderRadius="base"
            background="transparent"
            style={{ marginTop: "1rem" }}
          >
            <form onSubmit={handleSubmitClaimMarketingText}>
              <s-stack direction="block" gap="base">
                <div>
                  <s-text type="strong">
                    Claim form marketing consent text
                  </s-text>
                  <textarea
                    name="claimMarketingText"
                    value={claimMarketingText}
                    onChange={(e) => {
                      setClaimMarketingText(e.target.value);
                      if (claimMarketingError) setClaimMarketingError("");
                    }}
                    rows={4}
                    style={{
                      width: "100%",
                      marginTop: "0.5rem",
                      padding: "0.4rem",
                      borderRadius: "4px",
                      border:
                        "1px solid var(--p-color-border-subdued, #d2d5d8)",
                      resize: "vertical",
                    }}
                  />
                  {claimMarketingError && (
                    <p
                      style={{
                        color: "var(--p-color-critical, #d72c0d)",
                        marginTop: "0.35rem",
                        fontSize: "0.85rem",
                      }}
                    >
                      {claimMarketingError}
                    </p>
                  )}
                </div>

                <s-button
                  type="submit"
                  variant="primary"
                  {...(isSubmitting ? { loading: true } : {})}
                  disabled={!claimMarketingText.trim()}
                >
                  Save claim marketing text
                </s-button>
              </s-stack>
            </form>
          </s-box>
        </s-section>
      )}

      {/* 3) EMAIL CONFIGURATIONS TAB */}
      {activeTab === "email-configurations" && (
        <s-section heading="Email configurations">
          <s-paragraph>
            Configure your Brevo email integration here. These settings will be
            used when sending warranty-related emails.
          </s-paragraph>

          <s-box
            padding="base"
            border="small subdued solid"
            borderRadius="base"
            background="transparent"
            style={{ marginTop: "1rem" }}
          >
            <form onSubmit={handleSubmitEmailConfig}>
              <s-stack direction="block" gap="base">
                {/* Brevo API Key */}
                <div>
                  <s-text type="strong">Brevo API key</s-text>
                  <input
                    type="password"
                    name="brevoApiKey"
                    value={brevoApiKey}
                    onChange={(e) => {
                      setBrevoApiKey(e.target.value);
                      if (emailConfigError) setEmailConfigError("");
                    }}
                    placeholder="Paste your Brevo API key"
                    style={{
                      width: "100%",
                      marginTop: "0.5rem",
                      padding: "0.4rem",
                      borderRadius: "4px",
                      border:
                        "1px solid var(--p-color-border-subdued, #d2d5d8)",
                    }}
                  />
                </div>

                {/* Brevo Sender Email */}
                <div>
                  <s-text type="strong">Brevo sender email</s-text>
                  <input
                    type="email"
                    name="brevoSenderEmail"
                    value={brevoSenderEmail}
                    onChange={(e) => {
                      setBrevoSenderEmail(e.target.value);
                      if (emailConfigError) setEmailConfigError("");
                    }}
                    placeholder="e.g. no-reply@yourstore.com"
                    style={{
                      width: "100%",
                      marginTop: "0.5rem",
                      padding: "0.4rem",
                      borderRadius: "4px",
                      border:
                        "1px solid var(--p-color-border-subdued, #d2d5d8)",
                    }}
                  />
                </div>

                {/* Error message (if any) */}
                {emailConfigError && (
                  <p
                    style={{
                      color: "var(--p-color-critical, #d72c0d)",
                      marginTop: "0.35rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    {emailConfigError}
                  </p>
                )}

                {/* Submit button */}
                <s-button
                  type="submit"
                  variant="primary"
                  {...(isSubmitting ? { loading: true } : {})}
                  disabled={!brevoApiKey.trim() || !brevoSenderEmail.trim()}
                >
                  Save email configuration
                </s-button>
              </s-stack>
            </form>
          </s-box>
        </s-section>
      )}

      {/* 4) EMAIL TEMPLATES TAB */}
      {activeTab === "email-templates" && (
        <s-section heading="Email templates">
          <s-paragraph>
            Customize the email templates sent to customers for warranty and
            claim notifications. Use{" "}
            <code
              style={{
                backgroundColor: "#f3f4f6",
                padding: "2px 4px",
                borderRadius: "3px",
              }}
            >
              {"{{variable}}"}
            </code>{" "}
            placeholders to insert dynamic content.
          </s-paragraph>

          <s-box
            padding="base"
            border="small subdued solid"
            borderRadius="base"
            background="transparent"
            style={{ marginTop: "1rem" }}
          >
            <EmailTemplateEditor />
          </s-box>
        </s-section>
      )}

      {/* 5) CLOUD CONFIGURATIONS TAB */}
      {activeTab === "cloud-configurations" && (
        <s-section heading="Cloudflare / Cloudinary configuration">
          <s-paragraph>
            Configure your Cloud / media storage settings here. These values
            will be used when uploading and managing media for
            warranty-related features.
          </s-paragraph>

          <s-box
            padding="base"
            border="small subdued solid"
            borderRadius="base"
            background="transparent"
            style={{ marginTop: "1rem" }}
          >
            <form onSubmit={handleSubmitCloudConfig}>
              <s-stack direction="block" gap="base">
                {/* CLOUDNAME */}
                <div>
                  <s-text type="strong">Cloud name</s-text>
                  <input
                    type="text"
                    name="cloudName"
                    value={cloudName}
                    onChange={(e) => {
                      setCloudName(e.target.value);
                      if (cloudConfigError) setCloudConfigError("");
                    }}
                    placeholder="Your cloud name"
                    style={{
                      width: "100%",
                      marginTop: "0.5rem",
                      padding: "0.4rem",
                      borderRadius: "4px",
                      border:
                        "1px solid var(--p-color-border-subdued, #d2d5d8)",
                    }}
                  />
                </div>

                {/* CLOUDINARY_KEY */}
                <div>
                  <s-text type="strong">Cloudinary key</s-text>
                  <input
                    type="text"
                    name="cloudinaryKey"
                    value={cloudinaryKey}
                    onChange={(e) => {
                      setCloudinaryKey(e.target.value);
                      if (cloudConfigError) setCloudConfigError("");
                    }}
                    placeholder="Your Cloudinary API key"
                    style={{
                      width: "100%",
                      marginTop: "0.5rem",
                      padding: "0.4rem",
                      borderRadius: "4px",
                      border:
                        "1px solid var(--p-color-border-subdued, #d2d5d8)",
                    }}
                  />
                </div>

                {/* CLOUDINARY_SECRET */}
                <div>
                  <s-text type="strong">Cloudinary secret</s-text>
                  <input
                    type="password"
                    name="cloudinarySecret"
                    value={cloudinarySecret}
                    onChange={(e) => {
                      setCloudinarySecret(e.target.value);
                      if (cloudConfigError) setCloudConfigError("");
                    }}
                    placeholder="Your Cloudinary API secret"
                    style={{
                      width: "100%",
                      marginTop: "0.5rem",
                      padding: "0.4rem",
                      borderRadius: "4px",
                      border:
                        "1px solid var(--p-color-border-subdued, #d2d5d8)",
                    }}
                  />
                </div>

                {/* Error message (if any) */}
                {cloudConfigError && (
                  <p
                    style={{
                      color: "var(--p-color-critical, #d72c0d)",
                      marginTop: "0.35rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    {cloudConfigError}
                  </p>
                )}

                {/* Submit button */}
                <s-button
                  type="submit"
                  variant="primary"
                  {...(isSubmitting ? { loading: true } : {})}
                  disabled={
                    !cloudName.trim() ||
                    !cloudinaryKey.trim() ||
                    !cloudinarySecret.trim()
                  }
                >
                  Save cloud configuration
                </s-button>
              </s-stack>
            </form>
          </s-box>
        </s-section>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};