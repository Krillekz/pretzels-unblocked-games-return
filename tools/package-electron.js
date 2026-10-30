"use strict";

const fs = require("fs/promises");
const path = require("path");
const { packager } = require("@electron/packager");

const ROOT = path.resolve(__dirname, "..");
const RELEASE = path.join(ROOT, "release");
const STAGE = path.join(RELEASE, ".stage");
const RUNTIME = ["index.html", "css", "js", "data", "assets", "sw.js", "electron"];
const VERSION = require(path.join(ROOT, "package.json")).version;

async function main() {
  await fs.rm(STAGE, { recursive: true, force: true });
  await fs.mkdir(STAGE, { recursive: true });

  for (const item of RUNTIME) {
    await fs.cp(path.join(ROOT, item), path.join(STAGE, item), { recursive: true });
  }

  const stagePackage = {
    name: "pretzels-return",
    productName: "Pretzel Games",
    version: VERSION,
    description: "Local-first unblocked games shell with offline AI personas.",
    main: "electron/main.js",
    author: "Pretzel",
    license: "UNLICENSED",
    private: true,
  };
  await fs.writeFile(path.join(STAGE, "package.json"), `${JSON.stringify(stagePackage, null, 2)}\n`);

  const outputs = await packager({
    dir: STAGE,
    out: RELEASE,
    name: "Pretzel Games",
    executableName: "PretzelGames",
    platform: "win32",
    arch: "x64",
    appVersion: VERSION,
    overwrite: true,
    asar: true,
    prune: true,
    quiet: false,
    win32metadata: {
      CompanyName: "Pretzel",
      FileDescription: "Pretzel's Unblocked Games: RETURN",
      ProductName: "Pretzel's Unblocked Games: RETURN",
      OriginalFilename: "PretzelGames.exe",
    },
  });

  await fs.rm(STAGE, { recursive: true, force: true });
  for (const output of outputs) {
    console.log(`Packaged: ${output}`);
    console.log(`Executable: ${path.join(output, "PretzelGames.exe")}`);
  }
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  await fs.rm(STAGE, { recursive: true, force: true }).catch(() => {});
  process.exitCode = 1;
});
