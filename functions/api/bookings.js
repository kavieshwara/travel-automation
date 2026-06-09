const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, x-admin-token",
};

const bookingColumns = `
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT,
  customer_name TEXT,
  phone TEXT,
  travel_date TEXT,
  passengers TEXT,
  package_type TEXT,
  package_title TEXT,
  route TEXT,
  details TEXT,
  raw TEXT
`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function unavailable() {
  return json(
    {
      error: "D1 database is not connected yet.",
      setup: "Create a Cloudflare D1 database and bind it to this Pages project as KT_DB.",
    },
    503,
  );
}

function isAuthorized(request, env) {
  if (!env.ADMIN_TOKEN) return true;
  return request.headers.get("x-admin-token") === env.ADMIN_TOKEN;
}

async function ensureTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS bookings (${bookingColumns})`).run();
}

function normalizeBooking(input = {}) {
  return {
    id: String(input.id || `KT-${Date.now().toString(36).toUpperCase()}`),
    createdAt: String(input.createdAt || new Date().toISOString()),
    status: String(input.status || "New enquiry"),
    source: String(input.source || "Website checkout"),
    customerName: String(input.customerName || ""),
    phone: String(input.phone || ""),
    travelDate: String(input.travelDate || "Not fixed"),
    passengers: String(input.passengers || ""),
    packageType: String(input.packageType || ""),
    packageTitle: String(input.packageTitle || ""),
    route: String(input.route || ""),
    details: String(input.details || ""),
  };
}

function fromRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    source: row.source,
    customerName: row.customer_name,
    phone: row.phone,
    travelDate: row.travel_date,
    passengers: row.passengers,
    packageType: row.package_type,
    packageTitle: row.package_title,
    route: row.route,
    details: row.details,
  };
}

async function upsertBooking(db, booking) {
  await db
    .prepare(
      `INSERT INTO bookings (
        id, created_at, status, source, customer_name, phone, travel_date,
        passengers, package_type, package_title, route, details, raw
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        source = excluded.source,
        customer_name = excluded.customer_name,
        phone = excluded.phone,
        travel_date = excluded.travel_date,
        passengers = excluded.passengers,
        package_type = excluded.package_type,
        package_title = excluded.package_title,
        route = excluded.route,
        details = excluded.details,
        raw = excluded.raw`,
    )
    .bind(
      booking.id,
      booking.createdAt,
      booking.status,
      booking.source,
      booking.customerName,
      booking.phone,
      booking.travelDate,
      booking.passengers,
      booking.packageType,
      booking.packageTitle,
      booking.route,
      booking.details,
      JSON.stringify(booking),
    )
    .run();
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { headers: jsonHeaders });
  if (!env.KT_DB) return unavailable();

  await ensureTable(env.KT_DB);
  const url = new URL(request.url);

  if (request.method === "GET") {
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
    const limit = Math.min(Number(url.searchParams.get("limit") || 200), 500);
    const { results } = await env.KT_DB.prepare("SELECT * FROM bookings ORDER BY created_at DESC LIMIT ?").bind(limit).all();
    return json({ bookings: results.map(fromRow) });
  }

  if (request.method === "POST") {
    const booking = normalizeBooking(await request.json().catch(() => ({})));
    await upsertBooking(env.KT_DB, booking);
    return json({ booking }, 201);
  }

  if (request.method === "PUT") {
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
    const booking = normalizeBooking(await request.json().catch(() => ({})));
    await upsertBooking(env.KT_DB, booking);
    return json({ booking });
  }

  if (request.method === "DELETE") {
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Missing booking id" }, 400);
    await env.KT_DB.prepare("DELETE FROM bookings WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
