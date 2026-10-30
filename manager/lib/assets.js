"use strict";

const fs = require("fs/promises");
const path = require("path");

const EXPECTED = [
  { relative: "index.html", label: "Games shell", category: "Shell", required: true },
  { relative: "css/theme.css", label: "Design tokens", category: "Shell", required: true },
  { relative: "css/app.css", label: "Shell layout", category: "Shell", required: true },
  { relative: "js/app.js", label: "Shell logic", category: "Shell", required: true },
  { relative: "js/ai.js", label: "Persona engines", category: "Engines", required: true },
  { relative: "js/settings.js", label: "Settings store", category: "Engines", required: true },
  { relative: "data/library.json", label: "Game catalog", category: "Data", required: true, json: "catalog" },
  { relative: "data/config.json", label: "Runtime config", category: "Data", required: true, json: "config" },
  { relative: "assets/pretzel-crest.svg", label: "Crest mark", category: "Assets", required: true },
  { relative: "assets/fonts/chakra-petch-600.woff2", label: "Display face 600", category: "Assets", required: true },
  { relative: "assets/fonts/chakra-petch-700.woff2", label: "Display face 700", category: "Assets", required: true },
  { relative: "proxy/vercel/api/proxy.js", label: "Vercel gateway", category: "Proxy", required: false },
  { relative: "proxy/vercel/vercel.json", label: "Vercel routes", category: "Proxy", required: false },
  { relative: "proxy/cloudflare/worker.js", label: "Cloudflare Worker", category: "Proxy", required: false },
  { relative: "proxy/README.md", label: "Proxy guide", category: "Proxy", required: false },
  { relative: "tools/proxy-dev.js", label: "Local dev gateway", category: "Proxy", required: false },
  { relative: "README.md", label: "Repository README", category: "Docs", required: false },
  { relative: "v1.1/index.html", label: "v1.1 test deck", category: "Preview", required: false },
];

async function inspectFile(root, entry) {
  const absolute = path.join(root, entry.relative);
  const item = {
    label: entry.label,
    relative: entry.relative,
    category: entry.category,
    required: entry.required,
    exists: false,
    bytes: 0,
    modified: null,
    note: "",
    ok: !entry.required,
  };

  try {
    const stat = await fs.stat(absolute);
    item.exists = stat.isFile();
    item.bytes = stat.size;
    item.modified = stat.mtime.toISOString();

    if (!stat.isFile()) {
      item.note = "Not a file";
      item.ok = false;
    } else if (stat.size === 0) {
      item.note = "Empty file";
      item.ok = false;
    } else if (entry.json) {
      const parsed = JSON.parse(await fs.readFile(absolute, "utf8"));
      if (entry.json === "catalog") {
        const count = Array.isArray(parsed.games) ? parsed.games.length : 0;
        item.note = `${count} game${count === 1 ? "" : "s"}`;
        item.ok = count > 0;
      } else {
        item.note = "Valid JSON";
        item.ok = true;
      }
    } else {
      item.ok = true;
    }
  } catch (error) {
    item.note = error.code === "ENOENT" ? "Missing" : error.message;
    item.ok = false;
  }
  return item;
}

function localReferences(text) {
  const refs = new Set();
  const pattern = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("data:") || raw.startsWith("mailto:")) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
    refs.add(raw.split("?")[0].split("#")[0]);
  }
  return [...refs];
}

async function checkDeploymentAssets(root) {
  const items = [];
  for (const entry of EXPECTED) {
    items.push(await inspectFile(root, entry));
  }

  const brokenReferences = [];
  const referenceTargets = [{ page: "index.html", base: "" }];
  if (items.find((item) => item.relative === "v1.1/index.html" && item.exists)) {
    referenceTargets.push({ page: "v1.1/index.html", base: "v1.1" });
  }

  for (const target of referenceTargets) {
    let html = "";
    try {
      html = await fs.readFile(path.join(root, target.page), "utf8");
    } catch {
      continue;
    }
    for (const ref of localReferences(html)) {
      const absolute = path.join(root, target.base, ref);
      try {
        const stat = await fs.stat(absolute);
        if (!stat.isFile()) throw new Error("not a file");
      } catch {
        brokenReferences.push({ page: target.page, reference: ref });
      }
    }
  }

  const required = items.filter((item) => item.required);
  const missingRequired = required.filter((item) => !item.exists);
  const failed = items.filter((item) => item.exists && !item.ok);
  const faviconBroken = brokenReferences.filter((ref) => ref.reference.includes("pretzel-crest"));

  return {
    ok: missingRequired.length === 0 && failed.length === 0 && brokenReferences.length === 0,
    checkedAt: new Date().toISOString(),
    items,
    missingRequired: missingRequired.map((item) => item.relative),
    failed: failed.map((item) => ({ relative: item.relative, note: item.note })),
    brokenReferences,
    totals: {
      expected: items.length,
      present: items.filter((item) => item.exists).length,
      required: required.length,
      requiredPresent: required.filter((item) => item.exists).length,
      bytes: items.reduce((sum, item) => sum + item.bytes, 0),
    },
    note:
      brokenReferences.length > 0 && faviconBroken.length === 0
        ? "Some local references could not be resolved."
        : "",
  };
}

module.exports = { EXPECTED, checkDeploymentAssets, localReferences };
