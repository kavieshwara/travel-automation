import { bookingConfig } from "./config.js";
import { sendEmail } from "./email.js";

export async function dispatchNotifications({ notifications, customerId, customerProvider, ownerProvider }) {
  const results = [];
  for (const notification of notifications) {
    try {
      if (notification.type === "owner-whatsapp") {
        if (!bookingConfig.owner.whatsapp) {
          results.push({ type: notification.type, skipped: true, reason: "OWNER_WHATSAPP_NUMBER is not configured" });
          continue;
        }
        results.push(
          await ownerProvider.sendText({
            to: bookingConfig.owner.whatsapp,
            text: notification.message,
            reason: "owner-notification",
          }),
        );
      } else if (notification.type === "customer-whatsapp") {
        results.push(
          await customerProvider.sendText({
            to: customerId,
            text: notification.message,
            reason: "customer-summary",
          }),
        );
      } else if (notification.type === "owner-email") {
        if (!bookingConfig.owner.email) {
          results.push({ type: notification.type, skipped: true, reason: "OWNER_EMAIL is not configured" });
          continue;
        }
        results.push(
          await sendEmail({
            to: bookingConfig.owner.email,
            subject: notification.subject,
            text: notification.message,
          }),
        );
      } else if (notification.type === "customer-email") {
        results.push(
          await sendEmail({
            to: notification.to,
            subject: notification.subject,
            text: notification.message,
          }),
        );
      }
    } catch (error) {
      results.push({ type: notification.type, ok: false, error: error.message || String(error) });
    }
  }
  return results;
}
