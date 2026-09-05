/// <reference types="node" />
/**
 * vitest (Node) 에서 OpenCascade wasm 을 한 번 로드해 replicad 에 주입한다.
 * replicad 자체 테스트(packages/replicad/__tests__/setup.ts)와 같은 방식이되,
 * wasm 파일 경로를 locateFile 로 명시적으로 준다.
 */
import { createRequire } from "node:module";
import { beforeAll } from "vitest";
import opencascade from "replicad-opencascadejs";
import { setOC } from "replicad";

const require = createRequire(import.meta.url);
export const WASM_PATH: string = require.resolve("replicad-opencascadejs/wasm");

declare global {
  // eslint-disable-next-line no-var
  var __replicadInit: boolean | undefined;
  // eslint-disable-next-line no-var
  var __wasmLoadMs: number | undefined;
}

beforeAll(async () => {
  if (globalThis.__replicadInit) return;
  const t0 = performance.now();
  const OC = await opencascade({ locateFile: () => WASM_PATH });
  setOC(OC);
  globalThis.__wasmLoadMs = performance.now() - t0;
  globalThis.__replicadInit = true;
});
