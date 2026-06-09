import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = "https://karthiktravels.in/";
const OUT = path.resolve("karthiktravels_site_data");

const headers = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

const seedPages = [
  "https://karthiktravels.in/",
  "https://karthiktravels.in/index.php",
  "https://karthiktravels.in/about.html",
  "https://karthiktravels.in/gallery.html",
  "https://karthiktravels.in/gallery1.html",
  "https://karthiktravels.in/tour.html",
  "https://karthiktravels.in/tour1.html?joy=0",
  "https://karthiktravels.in/tour1.html?joy=1",
  "https://karthiktravels.in/tour1.html?joy=2",
  "https://karthiktravels.in/tour1.html?joy=3",
  "https://karthiktravels.in/contact.php",
];

function cleanText(value) {
  return decodeEntities(stripTags(value))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim();
}

function stripTags(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function absoluteUrl(url, base = ROOT) {
  try {
    return new URL(url, base).href;
  } catch {
    return "";
  }
}

function safeFileName(url, fallback = "file") {
  const parsed = new URL(url);
  const ext = path.extname(parsed.pathname) || ".html";
  const stem = `${parsed.hostname}${parsed.pathname}${parsed.search}`
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
  return `${stem || fallback}${ext}`;
}

async function fetchText(url) {
  const response = await fetch(url, { headers, redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return await response.text();
}

async function fetchBytes(url) {
  const response = await fetch(url, { headers, redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "",
  };
}

function extractTitle(html) {
  return cleanText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
}

function extractLinks(html, base) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      text: cleanText(match[2]),
      href: absoluteUrl(match[1], base),
    }))
    .filter((link) => link.href);
}

function extractImages(html, base) {
  return [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((tagMatch) => {
      const tag = tagMatch[0];
      const src = (tag.match(/\bsrc=["']([^"']+)["']/i) || [])[1] || "";
      const alt = (tag.match(/\balt=["']([^"']*)["']/i) || [])[1] || "";
      const title = (tag.match(/\btitle=["']([^"']*)["']/i) || [])[1] || "";
      return {
        src: absoluteUrl(src, base),
        alt: cleanText(alt),
        title: cleanText(title),
      };
    })
    .filter((image) => image.src);
}

function extractHeadings(html) {
  return [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => ({ level: match[1].toLowerCase(), text: cleanText(match[2]) }))
    .filter((heading) => heading.text);
}

function extractContact(text) {
  const phones = [
    ...new Set(
      (text.match(/(?:\+91\s*)?(?:0\d{3}\s*)?\d{5}\s*\d{5}|(?:\+91\s*)?0\d{3}\s*\d{7}|\b\d{7,10}\b/g) || [])
        .map((phone) => phone.replace(/\s+/g, " ").trim())
        .filter((phone) => phone.length >= 7),
    ),
  ].filter((phone, _, list) => !list.some((other) => other !== phone && other.endsWith(phone)));
  const emails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])];
  const addressMatch = text.match(/Chemical House[\s\S]*?Tamilnadu,\s*INDIA\./i);
  return {
    phones,
    emails,
    address: addressMatch ? cleanText(addressMatch[0]) : "",
  };
}

