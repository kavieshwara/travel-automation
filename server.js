import crypto from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bookingConfig, publicConfig } from "./booking/config.js";
import { dispatchNotifications } from "./booking/notifications.js";
import { processBookingMessage, getSession, listSessions, resetSession } from "./booking/stateMachine.js";
import { createWhatsAppProvider, getSentMessages, clearSentMessages } from "./booking/whatsappProviders.js";
import { getSentEmails, clearSentEmails } from "./booking/email.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);

const whatsappProvider = createWhatsAppProvider();
const simulatorProvider = createWhatsAppProvider("local");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body, null, 2));
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  res.end(text);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseJson(buffer) {
  if (!buffer.length) return {};
  return JSON.parse(buffer.toString("utf8"));
}

function verifyMetaSignature(req, rawBody) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true;
  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !signature.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function extractMetaMessages(payload) {
  const messages = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        const text =
          message.type === "text"
            ? message.text?.body || ""
            : message.type === "interactive"
              ? message.interactive?.button_reply?.title ||
                message.interactive?.button_reply?.id ||
                message.interactive?.list_reply?.title ||
                message.interactive?.list_reply?.id ||
                ""
              : "";
        if (!text) continue;
        messages.push({
          customerId: message.from,
          text,
          profile: {
            name: value.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name || "",
            phone: message.from,
          },
        });
      }
    }
  }
  return messages;
}

function extractOpenWAMessages(payload) {
  if (payload.event && payload.event !== "message.received") return [];
  const data = payload.data || payload.message || payload;
  const text = data?.selectedRowId || data?.selectedButtonId || data?.body || data?.text || "";
  if (!data || data.isGroup || !text) return [];
  const normalizedText = String(text).trim().toLowerCase();
  const isStartTrigger =
    ["start", "restart", "book", "hi", "hello"].includes(normalizedText) ||
    normalizedText.includes("book a trip") ||
    normalizedText.includes("plan my trip") ||
    normalizedText.includes("want to book");
  if (data.fromMe && !isStartTrigger) return [];
  let phoneDigits = data.fromNumber ? String(data.fromNumber).replace(/\D/g, "") : "";
  if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
  const phoneChatId = phoneDigits ? `${phoneDigits}@c.us` : "";
  const candidates = data.fromMe ? [data.to, data.chatId, data.fromContactId, data.from] : [data.from, data.chatId, data.fromContactId, data.to];
  const lidChatId = candidates.find((value) => String(value || "").endsWith("@lid")) || "";
  const customerId = lidChatId || phoneChatId || candidates.find(Boolean) || "";
  if (!customerId) return [];
  return [
    {
      customerId,
      text,
      profile: {
        name: data.notifyName || data.pushName || "there",
        phone: phoneChatId || data.from || customerId,
      },
    },
  ];
}

function twiml(messages) {
  const escapeXml = (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${messages
    .map((message) => `<Message>${escapeXml(message)}</Message>`)
    .join("")}</Response>`;
}

async function handleBookingInbound({ customerId, text, profile, replyProvider = whatsappProvider, ownerProvider = whatsappProvider }) {
  const result = processBookingMessage({ customerId, text, profile });
  for (const [index, reply] of result.replies.entries()) {
    await replyProvider.sendText({
      to: customerId,
      text: reply,
      interactive: result.interactiveReplies?.[index],
      reason: "bot-reply",
    });
  }
  const notificationResults = await dispatchNotifications({
    notifications: result.notifications,
    customerId,
    customerProvider: replyProvider,
    ownerProvider,
  });
  return { ...result, notificationResults };
}

async function routeApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/public-config") {
    return sendJson(res, 200, publicConfig());
  }

  if (req.method === "GET" && url.pathname === "/api/sessions") {
    return sendJson(res, 200, { sessions: listSessions(), sentMessages: getSentMessages(), sentEmails: getSentEmails() });
  }

  if (req.method === "POST" && url.pathname === "/api/simulator/reset") {
    clearSentMessages();
    clearSentEmails();
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/simulator/message") {
    const body = parseJson(await collectBody(req));
    const customerId = body.customerId || "whatsapp:+919999999999";
    const result = await handleBookingInbound({
      customerId,
      text: body.text || "",
      profile: { name: body.name || "Demo Customer", phone: customerId },
      replyProvider: simulatorProvider,
      ownerProvider: simulatorProvider,
    });
    return sendJson(res, 200, {
      ok: true,
      replies: result.replies,
      session: getSession(customerId),
      notificationResults: result.notificationResults,
      sentMessages: getSentMessages(),
      sentEmails: getSentEmails(),
    });
  }

  if (req.method === "POST" && url.pathname === "/api/simulator/session-reset") {
    const body = parseJson(await collectBody(req));
    resetSession(body.customerId || "whatsapp:+919999999999");
    return sendJson(res, 200, { ok: true });
  }

  return false;
}

async function routeWebhooks(req, res, url) {
  if (url.pathname === "/webhooks/whatsapp/meta" && req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      return sendText(res, 200, challenge || "");
    }
    return sendText(res, 403, "Webhook verification failed");
  }

  if (url.pathname === "/webhooks/whatsapp/meta" && req.method === "POST") {
    const rawBody = await collectBody(req);
    if (!verifyMetaSignature(req, rawBody)) return sendText(res, 403, "Invalid signature");
    const payload = parseJson(rawBody);
    const messages = extractMetaMessages(payload);
    const results = [];
    for (const inbound of messages) {
      results.push(await handleBookingInbound(inbound));
    }
    return sendJson(res, 200, { ok: true, processed: results.length });
  }

  if (url.pathname === "/webhooks/whatsapp/twilio" && req.method === "POST") {
    const rawBody = await collectBody(req);
    const form = new URLSearchParams(rawBody.toString("utf8"));
    const customerId = form.get("From") || "";
    const text = form.get("Body") || "";
    const profile = { name: form.get("ProfileName") || "there", phone: customerId };
    const result = processBookingMessage({ customerId, text, profile });
    await dispatchNotifications({
      notifications: result.notifications,
      customerId,
      customerProvider: whatsappProvider,
      ownerProvider: whatsappProvider,
    });
    return sendText(res, 200, twiml(result.replies), "text/xml; charset=utf-8");
  }

  if (url.pathname === "/webhooks/whatsapp/openwa" && req.method === "POST") {
    const rawBody = await collectBody(req);
    const payload = parseJson(rawBody);
    const messages = extractOpenWAMessages(payload);
    if (messages.length) {
      console.log(
        `[openwa-webhook] ${messages.length} message(s): ${messages
          .map((message) => `${message.customerId}="${message.text}"`)
          .join(", ")}`,
      );
    }
    const results = [];
    for (const inbound of messages) {
      results.push(await handleBookingInbound(inbound));
    }
    return sendJson(res, 200, { ok: true, processed: results.length });
  }

  return false;
}

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(__dirname, requestedPath));
  if (!filePath.startsWith(__dirname)) return sendText(res, 403, "Forbidden");
  if (!existsSync(filePath)) return sendText(res, 404, "Not found");
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const apiHandled = await routeApi(req, res, url);
    if (apiHandled !== false) return;
    const webhookHandled = await routeWebhooks(req, res, url);
    if (webhookHandled !== false) return;
    return serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { ok: false, error: error.message || String(error) });
  }
});

server.listen(PORT, () => {
  console.log(`${bookingConfig.agency.name} booking server running at http://localhost:${PORT}`);
  console.log(`Simulator: http://localhost:${PORT}/simulator.html`);
});
