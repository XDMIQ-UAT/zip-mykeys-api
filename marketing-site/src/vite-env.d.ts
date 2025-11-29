/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MYKEYS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}



