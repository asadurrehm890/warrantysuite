// app/otpStore.server.js
import crypto from "crypto";
import prisma from "./db.server";
import { decryptSecret } from "./utils/crypto.server";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Hash OTP before storing so the database never holds plaintext codes.
function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

// Load Brevo configuration for a specific shop from Prisma (decrypted).
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

  const brevoApiKey = decryptSecret(settings.brevoApiKey);
  const brevoSenderEmail = settings.brevoSenderEmail;

  if (!brevoApiKey) {
    throw new Error(`Brevo API key is not configured for shop ${shop}`);
  }
  if (!brevoSenderEmail) {
    throw new Error(`Brevo sender email is not configured for shop ${shop}`);
  }

  return { apiKey: brevoApiKey, senderEmail: brevoSenderEmail };
}

async function sendBrevoEmail(shop, email, code) {
  const { apiKey, senderEmail } = await getBrevoConfigForShop(shop);

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Warranty Activation", email: senderEmail },
      to: [{ email, name: email.split("@")[0] }],
      subject: "Your Warranty Activation OTP",
      textContent: `Your OTP code is: ${code}. It is valid for 10 minutes.`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Warranty Activation OTP</h2>
          <p>Your One-Time Password for warranty activation is:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #2563eb;">${code}</span>
          </div>
          <p>This OTP is valid for <strong>10 minutes</strong>.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
      tags: ["otp", "warranty-activation"],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `Brevo API responded ${response.status}: ${errBody.slice(0, 200)}`
    );
  }
}

// Best-effort cleanup of expired OTPs (cheap; runs alongside writes).
async function purgeExpired() {
  try {
    await prisma.otpToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch (err) {
    console.error("Failed to purge expired OTPs:", err.message);
  }
}

// Create OTP, persist it, send email via the shop's Brevo config.
export async function createOtp({ shop, email }) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpToken.create({
    data: {
      token,
      shop,
      email,
      codeHash: hashCode(code),
      expiresAt,
    },
  });

  // Fire-and-forget cleanup of expired rows
  purgeExpired();

  try {
    await sendBrevoEmail(shop, email, code);
  } catch (err) {
    // Don't leak the OTP in logs. Log only that delivery failed.
    console.error(`Failed to send OTP email for shop=${shop}:`, err.message);
    // Surface the failure so the caller returns a 500 to the storefront.
    throw err;
  }

  return token;
}

// Verify OTP from Prisma store. Single-use.
export async function verifyOtp(email, token, code) {
  if (!email || !token || !code) return false;

  const record = await prisma.otpToken.findUnique({ where: { token } });
  if (!record) return false;
  if (record.email !== email) return false;
  if (record.expiresAt < new Date()) {
    await prisma.otpToken.delete({ where: { token } }).catch(() => {});
    return false;
  }

  const ok = record.codeHash === hashCode(code);
  if (ok) {
    await prisma.otpToken.delete({ where: { token } }).catch(() => {});
  }
  return ok;
}
