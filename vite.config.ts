import { extname, relative, resolve, sep } from 'node:path'
import { defineConfig, type Plugin, type UserConfig } from 'vite'
// @ts-expect-error — untyped .mjs, build-only plugin.
import { fontMaps } from './scripts/vite-font-maps.mjs'
// @ts-expect-error — untyped .mjs, shared with the build scripts.
import { appDir, findEntry, outRoot, sharedDir } from './scripts/paths.mjs'

// Inlines the whole module tree into a single scripts/main.js.
const bundle = Boolean(process.env.BUNDLE)

// JerryScript runs main.js as a plain script, so the default export is rewritten
// into a call: `export{X as default}` → `X();`.
function callDefaultExport(): Plugin {
  return {
    name: 'call-default-export',
    renderChunk(code, chunk) {
      if (!chunk.isEntry) return null
      // The export is the chunk's last statement, in either form.
      const re = /export\s*(?:\{\s*([A-Za-z_$][\w$]*)\s+as\s+default\s*\}|default\s+([A-Za-z_$][\w$]*)\s*)\s*;?\s*$/
      const match = code.match(re)
      if (!match) {
        this.error(
          'call-default-export: no default export at the end of main.js. ' +
            'The app must have `export default function run()`.',
        )
      }
      const name = match![1] ?? match![2]
      return { code: code.replace(re, `${name}();\n`), map: null }
    },
  }
}

export default defineConfig((): UserConfig => {
  const entry = findEntry()
  if (!entry) {
    throw new Error(`build: ${appDir} has neither main.ts nor main.js`)
  }

  return {
    // .anim files are binary device assets, served as URLs.
    assetsInclude: ['**/*.anim'],
    plugins: [fontMaps(), callDefaultExport()],
    build: {
      // build.mjs passes the destination in and lays out resources and appmeta.
      outDir: resolve(outRoot(process.env.BUSY_OUT), 'scripts'),
      emptyOutDir: true,
      target: 'es2020',
      minify: process.env.NO_MINIFY ? false : 'oxc',
      rollupOptions: {
        input: entry,
        // The entry export must survive tree-shaking.
        preserveEntrySignatures: 'strict',
        output: {
          entryFileNames: 'main.js',
          // No hashes: the runtime resolves relative paths as-is.
          chunkFileNames: '[name].js',
          // inlineDynamicImports and manualChunks are mutually exclusive.
          ...(bundle
            ? { inlineDynamicImports: true }
            : {
                // Each of the app's own modules gets a file next to main.js;
                // dependencies and shared/ are inlined into the chunk using them.
                manualChunks(id: string) {
                  if (!id.startsWith(appDir)) return undefined
                  if (id === entry) return undefined
                  // Sources only; assets take their own path.
                  if (!/\.(ts|js)$/.test(id)) return undefined
                  // The package keeps every script next to main.js, so the chunk
                  // name is the module's path under src/, flattened — file names
                  // alone would collide across folders:
                  //   time.ts → time.js,  lib/format.ts → lib-format.js
                  const path = relative(appDir, id)
                  return path.slice(0, -extname(path).length).split(sep).join('-')
                },
              }),
          // Temp folder inside outDir; build.mjs spreads it out and removes it.
          assetFileNames: '_assets/[name][extname]',
        },
      },
    },
    resolve: { alias: { '@shared': sharedDir } },
  }
})
