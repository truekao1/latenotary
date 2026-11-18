import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import site from "../src/_data/site.js";
import indexnow from "../src/_data/indexnow.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const dryRun = process.argv.includes("--dry-run");
const endpoint = "https://api.indexnow.org/indexnow";

function xmlDecode(value) {
  return String(value)
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function readSitemapUrls() {
  const file = path.join(distDir, "sitemap.xml");
  if (!fs.existsSync(file)) {
    throw new Error(`missing ${file}`);
  }
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => xmlDecode(match[1].trim()));
}

function assertKey(key) {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key || "")) {
    throw new Error("IndexNow key must be 8-128 letters, numbers, or dashes");
  }
}

function loadPayload() {
  assertKey(indexnow.key);
  const keyFile = path.join(distDir, `${indexnow.key}.txt`);
  if (!fs.existsSync(keyFile)) {
    throw new Error(`missing ${keyFile}`);
  }
  const published = fs.readFileSync(keyFile, "utf8").replace(/^\uFEFF/, "").trim();
  if (published !== indexnow.key) {
    throw new Error("IndexNow key file contents do not match the configured key");
  }

  const host = new URL(site.url).host;
  const keyLocation = `${site.url}/${indexnow.key}.txt`;
  const urlList = readSitemapUrls();
  if (!urlList.length) throw new Error("sitemap has no URLs");
  for (const url of urlList) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`sitemap URL is not absolute: ${url}`);
    }
    if (parsed.host !== host) {
      throw new Error(`sitemap URL host ${parsed.host} does not match ${host}`);
    }
    if (!url.startsWith(`${site.url}/`)) {
      throw new Error(`sitemap URL is outside the site prefix: ${url}`);
    }
  }

  return {
    host,
    key: indexnow.key,
    keyLocation,
    urlList,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function keyIsLive(keyLocation, key) {
  try {
    const response = await fetch(keyLocation, {
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: { "user-agent": "LateNotary-IndexNow/1.0" },
    });
    const body = (await response.text()).replace(/^\uFEFF/, "").trim();
    const live = response.ok && body === key;
    console.log(
      `IndexNow key file ${keyLocation} -> HTTP ${response.status} (${live ? "match" : "not ready"})`
    );
    return live;
  } catch (error) {
    console.log(`IndexNow key file check failed: ${error.message}`);
    return false;
  }
}

async function ping(payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
    headers: {
      "content-type": "application/json; charset=utf-8",
      "user-agent": "LateNotary-IndexNow/1.0",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  return { status: response.status, body: body.slice(0, 500) };
}

async function main() {
  const payload = loadPayload();
  console.log(`INDEXNOW_HOST=${payload.host}`);
  console.log(`INDEXNOW_KEY_LOCATION=${payload.keyLocation}`);
  console.log(`INDEXNOW_URL_COUNT=${payload.urlList.length}`);
  for (const url of payload.urlList) console.log(`INDEXNOW_URL=${url}`);

  if (dryRun) {
    console.log("INDEXNOW_DRY_RUN=1");
    return;
  }

  console.log(`IndexNow submitting ${payload.urlList.length} URL(s) to ${endpoint}`);
  const keyWaits = [0, 10000, 15000, 20000, 30000, 30000, 45000, 60000];
  let live = false;
  for (let attempt = 0; attempt < keyWaits.length; attempt += 1) {
    if (keyWaits[attempt]) await sleep(keyWaits[attempt]);
    live = await keyIsLive(payload.keyLocation, payload.key);
    if (live) break;
  }
  if (!live) {
    console.log("IndexNow key file was not visible yet; pinging anyway.");
  }

  let status = 0;
  let body = "";
  const retryable = new Set([0, 403, 422, 429, 500, 502, 503, 504]);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const result = await ping(payload);
      status = result.status;
      body = result.body;
      console.log(`IndexNow ping attempt ${attempt}: HTTP ${status}`);
      if (body) console.log(body);
    } catch (error) {
      status = 0;
      body = error.message;
      console.log(`IndexNow ping attempt ${attempt} failed: ${error.message}`);
    }
    if (status === 200 || status === 202 || status === 400) break;
    if (!retryable.has(status)) break;
    if (attempt < 4) {
      await sleep(20000);
      live = await keyIsLive(payload.keyLocation, payload.key);
    }
  }

  console.log(`INDEXNOW_HTTP_STATUS=${status || "none"}`);
  console.log(`INDEXNOW_RESULT=${status === 200 || status === 202 ? "accepted" : "not-accepted"}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
