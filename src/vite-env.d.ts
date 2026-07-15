/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_ALLOWED_DOMAIN: string;
  readonly VITE_DEFAULT_SPREADSHEET_ID: string;
  readonly VITE_ADMIN_EMAILS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
