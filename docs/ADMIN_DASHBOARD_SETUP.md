# Karthik Travels Admin Dashboard

The live dashboard is available at `/admin.html`.

## What Works Now

- Website booking form saves a booking locally and posts to `/api/bookings`.
- Admin can add, edit, delete and export bookings.
- Admin can add, edit, delete and reset packages.
- Admin can add and remove gallery photos.
- Admin can update contact settings.
- Live Cloudflare D1 sync is connected through the `KT_DB` binding.
- If D1 is ever removed, the dashboard falls back to browser `localStorage`.

## Production Database Setup

Current live setup:

- Cloudflare Pages project: `karthiktravels`
- D1 database: `karthik_travels_admin`
- Binding name: `KT_DB`

To reconnect or move this setup later:

1. In Cloudflare, open `Workers & Pages`.
2. Open the `karthiktravels` Pages project.
3. Go to `Settings` -> `Functions` -> `D1 database bindings`.
4. Create or choose a D1 database.
5. Add the binding name exactly as:

```text
KT_DB
```

6. Optional but recommended: add an environment variable:

```text
ADMIN_TOKEN=choose-a-private-admin-password
```

7. Redeploy this website zip after saving the binding.

The API will automatically create its tables on the first request.

## API Endpoints

- `POST /api/bookings` public website booking capture.
- `GET /api/bookings` admin booking list.
- `PUT /api/bookings` admin booking save.
- `DELETE /api/bookings?id=BOOKING_ID` admin booking delete.
- `GET /api/admin-store?key=packages`
- `GET /api/admin-store?key=gallery`
- `GET /api/admin-store?key=settings`
- `PUT /api/admin-store?key=packages|gallery|settings`

If `ADMIN_TOKEN` is set, admin requests need the `x-admin-token` header. The dashboard asks for it once and saves it in the current browser.
