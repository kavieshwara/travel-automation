# Karthik Travels Website and Booking Automation

Modern travel agency website for Karthik Travels, Tamil Nadu, with WhatsApp booking automation, package details, vehicle/gallery assets, rate sheet content, and a local booking simulator.

## What Is Included

- Premium responsive website for Karthik Travels
- Real agency images and scraped package/content data
- Popular one-day package cards and vehicle gallery
- WhatsApp booking buttons with prefilled customer message
- Booking state machine for pickup city, passengers, vehicle suggestion, package, and confirmation
- Local chatbot simulator for testing the full flow before production WhatsApp setup
- WhatsApp provider abstraction for local simulator, Meta WhatsApp Cloud API, Twilio, and OpenWA testing
- Owner/customer booking notification logic
- Email notification helper
- Cloudflare-ready static output in `dist/`
- SEO files: `robots.txt`, `sitemap.xml`, manifest, and deployment checklist

## Tech Stack

- HTML, CSS, JavaScript
- Node.js backend server
- Cloudflare Pages compatible static build
- WhatsApp automation support through provider adapters

## Project Structure

```text
.
├── index.html
├── styles.css
├── script.js
├── server.js
├── booking/
│   ├── config.js
│   ├── stateMachine.js
│   ├── whatsappProviders.js
│   ├── notifications.js
│   └── email.js
├── public/
│   ├── simulator.css
│   └── simulator.js
├── simulator.html
├── docs/
│   ├── ADMIN_DASHBOARD_SETUP.md
│   ├── DEPLOYMENT_SEO_CHECKLIST.md
│   └── WHATSAPP_SETUP.md
├── assets/
├── karthiktravels_site_data/
├── karthiktravels_scrape/
└── dist/
```

## Run Locally

Install dependencies if needed:

```bash
npm install
```

Start the local server:

```bash
npm start
```

Default local URL:

```text
http://localhost:4173
```

Run the booking simulator flow test:

```bash
npm run test:flow
```

## Environment Setup

Copy the example env file:

```bash
cp .env.example .env
```

Then update values in `.env` for the current business setup.

Important values:

```text
BUSINESS_WHATSAPP_NUMBER=
BUSINESS_PHONE_NUMBER=
BUSINESS_EMAIL=
OWNER_WHATSAPP_NUMBER=
OWNER_EMAIL=
WHATSAPP_PROVIDER=local
EMAIL_PROVIDER=local
```

Do not commit real API keys, phone tokens, email provider keys, or access tokens.

## WhatsApp Automation

The booking flow supports:

1. Customer clicks `Book Now` or `Plan My Trip`
2. WhatsApp opens with: `Hi, I want to book a trip.`
3. Bot asks pickup city
4. Bot asks passenger count
5. Bot recommends vehicle
6. Bot asks package type
7. Bot asks confirmation
8. Confirmed summary goes to customer and owner

Provider modes:

- `local` for simulator testing
- `meta` for official WhatsApp Cloud API
- `twilio` for Twilio WhatsApp API
- `openwa` for local/testing only

Production should use Meta WhatsApp Cloud API or Twilio. Do not use unofficial WhatsApp Web QR automation for production.

Detailed setup:

[docs/WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md)

## Deployment

Static website output is available in:

```text
dist/
```

For Cloudflare Pages:

- Build command: leave empty if uploading `dist` directly
- Output directory: `dist`
- Custom domain: `karthiktravels.co.in`

After deployment, check:

- Homepage loads on mobile and desktop
- Images load correctly
- WhatsApp buttons open the correct phone number
- SEO files are available
- Custom domain DNS points to Cloudflare Pages

Deployment and SEO checklist:

[docs/DEPLOYMENT_SEO_CHECKLIST.md](docs/DEPLOYMENT_SEO_CHECKLIST.md)

## GitHub

Repository:

[github.com/kavieshwara/travel-automation](https://github.com/kavieshwara/travel-automation)

## Notes

The following are intentionally excluded from Git:

- `.env`
- `node_modules/`
- QR code images
- zip upload files
- nested OpenWA repository files
- local screenshots

Use `.env.example` as the public reference for required configuration.
