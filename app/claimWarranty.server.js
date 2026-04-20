// app/claimWarranty.server.js
import crypto from "crypto";
import prisma from "./db.server";

// ==============================
// Load Brevo config from Prisma
// ==============================
async function getBrevoConfigForShop(shop) {
  if (!shop) {
    throw new Error("Shop is required to load Brevo configuration");
  }

  const settings = await prisma.warrantySettings.findUnique({
    where: { shop },
  });

  if (!settings) {
    throw new Error(`No warranty settings found for shop ${shop}`);
  }

  const { brevoApiKey, brevoSenderEmail } = settings;

  if (!brevoApiKey) {
    throw new Error(`Brevo API key is not configured for shop ${shop}`);
  }

  if (!brevoSenderEmail) {
    throw new Error(`Brevo sender email is not configured for shop ${shop}`);
  }

  return {
    apiKey: brevoApiKey,
    senderEmail: brevoSenderEmail,
  };
}

// ==============================
// Brevo low-level email sender
// ==============================
//
// IMPORTANT: now requires `shop` so we can read the correct config
//
export async function sendBrevoEmail({
  shop,         // e.g. "store.myshopify.com"
  toEmail,
  toName,
  subject,
  htmlContent,
  textContent,
  tags = [],
}) {
  // Load Brevo config from WarrantySettings
  const { apiKey, senderEmail } = await getBrevoConfigForShop(shop);
  const senderName = "Warranty Service";

  console.log("📧 Attempting to send email:", {
    shop,
    toEmail,
    toName,
    subject,
    senderEmail,
    hasApiKey: !!apiKey,
    tags,
  });

  const safeToEmail = String(toEmail || "").trim();
  const safeToName =
    toName && String(toName).trim().length > 0
      ? String(toName).trim()
      : safeToEmail
      ? safeToEmail.split("@")[0]
      : "Customer";

  const requestBody = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: safeToEmail,
        name: safeToName,
      },
    ],
    subject,
    textContent,
    htmlContent,
    tags,
  };

  console.log("📤 Brevo API request:", {
    url: "https://api.brevo.com/v3/smtp/email",
    shop,
    sender: requestBody.sender,
    to: requestBody.to,
    subject: requestBody.subject,
    tags: requestBody.tags,
  });

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    console.log("📨 Brevo API response status:", response.status);
    console.log(
      "📨 Brevo API response data:",
      JSON.stringify(responseData, null, 2),
    );

    if (!response.ok) {
      console.error("❌ Brevo API Error Details:", {
        status: response.status,
        statusText: response.statusText,
        error: responseData,
      });
      throw new Error(
        `Failed to send email via Brevo: ${
          responseData.message || responseData.error || "Unknown error"
        }`,
      );
    }

    console.log("✅ Brevo email sent successfully:", responseData);
    return responseData;
  } catch (error) {
    console.error("❌ Error sending Brevo email:", error);
    throw error;
  }
}

// ==============================
// Helper: label formatter
// ==============================
function formatLabel(key) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

// ==============================
// PUBLIC: send claim details email
// ==============================
/**
 * Send an email to the customer with the details of one or more claims.
 *
//  * @param {string} customerEmail - Customer's email address
//  * @param {Array<Object>|Object} claims - claim or array of claims
//  * @param {Object} options
//  * @param {string} [options.shopDomain] - e.g. "mystore.myshopify.com"
 */
// export async function sendClaimDetailsEmail(
//   customerEmail,
//   claims,
//   { shopDomain } = {},
// ) {
//   const claimsArray = Array.isArray(claims) ? claims : [claims];
//   const shop = shopDomain; // use the same `shop` as WarrantySettings.shop

//   // Construct HTML for each claim
//   const claimsHtml = claimsArray
//     .map((claim) => {
//       const status = claim.status || "Pending Review";
//       const claimType = claim.claim_type || "N/A";
//       const description = claim.claim_description || "N/A";
//       const submittedAt = claim.submitted_at || "N/A";

//       // Parse warranty_details
//       let warrantyDetailsHtml = "";
//       try {
//         if (claim.warranty_details) {
//           const warrantyDetails = JSON.parse(claim.warranty_details);
//           if (warrantyDetails && typeof warrantyDetails === "object") {
//             const items = Object.entries(warrantyDetails)
//               .map(([key, value]) => {
//                 const label = formatLabel(key);
//                 const val =
//                   typeof value === "string" || typeof value === "number"
//                     ? String(value)
//                     : JSON.stringify(value);
//                 return `<p style="margin: 4px 0;"><strong>${label}:</strong> ${val}</p>`;
//               })
//               .join("");

