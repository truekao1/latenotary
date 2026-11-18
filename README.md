# LateNotary

A small, fast, static directory of notaries who publicly advertise **evening**, **weekend**, **mobile**, or **remote online (RON)** service.

Brand name: **LateNotary**. It is short, neutral, and describes the job. The public site root is the `url` value in `src/_data/site.js`. That one value is the deploy switch: canonical tags, Open Graph, JSON-LD, `robots.txt`, `sitemap.xml`, and the Eleventy path prefix all follow it. It is currently `https://truekao1.github.io/latenotary`. To serve the site from a custom domain at the domain root, set `url` to `https://latenotary.com` (no trailing slash) and rebuild. Do not put a personal name on the site.

This is an independent directory, not a notary public, law firm, or government office.

## Where it lives

This repository is the site. `npm run build` writes `dist/`. Pushing `main` runs `.github/workflows/pages.yml`, which publishes `dist/` to GitHub Pages.

## How to build

```bash
npm install
npm run build        # writes dist/
npm start            # local preview
npm run check        # validates city JSON, builds, checks internal links
```

The public base URL, affiliate link, and listing mailbox are all in one file: `src/_data/site.js`. Change `url` there when the host or domain changes. Leave off the trailing slash. A path such as `/latenotary` becomes the Eleventy `pathPrefix`; a bare origin uses `/`.

## Data schema

Add a city by adding one file: `data/cities/<st>-<city>.json` (for example `data/cities/ny-new-york.json`). The nightly research checklist is in `scripts/new-city.md`. A starter file is in `scripts/city.template.json`.

```json
{
  "slug": "ny-new-york",
  "city": "New York",
  "citySlug": "new-york",
  "state": "NY",
  "stateName": "New York",
  "focus": "Manhattan",
  "lastUpdated": "2026-11-18",
  "intro": "Short, factual intro for the city page.",
  "listings": [
    {
      "name": "Business name as published",
      "area": "Neighborhoods or boroughs served",
      "address": "Street address, or null if none is published",
      "phone": "(555) 555-5555",
      "website": "https://example.com/",
      "bookingUrl": "https://example.com/book",
      "hours": {
        "monday": "9:00 AM–9:00 PM",
        "tuesday": "9:00 AM–9:00 PM",
        "wednesday": "9:00 AM–9:00 PM",
        "thursday": "9:00 AM–9:00 PM",
        "friday": "9:00 AM–9:00 PM",
        "saturday": "10:00 AM–4:00 PM",
        "sunday": "Closed",
        "notes": "Any surcharge, appointment, or walk-in rules from the source."
      },
      "flags": {
        "evenings": true,
        "saturday": true,
        "sunday": false,
        "mobile": true,
        "hospitalJail": false,
        "ron": false
      },
      "visitNotes": "Optional. Hospital, jail, or storefront details from the source.",
      "feeNotes": "Only published fees. If none, say that and tell the reader to ask.",
      "sources": [{ "label": "Homepage", "url": "https://example.com/" }],
      "lastChecked": "2026-11-18"
    }
  ]
}
```

Rules:

- Never invent a business, hour, fee, phone, or flag.
- Every fact needs a public source URL and a `lastChecked` date.
- `evenings` is true only when the source lists hours at or after 6:00 PM, or clearly advertises evening or after-hours appointments.
- Other flags are true only when the source says so.
- If a site is down or a detail is unclear, leave the listing or the detail out.

## First city

New York, NY (Manhattan focus) ships in `data/cities/ny-new-york.json` with 15 verified listings, last checked November 18, 2026.

## Publishing blockers

These are not done yet and will block a public launch or first earnings:

- No custom domain has been registered, and `latenotary.com` is only the intended name. The live site is the GitHub Pages URL until that domain is set in `url`.
- GitHub Pages has to use **Source: GitHub Actions** for this repository. The workflow in `.github/workflows/pages.yml` deploys on every push to `main`.
- `site.emailContact` and `site.emailListings` are placeholders until a mailbox exists. Outreach should use the site’s own address, never a personal name.
- The Proof/Notarize button is a placeholder pointing at `https://www.proof.com`. Replace `site.ron.url` with an approved affiliate link from [the Notarize partner program](https://www.notarize.com/partner) after acceptance. The program may require a W-9 and a business identity for the site, not a personal name.
- Affiliate and lead-program payouts need an account that can later send funds to X Money; most programs pay Stripe, PayPal, or bank transfer first.
- No analytics yet. Add some only after updating the privacy page.

## Stack

Eleventy 3 builds plain HTML, CSS, and a small vanilla JS filter into `dist/`. Pages are mobile-first, with canonical URLs, Open Graph tags, `sitemap.xml`, `robots.txt`, and JSON-LD (`WebSite` / `ItemList` on the home page; `CollectionPage` + `ItemList` + `LocalBusiness` and `FAQPage` on city pages).
