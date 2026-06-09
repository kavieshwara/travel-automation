const sentEmails = [];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getSentEmails() {
  return sentEmails;
}

export function clearSentEmails() {
  sentEmails.length = 0;
}

export async function sendEmail({ to, subject, text }) {
  const provider = (process.env.EMAIL_PROVIDER || "local").toLowerCase();
  const email = {
    provider,
    to,
    subject,
    text,
    at: new Date().toISOString(),
  };

  if (provider === "local") {
    sentEmails.push(email);
    console.log(`[local-email] to=${to || "not-configured"} subject=${subject}\n${text}\n`);
    return { ok: true, id: `local-email-${sentEmails.length}`, email };
  }

  if (provider === "resend") {
    const apiKey = requireEnv("RESEND_API_KEY");
    const from = requireEnv("EMAIL_FROM");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Email send failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return { ok: true, provider, payload };
  }

  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}
