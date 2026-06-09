const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const packageGrid = document.querySelector("[data-package-grid]");
const filterButtons = document.querySelectorAll("[data-package-filter]");
const bookingButtons = document.querySelectorAll("[data-booking-button]");
const cartOpenButtons = document.querySelectorAll("[data-cart-open]");
const cartCloseButtons = document.querySelectorAll("[data-cart-close]");
const cartDrawer = document.querySelector("[data-cart-drawer]");
const cartOverlay = document.querySelector("[data-cart-overlay]");
const cartType = document.querySelector("[data-cart-type]");
const cartTitle = document.querySelector("[data-cart-title]");
const cartRoute = document.querySelector("[data-cart-route]");
const cartWhatsApp = document.querySelector("[data-cart-whatsapp]");
const checkoutOpen = document.querySelector("[data-checkout-open]");
const checkoutCloseButtons = document.querySelectorAll("[data-checkout-close]");
const checkoutBackdrop = document.querySelector("[data-checkout-backdrop]");
const checkoutModal = document.querySelector("[data-checkout-modal]");
const checkoutForm = document.querySelector("[data-checkout-form]");
const galleryGrid = document.querySelector("[data-gallery-grid]");
const heroSlides = document.querySelectorAll(".hero-slide");
const showcaseImages = document.querySelectorAll(".showcase-image");
const showcaseThumbs = document.querySelectorAll("[data-showcase-thumb]");
const showcaseCount = document.querySelector("[data-showcase-count]");
const showcaseProgress = document.querySelector("[data-showcase-progress]");
const showcasePrev = document.querySelector("[data-showcase-prev]");
const showcaseNext = document.querySelector("[data-showcase-next]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let whatsappNumber = "";
let bookingMessage = "Hi, I want to book a trip.";

const featuredImages = [
  "assets/whatsapp-gallery/whatsapp-trip-01.jpeg",
  "assets/whatsapp-gallery/whatsapp-trip-02.jpeg",
  "assets/whatsapp-gallery/whatsapp-trip-03.jpeg",
  "assets/whatsapp-gallery/whatsapp-trip-04.jpeg",
  "assets/whatsapp-gallery/whatsapp-trip-05.jpeg",
  "assets/whatsapp-gallery/whatsapp-trip-06.jpeg",
  "assets/whatsapp-gallery/whatsapp-trip-07.jpeg",
  "assets/whatsapp-gallery/whatsapp-trip-08.jpeg",
  "assets/whatsapp-gallery/whatsapp-trip-09.jpeg",
  "assets/whatsapp-gallery/whatsapp-trip-10.jpeg",
];

const packageImageOverrides = {
  "One Day Package:Package 4": "assets/whatsapp-gallery/package-4-vehicle-back-v2.png",
};

let allPackages = [];
let activeFilter = "All";
let activeHeroSlide = 0;
let activeShowcaseSlide = 0;
let showcaseTimer;
let selectedCartPlan = {
  type: "Custom trip",
  title: "Tamil Nadu travel enquiry",
  route: "Tell us your pickup place, destination, date and passengers. The team will suggest the right vehicle and package.",
};
const fallbackPublicConfig = {
  businessWhatsAppNumber: "+919443133465",
  bookingMessage: "Hi, I want to book a trip.",
};

const adminStorageKeys = {
  bookings: "kt-admin-bookings",
  packages: "kt-admin-packages",
  gallery: "kt-admin-gallery",
  settings: "kt-admin-settings",
};

function readAdminStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeAdminStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private browsing; WhatsApp enquiry still works.
  }
}

async function readSharedStore(key, fallback) {
  try {
    const response = await fetch(`/api/admin-store?key=${encodeURIComponent(key)}`);
    if (!response.ok) throw new Error("Shared store unavailable");
    const data = await response.json();
    return data.value ?? fallback;
  } catch {
    return fallback;
  }
}

function createBookingId() {
  return `KT-${Date.now().toString(36).toUpperCase()}`;
}

function storeWebsiteBooking(record) {
  const bookings = readAdminStorage(adminStorageKeys.bookings, []);
  bookings.unshift(record);
  writeAdminStorage(adminStorageKeys.bookings, bookings.slice(0, 200));
  return fetch("/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(record),
    keepalive: true,
  }).catch(() => null);
}

function syncHeader() {
  header.classList.toggle("is-scrolled", window.scrollY > 20);
}

