// app/otpStore.server.js
import crypto from "crypto";
import prisma from "./db.server"; // same import used in app.warranty-settings.jsx

const otpMap = new Map();

// Load Brevo configuration for a specific shop from Prisma
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

// Function to send email via Brevo API using per-shop config
async function sendBrevoEmail(shop, email, code) {
  const { apiKey, senderEmail } = await getBrevoConfigForShop(shop);
  const senderName = "Warranty Activation";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email,
          name: email.split("@")[0], // Optional: name from email
        },
      ],
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

  const responseData = await response.json();

  if (!response.ok) {
    console.error("Brevo API Error Details:", {
      status: response.status,
      statusText: response.statusText,
      error: responseData,
    });
    throw new Error(
      `Failed to send email: ${
        responseData.message || responseData.error || "Unknown error"
      }`,
    );
  }

  console.log("Brevo API Response:", responseData);
  return responseData;
}

// Create OTP and send using Brevo config for this shop
export async function createOtp({ shop, email }) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpMap.set(token, { email, code, expiresAt });

  console.log(`Generated OTP for ${email} (shop: ${shop}): ${code}`);

  try {
    await sendBrevoEmail(shop, email, code);
    console.log(`✅ OTP email sent to ${email} via Brevo API for shop ${shop}`);
  } catch (err) {
    console.error("❌ Error sending OTP email via API:", {
      shop,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });

    // Log OTP so you can debug if email fails
    console.log(`🔑 OTP for ${email}: ${code} (Token: ${token})`);
    // Optional: rethrow if you want to fail the request
    // throw err;
  }

  return token;
}

// Verify OTP from in-memory store
export function verifyOtp(email, token, code) {
  const record = otpMap.get(token);
  if (!record) return false;
  if (record.email !== email) return false;
  if (record.expiresAt < Date.now()) {
    otpMap.delete(token);
    return false;
  }
  const ok = record.code === code;
  if (ok) otpMap.delete(token);
  return ok;
}