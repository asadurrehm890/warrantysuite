// app/emailTemplates.server.js
import prisma from "./db.server";
import { renderEmailTemplate, getEmailTemplate } from "./utils/emailRenderer";
import { sendBrevoEmail } from "./claimWarranty.server";

// Helper: format date nicely
function formatDate(dateString) {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

// Default template definitions (fallbacks)
const DEFAULT_TEMPLATES = {
  warranty_approved: {
    subject: "✅ Your warranty for {{productName}} has been approved",
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
  <h2 style="color: #111827; margin-bottom: 16px;">Warranty Approved</h2>
  <p style="margin: 4px 0;">Hello {{customerName}},</p>
  <p style="margin: 4px 0;">Great news! Your warranty registration has been <strong style="color: #10b981;">approved</strong>.</p>
  
  <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <h3 style="margin: 0 0 12px 0;">Warranty Details</h3>
    <p style="margin: 4px 0;"><strong>Product:</strong> {{productName}}</p>
    <p style="margin: 4px 0;"><strong>Order Number:</strong> {{orderNumber}}</p>
    <p style="margin: 4px 0;"><strong>Serial Number:</strong> {{serialNumber}}</p>
    <p style="margin: 4px 0;"><strong>Warranty Period:</strong> {{startDate}} - {{endDate}}</p>
    <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #10b981;">Approved</span></p>
  </div>
  
  <p style="margin: 16px 0 0 0;">Your warranty is now active and valid until {{endDate}}.</p>
  <p style="margin: 16px 0 0 0;">Best regards,<br/>Warranty Support Team{{#if shopDomain}}<br/>{{shopDomain}}{{/if}}</p>
</div>`,
    textContent: `Warranty Approved

Hello {{customerName}},

Great news! Your warranty registration has been APPROVED.

Warranty Details:
- Product: {{productName}}
- Order Number: {{orderNumber}}
- Serial Number: {{serialNumber}}
- Warranty Period: {{startDate}} - {{endDate}}
- Status: Approved

Your warranty is now active and valid until {{endDate}}.

Best regards,
Warranty Support Team{{#if shopDomain}} - {{shopDomain}}{{/if}}`
  },
  warranty_disapproved: {
    subject: "❌ Update regarding your warranty for {{productName}}",
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
  <h2 style="color: #111827; margin-bottom: 16px;">Warranty Status Update</h2>
  <p style="margin: 4px 0;">Hello {{customerName}},</p>
  <p style="margin: 4px 0;">We regret to inform you that your warranty registration has been <strong style="color: #ef4444;">disapproved</strong>.</p>
  
  <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #fee2e2;">
    <h3 style="margin: 0 0 12px 0; color: #991b1b;">Warranty Details</h3>
    <p style="margin: 4px 0;"><strong>Product:</strong> {{productName}}</p>
    <p style="margin: 4px 0;"><strong>Order Number:</strong> {{orderNumber}}</p>
    <p style="margin: 4px 0;"><strong>Serial Number:</strong> {{serialNumber}}</p>
    <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #ef4444;">Disapproved</span></p>
  </div>
  
  <p style="margin: 16px 0 0 0;">If you believe this is an error or would like more information, please contact our support team.</p>
  <p style="margin: 16px 0 0 0;">Best regards,<br/>Warranty Support Team{{#if shopDomain}}<br/>{{shopDomain}}{{/if}}</p>
</div>`,
    textContent: `Warranty Status Update

Hello {{customerName}},

We regret to inform you that your warranty registration has been DISAPPROVED.

Warranty Details:
- Product: {{productName}}
- Order Number: {{orderNumber}}
- Serial Number: {{serialNumber}}
- Status: Disapproved

If you believe this is an error or would like more information, please contact our support team.

Best regards,
Warranty Support Team{{#if shopDomain}} - {{shopDomain}}{{/if}}`
  },
  claim_approved: {
    subject: "✅ Your warranty claim has been approved",
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
  <h2 style="color: #111827; margin-bottom: 16px;">Warranty Claim Approved</h2>
  <p style="margin: 4px 0;">Hello {{customerName}},</p>
  <p style="margin: 4px 0;">Good news! Your warranty claim has been <strong style="color: #10b981;">approved</strong>.</p>
  
  <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <h3 style="margin: 0 0 12px 0;">Claim Details</h3>
    <p style="margin: 4px 0;"><strong>Claim ID:</strong> {{claimId}}</p>
    <p style="margin: 4px 0;"><strong>Claim Type:</strong> {{claimType}}</p>
    <p style="margin: 4px 0;"><strong>Description:</strong> {{claimDescription}}</p>
    <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #10b981;">Approved</span></p>
  </div>
  
  <p style="margin: 16px 0 0 0;">Our team will process your claim and follow up with next steps shortly.</p>
  <p style="margin: 16px 0 0 0;">Best regards,<br/>Claims Support Team{{#if shopDomain}}<br/>{{shopDomain}}{{/if}}</p>
</div>`,
    textContent: `Warranty Claim Approved

Hello {{customerName}},

Good news! Your warranty claim has been APPROVED.

Claim Details:
- Claim ID: {{claimId}}
- Claim Type: {{claimType}}
- Description: {{claimDescription}}
- Status: Approved

Our team will process your claim and follow up with next steps shortly.

Best regards,
Claims Support Team{{#if shopDomain}} - {{shopDomain}}{{/if}}`
  },
  claim_rejected: {
    subject: "❌ Update regarding your warranty claim",
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
  <h2 style="color: #111827; margin-bottom: 16px;">Warranty Claim Update</h2>
  <p style="margin: 4px 0;">Hello {{customerName}},</p>
  <p style="margin: 4px 0;">We have reviewed your warranty claim and regret to inform you that it has been <strong style="color: #ef4444;">rejected</strong>.</p>
  
  <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #fee2e2;">
    <h3 style="margin: 0 0 12px 0; color: #991b1b;">Claim Details</h3>
    <p style="margin: 4px 0;"><strong>Claim ID:</strong> {{claimId}}</p>
    <p style="margin: 4px 0;"><strong>Claim Type:</strong> {{claimType}}</p>
    <p style="margin: 4px 0;"><strong>Description:</strong> {{claimDescription}}</p>
    <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #ef4444;">Rejected</span></p>
  </div>
  
  <p style="margin: 16px 0 0 0;">If you have questions about this decision or would like to provide additional information, please contact our support team.</p>
  <p style="margin: 16px 0 0 0;">Best regards,<br/>Claims Support Team{{#if shopDomain}}<br/>{{shopDomain}}{{/if}}</p>
</div>`,
    textContent: `Warranty Claim Update

Hello {{customerName}},

We have reviewed your warranty claim and regret to inform you that it has been REJECTED.

Claim Details:
- Claim ID: {{claimId}}
- Claim Type: {{claimType}}
- Description: {{claimDescription}}
- Status: Rejected

If you have questions about this decision or would like to provide additional information, please contact our support team.

Best regards,
Claims Support Team{{#if shopDomain}} - {{shopDomain}}{{/if}}`
  }
};

// Generic function to send templated email
async function sendTemplatedEmail({
  shopDomain,
  customerEmail,
  customerName,
  templateType,
  data,
}) {
  // Get template from database or use default
  const template = await getEmailTemplate(
    prisma,
    shopDomain,
    templateType,
    DEFAULT_TEMPLATES[templateType]
  );
  
  // Render the template with data
  const rendered = renderEmailTemplate(template, {
    customerName: customerName || customerEmail?.split("@")[0] || "Valued Customer",
    shopDomain,
    ...data,
  });
  
  // Send the email
  return sendBrevoEmail({
    shop: shopDomain,
    toEmail: customerEmail,
    toName: customerName,
    subject: rendered.subject,
    htmlContent: rendered.htmlContent,
    textContent: rendered.textContent,
    tags: ["warranty", templateType],
  });
}

// Updated email functions using the template system
export async function sendWarrantyApprovedEmail({
  customerEmail,
  customerName,
  warrantyDetails,
  shopDomain,
}) {
  const productName = warrantyDetails.productName || "your product";
  const orderNumber = warrantyDetails.orderNumber || "N/A";
  const serialNumber = warrantyDetails.serialNumber || "N/A";
  const startDate = formatDate(warrantyDetails.warrantyStartDate);
  const endDate = formatDate(warrantyDetails.warrantyEndDate);
  
  return sendTemplatedEmail({
    shopDomain,
    customerEmail,
    customerName,
    templateType: "warranty_approved",
    data: {
      productName,
      orderNumber,
      serialNumber,
      startDate,
      endDate,
    },
  });
}

export async function sendWarrantyDisapprovedEmail({
  customerEmail,
  customerName,
  warrantyDetails,
  shopDomain,
}) {
  const productName = warrantyDetails.productName || "your product";
  const orderNumber = warrantyDetails.orderNumber || "N/A";
  const serialNumber = warrantyDetails.serialNumber || "N/A";
  
  return sendTemplatedEmail({
    shopDomain,
    customerEmail,
    customerName,
    templateType: "warranty_disapproved",
    data: {
      productName,
      orderNumber,
      serialNumber,
    },
  });
}

export async function sendWarrantyClaimApprovedEmail({
  customerEmail,
  customerName,
  claimDetails,
  warrantyDetails,
  shopDomain,
}) {
  return sendTemplatedEmail({
    shopDomain,
    customerEmail,
    customerName,
    templateType: "claim_approved",
    data: {
      claimId: claimDetails.id,
      claimType: claimDetails.claim_type || "N/A",
      claimDescription: claimDetails.claim_description || "N/A",
    },
  });
}

export async function sendWarrantyClaimRejectedEmail({
  customerEmail,
  customerName,
  claimDetails,
  warrantyDetails,
  shopDomain,
}) {
  return sendTemplatedEmail({
    shopDomain,
    customerEmail,
    customerName,
    templateType: "claim_rejected",
    data: {
      claimId: claimDetails.id,
      claimType: claimDetails.claim_type || "N/A",
      claimDescription: claimDetails.claim_description || "N/A",
    },
  });
}