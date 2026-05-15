// app/routes/api.verify-otp.jsx
// Storefront endpoint — called via App Proxy.
import { verifyOtp } from "../otpStore.server.js";
import { proxyEndpoint } from "../utils/proxyEndpoint.server";

export const action = proxyEndpoint(async ({ request }) => {
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
  const otp = String(body.otp || "").trim();
  const token = String(body.token || "").trim();

  if (!email || !otp || !token) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const ok = await verifyOtp(email, token, otp);
  return Response.json({ verified: ok }, { status: ok ? 200 : 400 });
});
