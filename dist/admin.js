const storageKeys = {
  bookings: "kt-admin-bookings",
  packages: "kt-admin-packages",
  gallery: "kt-admin-gallery",
  settings: "kt-admin-settings",
};

const defaultSettings = {
  whatsapp: "+919443133465",
  email: "info@karthiktravels.in",
  phone: "0422 2443533",
  note: "Ask for pickup point, date, passengers and 50% advance before final confirmation.",
};

const adminTokenKey = "kt-admin-token";
let bookings = [];
let packages = [];
let gallery = [];
let settings = { ...defaultSettings };
let searchTerm = "";
let statusFilter = "All";

const bookingList = document.querySelector("[data-booking-list]");
const packageGrid = document.querySelector("[data-package-admin-grid]");
const photoGrid = document.querySelector("[data-photo-admin-grid]");
const bookingDialog = document.querySelector("[data-booking-dialog]");
const bookingForm = document.querySelector("[data-manual-booking-form]");
const packageForm = document.querySelector("[data-package-form]");
const photoForm = document.querySelector("[data-photo-form]");
const settingsForm = document.querySelector("[data-settings-form]");

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function adminToken() {
  return window.localStorage.getItem(adminTokenKey) || "";
}

function rememberAdminToken(token) {
  if (token) window.localStorage.setItem(adminTokenKey, token);
}

async function apiJson(url, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {}),
  };
  const token = adminToken();
  if (token) headers["x-admin-token"] = token;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    const nextToken = window.prompt("Enter admin API token");
    if (!nextToken) throw new Error("Admin token required");
    rememberAdminToken(nextToken);
    return apiJson(url, options);
  }
  if (!response.ok) throw new Error(`API unavailable: ${response.status}`);
  return response.json();
}

