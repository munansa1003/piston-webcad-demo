/**
 * 단일 파일(아티팩트) 빌드용 OC 로더.
 * HTML 안의 <script id="wasm-gz" type="application/octet-stream"> 에 든 base64(gzip) 를
 * 브라우저 내장 DecompressionStream 으로 풀어 emscripten 의 wasmBinary 옵션으로 넘긴다 (fetch 없음).
 */
import opencascade from "replicad-opencascadejs";
import type { OpenCascadeInstance } from "replicad-opencascadejs";

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gunzip(bytes: Uint8Array): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("이 브라우저는 DecompressionStream 을 지원하지 않습니다 (iPadOS/Safari 16.4 이상 필요)");
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

export async function loadEmbeddedOC(): Promise<OpenCascadeInstance> {
  const el = document.getElementById("wasm-gz");
  if (!el || !el.textContent) throw new Error("내장 wasm 데이터(#wasm-gz)를 찾을 수 없습니다");
  const gz = base64ToBytes(el.textContent);
  const wasm = await gunzip(gz);
  return opencascade({ wasmBinary: new Uint8Array(wasm) });
}
