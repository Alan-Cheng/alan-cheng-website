/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_TOKEN?: string;
  readonly VITE_IMG_WORKER_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  glob(
    pattern: string,
    options: { as: 'raw'; eager: true }
  ): Record<string, string>;
}

