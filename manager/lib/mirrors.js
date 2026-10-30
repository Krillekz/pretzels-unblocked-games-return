"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { writeJsonAtomic } = require("./workspace");

const FILE = path.join("data", "mirrors.json");
const MAX_MIRRORS = 12;

function normalizeOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  if (url.username || url.password || url.search || url.hash) return "";
  const pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return `${url.origin}${pathname}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function validateManifest(input) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: [{ path: "", message: "Mirror manifest must be an object." }], warnings };
  }

  const primary = normalizeOrigin(input.primary);
  if (input.primary && !primary) {
    errors.push({ path: "primary", message: "Primary must be a plain http(s) origin without credentials, query or hash." });
  }

  const rawMirrors = Array.isArray(input.mirrors) ? input.mirrors : [];
  if (rawMirrors.length > MAX_MIRRORS) {
    errors.push({ path: "mirrors", message: `Use at most ${MAX_MIRRORS} mirrors.` });
  }

  const mirrors = [];
  const origins = new Set();
  const ids = new Set();
  rawMirrors.forEach((raw, index) => {
    const at = `mirrors[${index}]`;
    const label = String(raw?.label || "").trim();
    const origin = normalizeOrigin(raw?.origin);
    const note = String(raw?.note || "").trim().slice(0, 160);
    if (!label) errors.push({ path: `${at}.label`, message: "Label is required." });
    else if (label.length > 40) errors.push({ path: `${at}.label`, message: "Label must be 40 characters or fewer." });
    if (!origin) errors.push({ path: `${at}.origin`, message: "Origin must be a plain http(s) origin ending in /." });
    if (origin && origin === primary) warnings.push({ path: `${at}.origin`, message: "This mirror is also the primary origin." });
    if (origin && origins.has(origin)) errors.push({ path: `${at}.origin`, message: "Duplicate mirror origin." });
    if (origin) origins.add(origin);
    let id = slugify(raw?.id || label || origin);
    if (!id) id = `mirror-${index + 1}`;
    while (ids.has(id)) id = `${id}-${index + 1}`;
    ids.add(id);
    mirrors.push({ id, label, origin, note });
  });

  let active = normalizeOrigin(input.active);
  if (input.active && !active) {
    errors.push({ path: "active", message: "Active route must be a plain http(s) origin." });
  }
  if (active && active !== primary && !origins.has(active)) {
    errors.push({ path: "active", message: "Active route must be the primary or one of the mirrors." });
  }
  if (!active) active = primary;

  if (errors.length) return { ok: false, errors, warnings };

  return {
    ok: true,
    errors: [],
    warnings,
    value: { version: 1, primary, active, mirrors },
  };
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function fingerprint(root) {
  const [index, library] = await Promise.all([
    fs.readFile(path.join(root, "index.html")),
    fs.readFile(path.join(root, "data", "library.json")),
  ]);
  return {
    indexSha256: sha256(index),
    catalogSha256: sha256(library),
    indexBytes: index.length,
    catalogBytes: library.length,
  };
}

function emptyManifest() {
  return {
    version: 1,
    updated: "",
    primary: "",
    active: "",
    mirrors: [],
    catalogSha256: "",
    indexSha256: "",
  };
}

async function readManifest(root) {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(root, FILE), "utf8"));
    return { ...emptyManifest(), ...parsed, mirrors: Array.isArray(parsed.mirrors) ? parsed.mirrors : [] };
  } catch {
    return emptyManifest();
  }
}

async function backupManifest(root, text) {
  const dir = path.join(root, ".manager", "backups");
  await fs.mkdir(dir, { recursive: true });
  const name = `mirrors-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await fs.writeFile(path.join(dir, name), text, "utf8");
  return name;
}

async function saveManifest(root, input) {
  const validated = validateManifest(input);
  if (!validated.ok) return validated;

  const hash = await fingerprint(root);
  const manifest = {
    ...validated.value,
    updated: new Date().toISOString().slice(0, 10),
    catalogSha256: hash.catalogSha256,
    indexSha256: hash.indexSha256,
  };

  const target = path.join(root, FILE);
  let previous = null;
  try {
    previous = await fs.readFile(target, "utf8");
  } catch {
    previous = null;
  }
  let backup = null;
  if (previous !== null) backup = await backupManifest(root, previous);
  await writeJsonAtomic(target, manifest);
  return { ok: true, errors: [], warnings: validated.warnings, manifest, backup };
}

function fetchImpl() {
  try {
    const electron = require("electron");
    if (electron?.net?.fetch) return electron.net.fetch.bind(electron.net);
  } catch {
    /* Node tests use global fetch */
  }
  return fetch;
}

async function fetchBytes(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetchImpl()(url, {
      redirect: "follow",
      credentials: "omit",
      signal: controller.signal,
      headers: {
        "user-agent": "PretzelManager/0.1 (+mirror route check)",
        accept: "application/json,text/html;q=0.9,*/*;q=0.5",
        "cache-control": "no-cache",
      },
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url || url,
      buffer,
      hash: sha256(buffer),
      contentType: response.headers.get("content-type") || "",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkOrigin(origin, local) {
  const started = Date.now();
  try {
    const [index, library] = await Promise.all([
      fetchBytes(`${origin}index.html`),
      fetchBytes(`${origin}data/library.json`),
    ]);
    return {
      origin,
      ok: index.ok && library.ok,
      status: `${index.status}/${library.status}`,
      indexMatch: index.hash === local.indexSha256,
      libraryMatch: library.hash === local.catalogSha256,
      finalUrl: library.finalUrl,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      error: "",
    };
  } catch (error) {
    return {
      origin,
      ok: false,
      status: "—",
      indexMatch: false,
      libraryMatch: false,
      finalUrl: "",
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      error: error.name === "AbortError" ? "Timed out after 9 seconds." : error.message,
    };
  }
}

async function checkAll(root, input) {
  const validated = validateManifest(input);
  if (!validated.ok) return validated;
  const local = await fingerprint(root);
  const origins = [
    ...(validated.value.primary ? [validated.value.primary] : []),
    ...validated.value.mirrors.map((mirror) => mirror.origin),
  ];
  const results = [];
  for (const origin of origins) {
    results.push(await checkOrigin(origin, local));
  }
  return { ok: true, local, results, manifest: validated.value };
}

function chooseActive(manifest, results) {
  const primary = results.find((result) => result.origin === manifest.primary);
  if (primary?.ok && primary.libraryMatch && primary.indexMatch) return manifest.primary;
  const matching = manifest.mirrors.find((mirror) => {
    const result = results.find((entry) => entry.origin === mirror.origin);
    return result?.ok && result.libraryMatch && result.indexMatch;
  });
  return matching?.origin || "";
}

async function autoRoute(root, input) {
  const checked = await checkAll(root, input);
  if (!checked.ok) return checked;
  const active = chooseActive(checked.manifest, checked.results);
  if (!active) {
    return {
      ok: false,
      errors: [{ path: "active", message: "No checked origin returned a matching index.html and library.json." }],
      warnings: [],
      results: checked.results,
      local: checked.local,
    };
  }
  const saved = await saveManifest(root, { ...checked.manifest, active });
  return { ...saved, results: checked.results, local: checked.local, active };
}

module.exports = {
  FILE,
  MAX_MIRRORS,
  normalizeOrigin,
  validateManifest,
  fingerprint,
  readManifest,
  saveManifest,
  checkOrigin,
  checkAll,
  autoRoute,
};
