import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 단일 파일(아티팩트/오프라인) 빌드 설정. `node scripts/build-standalone.mjs` 가 사용한다.
 * - 워커 클라이언트를 메인 스레드 구현으로 alias
 * - 청크 하나 + CSS 하나로 내보내고, 스크립트가 HTML 에 인라인한다
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "three"],
    alias: [{ find: /^\.\.\/worker\/client$/, replacement: "/src/standalone/client.ts" }],
  },
  optimizeDeps: { exclude: ["replicad-opencascadejs"] },
  base: "./",
  build: {
    outDir: "dist-standalone",
    target: "es2022",
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 4000,
  },
});
