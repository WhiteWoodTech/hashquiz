/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRANSPORT: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SOLO_SCORING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
