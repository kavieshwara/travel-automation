import assert from "node:assert/strict";
import { dispatchNotifications } from "../booking/notifications.js";
import { processBookingMessage, getSession, resetSession, bookingSummary } from "../booking/stateMachine.js";
import { clearSentEmails, getSentEmails } from "../booking/email.js";
import { clearSentMessages, createWhatsAppProvider, getSentMessages } from "../booking/whatsappProviders.js";

const customerId = "whatsapp:+919999999999";
const provider = createWhatsAppProvider("local");

async function send(text) {
  const result = processBookingMessage({
    customerId,
    text,
    profile: { name: "Demo Customer", phone: customerId },
  });
  await dispatchNotifications({
    notifications: result.notifications,
    customerId,
    customerProvider: provider,
    ownerProvider: provider,
  });
  return result;
}

resetSession(customerId);
clearSentMessages();
clearSentEmails();

let result = await send("Hi, I want to book a trip.");
assert.match(result.replies.join("\n"), /Pondicherry/);

result = await send("2");
assert.match(result.replies.join("\n"), /How many passengers/);

result = await send("4");
assert.match(result.replies.join("\n"), /Innova \/ Innova Crysta \/ Tempo Traveller/);

result = await send("3");
assert.match(result.replies.join("\n"), /Confirm booking/);

result = await send("demo@example.com");
assert.match(result.replies.join("\n"), /saved demo@example.com/);

result = await send("Confirm booking");
const session = getSession(customerId);
assert.equal(session.status, "complete");
assert.equal(session.city, "Coimbatore");
assert.equal(session.vehicle, "Innova / Innova Crysta / Tempo Traveller");
assert.equal(session.package.label, "Full day package");
assert.match(bookingSummary(session), /Customer WhatsApp/);
assert.ok(getSentMessages().some((message) => message.reason === "owner-notification"), "owner WhatsApp notification should be queued in local mode");
assert.ok(getSentEmails().length >= 2, "owner and customer email notifications should be queued in local mode");

console.log("Simulator booking flow passed.");
