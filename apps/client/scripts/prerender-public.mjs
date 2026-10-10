// Build public, route-specific HTML without fetching the API or touching user data.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const dist = new URL("../dist/", import.meta.url);
const rootPath = new URL("index.html", dist);
const html = readFileSync(rootPath, "utf8");
const origin = "https://www.soul-seer.net";
const image = "/images/soulseer-hero-logo.jpg";
if (!existsSync(new URL("images/soulseer-hero-logo.jpg", dist))) {
  throw new Error("Public social-preview image missing from the Vite build.");
}

const pages = [
  {
    slug: "readers",
    title: "Find a Psychic Reader | SoulSeer",
    heading: "Find the Reader who feels right.",
    description: "Meet SoulSeer's personally approved psychic readers. Explore chat, voice, and video readings with compassionate, judgment-free guidance.",
    detail: "Explore the SoulSeer reader community and choose the reading format that works for you.",
  },
  {
    slug: "about",
    title: "About SoulSeer | Ethical Psychic Readings",
    heading: "Built for guidance with a conscience.",
    description: "Learn why psychic medium Emilynn founded SoulSeer and how our community supports ethical, compassionate readings and fair treatment of readers.",
    detail: "SoulSeer was created to offer heart-centered guidance, fair standards for readers, and a welcoming spiritual community.",
  },
  {
    slug: "community",
    title: "SoulSeer Community | Share, Listen, Grow",
    heading: "A place to share, listen, and grow.",
    description: "Explore SoulSeer's spiritual community for respectful conversations, support, learning, and connection with readers and seekers.",
    detail: "Join conversations rooted in curiosity, kindness, and mutual respect.",
  },
  {
    slug: "help",
    title: "Help & Frequently Asked Questions | SoulSeer",
    heading: "Help & frequently asked questions",
    description: "Find SoulSeer answers about live readings, prepaid billing, connection interruptions, refunds, privacy, and accessibility support.",
    detail: "Find clear answers before, during, and after your SoulSeer reading.",
  },
  {
    slug: "privacy",
    title: "Privacy Policy | SoulSeer",
    heading: "Privacy Policy",
    description: "Read SoulSeer's privacy notice to understand how personal information is collected, used, shared, and protected.",
    detail: "This notice explains how SoulSeer handles personal information when you use our services.",
  },
  {
    slug: "terms",
    title: "Terms of Use | SoulSeer",
    heading: "Terms of Use",
    description: "Read the terms and conditions that govern access to and use of SoulSeer's website, app, and related services.",
    detail: "Understand the legal terms governing SoulSeer's services.",
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy | SoulSeer",
    heading: "Acceptable Use Policy",
    description: "Review SoulSeer's acceptable use policy and the rules for responsible participation in our services and community.",
    detail: "Learn about the standards for using SoulSeer safely and respectfully.",
  },
  {
    slug: "accessibility",
    title: "Accessibility Statement | SoulSeer",
    heading: "Accessibility Statement",
    description: "Read SoulSeer's accessibility statement, our WCAG 2.2 AA improvement goal, known limitations, and how to request assistance.",
    detail: "Accessibility is an ongoing effort at SoulSeer. Learn about our goals and available help.",
  },
  {
    slug: "eula",
    title: "End User License Agreement | SoulSeer",
    heading: "End User License Agreement",
    description: "Review the End User License Agreement for SoulSeer's website, application, and related services.",
    detail: "Read the license terms for using the SoulSeer app and services.",
  },
  {
    slug: "disclaimer",
    title: "Disclaimer | SoulSeer",
    heading: "Disclaimer",
    description: "Read SoulSeer's disclaimer about spiritual readings and the limitations of guidance offered through the platform.",
    detail: "SoulSeer readings are for entertainment and reflection, not a substitute for professional advice.",
  },
];

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
  const url = `${origin}/${page.slug}/`;
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
  const body = `<div id="root"><main>
    <h1>${escapeHtml(page.heading)}</h1>
    <p>${escapeHtml(page.description)}</p>
    <p>${escapeHtml(page.detail)}</p>
    ${publicPolicyMarkup(page.slug)}
    <nav aria-label="SoulSeer public pages"><a href="/">SoulSeer home</a>
      <a href="/readers/">Browse psychic readers</a>
      <a href="/about/">About SoulSeer</a></nav>
    <img src="${image}" width="640" alt="SoulSeer psychic reading platform logo" />
  </main></div>`;
  output = replaceOnce(output, /<div id="root">[\s\S]*?<\/div>/i, body, "root");
  return output;
}

for (const page of pages) {
  const directory = new URL(`${page.slug}/`, dist);
  mkdirSync(directory, { recursive: true });
  const rendered = render(page);
  const canonical = `<link rel="canonical" href="${origin}/${page.slug}/" />`;
  const social = `<meta property="og:url" content="${origin}/${page.slug}/" />`;
  const heading = `<h1>${escapeHtml(page.heading)}</h1>`;
  if (policySlugs.has(page.slug) && !rendered.includes('class="policy-document"')) {
    throw new Error(`Full policy content missing for /${page.slug}/`);
  }
  if (![canonical, social, heading].every((marker) => rendered.includes(marker))) {
    throw new Error(`Crawler HTML validation failed for /${page.slug}/`);
  }
  writeFileSync(new URL("index.html", directory), rendered);
}

// The catch-all SPA route should use a neutral shell, without claiming the homepage canonical.
// In Render, change the existing /* rewrite destination to /_app.html *after* deploy.
let fallback = html;
fallback = fallback.replace(/<link\b(?=[^>]*\brel="canonical")[^>]*>\s*/i, "");
fallback = fallback.replace(/<meta\b(?=[^>]*\bproperty="og:url")[^>]*>\s*/i, "");
fallback = replaceOnce(fallback, /<div id="root">[\s\S]*?<\/div>/i,
  '<div id="root"></div>', "root");
if (fallback.includes('rel="canonical"') || fallback.includes('property="og:url"')) {
  throw new Error("Neutral SPA fallback still contains homepage indexing metadata.");
}
writeFileSync(new URL("_app.html", dist), fallback);

console.log(`Generated ${pages.length} route-specific public pages and a neutral SPA fallback.`);
