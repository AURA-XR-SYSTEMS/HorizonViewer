/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HORIZON_API_BASE_URL?: string
  readonly VITE_HORIZON_CONFIG_URL?: string
  readonly VITE_HORIZON_EXPORT_ID?: string
  readonly VITE_HORIZON_ENABLE_ADMIN_PANEL?: string
  readonly VITE_HORIZON_ADMIN_DEFAULT_WORKSPACE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
