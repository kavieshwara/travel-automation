const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, PUT, OPTIONS",
  "access-control-allow-headers": "content-type, x-admin-token",
};

const allowedKeys = new Set(["packages", "gallery", "settings"]);

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
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();
}

async function readStore(db, key) {
  const row = await db.prepare("SELECT value, updated_at FROM admin_store WHERE key = ?").bind(key).first();
  if (!row) return null;
  return {
    key,
    value: JSON.parse(row.value),
    updatedAt: row.updated_at,
  };
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { headers: jsonHeaders });
  if (!env.KT_DB) return unavailable();

  await ensureTable(env.KT_DB);
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!allowedKeys.has(key)) {
    return json({ error: "Use key=packages, key=gallery, or key=settings" }, 400);
  }

  if (request.method === "GET") {
    const item = await readStore(env.KT_DB, key);
    return json(item || { key, value: null, updatedAt: null });
  }

  if (request.method === "PUT") {
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const value = body.value ?? null;
    const updatedAt = new Date().toISOString();
    await env.KT_DB.prepare(
      `INSERT INTO admin_store (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
      .bind(key, JSON.stringify(value), updatedAt)
      .run();
    return json({ key, value, updatedAt });
  }

  return json({ error: "Method not allowed" }, 405);
}