function setMenu(open) {
  document.body.classList.toggle("nav-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
}

function whatsappUrl(message) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function updateCart(plan = selectedCartPlan) {
  selectedCartPlan = { ...selectedCartPlan, ...plan };
  if (cartType) cartType.textContent = selectedCartPlan.type;
  if (cartTitle) cartTitle.textContent = selectedCartPlan.title;
  if (cartRoute) cartRoute.textContent = selectedCartPlan.route;
  if (cartWhatsApp) {
    const message = `Hi Karthik Travels, I want to enquire about ${selectedCartPlan.type}: ${selectedCartPlan.title}. Route/details: ${selectedCartPlan.route}`;
    cartWhatsApp.href = whatsappNumber ? whatsappUrl(message) : "/simulator.html";
  }
}

function openCart(plan) {
  updateCart(plan);
  document.body.classList.add("cart-open");
  cartDrawer?.setAttribute("aria-hidden", "false");
  if (cartOverlay) cartOverlay.hidden = false;
}

function closeCart() {
  document.body.classList.remove("cart-open");
  cartDrawer?.setAttribute("aria-hidden", "true");
  if (cartOverlay) cartOverlay.hidden = true;
}

function openCheckout() {
  document.body.classList.add("checkout-open");
  checkoutModal?.setAttribute("aria-hidden", "false");
  if (checkoutBackdrop) checkoutBackdrop.hidden = false;
}

function closeCheckout() {
  document.body.classList.remove("checkout-open");
  checkoutModal?.setAttribute("aria-hidden", "true");
  if (checkoutBackdrop) checkoutBackdrop.hidden = true;
}

function applyBookingLinks() {
  bookingButtons.forEach((button) => {
    if (!whatsappNumber) {
      button.setAttribute("href", "/simulator.html");
      button.removeAttribute("target");
      return;
    }
    button.setAttribute("href", whatsappUrl(bookingMessage));
    button.setAttribute("target", "_blank");
    button.setAttribute("rel", "noreferrer");
  });
  updateCart();
}

function setHeroSlide(index) {
  if (!heroSlides.length) return;
  heroSlides[activeHeroSlide].classList.remove("is-active");
  activeHeroSlide = (index + heroSlides.length) % heroSlides.length;
  heroSlides[activeHeroSlide].classList.add("is-active");
}

function setShowcaseSlide(index) {
  if (!showcaseImages.length) return;
  showcaseImages[activeShowcaseSlide].classList.remove("is-active");
  showcaseThumbs[activeShowcaseSlide]?.classList.remove("is-active");
  activeShowcaseSlide = (index + showcaseImages.length) % showcaseImages.length;
  showcaseImages[activeShowcaseSlide].classList.add("is-active");
  showcaseThumbs[activeShowcaseSlide]?.classList.add("is-active");
  if (showcaseCount) {
    showcaseCount.textContent = `${String(activeShowcaseSlide + 1).padStart(2, "0")} / ${String(showcaseImages.length).padStart(2, "0")}`;
  }
  if (showcaseProgress) {
    showcaseProgress.style.width = `${((activeShowcaseSlide + 1) / showcaseImages.length) * 100}%`;
  }
}

function restartShowcaseTimer() {
  if (reduceMotion || !showcaseImages.length) return;
  window.clearInterval(showcaseTimer);
  showcaseTimer = window.setInterval(() => setShowcaseSlide(activeShowcaseSlide + 1), 4300);
}

function routeSummary(pkg) {
  const places = pkg.places || [];
  const uniquePlaces = places.filter((place, index) => places.indexOf(place) === index);
  return uniquePlaces.slice(0, 5);
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPackages() {
  const filtered = activeFilter === "All" ? allPackages : allPackages.filter((pkg) => pkg.type === activeFilter);
  const visible = filtered.slice(0, 6);

  if (!visible.length) {
    packageGrid.innerHTML = '<p class="empty-state">Package details are loading.</p>';
    return;
  }

  packageGrid.innerHTML = visible
    .map((pkg, index) => {
      const routeTags = routeSummary(pkg)
        .map((place) => `<span>${place}</span>`)
        .join("");
      const message = `Hi Karthik Travels, please share details for ${pkg.type} ${pkg.package}: ${pkg.route}`;
      const image = pkg.image || packageImageOverrides[`${pkg.type}:${pkg.package}`] || featuredImages[index % featuredImages.length];
      const title = routeSummary(pkg).slice(1, 4).join(" + ") || pkg.package;
      return `
        <article class="package-card reveal in-view">
          <div class="package-card-body">
            <div class="package-meta">
              <span>${pkg.type}</span>
              <span>${pkg.package}</span>
            </div>
            <h3>${title}</h3>
            <p>${pkg.route}</p>
            <div class="route-list">${routeTags}</div>
          </div>
          <button class="package-card-action" type="button" data-cart-package="${escapeAttribute(pkg.type)}" data-cart-title="${escapeAttribute(title)}" data-cart-route="${escapeAttribute(pkg.route)}">Ask for vehicle & price</button>
          <img class="package-card-image" src="${image}" alt="" loading="lazy" />
        </article>
      `;
    })
    .join("");
}

async function applyLocalGalleryOverrides() {
  if (!galleryGrid) return;
  const sharedGallery = await readSharedStore("gallery", []);
  const localGallery = readAdminStorage(adminStorageKeys.gallery, []);
  const photos = localGallery.length ? localGallery : sharedGallery;
  photos
    .filter((item) => item && item.src)
    .forEach((item) => {
      const image = document.createElement("img");
      image.src = item.src;
      image.alt = item.alt || "Karthik Travels gallery photo";
      image.loading = "lazy";
      galleryGrid.appendChild(image);
    });
}

async function loadPackages() {
  try {
    const response = await fetch("karthiktravels_site_data/packages.json");
    allPackages = await response.json();
  } catch {
    allPackages = [
      {
        type: "One Day Package",
        package: "Package 1",
        route: "Coimbatore, Marudamalai Temple, Perur Temple, Isha Yoga, Eachanari, Sri Mahalakshmi, Kovai Kutralam, Coimbatore",
        places: ["Coimbatore", "Marudamalai Temple", "Perur Temple", "Isha Yoga", "Kovai Kutralam"],
      },
    ];
  }
  const localPackages = readAdminStorage(adminStorageKeys.packages, []);
  const sharedPackages = await readSharedStore("packages", []);
  if (sharedPackages.length) {
    allPackages = sharedPackages;
  }
  if (localPackages.length) {
    allPackages = localPackages;
  }
  renderPackages();
}

async function loadPublicConfig() {
  try {
    const response = await fetch("/api/public-config");
    if (!response.ok) throw new Error("Config unavailable");
    const config = await response.json();
    whatsappNumber = config.businessWhatsAppNumber || fallbackPublicConfig.businessWhatsAppNumber;
    bookingMessage = config.bookingMessage || fallbackPublicConfig.bookingMessage;
  } catch {
    try {
      const response = await fetch("public-config.json");
      if (!response.ok) throw new Error("Static config unavailable");
      const config = await response.json();
      whatsappNumber = config.businessWhatsAppNumber || fallbackPublicConfig.businessWhatsAppNumber;
      bookingMessage = config.bookingMessage || fallbackPublicConfig.bookingMessage;
    } catch {
      whatsappNumber = fallbackPublicConfig.businessWhatsAppNumber;
      bookingMessage = fallbackPublicConfig.bookingMessage;
    }
  }
  applyBookingLinks();
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 },
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

window.addEventListener("scroll", syncHeader, { passive: true });
syncHeader();

menuToggle.addEventListener("click", () => {
  setMenu(!document.body.classList.contains("nav-open"));
});

nav.addEventListener("click", (event) => {
  if (event.target.matches("a")) setMenu(false);
});

cartOpenButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openCart();
  });
});

packageGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cart-package]");
  if (!button) return;
  openCart({
    type: button.dataset.cartPackage || "Package enquiry",
    title: button.dataset.cartTitle || "Selected route",
    route: button.dataset.cartRoute || "Please share route details.",
  });
});

cartCloseButtons.forEach((button) => button.addEventListener("click", closeCart));
cartOverlay?.addEventListener("click", closeCart);
checkoutOpen?.addEventListener("click", openCheckout);
checkoutCloseButtons.forEach((button) => button.addEventListener("click", closeCheckout));
checkoutBackdrop?.addEventListener("click", (event) => {
  if (event.target === checkoutBackdrop) closeCheckout();
});

checkoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(checkoutForm);
  const bookingRecord = {
    id: createBookingId(),
    createdAt: new Date().toISOString(),
    status: "New enquiry",
    source: "Website checkout",
    packageType: selectedCartPlan.type,
    packageTitle: selectedCartPlan.title,
    route: selectedCartPlan.route,
    customerName: String(form.get("name") || "").trim(),
    phone: String(form.get("phone") || "").trim(),
    travelDate: String(form.get("date") || "Not fixed"),
    passengers: String(form.get("passengers") || ""),
    details: String(form.get("details") || "").trim(),
  };
  await storeWebsiteBooking(bookingRecord);
  const details = [
    `Hi Karthik Travels, I want to book/enquire.`,
    `Package: ${selectedCartPlan.type} - ${selectedCartPlan.title}`,
    `Route: ${selectedCartPlan.route}`,
    `Name: ${form.get("name") || ""}`,
    `Phone: ${form.get("phone") || ""}`,
    `Date: ${form.get("date") || "Not fixed"}`,
    `Passengers: ${form.get("passengers") || ""}`,
    `Pickup/destination: ${form.get("details") || ""}`,
  ].join("\n");
  window.location.href = whatsappNumber ? whatsappUrl(details) : `/simulator.html?message=${encodeURIComponent(details)}`;
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeCheckout();
  closeCart();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.packageFilter;
    renderPackages();
  });
});

if (!reduceMotion && heroSlides.length > 1) {
  window.setInterval(() => setHeroSlide(activeHeroSlide + 1), 5200);
}

showcaseThumbs.forEach((thumb) => {
  thumb.addEventListener("click", () => {
    setShowcaseSlide(Number(thumb.dataset.showcaseThumb || 0));
    restartShowcaseTimer();
  });
});

showcasePrev?.addEventListener("click", () => {
  setShowcaseSlide(activeShowcaseSlide - 1);
  restartShowcaseTimer();
});

showcaseNext?.addEventListener("click", () => {
  setShowcaseSlide(activeShowcaseSlide + 1);
  restartShowcaseTimer();
});

setShowcaseSlide(0);
restartShowcaseTimer();
applyLocalGalleryOverrides();

loadPublicConfig().then(loadPackages);
