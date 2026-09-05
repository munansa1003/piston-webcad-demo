/**
 * OpenCascade(wasm) 예외를 사람이 읽을 수 있는 문자열로.
 * 이 빌드는 네이티브 wasm 예외를 쓰므로 OCCT 실패는 `WebAssembly.Exception` 으로 던져진다 —
 * String() 하면 "[object WebAssembly.Exception]" 만 남으므로 OC.getExceptionMessage 로 풀어야 한다.
 */
import { getOC } from "replicad";

type OCWithExceptions = { getExceptionMessage?: (e: unknown) => unknown };

function tryGetOC(): OCWithExceptions | null {
  try {
    return getOC() as unknown as OCWithExceptions;
  } catch {
    return null;
  }
}

function isWasmException(err: unknown): boolean {
  const Ctor = (globalThis as { WebAssembly?: { Exception?: unknown } }).WebAssembly?.Exception;
  return typeof Ctor === "function" && err instanceof (Ctor as new () => unknown);
}

export function describeCadError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (isWasmException(err) || typeof err === "number") {
    const oc = tryGetOC();
    if (oc?.getExceptionMessage) {
      try {
        const m = oc.getExceptionMessage(err);
        const text = Array.isArray(m) ? m.map(String).filter(Boolean).join(": ") : String(m);
        if (text && text !== "[object WebAssembly.Exception]") return `OpenCascade: ${text}`;
      } catch {
        /* fall through */
      }
    }
    if (typeof err === "number") return `OpenCascade 예외 (코드 ${err})`;
    return "OpenCascade 예외 (메시지 없음)";
  }
  return String(err);
}
