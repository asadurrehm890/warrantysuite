// app/routes/api.send-otp.jsx
import { createOtp } from "../otpStore.server.js";

export async function action({ request }) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const email = String(body.email || "").trim();
  const shop = String(body.shop || "").trim(); // NEW

  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!shop) {
    // You can either hard-error or fallback. I recommend hard-error:
    return new Response(JSON.stringify({ error: "Shop is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const token = await createOtp({ shop, email }); // UPDATED
    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in send-otp:", err);
    return new Response(JSON.stringify({ error: "Failed to send OTP" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}