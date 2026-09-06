# DECISIONS

작업 중 내린 결정 목록 (한 줄씩, 시간순).

- 브랜치: 세션 하네스가 지정한 `claude/piston-parametric-webcad-demo-iok4q7` 에서 개발·푸시. 요청서의 `demo/webcad-v0` 이름으로도 동일 커밋을 푸시한다.
- React 18 고정이므로 참고 예제(React 19 + r3f 9)와 달리 `@react-three/fiber@8.18`, `@react-three/drei@9.122`, `three@0.170.0` 조합을 사용 (r3f 8 은 React 18 전용, drei 9 는 r3f 8 전용).
- TypeScript 는 7.x(Go 네이티브)가 아니라 검증된 `~5.9` 를 사용.
- npm 10.9 의 arborist 버그(`Cannot read properties of null (reading 'edgesOut')`, vitest 4.1.11 peer 체인)로 `npm install` 이 실패하여 `--legacy-peer-deps` 로 설치. `.npmrc` 에 `legacy-peer-deps=true` 를 두어 재현 가능하게 함.
- vitest 설정은 `vite.config.ts` 안의 `test` 필드에 둔다 (`vitest/config` 의 defineConfig). 별도 vitest.config 없음.
- 워커 생성은 `new Worker(new URL("./cad.worker.ts", import.meta.url), { type: "module" })` 방식 (참고 예제의 `?worker` 접미사 대신 TS 친화적인 표준 방식). 빌드 결과 동일하게 별도 청크 + wasm 에셋으로 나온다.
- wasm 은 `replicad-opencascadejs/wasm?url` 로 URL 만 받아 `opencascade({ locateFile })` 에 넘긴다 (예제와 동일). `optimizeDeps.exclude` 에 `replicad-opencascadejs` 를 넣음.
- 메시 `angularTolerance` 는 replicad/OCCT 가 라디안을 받으므로 15° 는 `15 * DEG2RAD` 로 넘긴다.
- 자동 카메라 프레이밍은 (1) 첫 모델, (2) 바운딩 박스 대각선이 20% 넘게 바뀔 때, (3) "뷰 맞춤" 버튼에서만 수행 — 슬라이더를 조금 움직일 때마다 시점이 튀지 않게.
- Playwright 는 앱 의존성에 넣지 않고, 컨테이너에 전역 설치된 playwright(1.56) + 사전 설치 Chromium 을 스크래치 스크립트에서 사용 (1절 "라이브러리 추가 금지" 준수).
- 불리언 도구 형상은 경계면과 정확히 겹치지 않도록 1 mm(EPS) 바깥으로 연장한다 (예: 속 파기 원기둥은 z=−1 에서 시작). 결과 형상은 스펙과 동일하고 OCCT 공면 불리언의 불안정성만 피한다.
- 링 홈의 안쪽 원기둥(R−depth)은 위아래로 EPS 만큼 더 길게 만들어 링 도구 형상이 깨끗한 환형이 되게 한다. 바깥 원기둥(R+2)은 홈 폭 그대로.
- 배유 구멍 원기둥은 중심이 아니라 벨트 안쪽 공동(반경 R−beltWall−1)에서 시작해 바깥(R+2)으로 관통한다 — "벽만 뚫으면 됨" 을 지키고 핀 보스를 건드리지 않기 위해.
- `xc = R·cos(panelAngle/2)` 를 스펙 그대로 구현했다. 기하학적으로는 ±X 쪽 잘려나가는 창의 각도가 panelAngle 이고, 남는 스커트 판(±Y)의 호는 180°−panelAngle 이다. 라벨은 스펙대로 "스커트 판 각도" 를 유지.
- 크라운 챔퍼는 `chamfer(0.8, e => e.inPlane("XY", TH).ofCurveType("CIRCLE"))` 로 상면 바깥 원 모서리만 선택. 실패 시 생략하고 리드아웃에 "생략" 힌트를 표시.
- 워커는 형상 생성 후 이전 캐시 solid 를 `delete()` 로 명시 해제한다 (wasm 힙 누수 방지).
- 절개 보기는 워커에서 표시용 메시만 사분면 박스로 cut 한다. 캐시 solid/체적/면수/내보내기는 전체 모델 기준.
- density 는 형상에 영향이 없으므로 재생성 키에서 제외하고 질량만 즉시 다시 계산한다.
- 생성 요청은 한 번에 하나만 워커로 보내고, 진행 중 들어온 변경은 최신 것 하나만 대기열에 남긴다 (슬라이더 드래그 시 밀린 생성이 쌓이지 않게). 연속 생성 사이에는 "준비됨" 으로 바꾸지 않는다.
- 첫 생성은 커널 준비 직후 디바운스 없이 실행 (init 완료 콜백과 디바운스 효과가 각각 생성을 시작해 같은 파라미터가 두 번 생성되던 문제를 제거).
- STL 은 바이너리(tolerance 0.05, angular 10°)로 내보낸다. 뷰어 메시는 스펙대로 tolerance 0.1 / 15°.
- 숫자 입력은 타이핑 중간 상태를 허용하고 범위 안의 유효한 값만 즉시 반영, blur/Enter 시 범위로 잘라낸다.
- URL 동기화는 기본값과 다른 키만 쿼리에 넣고 `history.replaceState` 로 갱신한다 (히스토리 오염 방지). 잘못된 값은 무시, 범위 밖은 clamp.
- 테스트용 `@types/node` 를 devDependency 로 추가 (tests/setup.ts 의 `node:module` 타입). 앱 코드에는 영향 없음 — `/// <reference types="node" />` 로 테스트 파일에만 스코프.
- (리뷰 반영) 규칙 경고는 패널 최상단(리드아웃보다 위)에 표시한다 — MUST 5 "패널 상단" 문구 그대로.
- (리뷰 반영) 내보내기 파일명은 슬라이더의 현재 값이 아니라 실제로 내보내는 캐시 solid 를 만든 파라미터로 짓는다 (재생성 전 클릭해도 파일명과 내용이 일치).
- (리뷰 반영) 자동 재생성 효과는 `resultKey` 도 의존성에 넣는다. 생성 중에 값을 바꿨다가 원래 값으로 되돌리면, 진행 중이던 다른 값의 결과가 표시된 채 재생성이 누락되던 버그 수정. 같은 값으로 실패한 뒤에는 값이 바뀔 때까지 자동 재시도하지 않는다 (무한 루프 방지).
- (리뷰 반영) 이 wasm 빌드는 네이티브 wasm 예외를 쓰므로 OCCT 실패가 `WebAssembly.Exception` 으로 온다. `src/cad/errors.ts` 의 `describeCadError` 가 `OC.getExceptionMessage` 로 풀어 단계 오류 메시지에 넣는다 (예: `[단계 2: 속 파기] OpenCascade: Standard_ConstructionError`).
- (리뷰 반영) 워커 스크립트 로드/최상위 실행 실패는 comlink 가 감지하지 못하므로 Worker `error` 이벤트를 `init()` 과 race 해 "커널 오류" 로 표시한다.
- (리뷰 반영) 절개 불리언이 실패하면 전체 모델을 표시하고 힌트를 띄운다. 메시 추출이 실패하면 새로 만든 solid 를 해제하고 `[단계 9: 메시 추출]` 오류를 던진다 (마지막 성공본 유지).
- (배포) Vercel 계정/토큰이 세션에 없고 GitHub Pages API 도 프록시가 막아, claude.ai 아티팩트로 바로 볼 수 있는 **단일 파일 빌드**를 추가했다 (`npm run build:standalone` → `dist-standalone/piston-webcad-standalone.html`, 약 10.4 MiB). wasm 은 gzip 후 base64 로 HTML 에 내장하고 브라우저의 `DecompressionStream` 으로 풀어 emscripten `wasmBinary` 로 넘긴다 (외부 요청 0건).
- (배포) 아티팩트 환경은 워커 스크립트 로드/외부 fetch 가 막혀 있어 단일 파일 빌드는 워커 대신 메인 스레드에서 같은 API(`createCadApi`)를 실행한다. 정식 앱(`npm run build`)은 그대로 워커를 쓴다 — "메인 스레드에서 replicad import 금지" 규칙은 정식 앱에만 적용.
- (구조) 워커 로직을 `src/worker/cadApi.ts` 의 `createCadApi(loadOC)` 팩토리로 분리해 워커와 단일 파일 빌드가 같은 코드를 쓴다.
