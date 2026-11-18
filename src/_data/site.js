/**
 * Site-wide config. `url` is the only deploy switch. Canonical tags,
 * Open Graph, JSON-LD, robots.txt, sitemap.xml, and the Eleventy path
 * prefix all follow it. Do not add a trailing slash.
 *
 * GitHub Pages project site:
 *   https://truekao1.github.io/latenotary
 * Custom domain at the domain root:
 *   https://latenotary.com
 *
 * ron.url is a placeholder until an approved Proof/Notarize affiliate
 * link is issued. Do not present it as a tracked affiliate URL until then.
 */
const url = normalizeSiteUrl("https://truekao1.github.io/latenotary");

function normalizeSiteUrl(value) {
  const parsed = new URL(value);
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  if (!parsed.pathname || parsed.pathname === "/") return parsed.origin;
  return parsed.origin + parsed.pathname;
}

function pathPrefixFromUrl(value) {
  const { pathname } = new URL(value);
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

export default {
  name: "LateNotary",
  tagline: "Find a notary open after work, on weekends, or at your door.",
  description:
    "A directory of notaries who publicly list evening, weekend, mobile, or remote online notarization — so you are not stuck with a bank or shipping store that already closed.",
  url,
  pathPrefix: pathPrefixFromUrl(url),
  locale: "en_US",
  language: "en",
  emailListings: "listings@latenotary.com",
  emailContact: "hello@latenotary.com",
  emailsArePlaceholders: true,
  ron: {
    name: "Proof (formerly Notarize)",
    url: "https://www.proof.com",
    affiliatePlaceholder: true,
    programUrl: "https://www.notarize.com/partner",
    disclosure:
      "This is a clearly marked advertising partner. LateNotary may earn a commission if you use an approved affiliate link, at no extra cost to you. The link below is a placeholder until the affiliate program approves a tracked URL.",
  },
};
