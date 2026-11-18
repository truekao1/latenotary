import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import site from "../src/_data/site.js";
import indexnow from "../src/_data/indexnow.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const citiesDir = path.join(root, "data", "cities");
const distDir = path.join(root, "dist");

const errors = [];
const warnings = [];
const cityUpdated = new Map();

if (!/^[a-zA-Z0-9-]{8,128}$/.test(indexnow.key || "")) {
  fail("IndexNow key must be 8-128 letters, numbers, or dashes");
}

function fail(msg) {
  errors.push(msg);
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

const days = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const flagKeys = ["evenings", "saturday", "sunday", "mobile", "hospitalJail", "ron"];

function checkCityFile(file) {
  const raw = fs.readFileSync(file, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    fail(`${path.basename(file)} is not valid JSON: ${err.message}`);
    return;
  }

  const expected = path.basename(file);
  const slugName = `${String(data.state || "").toLowerCase()}-${data.citySlug || ""}.json`;
  if (expected !== slugName) {
    warnings.push(`${expected} does not match suggested name ${slugName}`);
  }

  for (const field of ["slug", "city", "citySlug", "state", "stateName", "intro", "lastUpdated", "listings"]) {
    if (data[field] == null || data[field] === "") fail(`${expected}: missing ${field}`);
  }
  if (data.state && String(data.state).length !== 2) fail(`${expected}: state should be a two-letter code`);
  if (!isDate(data.lastUpdated)) fail(`${expected}: lastUpdated must be YYYY-MM-DD`);
  else if (data.state && data.citySlug) {
    cityUpdated.set(
      `${String(data.state).toLowerCase()}/${data.citySlug}/`,
      data.lastUpdated
    );
  }
  if (!Array.isArray(data.listings) || data.listings.length === 0) {
    fail(`${expected}: listings must be a non-empty array`);
    return;
  }

  data.listings.forEach((listing, i) => {
    const label = `${expected} listing ${i + 1} (${listing.name || "unnamed"})`;
    for (const field of ["name", "area", "phone", "website", "hours", "flags", "sources", "lastChecked"]) {
      if (listing[field] == null || listing[field] === "") fail(`${label}: missing ${field}`);
    }
    if (listing.website && !isHttpUrl(listing.website)) fail(`${label}: website is not an http(s) URL`);
    if (listing.bookingUrl && !isHttpUrl(listing.bookingUrl)) fail(`${label}: bookingUrl is not an http(s) URL`);
    if (!isDate(listing.lastChecked)) fail(`${label}: lastChecked must be YYYY-MM-DD`);
    if (!listing.hours || typeof listing.hours !== "object") {
      fail(`${label}: hours must be an object`);
    } else {
      for (const day of days) {
        if (listing.hours[day] == null || listing.hours[day] === "") {
          fail(`${label}: missing hours.${day}`);
        }
      }
    }
    if (!listing.flags) {
      fail(`${label}: missing flags`);
    } else {
      for (const key of flagKeys) {
        if (typeof listing.flags[key] !== "boolean") fail(`${label}: flags.${key} must be a boolean`);
      }
    }
    if (!Array.isArray(listing.sources) || listing.sources.length === 0) {
      fail(`${label}: at least one source is required`);
    } else {
      listing.sources.forEach((source, j) => {
        if (!source.label) fail(`${label}: source ${j + 1} is missing a label`);
        if (!isHttpUrl(source.url)) fail(`${label}: source ${j + 1} needs a public http(s) URL`);
      });
    }
  });
}

if (!fs.existsSync(citiesDir)) {
  fail("data/cities does not exist");
} else {
  const files = fs.readdirSync(citiesDir).filter((name) => name.endsWith(".json"));
  if (!files.length) fail("no city JSON files found");
  files.forEach((name) => checkCityFile(path.join(citiesDir, name)));
}

const built = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8" });
if (built.status !== 0) {
  fail(`eleventy build failed:\n${built.stdout}\n${built.stderr}`);
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function mountPrefix() {
  const prefix = site.pathPrefix || "/";
  if (prefix === "/") return "";
  return prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}

function stripMount(hrefPath) {
  const prefix = mountPrefix();
  if (!prefix || !hrefPath.startsWith("/")) return hrefPath;
  if (hrefPath === prefix || hrefPath.startsWith(`${prefix}/`)) {
    return hrefPath.slice(prefix.length) || "/";
  }
  return hrefPath;
}

function resolveInternal(fromFile, href) {
  const raw = href.split("#")[0].split("?")[0];
  if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || /^(https?:)?\/\//.test(raw)) {
    return null;
  }
  const clean = stripMount(raw);
  if (clean.endsWith(".xml") || clean.endsWith(".txt") || clean.endsWith(".html") || path.extname(clean)) {
    const abs = clean.startsWith("/")
      ? path.join(distDir, clean.slice(1))
      : path.join(path.dirname(fromFile), clean);
    return abs;
  }
  const rel = clean.startsWith("/") ? clean.slice(1) : path.relative(distDir, path.join(path.dirname(fromFile), clean));
  const base = path.join(distDir, rel);
  const candidates = [
    base,
    path.join(base, "index.html"),
    `${base}.html`,
  ];
  return candidates;
}

if (fs.existsSync(distDir) && built.status === 0) {
  const htmlFiles = walk(distDir).filter((file) => file.endsWith(".html"));
  const hrefRe = /(?:href|src)="([^"]+)"/g;
  const prefix = mountPrefix();
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    let match;
    while ((match = hrefRe.exec(html))) {
      const href = match[1];
      if (prefix && href.startsWith("/") && !href.startsWith("//")) {
        if (href !== prefix && !href.startsWith(`${prefix}/`)) {
          fail(`root link missing path prefix in ${path.relative(distDir, file)}: ${href}`);
        }
      }
      const resolved = resolveInternal(file, href);
      if (!resolved) continue;
      const candidates = Array.isArray(resolved) ? resolved : [resolved];
      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        fail(`broken internal link in ${path.relative(distDir, file)}: ${href}`);
      }
    }

    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    blocks.forEach((block, i) => {
      try {
        JSON.parse(block[1]);
      } catch (err) {
        fail(`invalid JSON-LD in ${path.relative(distDir, file)} block ${i + 1}: ${err.message}`);
      }
    });
  }

  for (const required of ["index.html", "sitemap.xml", "robots.txt", "404.html", "about/index.html", "ny/new-york/index.html"]) {
    if (!fs.existsSync(path.join(distDir, required))) fail(`missing dist/${required}`);
  }

  const base = String(site.url || "").replace(/\/$/, "");
  const sitemap = fs.readFileSync(path.join(distDir, "sitemap.xml"), "utf8");
  const robots = fs.readFileSync(path.join(distDir, "robots.txt"), "utf8");
  function readDist(rel) {
    const file = path.join(distDir, rel);
    if (!fs.existsSync(file)) {
      fail(`missing dist/${rel}`);
      return "";
    }
    return fs.readFileSync(file, "utf8");
  }

  const home = readDist("index.html");
  const cityPage = readDist("ny/new-york/index.html");
  const statePage = readDist("ny/index.html");
  const guidePage = readDist("guides/notarize-after-hours-or-weekend/index.html");

  function publicUrlForHtml(file) {
    const rel = path.relative(distDir, file).split(path.sep).join("/");
    if (rel === "index.html") return `${base}/`;
    if (rel.endsWith("/index.html")) return `${base}/${rel.slice(0, -"index.html".length)}`;
    return `${base}/${rel}`;
  }

  function withPrefix(href) {
    if (!prefix) return href;
    if (href === "/") return `${prefix}/`;
    return `${prefix}${href.startsWith("/") ? href : `/${href}`}`;
  }

  function hasHref(html, href) {
    return html.includes(`href="${withPrefix(href)}"`) || html.includes(`href="${href}"`);
  }

  const sitemapEntries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const body = match[1];
    return {
      loc: (body.match(/<loc>([^<]*)<\/loc>/) || [])[1],
      lastmod: (body.match(/<lastmod>([^<]*)<\/lastmod>/) || [])[1],
    };
  });
  if (!sitemapEntries.length) fail("sitemap.xml has no URLs");
  const sitemapLocs = new Set();
  for (const entry of sitemapEntries) {
    if (!entry.loc) fail("sitemap url missing loc");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod || "")) {
      fail(`sitemap lastmod missing or invalid for ${entry.loc || "(no loc)"}`);
    }
    if (sitemapLocs.has(entry.loc)) fail(`sitemap duplicate loc ${entry.loc}`);
    sitemapLocs.add(entry.loc);
  }

  const expectedLocs = new Set(
    htmlFiles
      .filter((file) => path.basename(file) !== "404.html")
      .map((file) => publicUrlForHtml(file))
  );
  for (const loc of expectedLocs) {
    if (!sitemapLocs.has(loc)) fail(`sitemap.xml missing ${loc}`);
  }
  for (const loc of sitemapLocs) {
    if (!expectedLocs.has(loc)) fail(`sitemap.xml lists a non-page URL ${loc}`);
  }
  for (const [cityPath, lastUpdated] of cityUpdated) {
    const loc = `${base}/${cityPath}`;
    const entry = sitemapEntries.find((item) => item.loc === loc);
    if (!entry) fail(`sitemap.xml missing city ${loc}`);
    else if (entry.lastmod !== lastUpdated) {
      fail(`sitemap lastmod for ${loc} is ${entry.lastmod}, expected ${lastUpdated}`);
    }
  }
  const newestCityUpdate = [...cityUpdated.values()].sort().at(-1);
  const homeEntry = sitemapEntries.find((item) => item.loc === `${base}/`);
  if (newestCityUpdate && homeEntry && homeEntry.lastmod !== newestCityUpdate) {
    fail(`home sitemap lastmod is ${homeEntry.lastmod}, expected ${newestCityUpdate}`);
  }

  if (!robots.includes(`Sitemap: ${base}/sitemap.xml`)) {
    fail(`robots.txt missing Sitemap: ${base}/sitemap.xml`);
  }
  if (!home.includes(`${base}/`)) fail(`home page missing absolute URL ${base}/`);
  if (!home.includes(`"@type":"WebSite"`) && !home.includes(`"@type": "WebSite"`)) {
    fail("home page missing WebSite JSON-LD");
  }
  if (!home.includes(`"@type":"Organization"`) && !home.includes(`"@type": "Organization"`)) {
    fail("home page missing Organization JSON-LD");
  }
  if (!cityPage.includes(`${base}/ny/new-york/`)) {
    fail(`city page missing absolute URL ${base}/ny/new-york/`);
  }
  if (!cityPage.includes('"Notary"') || !cityPage.includes('"LocalBusiness"')) {
    fail("city page JSON-LD missing LocalBusiness/Notary");
  }
  if (!cityPage.includes('"ItemList"') || !cityPage.includes('"FAQPage"')) {
    fail("city page JSON-LD missing ItemList or FAQPage");
  }
  if (!cityPage.includes("Notary open late in New York")) {
    fail("city page title or heading is missing the late-notary phrase");
  }
  if (!cityPage.includes("Sunday notary New York") || !cityPage.includes("mobile notary near me New York")) {
    fail("city page description is missing Sunday or mobile search phrases");
  }
  if (!cityPage.includes('id="nearby-cities"') || !cityPage.includes('aria-label="Breadcrumb"')) {
    fail("city page missing nearby cities or breadcrumbs");
  }
  if (!hasHref(cityPage, "/ny/") || !hasHref(cityPage, "/guides/notarize-after-hours-or-weekend/")) {
    fail("city page missing state index or guide link");
  }
  if (!hasHref(home, "/ny/") || !hasHref(home, "/ny/new-york/") || !hasHref(home, "/guides/notarize-after-hours-or-weekend/")) {
    fail("home page missing state, city, or guide link");
  }
  if (!hasHref(statePage, "/ny/new-york/") || !hasHref(statePage, "/guides/notarize-after-hours-or-weekend/")) {
    fail("state index missing city or guide link");
  }
  if (!statePage.includes('aria-label="Breadcrumb"') || !statePage.includes('"ItemList"')) {
    fail("state index missing breadcrumbs or ItemList JSON-LD");
  }
  if (!guidePage.includes("How to get a document notarized after hours or on a weekend")) {
    fail("guide page missing its title");
  }
  if (!hasHref(guidePage, "/ny/new-york/")) fail("guide page missing city link");
  if (!guidePage.includes(site.ron.url) || !guidePage.includes(site.ron.disclosure)) {
    fail("guide page missing the affiliate URL or disclosure text");
  }
  if (!guidePage.includes('aria-label="Breadcrumb"')) fail("guide page missing breadcrumbs");

  const titles = new Map();
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    const doubled = prefix ? `${prefix}/${prefix.replace(/^\//, "")}` : "";
    if (doubled && html.includes(doubled)) {
      fail(`built HTML doubled the path prefix in ${path.relative(distDir, file)}`);
    }
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    const description = (html.match(/<meta name="description" content="([^"]*)">/) || [])[1];
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
    if (!title) fail(`missing title in ${path.relative(distDir, file)}`);
    else if (titles.has(title)) {
      fail(`duplicate title "${title}" in ${path.relative(distDir, file)} and ${titles.get(title)}`);
    } else titles.set(title, path.relative(distDir, file));
    if (!description) fail(`missing meta description in ${path.relative(distDir, file)}`);
    if (!canonical || !canonical.startsWith(`${base}/`) && canonical !== base) {
      fail(`canonical missing site prefix in ${path.relative(distDir, file)}: ${canonical || ""}`);
    }
    for (const tag of ["og:title", "og:description", "og:url", "og:image"]) {
      if (!html.includes(`property="${tag}"`)) {
        fail(`missing ${tag} in ${path.relative(distDir, file)}`);
      }
    }
  }

  const keyFile = path.join(distDir, `${indexnow.key}.txt`);
  if (!fs.existsSync(keyFile)) fail(`missing dist/${indexnow.key}.txt`);
  else if (fs.readFileSync(keyFile, "utf8").replace(/^\uFEFF/, "").trim() !== indexnow.key) {
    fail("IndexNow key file contents do not match the key");
  }

  for (const required of [
    "ny/index.html",
    "guides/notarize-after-hours-or-weekend/index.html",
    `${indexnow.key}.txt`,
  ]) {
    if (!fs.existsSync(path.join(distDir, required))) fail(`missing dist/${required}`);
  }
}

if (fs.existsSync(distDir) && built.status === 0) {
  const dry = spawnSync(process.execPath, ["scripts/indexnow.mjs", "--dry-run"], {
    cwd: root,
    encoding: "utf8",
  });
  if (dry.status !== 0) {
    fail(`IndexNow dry run failed:\n${dry.stdout}\n${dry.stderr}`);
  } else {
    const location = `${String(site.url || "").replace(/\/$/, "")}/${indexnow.key}.txt`;
    if (!dry.stdout.includes(`INDEXNOW_KEY_LOCATION=${location}`)) {
      fail(`IndexNow dry run missing key location ${location}`);
    }
    const count = Number((dry.stdout.match(/INDEXNOW_URL_COUNT=(\d+)/) || [])[1]);
    if (!count) fail("IndexNow dry run reported no URLs");
  }
}

if (warnings.length) {
  console.log("Warnings:");
  warnings.forEach((w) => console.log("  -", w));
}
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  errors.forEach((e) => console.error("  -", e));
  process.exit(1);
}

const cityCount = fs.readdirSync(citiesDir).filter((n) => n.endsWith(".json")).length;
console.log(`OK: ${cityCount} city file(s), build succeeded, internal links and JSON-LD parsed.`);
