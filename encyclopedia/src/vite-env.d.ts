/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEPLOY_MODE?: 'local' | 'ghpages'
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
