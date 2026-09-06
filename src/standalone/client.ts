/**
 * 단일 파일(아티팩트) 빌드용 클라이언트 — 워커 대신 메인 스레드에서 같은 API 를 직접 실행한다.
 * vite.standalone.config.ts 의 alias 가 src/worker/client 를 이 파일로 바꿔치기한다.
 * (정식 앱은 워커를 쓴다. 아티팩트 환경은 외부 fetch 와 워커 스크립트 로드가 막혀 있어 이 변형이 필요하다.)
 */
import type { CadWorkerApi } from "../worker/api";
import { createCadApi } from "../worker/cadApi";
import { loadEmbeddedOC } from "./loadOC";

// 동기 형상 생성이 UI 를 막기 전에 "생성 중" 배지가 그려지도록 한 프레임 양보
const yieldToPaint = () => new Promise<void>((r) => setTimeout(r, 30));

let api: CadWorkerApi | null = null;

export function getCadWorker(): CadWorkerApi {
  if (!api) api = createCadApi(loadEmbeddedOC, { beforeBuild: yieldToPaint, stlBinary: false });
  return api;
}

/** 워커가 없으므로 영원히 pending (App 이 init() 과 race 하는 용도) */
export function workerFailure(): Promise<never> {
  return new Promise<never>(() => {});
}
