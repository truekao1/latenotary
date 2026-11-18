import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HtmlBasePlugin } from "@11ty/eleventy";
import site from "./src/_data/site.js";

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

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addWatchTarget("data/cities/");
  eleventyConfig.addWatchTarget("src/assets/");

  eleventyConfig.addFilter("isoDate", (value) => {
    if (!value) return "";
    return String(value).slice(0, 10);
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

  eleventyConfig.addFilter("absoluteUrl", (pathname, base) => {
    const { origin, prefix, root } = originAndPrefix(base);
    if (!pathname) return `${root}/`;
    if (/^https?:\/\//.test(pathname)) return pathname;
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
    if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) {
      return `${origin}${path}`;
    }
    return `${root}${path}`;
  });

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
      "@type": "LocalBusiness",
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


  eleventyConfig.addFilter("defaultCityFaqs", (city) => [
    {
      q: `Can I get something notarized after work in ${city.city}?`,
      a: "Often yes, but usually not at a bank or shipping store. Use the Evening filter on this page for notaries that publicly list hours at or after 6:00 PM, or that advertise evening or after-hours appointments. Call or text before you go; many visits are by appointment.",
    },
    {
      q: `Are there notaries open on Saturday or Sunday in ${city.city}?`,
      a: "Yes — several mobile notaries on this page publicly list Saturday or Sunday availability. Use the Saturday and Sunday filters. Weekend visits often cost more than weekday ones. Confirm the total and the arrival window when you book.",
    },
    {
      q: "What is a mobile notary?",
      a: "A mobile notary travels to you: home, office, lobby, café, hotel, or, when they offer it, a hospital or jail. You still need valid photo ID, and you generally should not sign until the notary is present. You pay the state’s notary fee plus a travel or appointment fee set by the notary.",
    },
    {
      q: "What is remote online notarization (RON), and is it legal in New York?",
      a: "RON is a notarization done over a recorded, identity-verified video session instead of in person. Several states, including New York, allow it, but the receiving party — a bank, court, employer, or foreign authority — may still require an in-person, wet-ink seal. Ask them before you book an online session.",
    },
    {
      q: "What should I have ready?",
      a: "A current government-issued photo ID for every signer, the complete document with blanks filled in but usually unsigned, and every signer present and willing. If the document needs witnesses, ask the notary whether they can bring impartial witnesses and what that costs.",
    },
    {
      q: "How much does a mobile notary cost?",
      a: "States often cap the fee for the notarial act itself, but mobile notaries also charge for travel and time. Published visit prices are copied into each listing’s fee notes when a business posts them. Late-evening, weekend, hospital, and rush visits often cost more. Ask for a total before anyone travels.",
    },
    {
      q: "How does LateNotary verify these listings?",
      a: "We only publish facts we found on a public page — usually the business’s own website. Each listing has source links and a last-checked date. We do not invent hours, fees, or services. If a site was down or a detail was unclear, we left it out.",
    },
  ]);

    eleventyConfig.addFilter("cityJsonLd", (city, site) => {
    const pageUrl = `${site.url}/${String(city.state).toLowerCase()}/${city.citySlug}/`;
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `Notaries open late, on weekends, and mobile in ${city.city}, ${city.state}`,
      url: pageUrl,
      isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
      about: {
        "@type": "ItemList",
        name: `After-hours, weekend, and mobile notaries in ${city.city}, ${city.state}`,
        numberOfItems: (city.listings || []).length,
        itemListElement: (city.listings || []).map((listing, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: listingToLocalBusiness(listing, city, site),
        })),
      },
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

  eleventyConfig.addFilter("homeJsonLd", (site, cities) => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    description: site.description,
    publisher: { "@type": "Organization", name: site.name, url: site.url },
    hasPart: {
      "@type": "ItemList",
      name: "Cities with after-hours and mobile notary listings",
      numberOfItems: (cities || []).length,
      itemListElement: (cities || []).map((city, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${city.city}, ${city.state}`,
        url: `${site.url}/${String(city.state).toLowerCase()}/${city.citySlug}/`,
      })),
    },
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
