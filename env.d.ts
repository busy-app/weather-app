/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** BUSY Bar address for dev mode (see .env). */
  readonly VITE_BUSY_ADDR?: string
  /** Base URL of the weather backend; set in CI (see .env). */
  readonly VITE_WEATHER_API?: string
}

/** `dispatcher` is not in lib.dom. `useDeviceKey` authorizes the request with the device key. */
interface BusyRequestInit extends RequestInit {
  dispatcher?: {
    connect?: {
      useDeviceKey?: boolean
    }
  }
}

declare function fetch(
  input: RequestInfo | URL,
  init?: BusyRequestInit,
): Promise<Response>

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** A .anim file is a binary device asset; Vite returns its URL. */
declare module '*.anim' {
  const src: string
  export default src
}

/** Glyph maps of every font in use, collected by the font-maps plugin. */
declare module 'virtual:font-maps' {
  export const MAPS: { fonts: Record<string, unknown> }[]
}
