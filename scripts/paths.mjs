// Project layout, in one place. One repository holds one app.
//
//   my-app/
//   ├── src/
//   │   ├── main.ts        ← the entry point: export default function run()
//   │   ├── appmeta/       ← manifest.json, settings.json
//   │   └── images/        ← resources, copied into the package
//   ├── shared/            ← the platform, imported as `@shared/*`
//   ├── scripts/           ← the build
//   └── env.d.ts           ← ambient types for the build environment
//
// Imported by vite.config.ts and by the build scripts, so the two stay in sync.

import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repository root: package.json, the configs, scripts/. */
export const root = fileURLToPath(new URL('..', import.meta.url))
/** The app itself — sources, appmeta and resources. */
export const appDir = resolve(root, 'src')
/** The platform code, imported as `@shared/*`. */
export const sharedDir = resolve(root, 'shared')
/** Glyph maps of the firmware fonts, shipped with the template. */
export const mapsDir = resolve(sharedDir, 'fontMaps')
/** The manifest and, optionally, the settings descriptor. */
export const appmetaDir = resolve(appDir, 'appmeta')

/**
 * Where the built package lands: `dist/` by default, or the path given by
 * `--out <path>` / `BUSY_OUT`. A relative path resolves against the repository
 * root, so `../` reaches a destination outside the app.
 */
export function outRoot(override) {
  const path = override ?? process.env.BUSY_OUT ?? 'dist'
  return isAbsolute(path) ? path : resolve(root, path)
}

/** App entry point: src/main.ts or src/main.js. Returns the path, or null. */
export function findEntry(dir = appDir) {
  for (const name of ['main.ts', 'main.js']) {
    const path = resolve(dir, name)
    if (existsSync(path)) return path
  }
  return null
}
