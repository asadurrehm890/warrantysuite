// app/claimWarranty.server.js
import prisma from "./db.server";
import { decryptSecret } from "./utils/crypto.server";

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

  const apiKey = decryptSecret(settings.brevoApiKey);
  const senderEmail = settings.brevoSenderEmail;

  if (!apiKey) {
    throw new Error(`Brevo API key is not configured for shop ${shop}`);
  }
  if (!senderEmail) {
    throw new Error(`Brevo sender email is not configured for shop ${shop}`);
  }

  return { apiKey, senderEmail };
}

export async function sendBrevoEmail({
  shop,
  toEmail,
  toName,
  subject,
  htmlContent,
  textContent,
  tags = [],
}) {
  const { apiKey, senderEmail } = await getBrevoConfigForShop(shop);

  const safeToEmail = String(toEmail || "").trim();
  const safeToName =
    toName && String(toName).trim().length > 0
      ? String(toName).trim()
      : safeToEmail
      ? safeToEmail.split("@")[0]
      : "Customer";

  const requestBody = {
    sender: { name: "Warranty Service", email: senderEmail },
    to: [{ email: safeToEmail, name: safeToName }],
    subject,
    textContent,
    htmlContent,
    tags,
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(`Brevo API ${response.status} for ${shop}:`, errBody.slice(0, 200));
    throw new Error(`Brevo API responded ${response.status}`);
  }

  return response.json();
}
