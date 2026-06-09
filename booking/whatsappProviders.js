const sentMessages = [];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeWhatsAppAddress(value) {
  if (!value) return "";
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

function normalizeOpenWAChatId(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  if (rawValue.endsWith("@c.us") || rawValue.endsWith("@g.us") || rawValue.endsWith("@lid")) return rawValue;

  let digits = rawValue.replace(/^whatsapp:/, "").replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  return `${digits}@c.us`;
}

function textWithoutNumberedOptions(text) {
  return String(text || "")
    .split("\n")
    .filter((line) => !/^\s*\d+\.\s+/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pollOptionsFromInteractive(interactive) {
  return (interactive?.sections || [])
    .flatMap((section) => section.rows || [])
    .map((row) => row.title || row.id)
    .filter(Boolean)
    .slice(0, 12);
}

function textWithOptionLabels(text, interactive) {
  const labels = rowsFromInteractive(interactive)
    .map((row) => row.title || row.id)
    .filter(Boolean);
  const cleanText = textWithoutNumberedOptions(text) || text;
  if (!labels.length) return cleanText;
  return `${cleanText}\n\n${labels.map((label) => `- ${label}`).join("\n")}`;
}

function rowsFromInteractive(interactive) {
  return (interactive?.sections || []).flatMap((section) => section.rows || []);
}

function listSectionsFromInteractive(interactive) {
  return (interactive?.sections || []).map((section) => ({
    title: section.title || "Options",
    rows: (section.rows || []).map((row) => ({
      id: row.id || row.title,
      title: row.title,
      description: row.description || undefined,
    })),
  }));
}

export function getSentMessages() {
  return sentMessages;
}

export function clearSentMessages() {
  sentMessages.length = 0;
}

class LocalWhatsAppProvider {
  async sendText({ to, text, interactive, reason = "local" }) {
    const message = {
      provider: "local",
      to,
      text,
      interactive,
      reason,
      at: new Date().toISOString(),
    };
    sentMessages.push(message);
    console.log(`[local-whatsapp:${reason}] to=${to || "simulator"}\n${text}\n`);
    return { ok: true, id: `local-${sentMessages.length}`, message };
  }
}

class MetaWhatsAppProvider {
  constructor() {
    this.accessToken = requireEnv("META_WHATSAPP_ACCESS_TOKEN");
    this.phoneNumberId = requireEnv("META_WHATSAPP_PHONE_NUMBER_ID");
    this.apiVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
  }

  async sendText({ to, text, interactive }) {
    const recipient = to.replace(/^whatsapp:/, "").replace(/^\+/, "");
    let body;

    if (interactive?.type === "options") {
      const rows = rowsFromInteractive(interactive);
      const cleanText = textWithoutNumberedOptions(text) || text;
      body =
        rows.length > 0 && rows.length <= 3
          ? {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: recipient,
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: interactive.title || "Karthik Travels" },
                body: { text: cleanText },
                footer: { text: interactive.footer || "Tap an option to continue" },
                action: {
                  buttons: rows.map((row, index) => ({
                    type: "reply",
                    reply: {
                      id: row.id || row.title || `option-${index + 1}`,
                      title: row.title,
                    },
                  })),
                },
              },
            }
          : {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: recipient,
              type: "interactive",
              interactive: {
                type: "list",
                header: { type: "text", text: interactive.title || "Karthik Travels" },
                body: { text: cleanText },
                footer: { text: interactive.footer || "Tap an option to continue" },
                action: {
                  button: interactive.buttonText || "Choose",
                  sections: listSectionsFromInteractive(interactive),
                },
              },
            };
    } else {
      body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: { preview_url: false, body: text },
      };
    }
    const response = await fetch(`https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Meta WhatsApp send failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return { ok: true, provider: "meta", payload };
  }
}

class TwilioWhatsAppProvider {
  constructor() {
    this.accountSid = requireEnv("TWILIO_ACCOUNT_SID");
    this.authToken = requireEnv("TWILIO_AUTH_TOKEN");
    this.from = normalizeWhatsAppAddress(requireEnv("TWILIO_WHATSAPP_FROM"));
  }

  async sendText({ to, text }) {
    const body = new URLSearchParams({
      From: this.from,
      To: normalizeWhatsAppAddress(to),
      Body: text,
    });
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Twilio WhatsApp send failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return { ok: true, provider: "twilio", payload };
  }
}

class OpenWAProvider {
  constructor() {
    this.baseUrl = (process.env.OPENWA_API_BASE_URL || "http://127.0.0.1:2785/api").replace(/\/$/, "");
    this.sessionId = requireEnv("OPENWA_SESSION_ID");
    this.apiKey = process.env.OPENWA_API_KEY || "dev-admin-key";
    this.enableInteractive = process.env.OPENWA_ENABLE_INTERACTIVE === "true";
    this.optionMode = (process.env.OPENWA_OPTION_MODE || "buttons").toLowerCase();
    this.sendTextFallback = process.env.OPENWA_SEND_TEXT_FALLBACK !== "false";
  }

  async sendPayload(body) {
    const response = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(this.sessionId)}/messages/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`OpenWA send failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return payload;
  }

  async sendText({ to, text, interactive }) {
    const chatId = normalizeOpenWAChatId(to);
    if (!chatId) throw new Error("OpenWA send failed: missing chatId");

    const body = { chatId, text };
    if (this.enableInteractive && interactive?.type === "options") {
      if (this.optionMode === "text") {
        const payload = await this.sendPayload({ chatId, text: textWithOptionLabels(text, interactive) });
        return { ok: true, provider: "openwa", payload };
      }

      if (this.optionMode === "poll") {
        const options = pollOptionsFromInteractive(interactive);
        const pollName = textWithoutNumberedOptions(text) || interactive.buttonText || "Choose an option";
        if (options.length >= 2) {
          const payload = await this.sendPayload({
            chatId,
            text: pollName,
            poll: {
              name: pollName,
              options,
              allowMultipleAnswers: false,
            },
          });
          return { ok: true, provider: "openwa", payload };
        }
      }

      const rows = rowsFromInteractive(interactive);
      body.text = textWithoutNumberedOptions(text) || text;

      if (rows.length > 0 && (rows.length <= 3 || this.optionMode === "buttons")) {
        const buttonRows =
          rows.length > 3
            ? [...rows.slice(0, 2), { id: "__more__", title: "More options" }]
            : rows.slice(0, 3);
        body.buttons = {
          title: interactive.title || "Karthik Travels",
          footer: interactive.footer || "Tap an option to continue",
          buttons: buttonRows.map((row) => ({
            id: row.id || row.title,
            body: row.title,
          })),
        };
      } else {
        body.list = {
          buttonText: interactive.buttonText || "Choose option",
          title: interactive.title || "Karthik Travels",
          footer: interactive.footer || "Tap an option to continue",
          sections: listSectionsFromInteractive(interactive),
        };
      }

      let payload;
      try {
        payload = await this.sendPayload(body);
      } catch (error) {
        console.error(`[openwa] interactive send failed; falling back to text for ${chatId}:`, error.message || error);
        payload = await this.sendPayload({ chatId, text: textWithOptionLabels(text, interactive) });
      }
      if (this.sendTextFallback) {
        await this.sendPayload({ chatId, text });
      }
      return { ok: true, provider: "openwa", payload };
    }

    const payload = await this.sendPayload(body);
    return { ok: true, provider: "openwa", payload };
  }
}

export function createWhatsAppProvider(providerOverride) {
  const provider = (providerOverride || process.env.WHATSAPP_PROVIDER || "local").toLowerCase();
  if (provider === "meta") return new MetaWhatsAppProvider();
  if (provider === "twilio") return new TwilioWhatsAppProvider();
  if (provider === "openwa") return new OpenWAProvider();
  return new LocalWhatsAppProvider();
}