//             warrantyDetailsHtml = `
//               <div style="margin-top: 8px;">
//                 <h4 style="margin: 8px 0;">Product / warranty details</h4>
//                 ${items}
//               </div>
//             `;
//           }
//         }
//       } catch (e) {
//         console.error("Failed to parse warranty_details in email:", e);
//       }

//       // Parse file_urls
//       let attachmentsHtml = "";
//       try {
//         if (claim.file_urls) {
//           const fileUrls = JSON.parse(claim.file_urls) || [];
//           if (Array.isArray(fileUrls) && fileUrls.length > 0) {
//             const links = fileUrls
//               .map(
//                 (url, index) =>
//                   `<li style="margin: 2px 0;"><a href="${url}" target="_blank" rel="noopener noreferrer">Attachment ${
//                     index + 1
//                   }</a></li>`,
//               )
//               .join("");

//             attachmentsHtml = `
//               <div style="margin-top: 8px;">
//                 <h4 style="margin: 8px 0;">Attachments</h4>
//                 <ul style="padding-left: 16px; margin: 4px 0;">
//                   ${links}
//                 </ul>
//               </div>
//             `;
//           }
//         }
//       } catch (e) {
//         console.error("Failed to parse file_urls in email:", e);
//       }

//       return `
//         <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
//           <p style="margin: 4px 0;"><strong>Claim ID:</strong> ${claim.id}</p>
//           <p style="margin: 4px 0;"><strong>Status:</strong> ${status}</p>
//           <p style="margin: 4px 0;"><strong>Claim type:</strong> ${claimType}</p>
//           <p style="margin: 4px 0;"><strong>Description:</strong> ${description}</p>
//           <p style="margin: 4px 0;"><strong>Submitted at:</strong> ${submittedAt}</p>
//           ${warrantyDetailsHtml}
//           ${attachmentsHtml}
//         </div>
//       `;
//     })
//     .join("");

//   const subject =
//     claimsArray.length === 1
//       ? "Update regarding your warranty claim"
//       : "Update regarding your warranty claims";

//   const shopText = shopDomain ? ` with ${shopDomain}` : "";

//   const htmlContent = `
//     <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
//       <h2 style="color: #111827; margin-bottom: 8px;">Warranty claim update${shopText}</h2>
//       <p style="margin: 4px 0;">Hello,</p>
//       <p style="margin: 4px 0;">
//         We’re contacting you with an update on the following warranty claim${
//           claimsArray.length > 1 ? "s" : ""
//         }:
//       </p>
//       <div style="margin-top: 16px;">
//         ${claimsHtml}
//       </div>
//       <p style="margin-top: 16px;">
//         If you have any questions, please reply to this email or contact our support team.
//       </p>
//       <p style="margin: 16px 0 0 0;">Best regards,<br/>Customer Support${
//         shopDomain ? `<br/>${shopDomain}` : ""
//       }</p>
//       <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
//       <p style="color: #6b7280; font-size: 12px;">
//         This is an automated message related to your warranty claim. If you believe you received this in error, please ignore it.
//       </p>
//     </div>
//   `;

//   const textContent =
//     claimsArray
//       .map((claim, idx) => {
//         const status = claim.status || "Pending Review";
//         const claimType = claim.claim_type || "N/A";
//         const description = claim.claim_description || "N/A";
//         const submittedAt = claim.submitted_at || "N/A";

//         return [
//           `Claim ${idx + 1}:`,
//           `  ID: ${claim.id}`,
//           `  Status: ${status}`,
//           `  Type: ${claimType}`,
//           `  Description: ${description}`,
//           `  Submitted at: ${submittedAt}`,
//           "",
//         ].join("\n");
//       })
//       .join("\n") +
//     "\n\nIf you have questions about these claims, reply to this email.\n";

//   return sendBrevoEmail({
//     shop, // NEW: use the shop's Brevo config
//     toEmail: customerEmail,
//     toName: customerEmail.split("@")[0],
//     subject,
//     htmlContent,
//     textContent,
//     tags: ["warranty-claim", "claim-update"],
//   });
// }