function extractPackages(html) {
  const packages = [];
  const sectionMatches = [...html.matchAll(/<div id="(prog\d+)">([\s\S]*?)(?=<div id="prog\d+">|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="footer_bg">)/gi)];
  for (const sectionMatch of sectionMatches) {
    const sectionHtml = sectionMatch[2];
    const packageType = cleanText((sectionHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || sectionMatch[1]);
    const itemMatches = [...sectionHtml.matchAll(/<h3[^>]*>(Package\s*\d+)<\/h3>\s*<ul>\s*<li>([\s\S]*?)<\/li>\s*<\/ul>/gi)];
    for (const item of itemMatches) {
      const route = cleanText(item[2]);
      packages.push({
        type: packageType,
        package: cleanText(item[1]),
        route,
        places: route
          .split(",")
          .map((place) => place.trim())
          .filter(Boolean),
        price: null,
        priceNote: "No price is listed on the source website.",
      });
    }
  }
  return packages;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, "pages"), { recursive: true });
  await mkdir(path.join(OUT, "images"), { recursive: true });

  const pages = [];
  const pageErrors = [];
  const imageMap = new Map();
  const allPackages = [];
  let contact = {};

  for (const url of seedPages) {
    let html = "";
    try {
      html = await fetchText(url);
    } catch (error) {
      pageErrors.push({ url, error: error.message || String(error) });
      continue;
    }
    const fileName = safeFileName(url);
    const text = cleanText(html);
    const page = {
      url,
      title: extractTitle(html),
      file: `pages/${fileName}`,
      textFile: `pages/${fileName.replace(/\.html?$/i, ".txt")}`,
      headings: extractHeadings(html),
      links: extractLinks(html, url),
      images: extractImages(html, url),
      text,
    };
    await writeFile(path.join(OUT, page.file), html, "utf8");
    await writeFile(path.join(OUT, page.textFile), text, "utf8");
    pages.push(page);
    page.images.forEach((image) => imageMap.set(image.src, image));
    const packages = extractPackages(html);
    if (packages.length) allPackages.push(...packages);
    const pageContact = extractContact(text);
    if (pageContact.phones.length || pageContact.emails.length || pageContact.address) {
      contact = {
        phones: [...new Set([...(contact.phones || []), ...pageContact.phones])],
        emails: [...new Set([...(contact.emails || []), ...pageContact.emails])],
        address: contact.address || pageContact.address,
      };
    }
  }

  const images = [];
  for (const image of imageMap.values()) {
    try {
      const { bytes, contentType } = await fetchBytes(image.src);
      const imageName = safeFileName(image.src, "image").replace(/\.html?$/i, "");
      const parsedExt = path.extname(new URL(image.src).pathname);
      const ext =
        parsedExt ||
        (contentType.includes("png")
          ? ".png"
          : contentType.includes("gif")
            ? ".gif"
            : contentType.includes("jpeg") || contentType.includes("jpg")
              ? ".jpg"
              : ".bin");
      const finalName = imageName.endsWith(ext) ? imageName : `${imageName}${ext}`;
      const localPath = path.join("images", finalName);
      await writeFile(path.join(OUT, localPath), bytes);
      images.push({ ...image, localPath, contentType, bytes: bytes.length });
    } catch (error) {
      images.push({ ...image, error: error.message || String(error) });
    }
  }

  const packageKeys = new Set();
  const uniquePackages = allPackages.filter((pkg) => {
    const key = `${pkg.type}::${pkg.package}::${pkg.route}`;
    if (packageKeys.has(key)) return false;
    packageKeys.add(key);
    return true;
  });

  const summary = {
    scrapedAt: new Date().toISOString(),
    source: ROOT,
    pages: pages.map(({ text, ...page }) => page),
    pageErrors,
    contact,
    packages: uniquePackages,
    images,
    notes: [
      "The website lists routes/places for packages but does not publish package prices.",
      "Images were downloaded from URLs referenced by the public source pages.",
    ],
  };

  await writeFile(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  await writeFile(
    path.join(OUT, "packages.json"),
    JSON.stringify(uniquePackages, null, 2),
    "utf8",
  );
  await writeFile(path.join(OUT, "images.json"), JSON.stringify(images, null, 2), "utf8");
  await writeFile(path.join(OUT, "contact.json"), JSON.stringify(contact, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        out: OUT,
        pages: pages.length,
        pageErrors: pageErrors.length,
        uniqueImages: imageMap.size,
        downloadedImages: images.filter((image) => !image.error).length,
        failedImages: images.filter((image) => image.error).length,
        packages: uniquePackages.length,
        pricesFound: uniquePackages.filter((pkg) => pkg.price).length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
