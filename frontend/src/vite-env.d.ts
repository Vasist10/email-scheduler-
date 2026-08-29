/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API base URL injected at build time (Docker build arg or .env file). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
