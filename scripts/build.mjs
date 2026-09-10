// Builds the app into the BusyBar package format:
//
//   dist/<id>/
//   ├── appmeta/manifest.json      # required
//   ├── appmeta/settings.json      # optional
//   ├── scripts/main.js            # fixed entry point, plus sibling modules
//   └── images/ animations/ sounds/ resources/
//
// The package folder is named after the manifest id.
//
// Resources in src/images, src/animations and src/sounds are copied as-is;
// anything else in src/ is sorted by file type.
//
// Usage:
//   pnpm build                     → dist/<id>/
//   pnpm build --out <path>        → <path>/<id>/, relative to the repository root
//   pnpm build --tgz               → the folder, plus <id>-<version>.tgz beside it
//   pnpm build --tgz-only          → <id>-<version>.tgz alone
//   pnpm build --no-minify         → readable output, for debugging
//   pnpm build --bundle            → everything inlined into one main.js

import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { relative, resolve } from 'node:path'
import { appDir, appmetaDir, outRoot, root } from './paths.mjs'
import { classify, KNOWN_DIRS } from './resources.mjs'

/** Validates the manifest against the spec; throws on violation. */
function validateManifest(path) {
  if (!existsSync(path)) {
    throw new Error('src/appmeta/manifest.json is missing and required')
  }
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof manifest.id !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(manifest.id)) {
    throw new Error('manifest.id must match ^[a-zA-Z0-9._-]+$')
  }
  if (manifest.id.length > 32) {
    throw new Error(`manifest.id must be at most 32 characters, this one is ${manifest.id.length}`)
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? '')) {
    throw new Error('manifest.version must be semver, e.g. "1.0.0"')
  }
  if (typeof manifest.name !== 'string' || manifest.name === '') {
    throw new Error('manifest.name is required')
  }
  return manifest
}

/** App sources: built by Vite, never treated as resources. */
const SOURCE_FILE = /\.(ts|tsx|js|mjs|cjs|jsx|d\.ts|map)$/i
/** Entries inside src/ that are not resources; appmeta/ is copied separately. */
const IGNORED = new Set(['appmeta'])

/**
 * Recursively sorts a directory's files into the package's target folders.
 * Returns a map of `file name` → `path inside the package`.
 */
function layoutResources(srcDir, outDir, sourceDirName, moved = new Map()) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    // Dot-entries are tooling, never app resources.
    if (entry.name.startsWith('.')) continue
    if (IGNORED.has(entry.name)) continue
    const src = resolve(srcDir, entry.name)
    // A destination inside the repository must not feed itself.
    if (src === outDir) continue

    if (entry.isDirectory()) {
      // A known folder name sets the type; any other is transparent.
      const nested = KNOWN_DIRS.includes(entry.name) ? entry.name : sourceDirName
      layoutResources(src, outDir, nested, moved)
      continue
    }

    if (SOURCE_FILE.test(entry.name)) continue

    const { target, warning } = classify(entry.name, sourceDirName)
    if (warning) console.warn(`  ⚠ ${warning}`)
    const destDir = resolve(outDir, target)
    mkdirSync(destDir, { recursive: true })
    cpSync(src, resolve(destDir, entry.name))
    moved.set(entry.name, `${target}/${entry.name}`)
  }
  return moved
}

/** Rewrites "/_assets/<file>" references to the real path in the package. */
function rewriteAssetUrls(scriptsDir, moved) {
  for (const entry of readdirSync(scriptsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue
    const path = resolve(scriptsDir, entry.name)
    const code = readFileSync(path, 'utf8')
    const patched = code.replace(/(^|[^\w.-])\/_assets\/([\w.-]+)/g, (match, prefix, file) =>
      moved.has(file) ? `${prefix}${moved.get(file)}` : match,
    )
    if (patched !== code) writeFileSync(path, patched)
  }
}

const args = process.argv.slice(2)
const noMinify = args.includes('--no-minify')
const bundle = args.includes('--bundle')
const tgzOnly = args.includes('--tgz-only')
const tgz = tgzOnly || args.includes('--tgz')
const outFlag = args.indexOf('--out')
if (outFlag !== -1 && !args[outFlag + 1]) {
  console.error('--out needs a path')
  process.exit(1)
}
const destDir = outRoot(outFlag === -1 ? undefined : args[outFlag + 1])

const manifest = validateManifest(resolve(appmetaDir, 'manifest.json'))
console.log(`\n▶ Building ${manifest.id} v${manifest.version}`)

const outDir = resolve(destDir, manifest.id)

// vite empties only scripts/, so clear the whole package folder here.
rmSync(outDir, { recursive: true, force: true })
mkdirSync(destDir, { recursive: true })

execFileSync('pnpm', ['exec', 'vite', 'build'], {
  stdio: 'inherit',
  cwd: root,
  env: {
    ...process.env,
    BUSY_OUT: outDir,
    ...(noMinify && { NO_MINIFY: '1' }),
    ...(bundle && { BUNDLE: '1' }),
  },
})

if (!existsSync(resolve(outDir, 'scripts/main.js'))) {
  throw new Error('build produced no scripts/main.js')
}

// appmeta/: the manifest and, if present, the settings descriptor.
cpSync(appmetaDir, resolve(outDir, 'appmeta'), { recursive: true })
if (manifest.settings && !existsSync(resolve(outDir, manifest.settings))) {
  throw new Error(`manifest.settings points at ${manifest.settings}, which is missing`)
}

// images/animations/sounds keep their folder; the rest go by extension.
layoutResources(appDir, outDir, null)

// Assets vite emitted land in scripts/_assets/; spread them out and drop it.
const emitted = resolve(outDir, 'scripts/_assets')
if (existsSync(emitted)) {
  const moved = layoutResources(emitted, outDir, null)
  rmSync(emitted, { recursive: true, force: true })
  rewriteAssetUrls(resolve(outDir, 'scripts'), moved)
}

const scripts = readdirSync(resolve(outDir, 'scripts')).sort()
console.log(`  scripts: ${scripts.join(', ')}`)

let result = outDir

if (tgz) {
  const archive = resolve(destDir, `${manifest.id}-${manifest.version}.tgz`)
  // Packed from destDir so the archive holds the <id>/ folder itself.
  execFileSync('tar', ['-czf', archive, '-C', destDir, manifest.id], { stdio: 'inherit' })
  if (tgzOnly) rmSync(outDir, { recursive: true, force: true })
  result = archive
}

console.log(`\n✔ Done → ${relative(root, result) || result}`)
