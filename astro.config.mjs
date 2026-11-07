import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  // 사이트 CSS는 HTML 안에 넣는다 — CSS 파일을 따로 받을 때까지 화면이 비는 시간을 없앤다
  build: { inlineStylesheets: 'always' },
  // 배포 판 번호: 페이지 캐시 이름에 붙인다
  vite: { define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) } },
});
