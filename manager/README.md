# Pretzel Manager — Phase 5 dashboard (+ Phase 6 mirror routes)

A separate Electron utility for **Pretzel's Unblocked Games: RETURN**. It is not
part of the static site and it does not ship inside the games shell. It reads and
writes the workspace's shared `data/library.json`, runs frame/asset checks and
provides the three test simulations required by the Phase 5 brief.

## Run it

```sh
cd manager
npm install
npm start
```

The Manager looks for a workspace containing `index.html`, `js/app.js` and
`data/library.json`. It checks the saved workspace, the current directory, the
executable's directory and their parents. If it cannot find one, use the
workspace chip in the top bar to pick the project folder. The choice is stored in
the app's user-data folder as `manager-settings.json`.

When more than one display is connected, the Manager, app test window and frame
harness open on the widest non-primary display. The primary display is left
alone; with a single display they fall back to it. You can still drag any window
to another monitor.

## Build the standalone app

```sh
cd manager
npm run package:win
```

Output: `manager/dist/Pretzel Manager-win32-x64/Manager.exe`. The folder is a
portable Electron distribution, not an installer; copy the whole folder. The
build is unsigned. Phase 4 (the main games shell wrapper) remains separate; this
executable only runs the Manager.

## What it does

| Page | Purpose |
| --- | --- |
| Overview | Workspace/catalog status, readiness gates, backup stack, quick actions |
| Catalog | Add, edit and delete entries; search/filter; save the complete array |
| Frame check | Reads HTTP status, `X-Frame-Options` and CSP `frame-ancestors`; opens a visual frame harness |
| Test lab | External-network dropout, blocked/crashed frame fixtures, 1440/860/390 layout presets |
| Mirrors | Primary + up to 12 fallback origins, SHA-256 comparison of live files, auto-route, manifest backups |
| Files | Delivery asset scan, local reference check, paths and timestamped backups |

The **app test window** is a separate Chromium window pointed at the local
workspace through a loopback-only static server. It opens the current shell or
the v1.1 deck on the secondary display. The dropout toggle blocks external
http(s) requests in that test session only; local files keep loading.

## Data safety

- The Manager never parses or rewrites application JavaScript.
- A save validates the entire array against schema v1 before touching disk.
- The previous `library.json` is copied into `.manager/backups/` first.
- The new file is written to a temp file and renamed into place.
- Backups are pruned to the newest 40.
- Invalid saves are rejected before the backup and before the write.

Backups are visible from Overview and Files, or by revealing
`.manager/backups/` in the workspace.

Mirror manifests follow the same rule: origins must be plain `http(s)` URLs
without credentials, query strings or hashes, duplicates are rejected, and the
previous `data/mirrors.json` is copied into `.manager/backups/` before the new
file is renamed into place. A mirror is only promoted by **Auto-route** when its
live `index.html` and `library.json` match this workspace byte for byte.

## Verification

`npm run smoke` boots the real Electron shell, checks the preload bridge and all
six routes, validates a deliberately broken catalog, runs the asset scan, does
a save/backup/reject roundtrip in a temporary workspace, exercises a catalog
draft and discard, performs a live frame check, opens the blocked-frame harness,
loads the app test window, resizes it to 860 and 390, proves external fetch is
blocked when dropout is on, and saves a mirror manifest twice to confirm the
backup, active-route switch and stored fingerprint. It writes screenshots to
`manager/.smoke/` and exits non-zero if a check fails.

The packaged `Manager.exe --smoke` runs the same suite from inside the asar.

## Known limits

- Header checks are advisory: a page can still refuse framing because of script
  behaviour, authentication, or a header shape not covered here. Use the visual
  harness for the final call.
- The app test window uses an ephemeral loopback port, so it is local to this
  machine and disappears when the window closes.
- The Manager is local-only. It has no authentication, no telemetry and no
  network write path.
- There is no deploy packaging panel, by the locked Phase 5 decision. The Files
  page reports readiness and reveals files; publishing remains a separate step.
- Mirror checks require the host to serve `index.html` and `data/library.json`
  at the manifest origin and to allow a direct fetch. A host behind a login,
  a bot wall or a redirect that rewrites those paths will report FAIL or DRIFT
  rather than a match.
- The executable is unsigned and the packaged folder is large because it carries
  the Electron runtime.
