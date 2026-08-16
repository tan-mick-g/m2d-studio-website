const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://icukvxoxvayjcupgcugz.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljdWt2eG94dmF5amN1cGdjdWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTAyNzYsImV4cCI6MjEwMDM4NjI3Nn0.vHIrCnfKELK8USfA05ompK4_S5JQpIkqFKMiL_FkQAw";

const PAGE_MAP = {
  "/": { file: "index.html", key: "home" },
  "/about": { file: "about.html", key: "about" },
  "/services": { file: "services.html", key: "services" },
  "/teachers": { file: "teachers.html", key: "teachers" },
  "/contact": { file: "contact.html", key: "contact" },
  "/faq": { file: "faq.html", key: "faq" },
  "/terms": { file: "terms.html", key: "terms" },
  "/waiver": { file: "waiver.html", key: "waiver" },
  "/privacy": { file: "privacy.html", key: "privacy" }
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const deepMerge = (base, override) => {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (!base || typeof base !== "object") return override ?? base;

  const next = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    next[key] = deepMerge(base[key], value);
  });
  return next;
};

const loadDefaultContent = () => {
  const source = fs.readFileSync(path.join(process.cwd(), "content.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });
  return sandbox.window.MTD_DEFAULT_CONTENT || {};
};

const getSavedContent = async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/site_content?id=eq.homepage&select=content`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
  } catch (error) {
    return null;
  }

  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0]?.content || null;
};

const absoluteUrl = (request, value) => {
  if (!value) return "";
  try {
    return new URL(value).toString();
  } catch (error) {
    const host = request.headers["x-forwarded-host"] || request.headers.host || "madetodance.ph";
    const protocol = request.headers["x-forwarded-proto"] || "https";
    return new URL(value.replace(/^\/?/, "/"), `${protocol}://${host}`).toString();
  }
};

const setMeta = (html, attribute, name, value) => {
  if (!value) return html;
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`<meta\\s+${attribute}="${name}"\\s+content="[^"]*"\\s*\\/?>`, "i");
  const tag = `<meta ${attribute}="${name}" content="${escaped}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
};

const applySeo = (html, request, pageKey, pagePath, content) => {
  const pageSeo = content.seo?.pages?.[pageKey] || {};
  const title = pageSeo.title || content.seo?.siteName || "Made To Dance Studio";
  const description = pageSeo.description || "";
  const image = absoluteUrl(request, content.seo?.defaultImage || "assets/m2d-icon.png");
  const url = absoluteUrl(request, pagePath || "/");
  const siteName = content.seo?.siteName || "Made To Dance Studio";

  let nextHtml = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  nextHtml = setMeta(nextHtml, "name", "description", description);
  nextHtml = setMeta(nextHtml, "property", "og:title", title);
  nextHtml = setMeta(nextHtml, "property", "og:description", description);
  nextHtml = setMeta(nextHtml, "property", "og:image", image);
  nextHtml = setMeta(nextHtml, "property", "og:image:secure_url", image);
  nextHtml = setMeta(nextHtml, "property", "og:image:width", "1200");
  nextHtml = setMeta(nextHtml, "property", "og:image:height", "630");
  nextHtml = setMeta(nextHtml, "property", "og:type", "website");
  nextHtml = setMeta(nextHtml, "property", "og:site_name", siteName);
  nextHtml = setMeta(nextHtml, "property", "og:url", url);
  nextHtml = setMeta(nextHtml, "name", "twitter:card", "summary_large_image");
  nextHtml = setMeta(nextHtml, "name", "twitter:title", title);
  nextHtml = setMeta(nextHtml, "name", "twitter:description", description);
  nextHtml = setMeta(nextHtml, "name", "twitter:image", image);
  return nextHtml;
};

module.exports = async (request, response) => {
  const parsedUrl = new URL(request.url, "https://madetodance.ph");
  const requestedPath = parsedUrl.searchParams.get("path") || parsedUrl.pathname;
  const requestPath = requestedPath.replace(/\/$/, "") || "/";
  const page = PAGE_MAP[requestPath];

  if (!page) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }

  const html = fs.readFileSync(path.join(process.cwd(), page.file), "utf8");
  const defaultContent = loadDefaultContent();
  const savedContent = await getSavedContent();
  const content = deepMerge(defaultContent, savedContent);
  const renderedHtml = applySeo(html, request, page.key, requestPath, content);

  response.statusCode = 200;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  response.end(renderedHtml);
};
