// app/routes/api.send-otp.jsx
// Storefront endpoint — called via App Proxy.
import { createOtp } from "../otpStore.server.js";
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

export const action = proxyEndpoint(async ({ session, request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const token = await createOtp({ shop: session.shop, email });
    return { token };
  } catch (err) {
    console.error("Error in send-otp:", err.message);
    return Response.json({ error: "Failed to send OTP" }, { status: 500 });
  }
});
