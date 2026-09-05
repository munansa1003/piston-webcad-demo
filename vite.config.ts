import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 참고: replicad 모노리포 packages/replicad-app-example/vite.config.js 와 같은 구조.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "three"],
  },
  optimizeDeps: {
    // wasm 글루 코드는 사전 번들링에서 제외 (locateFile 로 wasm 경로를 직접 준다)
    exclude: ["replicad-opencascadejs"],
  },
  worker: {
    format: "es",
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
  server: {
    port: 5173,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
