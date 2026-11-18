import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HtmlBasePlugin } from "@11ty/eleventy";
import site from "./src/_data/site.js";
import indexnow from "./src/_data/indexnow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function originAndPrefix(base) {
  const root = String(base || "").replace(/\/$/, "");
  try {
    const { origin, pathname } = new URL(root);
    const prefix = !pathname || pathname === "/" ? "" : pathname.replace(/\/$/, "");
    return { origin, prefix, root };
  } catch {
    return { origin: root, prefix: "", root };
  }
}

function toAbsoluteUrl(pathname, base) {
  const { origin, prefix, root } = originAndPrefix(base);
  if (!pathname) return `${root}/`;
  if (/^https?:\/\//.test(pathname)) return pathname;
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) {
    return `${origin}${path}`;
  }
  return `${root}${path}`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pageLastmod(page) {
  const data = page?.data || {};
  if (data.city?.lastUpdated) return String(data.city.lastUpdated).trim().slice(0, 10);
  if (Array.isArray(data.stateEntry?.cities)) {
    const dates = data.stateEntry.cities
      .map((city) => city.lastUpdated)
      .filter(Boolean)
      .map((value) => String(value).trim())
      .sort();
    if (dates.length) return dates[dates.length - 1].slice(0, 10);
  }
  if (data.updated instanceof Date && !Number.isNaN(data.updated.getTime())) {
    return data.updated.toISOString().slice(0, 10);
  }
  if (data.updated) return String(data.updated).trim().slice(0, 10);
  if (page?.date instanceof Date && !Number.isNaN(page.date.getTime())) {
    return page.date.toISOString().slice(0, 10);
  }
  return "";
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addWatchTarget("data/cities/");
  eleventyConfig.addWatchTarget("src/assets/");

  eleventyConfig.addFilter("isoDate", (value) => {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return "";
  });

  eleventyConfig.addFilter("displayDate", (value) => {
    if (!value) return "";
    const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  eleventyConfig.addFilter("hoursSummary", (hours) => {
    if (!hours) return "Call to confirm";
    if (hours.summary) return hours.summary;
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const values = days.map((day) => (hours[day] || "").trim());
    const groups = [];
    let i = 0;
    while (i < 7) {
      let j = i;
      while (j + 1 < 7 && values[j + 1] === values[i] && values[i]) j += 1;
      if (values[i]) {
        const label = i === j ? labels[i] : `${labels[i]}–${labels[j]}`;
        groups.push(`${label} ${values[i]}`);
      }
      i = j + 1;
    }
    return groups.join("; ") || "Call to confirm";
  });

  eleventyConfig.addFilter("telHref", (phone) => {
    if (!phone) return "";
    const digits = String(phone).replace(/[^\d+]/g, "");
    return digits ? `tel:${digits}` : "";
  });

  eleventyConfig.addFilter("slugifyId", (name) =>
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );

  eleventyConfig.addFilter("jsonLd", (obj) =>
    JSON.stringify(obj).replace(/</g, "\\u003c")
  );

  eleventyConfig.addFilter("absoluteUrl", (pathname, base) => toAbsoluteUrl(pathname, base));

  eleventyConfig.addFilter("statePath", (state) => `/${String(state || "").toLowerCase()}/`);

  eleventyConfig.addFilter("latestCityUpdate", (cities) => {
    const dates = (cities || [])
      .map((city) => city && city.lastUpdated)
      .filter((value) => /^\d{4}-\d{2}-\d{2}/.test(String(value || "")))
      .map((value) => String(value).slice(0, 10))
      .sort();
    return dates.length ? dates[dates.length - 1] : "";
  });

  eleventyConfig.addFilter("nearbyCities", (city, all) => {
    const list = Array.isArray(all) ? all : [];
    const same = [];
    const rest = [];
    for (const other of list) {
      if (!other) continue;
      if (other.state === city.state && other.citySlug === city.citySlug) continue;
      if (other.state === city.state) same.push(other);
      else rest.push(other);
    }
    return [...same, ...rest].slice(0, 8);
  });

  eleventyConfig.addFilter("sitemapXml", (pages) => {
    const entries = (pages || [])
      .filter((page) => page && page.url)
      .map((page) => ({
        loc: toAbsoluteUrl(page.url, site.url),
        lastmod: pageLastmod(page),
      }))
      .sort((a, b) => a.loc.localeCompare(b.loc));
    return entries
      .map(
        (entry) =>
          `  <url><loc>${xmlEscape(entry.loc)}</loc><lastmod>${xmlEscape(entry.lastmod)}</lastmod></url>`
      )
      .join("\n");
  });

  eleventyConfig.addFilter("breadcrumbJsonLd", (crumbs, pageUrl, siteUrl) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: (crumbs || []).map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: toAbsoluteUrl(crumb.href || pageUrl, siteUrl),
    })),
  }));

  eleventyConfig.addFilter("cityPath", (city) => {
    const state = String(city.state || "").toLowerCase();
    const slug = city.citySlug || String(city.city || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `/${state}/${slug}/`;
  });


  const dayMap = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };

  function parseClockRange(value) {
    if (!value) return null;
    const text = String(value);
    const re =
      /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)|midnight|noon)\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)|midnight)/i;
    const m = text.match(re);
    if (!m) return null;
    const to24 = (s) => {
      const t = s.trim().toLowerCase();
      if (t === "midnight") return "00:00";
      if (t === "noon") return "12:00";
      const mm = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
      if (!mm) return null;
      let h = Number(mm[1]);
      const min = mm[2];
      const ap = mm[3];
      if (ap === "pm" && h !== 12) h += 12;
      if (ap === "am" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${min}`;
    };
    let opens = to24(m[1]);
    let closes = to24(m[2]);
    if (!opens || !closes) return null;
    if (closes === "00:00" && /midnight/i.test(m[2])) closes = "23:59";
    return { opens, closes };
  }

  function listingToLocalBusiness(listing, city, site) {
    const url = listing.website || listing.bookingUrl;
    const business = {
      "@type": ["LocalBusiness", "Notary"],
      name: listing.name,
      url,
      telephone: listing.phone || undefined,
      areaServed: listing.area,
      description: listing.feeNotes || undefined,
    };
    if (listing.address) business.address = listing.address;
    const hours = [];
    if (listing.hours) {
      for (const [day, value] of Object.entries(dayMap)) {
        const raw = listing.hours[day];
        if (!raw) continue;
        if (/24\s*hours|24\/7/i.test(raw) && !/not\s+published|closed/i.test(raw)) {
          hours.push({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: value,
            opens: "00:00",
            closes: "23:59",
          });
          continue;
        }
        const range = parseClockRange(raw);
        if (range) {
          hours.push({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: value,
            opens: range.opens,
            closes: range.closes,
          });
        }
      }
    }
    if (hours.length) business.openingHoursSpecification = hours;
    return business;
  }


  eleventyConfig.addFilter("defaultCityFaqs", (city) => {
    const place = city.city;
    return [
      {
        q: `How do I find a notary open late in ${place}?`,
        a: `Banks and shipping stores often stop notarizing in the afternoon. This page lists notaries that publicly advertise evening, weekend, or mobile service in ${place}. Use the Evening filter for hours at or after 6:00 PM or for after-hours appointments, and the Sunday filter for a Sunday notary in ${place}. Call or text before you go. Many visits are by appointment rather than walk-in.`,
      },
      {
        q: `What does a Sunday notary or a mobile notary near me in ${place} usually cost?`,
        a: `The state fee for the notarization itself is often separate from the travel or appointment fee the notary charges. A mobile notary near me in ${place} sets that travel fee, and Sunday, late-evening, hospital, and rush visits often cost more than a weekday visit. Published prices are copied into each listing’s fee notes when the business posts them. Ask for the total before anyone travels.`,
      },
      {
        q: `Can I notarize a document online instead of meeting a notary in ${place}?`,
        a: `Remote online notarization is a recorded video session with identity checks. It can be a fallback when you cannot reach a notary open late in ${place} or a Sunday notary who can travel to you. The bank, court, employer, or other recipient may still require an in-person seal, so ask them first. If they accept an online session, use the ${site.ron.name} advertisement on this page.`,
      },
    ];
  });

  eleventyConfig.addFilter("cityJsonLd", (city, siteConfig) => {
    const pageUrl = `${siteConfig.url}/${String(city.state).toLowerCase()}/${city.citySlug}/`;
    const listId = `${pageUrl}#notaries`;
    const items = (city.listings || []).map((listing, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: listingToLocalBusiness(listing, city, siteConfig),
    }));
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ItemList",
          "@id": listId,
          name: `Notary open late in ${city.city}, ${city.state}`,
          url: pageUrl,
          numberOfItems: items.length,
          itemListElement: items,
        },
        {
          "@type": "CollectionPage",
          name: `Notary open late in ${city.city}, ${city.state}`,
          url: pageUrl,
          isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
          mainEntity: { "@id": listId },
        },
      ],
    };
  });

  eleventyConfig.addFilter("stateJsonLd", (stateEntry, siteConfig) => {
    const pageUrl = `${siteConfig.url}/${stateEntry.stateSlug}/`;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Notary open late in ${stateEntry.stateName}`,
      url: pageUrl,
      numberOfItems: (stateEntry.cities || []).length,
      itemListElement: (stateEntry.cities || []).map((city, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `Notary open late in ${city.city}, ${city.state}`,
        url: `${siteConfig.url}/${stateEntry.stateSlug}/${city.citySlug}/`,
      })),
    };
  });

  eleventyConfig.addFilter("faqJsonLd", (faqs, pageUrl) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: pageUrl,
    mainEntity: (faqs || []).map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  }));

  eleventyConfig.addFilter("homeJsonLd", (siteConfig, cities) => ({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        name: siteConfig.name,
        url: `${siteConfig.url}/`,
        description: siteConfig.description,
        inLanguage: siteConfig.language,
        publisher: { "@id": `${siteConfig.url}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        url: `${siteConfig.url}/`,
        description: siteConfig.description,
        logo: `${siteConfig.url}/assets/favicon.svg`,
      },
      {
        "@type": "ItemList",
        name: "Cities with after-hours and mobile notary listings",
        numberOfItems: (cities || []).length,
        itemListElement: (cities || []).map((city, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${city.city}, ${city.state}`,
          url: `${siteConfig.url}/${String(city.state).toLowerCase()}/${city.citySlug}/`,
        })),
      },
    ],
  }));

    eleventyConfig.addCollection("cities", () => {
    const dir = path.join(__dirname, "data", "cities");
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => {
        const raw = fs.readFileSync(path.join(dir, name), "utf8");
        const data = JSON.parse(raw);
        data._file = name;
        if (!data.citySlug) {
          data.citySlug = String(data.city || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
        }
        return data;
      })
      .sort((a, b) =>
        `${a.city}, ${a.state}`.localeCompare(`${b.city}, ${b.state}`)
      );
  });

  if (!/^[a-zA-Z0-9-]{8,128}$/.test(indexnow.key || "")) {
    throw new Error("IndexNow key must be 8-128 letters, numbers, or dashes");
  }

  eleventyConfig.on("eleventy.after", ({ dir }) => {
    const output = path.resolve(dir?.output || path.join(__dirname, "dist"));
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, `${indexnow.key}.txt`), `${indexnow.key}\n`);
  });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    pathPrefix: site.pathPrefix,
  };
}
