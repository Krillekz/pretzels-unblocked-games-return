"use strict";

/**
 * Catalog schema for data/library.json.
 *
 * The Manager and the games shell share this single file. The Manager never
 * rewrites application JavaScript: it validates a complete catalog, keeps a
 * timestamped backup, then replaces library.json atomically.
 */

const PLATFORMS = ["HTML5", "WebGL", "Flash", "Emulator"];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const MAX_GAMES = 500;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateCatalog(input) {
  const errors = [];
  const warnings = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: [{ path: "", message: "Catalog must be a JSON object." }], warnings, value: null };
  }

  const version = input.version === undefined ? 1 : input.version;
  if (version !== 1) {
    errors.push({ path: "version", message: "Unsupported catalog version; expected 1." });
  }

  if (!Array.isArray(input.games)) {
    errors.push({ path: "games", message: "Catalog needs a games array." });
    return { ok: false, errors, warnings, value: null };
  }

  if (input.games.length === 0) {
    errors.push({ path: "games", message: "Add at least one game before saving." });
  }
  if (input.games.length > MAX_GAMES) {
    errors.push({ path: "games", message: `The catalog is capped at ${MAX_GAMES} entries.` });
  }

  const acceptedKeys = new Set(["id", "title", "genre", "platform", "url", "cover", "needsProxy", "tags"]);
  const seenIds = new Map();
  const seenUrls = new Map();
  const games = [];

  input.games.forEach((raw, index) => {
    const at = `games[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push({ path: at, message: "Entry must be an object." });
      return;
    }

    for (const key of Object.keys(raw)) {
      if (!acceptedKeys.has(key)) {
        errors.push({ path: `${at}.${key}`, message: `Unknown field "${key}".` });
      }
    }

    const id = cleanText(raw.id).toLowerCase();
    const title = cleanText(raw.title);
    const genre = cleanText(raw.genre);
    const platform = cleanText(raw.platform);
    const url = cleanText(raw.url);
    const cover = cleanText(raw.cover);
    const needsProxy = raw.needsProxy === true;
    const tags = raw.tags === undefined ? [] : raw.tags;

    if (!id) {
      errors.push({ path: `${at}.id`, message: "Id is required." });
    } else if (!ID_RE.test(id)) {
      errors.push({ path: `${at}.id`, message: "Use lowercase letters, numbers and hyphens; start with a letter or number." });
    } else if (seenIds.has(id)) {
      errors.push({ path: `${at}.id`, message: `Duplicate id "${id}" (also at games[${seenIds.get(id)}]).` });
    } else {
      seenIds.set(id, index);
    }

    if (!title) {
      errors.push({ path: `${at}.title`, message: "Title is required." });
    } else if (title.length > 80) {
      errors.push({ path: `${at}.title`, message: "Title must be 80 characters or fewer." });
    }

    if (!genre) {
      errors.push({ path: `${at}.genre`, message: "Genre is required." });
    } else if (genre.length > 32) {
      errors.push({ path: `${at}.genre`, message: "Genre must be 32 characters or fewer." });
    }

    if (!PLATFORMS.includes(platform)) {
      errors.push({ path: `${at}.platform`, message: `Platform must be one of: ${PLATFORMS.join(", ")}.` });
    }

    if (!url) {
      errors.push({ path: `${at}.url`, message: "Game URL is required." });
    } else if (url.length > 2048) {
      errors.push({ path: `${at}.url`, message: "Game URL is too long." });
    } else if (!isHttpUrl(url)) {
      errors.push({ path: `${at}.url`, message: "Game URL must be an http(s) address without credentials." });
    } else if (seenUrls.has(url)) {
      warnings.push({ path: `${at}.url`, message: `Same URL as "${seenUrls.get(url)}".` });
    } else {
      seenUrls.set(url, title || id || `games[${index}]`);
    }

    if (cover) {
      const safeRelative = cover.startsWith("assets/") && !cover.includes("..");
      if (cover.length > 256) {
        errors.push({ path: `${at}.cover`, message: "Cover path must be 256 characters or fewer." });
      } else if (!isHttpUrl(cover) && !safeRelative) {
        errors.push({ path: `${at}.cover`, message: "Cover must be blank, an http(s) URL, or a path beginning with assets/." });
      }
    }

    if (!Array.isArray(tags)) {
      errors.push({ path: `${at}.tags`, message: "Tags must be an array when present." });
    } else if (tags.length > 8) {
      errors.push({ path: `${at}.tags`, message: "Use at most 8 tags." });
    }

    const cleanTags = [];
    const seenTags = new Set();
    if (Array.isArray(tags)) {
      tags.forEach((tag, tagIndex) => {
        const value = cleanText(tag).toLowerCase();
        if (!value) {
          errors.push({ path: `${at}.tags[${tagIndex}]`, message: "Tags cannot be blank." });
        } else if (value.length > 24) {
          errors.push({ path: `${at}.tags[${tagIndex}]`, message: "Tags must be 24 characters or fewer." });
        } else if (!seenTags.has(value)) {
          seenTags.add(value);
          cleanTags.push(value);
        }
      });
    }

    if (raw.needsProxy !== undefined && typeof raw.needsProxy !== "boolean") {
      errors.push({ path: `${at}.needsProxy`, message: "needsProxy must be true or false." });
    }

    games.push({
      id,
      title,
      genre,
      platform,
      url,
      cover,
      needsProxy,
      tags: cleanTags,
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors, warnings, value: null };
  }

  return {
    ok: true,
    errors: [],
    warnings,
    value: {
      version: 1,
      updated: new Date().toISOString().slice(0, 10),
      games,
    },
  };
}

function summarizeCatalog(catalog) {
  const games = Array.isArray(catalog?.games) ? catalog.games : [];
  const genres = [...new Set(games.map((game) => game.genre).filter(Boolean))].sort();
  const platforms = [...new Set(games.map((game) => game.platform).filter(Boolean))].sort();
  return {
    count: games.length,
    genres,
    platforms,
    proxyCount: games.filter((game) => game.needsProxy).length,
    coverCount: games.filter((game) => game.cover).length,
  };
}

module.exports = {
  PLATFORMS,
  MAX_GAMES,
  validateCatalog,
  summarizeCatalog,
  isHttpUrl,
};
