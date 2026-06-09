# WhatsApp Booking Automation Setup

This project uses official WhatsApp provider APIs only:

- Preferred: Meta WhatsApp Business Cloud API
- Fallback: Twilio WhatsApp API
- Local development: built-in simulator
- Local client test only: OpenWA

Do not use unofficial WhatsApp Web QR automation for production. OpenWA is wired here only so you can test the client demo locally before moving the bot to Meta or Twilio.

## Local Run

```bash
cp .env.example .env
npm run dev
```

Open:

- Website: `http://localhost:4173`
- Simulator: `http://localhost:4173/simulator.html`
- OpenWA dashboard: `http://localhost:2886`
- OpenWA API docs: `http://localhost:2785/api/docs`

In local mode, WhatsApp and email notifications are not sent to real customers. They are logged in memory and shown through the simulator/test APIs.

## Required Environment Variables

Set these in `.env` locally and in your production hosting environment:

- `BUSINESS_WHATSAPP_NUMBER`
- `BUSINESS_PHONE_NUMBER`
- `BUSINESS_EMAIL`
- `OWNER_WHATSAPP_NUMBER`
- `OWNER_EMAIL`
- `WHATSAPP_PROVIDER`
- `WEBHOOK_VERIFY_TOKEN`

For Meta:

- `META_GRAPH_API_VERSION`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_APP_SECRET`

For Twilio:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`

For OpenWA local testing:

- `OPENWA_API_BASE_URL`
- `OPENWA_API_KEY`
- `OPENWA_SESSION_ID`
- `OPENWA_ENABLE_INTERACTIVE=true` to test clickable reply buttons or list menus in OpenWA. Keep this as a local demo setting only; use Meta WhatsApp Cloud API for production interactive messages.
- `OPENWA_OPTION_MODE=poll` to use native WhatsApp single-choice polls for no-typing option selection while testing with OpenWA.
- `OPENWA_OPTION_MODE=text` to send reliable plain-text menus without numeric option prefixes. This is the safest fallback because deprecated WhatsApp Web buttons may return success without rendering in the chat.
- `OPENWA_OPTION_MODE=buttons` to try WhatsApp quick-reply buttons with a `More options` button for longer menus.
- `OPENWA_OPTION_MODE=menu` to try WhatsApp list-menu buttons for longer menus. Some WhatsApp Web / Business sessions reject this with `[LT01] Whatsapp business can't send this yet`.
- `OPENWA_SEND_TEXT_FALLBACK=true` to keep the bot replying even when WhatsApp Web does not render deprecated OpenWA buttons/list menus.

For email:

- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `RESEND_API_KEY` if `EMAIL_PROVIDER=resend`

## Meta WhatsApp Cloud API Setup

1. Create or open your Meta Developer app.
2. Add WhatsApp Business Platform.
3. Configure a production phone number and WhatsApp Business Account.
4. Set your webhook callback URL:

   `https://YOUR_DOMAIN.com/webhooks/whatsapp/meta`

5. Set the webhook verify token to the same value as `WEBHOOK_VERIFY_TOKEN`.
6. Subscribe to WhatsApp message events.
7. Add these values to your environment:

   - `META_WHATSAPP_PHONE_NUMBER_ID`
   - `META_WHATSAPP_ACCESS_TOKEN`
   - `META_APP_SECRET`
   - `WEBHOOK_VERIFY_TOKEN`
   - `WHATSAPP_PROVIDER=meta`

Meta sends webhook verification as a GET request with `hub.verify_token` and expects the raw `hub.challenge` value back. Incoming POST payloads should be verified with `X-Hub-Signature-256` when `META_APP_SECRET` is configured.

## Twilio WhatsApp Setup

1. Open Twilio Console.
2. Configure a WhatsApp Sandbox sender or approved WhatsApp sender.
3. Set the incoming message webhook URL:

   `https://YOUR_DOMAIN.com/webhooks/whatsapp/twilio`

4. Add these values to your environment:

   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM`
   - `WHATSAPP_PROVIDER=twilio`

Twilio sends incoming WhatsApp messages using the same webhook format as SMS/MMS, with `From`, `To`, and `Body` fields in `application/x-www-form-urlencoded` format.

## OpenWA Local Test Setup

The local session configured for this project is:

- WhatsApp number: `+919025929032`
- Session name: `karthik-9025929032`
- Webhook URL for OpenWA: `http://host.docker.internal:4173/webhooks/whatsapp/openwa`

Start OpenWA with Docker:

```bash
cd openwa
docker compose -f docker-compose.dev.yml up -d --build
```

Then create/start the session and scan the QR from the OpenWA dashboard or API. After the session is connected, incoming messages to that WhatsApp number can trigger the booking flow.

## Booking Flow

1. Customer clicks `Book Now` or `Plan My Trip`.
2. WhatsApp opens with: `Hi, I want to book a trip.`
3. Bot asks pickup city:
   - Pondicherry
   - Coimbatore
   - Tiruppur
   - Ooty
   - Erode
4. Bot asks passenger count.
5. Bot recommends vehicle:
   - 1-2 people: Sedan / Dzire / Etios
   - 3-4 people: Ertiga / Sedan
   - 5-8 people: Innova / Innova Crysta / Tempo Traveller
   - More than 8 people: Tempo Traveller / Mini Bus
6. Bot asks package type.
7. Bot asks confirmation.
8. On confirmation, it sends summaries to owner/customer WhatsApp and email where configured.

## Production Notes

- Use HTTPS for production webhooks.
- Keep access tokens and API keys only in environment variables.
- Use a persistent database before production traffic. The current session store is in-memory for local development.
- WhatsApp free-form replies are subject to provider and WhatsApp service-window rules. Outside the service window, use approved templates.
- Add provider signature validation for Twilio in production using the official Twilio SDK or equivalent verified middleware.

## Credentials Still Needed

- Meta production access token or Twilio account credentials
- Meta phone number ID or Twilio WhatsApp sender
- Owner email address
- Email sending provider API key if real email is required
- Public deployment URL for webhook registration
