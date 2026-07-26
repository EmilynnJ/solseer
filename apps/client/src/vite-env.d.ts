/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN: string;
  readonly VITE_NEON_AUTH_URL: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_FACEBOOK_GROUP_URL: string;
  readonly VITE_DISCORD_INVITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
