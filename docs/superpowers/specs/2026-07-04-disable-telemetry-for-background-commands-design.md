# Disable telemetry for passive background CLI commands

**Date:** 2026-07-04
**Status:** Approved

## Problem

The VS Code extension shells out to the `wendy` CLI for two very different
reasons:

1. **User-initiated actions** — the user clicks a button or runs a command
   (run app, connect WiFi, update agent, unenroll, open a logs terminal, flash
   an OS image).
2. **Passive background work** — the extension polls and refreshes on its own:
   device discovery loops, automatic update checks, sidebar tree refreshes,
   disk/OS-cache listings, and a version probe on every CLI construction.

The `wendy` CLI reports anonymous usage analytics for every invocation. Because
the extension fires background invocations continuously (discovery runs every
2s/10s, disks refresh every 5s), these polls drown out and misrepresent real
CLI usage in analytics.

## Goal

Background (non-user-triggered) CLI invocations from the extension must not be
counted in usage analytics. User-initiated invocations continue to report
normally.

## Mechanism

The `wendy` CLI honors the environment variable `WENDY_ANALYTICS=false` to skip
analytics for that invocation. There is no per-command flag, so the environment
variable is the only lever, and it is per-process — exactly what we want.

Add a single helper as the source of truth:

```ts
// src/utilities/utilities.ts

/**
 * Environment for CLI invocations the extension makes on its own behalf
 * (polling, refreshes, probes) rather than in response to an explicit user
 * action. The wendy CLI honors WENDY_ANALYTICS=false to skip usage analytics.
 */
export function analyticsDisabledEnv(): NodeJS.ProcessEnv {
  return { ...process.env, WENDY_ANALYTICS: "false" };
}
```

`process.env` is spread so `PATH` and friends survive — important because the
CLI is resolved by path and may be a symlink/shim that relies on the inherited
environment.

## Classification

### Background — pass `{ env: analyticsDisabledEnv() }`

| Call site | Command | Why background |
|---|---|---|
| `DeviceManager.scanType` | `discover` | fast/slow timer loops (2s/10s) |
| `DeviceManager.checkForUpdates` | `device info --check-updates` | auto-fires on device rebuild |
| `DeviceManager.getHardware` | `device hardware list` | HardwareProvider auto-refresh on device-change events |
| `DeviceManager.listApps` | `device apps list` | DevicesProvider auto-refresh |
| `DiskManager.getDisks` | `os list-drives` | DisksProvider `Refresher` (5s) |
| `OperatingSystemCacheProvider.listOsCacheEntries` | `os cache list` | tree auto-refresh |
| `WendyCLI.create` probe | `--version` | runs on every CLI construction |
| `WendyCLI.getJsonSchema` | `json schema` | activation-time schema sync |
| `WendyCLI.getInfo` | `info` | probe |

### User-initiated — analytics stays ON (unchanged)

`unenrollDevice`, `updateAgent`, `connectWifi`, `disconnectWifi`, `startApp`,
`stopApp`, `removeApp`, `getWifiStatus`, `WendyImager.listSupportedDevices`
(only runs inside the flash flow), all `createTerminal` commands (logs, setup,
hardware, `analytics status`, `os install`), and the `run` task
(`WendyTaskProvider`).

### Nuance

A user action such as `connectWifi` first calls `WendyCLI.create()`, so its
`--version` probe runs with analytics off while the actual wifi-connect runs
with analytics on. This is intended: the probe is the extension's own call, the
action is the user's.

## Edits (Approach A — shared env helper, passed at each background call site)

- **`src/utilities/utilities.ts`** — add `analyticsDisabledEnv()`.
- **`src/wendy-cli/wendy-cli.ts`** — `exec` gains a `background = false`
  parameter; when true it passes `{ env: analyticsDisabledEnv() }` to
  `utilities.execFile`. `getVersion`, `getInfo`, `getJsonSchema` call
  `exec(args, true)`; `unenrollDevice` stays `exec(args)`.
- **`src/models/DeviceManager.ts`** — `scanType`, `checkForUpdates`,
  `getHardware`, `listApps` switch their raw `child_process.execFile` calls to
  the 4-arg form `execFile(path, args, { env: analyticsDisabledEnv() }, cb)`.
  Import the helper. `getWifiStatus`, `connectWifi`, app start/stop/remove,
  `updateAgent`, `disconnectWifi` are left as-is.
- **`src/models/DiskManager.ts`** — `getDisks` gets the options object;
  `flashWendyOS` (terminal) unchanged.
- **`src/sidebar/OperatingSystemCacheProvider.ts`** — `listOsCacheEntries`
  passes `{ env: analyticsDisabledEnv() }` (it already uses `utilities.execFile`,
  which merges options).

No changes to `extension.ts` terminal commands, `WendyTaskProvider`, or
`Imager`.

Note: Node's `child_process.execFile` accepts `execFile(file, args, options,
callback)`; inserting the options object before the callback is the whole
change at those sites. The `env` option, when provided, must include the full
environment we want the child to see — hence spreading `process.env`.

## Testing

The repo's only test harness is `vscode-test` (integration) with effectively no
existing coverage. Full execFile mocking across every site would be
disproportionate. Scope:

1. **Helper unit test** — `analyticsDisabledEnv()` returns an env with
   `WENDY_ANALYTICS === "false"` and preserves a pre-existing variable (e.g.
   `PATH`).
2. **Plumbing assertion** — verify `WendyCLI.exec(args, true)` invokes the
   underlying exec with an env containing `WENDY_ANALYTICS=false`, and that
   `exec(args)` (background=false) does not set it. This is the single point
   through which the CLI-owned background calls flow.
3. **Manual verification** — run `wendy analytics status` (or inspect the
   telemetry endpoint), let the extension idle so discovery/disk polling runs,
   confirm background polls do not register; then trigger a user `run` and
   confirm it does.

## Out of scope / YAGNI

- No new user-facing setting to toggle this; the classification is fixed.
- No change to the terminal-based commands or the `run` task.
- No broader refactor of raw `execFile` usage into `WendyCLI` (that was the
  rejected Approach B).
