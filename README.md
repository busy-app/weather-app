# Weather

Weather forecast

A JavaScript app for the BUSY Bar, generated from the BUSY JS app template.

## Screens

Three, in a ring: the weather now, the next 24 hours as a graph, and the days after them. An empty screen is skipped.

| Input | |
| --- | --- |
| `ok`, `start` | the next screen |
| encoder | steps through the hours or the days, stopping at either end |

The forecast is fetched on launch and every 15 minutes after.

## Getting started

```sh
pnpm install
cp .env.example .env   # set VITE_WEATHER_API to the weather backend
pnpm build
```

The app's id is `app.busy.weather`, set in `src/appmeta/manifest.json`. An id is `<namespace>.<app>`, at most 32 characters, made of letters, digits, dots, and underscores. If yours still says `app.example`, change it to your own namespace before publishing.

## Layout

`src/` is the app — everything in it is yours to edit.

The entry point is `src/main.ts` (or `src/main.js`). The name is fixed: the build turns it into `scripts/main.js`, the file the BUSY Bar starts. Any imported modules are emitted as separate files alongside it in `scripts/`, unless `pnpm build --bundle` inlines them.

`src/main.ts` is run from top to bottom, not imported: it starts the app by calling `main()` at the end and must not export anything. Imported modules can use standard exports.

```
my-app/
├── src/                          the app
│   ├── main.ts                   the entry point: function main(), called at the end
│   ├── appmeta/
│   │   ├── manifest.json         id, name, version
│   │   ├── settings.json         the settings screen — optional
│   │   ├── icon_front_8x8.png    front icon, 8×8 color — optional
│   │   └── icon_back_11x11.png   back icon, 11×11 grayscale — optional
│   ├── images/
│   ├── animations/
│   └── sounds/
├── shared/                       app-level helpers, imported as @shared/*
```

Both icons are optional; without them a default is used.

## Resources

Anything in `src/` that isn't a source file is copied into the package, sorted by what the BUSY Bar can read:

| Extension | Destination |
| --- | --- |
| `.png` `.image` | `images/` |
| `.anim` | `animations/` |
| `.snd` | `sounds/` |
| anything else | `resources/` |

A file in `src/images`, `src/animations` or `src/sounds` keeps its folder as long as the BUSY Bar reads its format.

`images/`, `animations/` and `sounds/` hold only those formats. An image, animation or sound in another format — `.jpg`, `.gif`, `.svg`, `.wav`, `.mp3` and the like — goes to `resources/`, and the build warns that the device cannot read it.

Everything the app draws is placed by hand, in screen pixels: each screen builds the display elements it needs with explicit `x`/`y` coordinates and sends them with `displayDraw()` from `@shared/device`. Text widths and line heights come from `src/font.ts`, which carries only the two device fonts this app prints. The screen is 72×16 pixels.

## Input

`listen("input", handler)` delivers the device keys: `ok`, `start` and `back` with a `press` / `release` action, and `encoder` with a `delta` of `1` or `-1`. It returns an unbind function.

## Commands

| Command | Description |
| --- | --- |
| `pnpm build` | empties `dist/` and builds the package into it |
| `pnpm build --out <path>` | builds into `<path>` instead, replacing only this app's package there |
| `pnpm build --tgz` | also packs the package into a `.tgz` alongside it |
| `pnpm build --tgz-only` | packs the `.tgz` and leaves nothing else |
| `pnpm build --tgz --tgz-name <name>` | names the `.tgz`, e.g. `"{id}-{version}.tgz"` |
| `pnpm build --no-minify` | readable output, for debugging |
| `pnpm build --bundle` | inlines every module into one `main.js` |
| `pnpm build --addr <host>` | sets the BUSY Bar address the app connects to, `localhost` by default |
| `pnpm typecheck` | type-checks the app |
| `pnpm app:install` | installs `dist/app.busy.weather.tgz` on the BUSY Bar; build it first with `pnpm build --tgz` |
| `pnpm app:uninstall` | removes the app from the BUSY Bar, keeping its settings |
| `pnpm app:run` | launches the installed app |
| `pnpm app:stop` | quits the running app |

The four `app:` commands talk to the BUSY Bar connected over USB. For a device connected over Wi-Fi, pass `--addr <host>` with its network IP address or hostname, and `--password <password>` if password protection is enabled:

```sh
pnpm app:install --addr <host>
pnpm app:install --addr <host> --password <password>
```

## Build output

The package folder is named after the app id:

```
dist/
└── app.busy.weather/
    ├── appmeta/manifest.json
    ├── scripts/main.js
    └── images/ animations/ sounds/ resources/
```

`--tgz` packs that folder into `dist/app.busy.weather.tgz`, with the folder itself at the root of the archive. `--tgz-name` gives the archive another name; `{id}` and `{version}` in it are replaced with the manifest values.

## Releasing

Pushing a git tag matching the manifest `version` (e.g. `0.1.0`) builds the app and attaches `app.busy.weather-<version>.tgz` to a GitHub release. The release notes open with the app's name, id, version and API version. The release fails when the tag differs from the manifest `version`. CI and the release build take the weather backend from the `WEATHER_API` repository variable.

## Manifest

`src/appmeta/manifest.json` carries the app's identity and a couple of knobs:

| Field | Description |
| --- | --- |
| `format_version` | manifest format, `1` — required |
| `id` | up to 32 characters — required |
| `name` | display name — required |
| `version` | semver, e.g. `1.0.0` — required |
| `api_version` | minimum BUSY Bar HTTP API version the app needs, e.g. `27.12.0` — required |
| `description`, `author` | free form, default `""` |
| `heap_size_kib` | memory for the app heap, 1–256, default 32 |
| `debug` | when true, shown only in developer mode, default false |

Raise `heap_size_kib` if the app runs out of memory.

## Node version

The app builds on Node 24 — the version in `.nvmrc` and the range `engines` allows. Node 26 breaks the build and is excluded. With `fnm` or `nvm` installed, `fnm use` / `nvm use` picks the right one up from `.nvmrc`.

## Settings

To give the app a settings screen, add `src/appmeta/settings.json` describing the fields, then read the stored values with `getAppSettings()`:

```ts
import { getAppSettings } from "@shared/device";

const { version, values } = await getAppSettings(manifest.id);
```

`values` is a map of field id to the stored value. If nothing is stored yet, the first read fills in the defaults from the schema. The weather app reads settings once, at startup — restart it to pick up a change.
