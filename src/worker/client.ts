/**
 * 메인 스레드용 워커 클라이언트. 워커는 앱 생명주기 동안 한 번만 만든다 (파라미터 변경마다 재시작 금지).
 * 워커 스크립트 로드/최상위 실행 실패는 comlink 가 감지하지 못하므로 error 이벤트를 따로 받아 init() 과 race 한다.
 */
import { wrap, type Remote } from "comlink";
import type { CadWorkerApi } from "./api";

let remote: Remote<CadWorkerApi> | null = null;
let failure: Promise<never> | null = null;

function create(): void {
  const worker = new Worker(new URL("./cad.worker.ts", import.meta.url), {
    type: "module",
    name: "cad-worker",
  });
  failure = new Promise<never>((_, reject) => {
    worker.addEventListener("error", (e) => {
      reject(new Error(`워커 오류: ${e.message || "스크립트를 불러오지 못했습니다"}`));
    });
    worker.addEventListener("messageerror", () => reject(new Error("워커 메시지 역직렬화 실패")));
  });
  failure.catch(() => {
    /* 처리되지 않은 거부 경고 방지. 실제 처리는 workerFailure() 를 race 하는 쪽에서 */
  });
  remote = wrap<CadWorkerApi>(worker);
}

export function getCadWorker(): Remote<CadWorkerApi> {
  if (!remote) create();
  return remote as Remote<CadWorkerApi>;
}

/** 워커가 로드/실행에 실패하면 거부되는 Promise (성공 시에는 영원히 pending). init() 과 Promise.race 로 사용. */
export function workerFailure(): Promise<never> {
  if (!failure) create();
  return failure as Promise<never>;
}