async function readSharedStore(key, fallback) {
  try {
    const data = await apiJson(`/api/admin-store?key=${encodeURIComponent(key)}`);
    return data.value ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeSharedStore(key, value) {
  try {
    await apiJson(`/api/admin-store?key=${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  } catch {
    // The static dashboard still works through localStorage until D1 is bound.
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(status) {
  return String(status || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function routePlaces(route) {
  return String(route || "")
    .split(",")
    .map((place) => place.trim())
    .filter(Boolean);
}

function sampleBookings() {
  return [
    {
      id: createId("KT"),
      createdAt: new Date().toISOString(),
      status: "New enquiry",
      source: "Website checkout",
      customerName: "Sample customer",
      phone: "9487845502",
      travelDate: "Not fixed",
      passengers: "3-4 people",
      packageType: "One Day Package",
      packageTitle: "Ooty family trip",
      route: "Coimbatore to Ooty, pickup from Saibaba Colony",
      details: "Needs Innova or Crysta pricing.",
    },
    {
      id: createId("KT"),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      status: "Confirmed",
      source: "Manual entry",
      customerName: "Temple group",
      phone: "9025929032",
      travelDate: "2026-05-28",
      passengers: "5-8 people",
      packageType: "One Day Package",
      packageTitle: "Marudamalai + Isha Yoga",
      route: "Coimbatore, Marudamalai Temple, Perur Temple, Isha Yoga",
      details: "Advance pending.",
    },
  ];
}

function updateStats() {
  document.querySelector("[data-stat-total]").textContent = bookings.length;
  document.querySelector("[data-stat-new]").textContent = bookings.filter((item) => item.status === "New enquiry").length;
  document.querySelector("[data-stat-confirmed]").textContent = bookings.filter((item) => item.status === "Confirmed").length;
  document.querySelector("[data-stat-packages]").textContent = packages.length;
}

function renderBookings() {
  const needle = searchTerm.trim().toLowerCase();
  const visible = bookings.filter((booking) => {
    const statusMatch = statusFilter === "All" || booking.status === statusFilter;
    const text = [booking.customerName, booking.phone, booking.route, booking.packageTitle, booking.details].join(" ").toLowerCase();
    return statusMatch && (!needle || text.includes(needle));
  });

  if (!visible.length) {
    bookingList.innerHTML = '<div class="empty-state">No bookings found. Add a booking or load samples.</div>';
    updateStats();
    return;
  }

  bookingList.innerHTML = visible
    .map((booking) => {
      const date = booking.travelDate || "Not fixed";
      const created = booking.createdAt ? new Date(booking.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";
      return `
        <article class="booking-row" data-booking-id="${escapeHtml(booking.id)}">
          <div>
            <strong>${escapeHtml(booking.customerName || "Guest")}</strong>
            <span class="booking-meta">${escapeHtml(booking.phone || "No phone")} · ${escapeHtml(booking.passengers || "Passengers not set")}</span>
          </div>
          <div>
            <strong>${escapeHtml(booking.packageTitle || "Custom trip")}</strong>
            <span class="booking-meta">${escapeHtml(date)}</span>
          </div>
          <span class="status-pill ${statusClass(booking.status)}">${escapeHtml(booking.status || "New enquiry")}</span>
          <div class="row-actions">
            <button class="ghost-btn small" type="button" data-edit-booking="${escapeHtml(booking.id)}">Edit</button>
            <button class="icon-btn" type="button" aria-label="Delete booking" data-delete-booking="${escapeHtml(booking.id)}">×</button>
          </div>
          <span class="booking-meta">${escapeHtml(booking.route || "")}${created ? ` · ${escapeHtml(created)}` : ""}</span>
        </article>
      `;
    })
    .join("");
  updateStats();
}

function renderPackages() {
  if (!packages.length) {
    packageGrid.innerHTML = '<div class="empty-state">No packages loaded yet.</div>';
    updateStats();
    return;
  }

  packageGrid.innerHTML = packages
    .slice(0, 60)
    .map((pkg, index) => `
      <article class="package-card-admin">
        <span class="mini-label">${escapeHtml(pkg.type)}</span>
        <h3>${escapeHtml(pkg.package)}</h3>
        <p>${escapeHtml(pkg.route)}</p>
        <div class="row-actions">
          <button class="ghost-btn small" type="button" data-edit-package="${index}">Edit</button>
          <button class="icon-btn" type="button" aria-label="Delete package" data-delete-package="${index}">×</button>
        </div>
      </article>
    `)
    .join("");
  updateStats();
}

function renderGallery() {
  if (!gallery.length) {
    photoGrid.innerHTML = '<div class="empty-state">Added photos will appear here. Existing website photos stay in the site files.</div>';
    return;
  }

  photoGrid.innerHTML = gallery
    .map((photo, index) => `
      <article class="photo-card">
        <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt || "Gallery photo")}" />
        <div>
          <span>${escapeHtml(photo.alt || "Karthik Travels photo")}</span>
          <button class="ghost-btn small" type="button" data-delete-photo="${index}">Remove photo</button>
        </div>
      </article>
    `)
    .join("");
}

function fillSettings() {
  settingsForm.elements.whatsapp.value = settings.whatsapp || "";
  settingsForm.elements.email.value = settings.email || "";
  settingsForm.elements.phone.value = settings.phone || "";
  settingsForm.elements.note.value = settings.note || "";
}

async function loadSourcePackages() {
  try {
    const response = await fetch("karthiktravels_site_data/packages.json");
    if (!response.ok) throw new Error("Package source unavailable");
    return await response.json();
  } catch {
    return [];
  }
}

async function init() {
  bookings = readStorage(storageKeys.bookings, []);
  gallery = await readSharedStore("gallery", readStorage(storageKeys.gallery, []));
  settings = { ...defaultSettings, ...(await readSharedStore("settings", readStorage(storageKeys.settings, {}))) };
  packages = await readSharedStore("packages", readStorage(storageKeys.packages, []));
  try {
    const data = await apiJson("/api/bookings");
    bookings = data.bookings || bookings;
  } catch {
    // Local bookings are used until the Cloudflare D1 binding is connected.
  }
  if (!packages.length) {
    packages = await loadSourcePackages();
  }
  renderBookings();
  renderPackages();
  renderGallery();
  fillSettings();
}

function saveBookings() {
  writeStorage(storageKeys.bookings, bookings);
  renderBookings();
}

async function saveBookingsToApi(record) {
  try {
    await apiJson("/api/bookings", {
      method: "PUT",
      body: JSON.stringify(record),
    });
  } catch {
    // Keep local edits usable without the production database.
  }
}

async function deleteBookingFromApi(id) {
  try {
    await apiJson(`/api/bookings?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    // Keep local edits usable without the production database.
  }
}

function savePackages() {
  writeStorage(storageKeys.packages, packages);
  writeSharedStore("packages", packages);
  renderPackages();
}

function saveGallery() {
  writeStorage(storageKeys.gallery, gallery);
  writeSharedStore("gallery", gallery);
  renderGallery();
}

function openBookingDialog(booking = null) {
  bookingForm.reset();
  document.querySelector("[data-dialog-title]").textContent = booking ? "Edit booking" : "Add booking";
  if (booking) {
    bookingForm.elements.id.value = booking.id || "";
    bookingForm.elements.customerName.value = booking.customerName || "";
    bookingForm.elements.phone.value = booking.phone || "";
    bookingForm.elements.travelDate.value = booking.travelDate && booking.travelDate !== "Not fixed" ? booking.travelDate : "";
    bookingForm.elements.passengers.value = booking.passengers || "1 person";
    bookingForm.elements.status.value = booking.status || "New enquiry";
    bookingForm.elements.packageTitle.value = booking.packageTitle || "";
    bookingForm.elements.route.value = booking.route || booking.details || "";
  }
  bookingDialog.showModal();
}

document.querySelector("[data-open-new-booking]").addEventListener("click", () => openBookingDialog());
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => bookingDialog.close());
});

document.querySelector("[data-booking-search]").addEventListener("input", (event) => {
  searchTerm = event.target.value;
  renderBookings();
});

