"use strict";

const fs = require("fs/promises");
const path = require("path");
const { app } = require("electron");
const { validateCatalog } = require("./catalog");

const BACKUP_DIR = ".manager/backups";
const MAX_BACKUPS = 40;

function settingsFile() {
  return path.join(app.getPath("userData"), "manager-settings.json");
}

async function readJsonFile(file) {
  const text = await fs.readFile(file, "utf8");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await fs.rename(temp, file);
  } catch (error) {
    if (error.code === "EEXIST" || error.code === "EPERM") {
      await fs.rm(file, { force: true });
      await fs.rename(temp, file);
    } else {
      await fs.rm(temp, { force: true });
      throw error;
    }
  }
}

async function loadSettings() {
  try {
    return await readJsonFile(settingsFile());
  } catch {
    return {};
  }
}

async function saveSettings(settings) {
  await writeJsonAtomic(settingsFile(), settings);
}

async function isWorkspace(dir) {
  if (!dir || typeof dir !== "string") return false;
  const root = path.resolve(dir);
  const checks = await Promise.all(
    ["index.html", path.join("js", "app.js"), path.join("data", "library.json")].map(async (relative) => {
      try {
        const stat = await fs.stat(path.join(root, relative));
        return stat.isFile();
      } catch {
        return false;
      }
    }),
  );
  return checks.every(Boolean);
}

function parentDirs(start, steps) {
  const dirs = [];
  let current = path.resolve(start);
  for (let index = 0; index < steps; index += 1) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
    dirs.push(current);
  }
  return dirs;
}

async function findWorkspace(explicit) {
  const settings = await loadSettings();
  const candidates = [];

  const add = (candidate) => {
    if (!candidate || typeof candidate !== "string") return;
    const resolved = path.resolve(candidate);
    if (!candidates.includes(resolved)) candidates.push(resolved);
  };

  add(explicit);
  add(process.env.PRETZEL_WORKSPACE);
  add(settings.lastWorkspace);
  add(process.cwd());
  parentDirs(process.cwd(), 4).forEach(add);
  add(path.dirname(process.execPath));
  parentDirs(path.dirname(process.execPath), 6).forEach(add);

  for (const candidate of candidates) {
    if (await isWorkspace(candidate)) {
      if (settings.lastWorkspace !== candidate) {
        await saveSettings({ ...settings, lastWorkspace: candidate });
      }
      return candidate;
    }
  }
  return null;
}

async function readLibrary(root) {
  const file = path.join(root, "data", "library.json");
  const text = await fs.readFile(file, "utf8");
  const raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  return { file, text, raw };
}

async function readConfig(root) {
  try {
    return await readJsonFile(path.join(root, "data", "config.json"));
  } catch {
    return null;
  }
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function listBackups(root) {
  const dir = path.join(root, BACKUP_DIR);
  let names = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const items = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const stat = await fs.stat(path.join(dir, name));
      items.push({
        name,
        bytes: stat.size,
        modified: stat.mtime.toISOString(),
        path: path.join(dir, name),
      });
    } catch {
      /* a backup that vanished mid-scan is not a failure */
    }
  }
  return items.sort((a, b) => b.modified.localeCompare(a.modified));
}

async function pruneBackups(root) {
  const backups = await listBackups(root);
  for (const backup of backups.slice(MAX_BACKUPS)) {
    await fs.rm(backup.path, { force: true });
  }
}

async function createBackup(root, text) {
  const dir = path.join(root, BACKUP_DIR);
  await fs.mkdir(dir, { recursive: true });
  const name = `library-${stamp()}.json`;
  const file = path.join(dir, name);
  await fs.writeFile(file, text, "utf8");
  await pruneBackups(root);
  return { name, path: file, bytes: Buffer.byteLength(text) };
}

async function saveLibrary(root, input) {
  const result = validateCatalog(input);
  if (!result.ok) {
    return { ok: false, errors: result.errors, warnings: result.warnings };
  }

  const libraryFile = path.join(root, "data", "library.json");
  let previous = null;
  try {
    previous = await fs.readFile(libraryFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  let backup = null;
  if (previous !== null) {
    backup = await createBackup(root, previous);
  }

  await writeJsonAtomic(libraryFile, result.value);
  return { ok: true, errors: [], warnings: result.warnings, catalog: result.value, backup };
}

async function backupNow(root) {
  const library = await readLibrary(root);
  return createBackup(root, library.text);
}

module.exports = {
  BACKUP_DIR,
  MAX_BACKUPS,
  isWorkspace,
  findWorkspace,
  loadSettings,
  saveSettings,
  readLibrary,
  readConfig,
  listBackups,
  createBackup,
  backupNow,
  saveLibrary,
  writeJsonAtomic,
  settingsFile,
};
