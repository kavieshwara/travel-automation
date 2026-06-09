# Karthik Travels Deployment and SEO Checklist

## Recommended Setup

Use a new domain and static hosting first:

1. Buy `karthiktravels.co.in` if the owner approves the name.
2. Host the website on Cloudflare Pages.
3. Point the new domain to Cloudflare Pages.
4. Keep the WhatsApp booking button as a direct WhatsApp link until Meta WhatsApp Cloud API is ready.

This site is ready for static hosting because package data, images, SEO files, and public WhatsApp config are all served from the project files.

## Files To Update If The Final Domain Changes

Replace `https://karthiktravels.co.in/` in:

- `index.html`
- `robots.txt`
- `sitemap.xml`

Update the phone number in:

- `public-config.json`
- `index.html` structured data contact point, if the public WhatsApp number changes

## Cloudflare Pages Settings

- Framework preset: None
- Build command: leave empty
- Build output directory: `/`
- Root directory: project root

After deployment, add the custom domain in Cloudflare Pages and follow the DNS instructions shown there.

## SEO Launch Steps

1. Submit the new domain to Google Search Console.
2. Verify ownership using the DNS TXT record Google provides.
3. Submit `https://YOUR_DOMAIN/sitemap.xml`.
4. Add the business to Google Business Profile with the same name, phone number and service area.
5. Ask the owner for real address/service-area details and update the LocalBusiness schema if needed.
6. Add 5-10 customer testimonials with real names/initials after owner approval.
7. Add separate pages later for high-intent searches:
   - `/coimbatore-taxi-service/`
   - `/tempo-traveller-rental-coimbatore/`
   - `/ooty-tour-package-from-coimbatore/`
   - `/palani-tour-package-from-coimbatore/`
   - `/rameswaram-tour-package-from-coimbatore/`

## Current SEO Baseline Included

- Search title and meta description
- Canonical URL
- Open Graph and Twitter preview tags
- TravelAgency structured data
- `robots.txt`
- `sitemap.xml`
- Web app manifest
- Image preload for the hero visual
- Static WhatsApp config for no-backend hosting