document.querySelector("[data-status-filter]").addEventListener("change", (event) => {
  statusFilter = event.target.value;
  renderBookings();
});

bookingList.addEventListener("click", (event) => {
  const editId = event.target.closest("[data-edit-booking]")?.dataset.editBooking;
  const deleteId = event.target.closest("[data-delete-booking]")?.dataset.deleteBooking;
  if (editId) {
    openBookingDialog(bookings.find((booking) => booking.id === editId));
  }
  if (deleteId) {
    bookings = bookings.filter((booking) => booking.id !== deleteId);
    deleteBookingFromApi(deleteId);
    saveBookings();
  }
});

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(bookingForm);
  const id = data.get("id") || createId("KT");
  const record = {
    id,
    createdAt: bookings.find((booking) => booking.id === id)?.createdAt || new Date().toISOString(),
    status: data.get("status"),
    source: "Admin",
    customerName: data.get("customerName"),
    phone: data.get("phone"),
    travelDate: data.get("travelDate") || "Not fixed",
    passengers: data.get("passengers"),
    packageTitle: data.get("packageTitle"),
    packageType: "Manual",
    route: data.get("route"),
    details: data.get("route"),
  };
  bookings = [record, ...bookings.filter((booking) => booking.id !== id)];
  saveBookingsToApi(record);
  saveBookings();
  bookingDialog.close();
});

document.querySelector("[data-seed-bookings]").addEventListener("click", () => {
  bookings = [...sampleBookings(), ...bookings];
  saveBookings();
});

document.querySelector("[data-export-bookings]").addEventListener("click", () => {
  const headers = ["id", "createdAt", "status", "customerName", "phone", "travelDate", "passengers", "packageTitle", "route", "details"];
  const lines = [headers.join(",")].concat(
    bookings.map((booking) =>
      headers
        .map((header) => `"${String(booking[header] || "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "karthik-travels-bookings.csv";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector("[data-save-package]").addEventListener("click", () => {
  const data = new FormData(packageForm);
  const index = data.get("index");
  const route = String(data.get("route") || "");
  const record = {
    type: data.get("type"),
    package: data.get("package"),
    route,
    places: routePlaces(route),
    price: null,
    priceNote: data.get("priceNote") || "Ask for vehicle & price",
    image: data.get("image") || "",
  };
  if (!record.type || !record.package || !record.route) return;
  if (index !== "") {
    packages[Number(index)] = record;
  } else {
    packages.unshift(record);
  }
  packageForm.reset();
  packageForm.elements.index.value = "";
  savePackages();
});

packageGrid.addEventListener("click", (event) => {
  const editIndex = event.target.closest("[data-edit-package]")?.dataset.editPackage;
  const deleteIndex = event.target.closest("[data-delete-package]")?.dataset.deletePackage;
  if (editIndex !== undefined) {
    const pkg = packages[Number(editIndex)];
    packageForm.elements.index.value = editIndex;
    packageForm.elements.type.value = pkg.type || "";
    packageForm.elements.package.value = pkg.package || "";
    packageForm.elements.route.value = pkg.route || "";
    packageForm.elements.priceNote.value = pkg.priceNote || "";
    packageForm.elements.image.value = pkg.image || "";
    packageForm.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (deleteIndex !== undefined) {
    packages.splice(Number(deleteIndex), 1);
    savePackages();
  }
});

document.querySelector("[data-reset-packages]").addEventListener("click", async () => {
  packages = await loadSourcePackages();
  writeStorage(storageKeys.packages, packages);
  writeSharedStore("packages", packages);
  renderPackages();
});

photoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const fileInput = photoForm.elements.photo;
  const file = fileInput.files[0];
  const url = photoForm.elements.url.value.trim();
  const alt = photoForm.elements.alt.value.trim() || "Karthik Travels photo";

  const addPhoto = (src) => {
    gallery.unshift({ src, alt, createdAt: new Date().toISOString() });
    photoForm.reset();
    saveGallery();
  };

  if (file) {
    const reader = new FileReader();
    reader.addEventListener("load", () => addPhoto(reader.result));
    reader.readAsDataURL(file);
  } else if (url) {
    addPhoto(url);
  }
});

photoGrid.addEventListener("click", (event) => {
  const deleteIndex = event.target.closest("[data-delete-photo]")?.dataset.deletePhoto;
  if (deleteIndex === undefined) return;
  gallery.splice(Number(deleteIndex), 1);
  saveGallery();
});

document.querySelector("[data-clear-gallery]").addEventListener("click", () => {
  gallery = [];
  saveGallery();
});

document.querySelector("[data-save-settings]").addEventListener("click", () => {
  settings = {
    whatsapp: settingsForm.elements.whatsapp.value.trim(),
    email: settingsForm.elements.email.value.trim(),
    phone: settingsForm.elements.phone.value.trim(),
    note: settingsForm.elements.note.value.trim(),
  };
  writeStorage(storageKeys.settings, settings);
  writeSharedStore("settings", settings);
});

init();
