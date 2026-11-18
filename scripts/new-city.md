# Nightly city research checklist

The goal of a nightly run is to ship **one useful city page**, not a long list of unverified names. Adding a city means adding one file under `data/cities/` and rebuilding.

## 1. Pick the city

Choose a place people actually search after work or on weekends. Prefer complaints and demand (after-hours, weekend, mobile, hospital) over cities that already have a strong, current directory.

Filename: `data/cities/<st>-<city>.json`  
Examples: `ny-new-york.json`, `il-chicago.json`, `ca-los-angeles.json`  
Use the two-letter state, lowercase, then a hyphen, then the city slug.

Copy `scripts/city.template.json` and fill it in.

## 2. Find candidates

Search for public pages, not hearsay:

- `mobile notary <city> <ST> evening OR weekend OR Saturday OR Sunday`
- `notary open Saturday <city>` / `after hours notary <city>`
- The business’s own website, booking page, or Google/Yelp listing
- State notary commission search, when it helps confirm that a person or firm is commissioned

Skip banks and shipping stores unless you can verify that *this branch* still notarizes at the published late or weekend hours.

## 3. Verify every fact on a public page

For each listing, record only what the source says:

- Name, area served, address (or `null`), phone, website, booking URL
- Hours by day. If the source only says “7 days, including evenings,” write that — do not invent 9:00–9:00.
- Flags: evenings, Saturday, Sunday, mobile, hospital/jail, RON
- Fee notes, only if published
- `sources[]` with a label and the exact URL
- `lastChecked` as today’s date (`YYYY-MM-DD`)

**Evenings** means published hours at or after 6:00 PM, or a clear evening / after-hours appointment offer. A shop that closes at 6:00 PM is not an evening listing.

If two sources disagree, prefer the official site and say so in `hours.notes`. If you cannot verify a detail, omit it. If you cannot verify the business at all, do not list it.

Do not call businesses just to fill a spreadsheet unless a later playbook says otherwise. This checklist is written so a pass can be done from public pages.

## 4. Aim for quality, not a quota

Ten to twenty solid listings is enough for a first city page. Fewer is fine if that is all that can be verified. Zero invented rows is the hard rule.

Write a short, honest `intro` for the city. Mention any focus (a borough, a downtown, a suburb) instead of implying citywide coverage you did not research.

## 5. Build and check

```bash
npm run check
```

That command validates the JSON, builds the site, and fails if a required field is missing or an internal link is broken. If it passes, commit the new city file (and the built site stays out of git).

## 6. After publish

Update `lastUpdated` on the city file when listings change. On later nights, recrawl the oldest `lastChecked` dates before adding a second city, so pages do not rot.
