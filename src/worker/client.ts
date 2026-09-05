/**
 * 메인 스레드용 워커 클라이언트. 워커는 앱 생명주기 동안 한 번만 만든다 (파라미터 변경마다 재시작 금지).
 */
import { wrap, type Remote } from "comlink";
import type { CadWorkerApi } from "./api";

let remote: Remote<CadWorkerApi> | null = null;

export function getCadWorker(): Remote<CadWorkerApi> {
  if (!remote) {
    const worker = new Worker(new URL("./cad.worker.ts", import.meta.url), {
      type: "module",
      name: "cad-worker",
    });
    remote = wrap<CadWorkerApi>(worker);
  }
  return remote;
}
