import { createRequire } from "node:module";

const require = createRequire(
  "/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json",
);
const { chromium } = require("playwright");

const targetUrl = process.env.TARGET_URL || "http://localhost:4181/?mobile-audit=390x844";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});

await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1800);

const home = await page.evaluate(() => {
  const rectOf = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
    };
  };
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    header: rectOf(".site-header"),
    topStrip: rectOf(".top-strip") || rectOf(".site-header"),
    hero: rectOf(".hero"),
    h1: rectOf(".hero h1"),
  };
});

await page.evaluate(() => {
  const visibleOpener = [...document.querySelectorAll("[data-cart-open]")].find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  visibleOpener?.click();
});
await page.waitForTimeout(350);

const cart = await page.evaluate(() => {
  const rectOf = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
    };
  };
  const drawerEl = document.querySelector("[data-cart-drawer]");
  return {
    open: document.body.classList.contains("cart-open"),
    drawer: rectOf("[data-cart-drawer]"),
    body: rectOf(".cart-body"),
    scrollWidth: drawerEl?.scrollWidth,
    clientWidth: drawerEl?.clientWidth,
    pageScrollWidth: document.documentElement.scrollWidth,
  };
});

await page.evaluate(() => document.querySelector("[data-checkout-open]")?.click());
await page.waitForTimeout(300);

const checkout = await page.evaluate(() => {
  const rectOf = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
    };
  };
  const formEl = document.querySelector(".checkout-form");
  const modalEl = document.querySelector("[data-checkout-modal]");
  return {
    open: document.body.classList.contains("checkout-open"),
    modal: rectOf("[data-checkout-modal]"),
    form: rectOf(".checkout-form"),
    submit: rectOf(".checkout-submit"),
    formScrollWidth: formEl?.scrollWidth,
    formClientWidth: formEl?.clientWidth,
    modalScrollHeight: modalEl?.scrollHeight,
    modalClientHeight: modalEl?.clientHeight,
    pageScrollWidth: document.documentElement.scrollWidth,
  };
});

await browser.close();

const report = { targetUrl, home, cart, checkout };
const failures = [];

if (report.home.viewport.width !== 390 || report.home.viewport.height !== 844) {
  failures.push(`Expected 390x844 viewport, got ${report.home.viewport.width}x${report.home.viewport.height}`);
}
if (report.home.scrollWidth > 390 || report.home.bodyScrollWidth > 390) {
  failures.push(`Home has sideways scroll: html ${report.home.scrollWidth}, body ${report.home.bodyScrollWidth}`);
}
for (const [name, rect] of [
  ["header", report.home.header],
  ["top strip", report.home.topStrip],
  ["hero", report.home.hero],
  ["hero title", report.home.h1],
]) {
  if (!rect) failures.push(`Missing ${name}`);
  else if (rect.x < -1 || rect.right > 391) failures.push(`${name} does not fit viewport: ${JSON.stringify(rect)}`);
}
if (!report.cart.open) failures.push("Cart drawer did not open");
if (!report.cart.drawer) failures.push("Missing cart drawer");
else if (report.cart.drawer.x < -1 || report.cart.drawer.right > 391 || report.cart.drawer.width > 390) {
  failures.push(`Cart drawer overflows: ${JSON.stringify(report.cart.drawer)}`);
}
if (report.cart.scrollWidth > report.cart.clientWidth) {
  failures.push(`Cart drawer internal horizontal overflow: ${report.cart.scrollWidth} > ${report.cart.clientWidth}`);
}
if (report.cart.pageScrollWidth > 390) {
  failures.push(`Page scrolls sideways while cart is open: ${report.cart.pageScrollWidth}`);
}
if (!report.checkout.open) failures.push("Checkout modal did not open");
if (!report.checkout.modal) failures.push("Missing checkout modal");
else if (report.checkout.modal.x < -1 || report.checkout.modal.right > 391 || report.checkout.modal.width > 390) {
  failures.push(`Checkout modal overflows width: ${JSON.stringify(report.checkout.modal)}`);
}
if (report.checkout.formScrollWidth > report.checkout.formClientWidth) {
  failures.push(`Checkout form horizontal overflow: ${report.checkout.formScrollWidth} > ${report.checkout.formClientWidth}`);
}
if (!report.checkout.submit) failures.push("Missing checkout submit button");
else if (report.checkout.submit.x < -1 || report.checkout.submit.right > 391 || report.checkout.submit.bottom > 844) {
  failures.push(`Checkout submit button is outside viewport: ${JSON.stringify(report.checkout.submit)}`);
}
if (report.checkout.pageScrollWidth > 390) {
  failures.push(`Page scrolls sideways while checkout is open: ${report.checkout.pageScrollWidth}`);
}

console.log(JSON.stringify({ ok: failures.length === 0, failures, report }, null, 2));
if (failures.length) process.exit(1);
