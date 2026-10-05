/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly CMS_PASSWORD?: string;
  readonly VITE_CMS_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
