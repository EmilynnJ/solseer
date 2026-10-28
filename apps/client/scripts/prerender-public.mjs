// Build public route HTML from shared components. Only fetch the public reader directory.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { renderPublicPage } from "../.prerender/entry-public.js";

const dist = new URL("../dist/", import.meta.url);
const rootPath = new URL("index.html", dist);
const html = readFileSync(rootPath, "utf8");
const origin = "https://www.soul-seer.net";
const image = "/images/soulseer-hero-logo.jpg";
if (!existsSync(new URL("images/soulseer-hero-logo.jpg", dist))) {
  throw new Error("Public social-preview image missing from the Vite build.");
}

const pages = JSON.parse(readFileSync(
  new URL("../src/content/public-pages.json", import.meta.url), "utf8"
));

// Public marketing data only: never fetch authenticated endpoints or session data.
// A temporary API outage must not prevent the static site from deploying.
let publicReaders;
const apiOrigin = (process.env.VITE_API_ORIGIN || "https://api.soul-seer.net").replace(/\/$/, "");
// The same deployed Worker has an enabled workers.dev URL (verified in Cloudflare).
// Use it for this public GET if zone bot protection rejects the build server.
// Browser API calls and image URLs continue to use the configured custom domain.
for (const directoryOrigin of new Set([apiOrigin, "https://soulseer-api.emilynn.workers.dev"])) {
  try {
    const response = await fetch(`${directoryOrigin}/api/readers`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.readers)) throw new Error("Invalid public reader directory");
    publicReaders = payload.readers;
    console.log(`Rendered public directory data: ${publicReaders.length} readers`);
    break;
  } catch (error) {
    console.warn(`Public reader directory unavailable at ${directoryOrigin}: ${error.message}`);
  }
}

const escapeHtml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// Policy content is already local in the frontend repo. Sanitize the same HTML
// that the React PolicyPage displays, rather than reducing legal pages to teasers.
const policySlugs = new Set([
  "privacy", "terms", "acceptable-use", "accessibility", "eula", "disclaimer",
]);
const purifier = createDOMPurify(new JSDOM("").window);
function publicPolicyMarkup(slug) {
  if (!policySlugs.has(slug)) return "";
  const raw = readFileSync(
    new URL(`../src/content/policies/${slug}.html`, import.meta.url), "utf8"
  );
  return `<article class="policy-document">${purifier.sanitize(raw)}</article>`;
}

function replaceOnce(document, regex, replacement, label) {
  if (!regex.test(document)) throw new Error(`Expected HTML marker not found: ${label}`);
  return document.replace(regex, replacement);
}

function setMeta(document, attribute, key, value) {
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}="${key}")[^>]*>`, "i");
  return replaceOnce(document, matcher,
    `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`, key);
}

function render(page) {
  const url = `${origin}/${page.slug ? page.slug + "/" : ""}`;
  let output = html;
  output = replaceOnce(output, /<link\b(?=[^>]*\brel="canonical")[^>]*>/i,
    `<link rel="canonical" href="${url}" />`, "canonical");
  output = setMeta(output, "name", "description", page.description);
  output = setMeta(output, "property", "og:url", url);
  output = setMeta(output, "property", "og:title", page.title);
  output = setMeta(output, "property", "og:description", page.description);
  output = setMeta(output, "name", "twitter:title", page.title);
  output = setMeta(output, "name", "twitter:description", page.description);
  output = replaceOnce(output, /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(page.title)}</title>`, "title");

  // React replaces this static content when it mounts; bots without JS can read it.
  const sharedMarkup = renderPublicPage(page.slug, publicReaders);
  const body = sharedMarkup ?? `<main>
    <h1>${escapeHtml(page.heading)}</h1>
    <p>${escapeHtml(page.description)}</p>
    <p>${escapeHtml(page.detail)}</p>
    ${publicPolicyMarkup(page.slug)}
    <nav aria-label="SoulSeer public pages"><a href="/">SoulSeer home</a>
      <a href="/readers/">Browse psychic readers</a>
      <a href="/about/">About SoulSeer</a></nav>
    <img src="${image}" width="640" alt="SoulSeer psychic reading platform logo" />
  </main>`;
  const document = new JSDOM(output).window.document;
  document.getElementById("root").innerHTML = body;
  // Interactions are activated when React mounts; avoid native GET form submission.
  for (const control of document.querySelectorAll("form input, form button")) control.disabled = true;
  output = "<!doctype html>\n" + document.documentElement.outerHTML;
  return output;
}

for (const page of pages) {
  const directory = new URL(page.slug ? `${page.slug}/` : "./", dist);
  mkdirSync(directory, { recursive: true });
  const rendered = render(page);
  const canonicalUrl = `${origin}/${page.slug ? page.slug + "/" : ""}`;
  const document = new JSDOM(rendered).window.document;
  if (policySlugs.has(page.slug) && !rendered.includes('class="policy-document"')) {
    throw new Error(`Full policy content missing for /${page.slug}/`);
  }
  if (document.querySelector('link[rel="canonical"]')?.href !== canonicalUrl ||
      document.querySelector('meta[property="og:url"]')?.content !== canonicalUrl ||
      !document.querySelector("h1")) {
    throw new Error(`Crawler HTML validation failed for /${page.slug}/`);
  }
  writeFileSync(new URL("index.html", directory), rendered);
}

// The catch-all SPA route should use a neutral shell, without claiming the homepage canonical.
// In Render, change the existing /* rewrite destination to /_app.html *after* deploy.
let fallback = html;
fallback = fallback.replace(/<link\b(?=[^>]*\brel="canonical")[^>]*>\s*/i, "");
fallback = fallback.replace(/<meta\b(?=[^>]*\bproperty="og:url")[^>]*>\s*/i, "");
const fallbackDocument = new JSDOM(fallback).window.document;
fallbackDocument.getElementById("root").innerHTML = "";
fallback = "<!doctype html>\n" + fallbackDocument.documentElement.outerHTML;
if (fallback.includes('rel="canonical"') || fallback.includes('property="og:url"')) {
  throw new Error("Neutral SPA fallback still contains homepage indexing metadata.");
}
writeFileSync(new URL("_app.html", dist), fallback);

console.log(`Generated ${pages.length} route-specific public pages and a neutral SPA fallback.`);
