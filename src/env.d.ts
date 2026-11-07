/// <reference types="astro/client" />
type Runtime = import('@astrojs/cloudflare').Runtime;
declare namespace App {
  interface Locals extends Runtime {}
}

// 빌드마다 바뀌는 배포 판 번호 (astro.config.mjs vite.define)
declare const __BUILD_ID__: string;
