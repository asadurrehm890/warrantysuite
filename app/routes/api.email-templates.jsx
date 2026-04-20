// app/routes/api.email-templates.jsx
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  
  const where = { shop };
  if (type) where.type = type;
  
  const templates = await prisma.emailTemplate.findMany({
    where,
    orderBy: { type: "asc" },
  });
  
  return Response.json({ templates });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const formData = await request.formData();
  const intent = formData.get("_intent");
  
  if (intent === "save_template") {
    const type = formData.get("type");
    const subject = formData.get("subject");
    const htmlContent = formData.get("htmlContent");
    const textContent = formData.get("textContent");
    
    if (!type || !subject || !htmlContent || !textContent) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const template = await prisma.emailTemplate.upsert({
      where: {
        shop_type: {
          shop,
          type,
        },
      },
      update: {
        subject,
        htmlContent,
        textContent,
      },
      create: {
        shop,
        type,
        subject,
        htmlContent,
        textContent,
      },
    });
    
    return Response.json({ success: true, template });
  }
  
  if (intent === "reset_template") {
    const type = formData.get("type");
    
    // Get default template
    const defaultTemplate = getDefaultTemplate(type);
    if (!defaultTemplate) {
      return Response.json({ error: "Invalid template type" }, { status: 400 });
    }
    
    const template = await prisma.emailTemplate.upsert({
      where: {
        shop_type: {
          shop,
          type,
        },
      },
      update: {
        subject: defaultTemplate.subject,
        htmlContent: defaultTemplate.htmlContent,
        textContent: defaultTemplate.textContent,
      },
      create: {
        shop,
        type,
        subject: defaultTemplate.subject,
        htmlContent: defaultTemplate.htmlContent,
        textContent: defaultTemplate.textContent,
      },
    });
    
    return Response.json({ success: true, template });
  }
  
  return Response.json({ error: "Unknown intent" }, { status: 400 });
};

// Default templates
function getDefaultTemplate(type) {
  const templates = {
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
  
  return templates[type];
}