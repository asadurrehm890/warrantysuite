import { getAdminClientForShop } from "./admin-client.server";

/**
 * Check if the shop has an active subscription to your plan.
 */
export async function getBillingStatus(shop) {
  const admin = await getAdminClientForShop(shop);

  const response = await admin.query({
    data: {
      query: `
        query CurrentAppSubscription {
          currentAppInstallation {
            activeSubscriptions {
              id
              name
              status
            }
          }
        }
      `,
    },
  });

  const activeSubs =
    response.body.data.currentAppInstallation?.activeSubscriptions ?? [];

  if (!activeSubs.length) {
    return { active: false };
  }

  // Optional: restrict to your specific plan name
  const planName = "Warranty Activation Suite - Annual Plan";
  const hasPlan = activeSubs.some(
    (sub) => sub.status === "ACTIVE" && sub.name === planName,
  );

  return { active: hasPlan };
}