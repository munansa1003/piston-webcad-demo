# CLAUDE.md — 피스톤 파라메트릭 WebCAD 데모

이 리포는 "브라우저 안에서 OpenCascade(WASM) 커널로 피스톤 3D를 파라메트릭하게 다시 만들고 STEP/STL로 내려받는 것"이
실제로 되는지 확인하는 **실현 가능성 데모**다. 정식 제품이 아니다. 예쁘게보다 "돌아가고, 검증되고, 재현되는" 것이 우선.

## 스택 (고정 — 바꾸지 말 것)
- Vite 8 + React 18 + TypeScript strict
- replicad 1.1 + replicad-opencascadejs 1.1 (커널, single-thread wasm) + replicad-threejs-helper 1.0
- three 0.170 + @react-three/fiber 8 + @react-three/drei 9 (React 18 호환 조합. r3f 9/drei 10 은 React 19 전용이므로 올리지 말 것)
- comlink (워커 RPC), vitest (Node 에서 커널 테스트)
- 스타일은 `src/styles.css` 한 파일. Tailwind·UI 라이브러리·상태관리 라이브러리 금지.
- 백엔드·DB·로그인·AI 호출 없음. 100% 정적 사이트.
- 위 목록 외 라이브러리 추가 금지 (`@types/*` 같은 타입 선언만 예외).

## 구조
```
src/cad/params.ts        파라미터 타입·기본값·범위·유도값·규칙검사 (순수 함수, 커널 무관)
src/cad/urlState.ts      파라미터 ↔ URL 쿼리 (순수 함수)
src/cad/errors.ts        wasm 예외(WebAssembly.Exception) → OC.getExceptionMessage 로 읽을 수 있는 메시지
src/cad/sketch.ts        2D 단면도·평면도 생성 (derive 만 사용, 커널 무관 순수 함수)
src/cad/piston.ts        형상 생성 8단계 (replicad). 단계별 함수, 실패 시 "[단계 N: 이름]" 오류
src/worker/cadApi.ts     CAD API 구현 createCadApi(loadOC) — 워커/단일 파일 빌드 공용
src/worker/cad.worker.ts wasm 1회 로드(locateFile) + comlink expose: init/generate/exportSTEP/exportSTL/hasCached
src/standalone/          단일 파일(아티팩트) 빌드 전용: 내장 wasm(gzip+base64) 로더, 메인 스레드 클라이언트 (정식 앱에서 import 금지)
src/worker/api.ts        워커 ↔ 메인 공유 타입 (메인 스레드는 replicad 를 import 하지 않는다)
src/worker/client.ts     워커 인스턴스 1개 (파라미터 변경마다 재시작 금지)
src/ui/App.tsx           상태 머신(커널 로딩/생성 중/오류), 300ms 디바운스, 대기열, URL 동기화
src/ui/ParamPanel.tsx    슬라이더+숫자 입력, 경고, 초기값 복원, 링크 복사
src/ui/Readout.tsx       체적/질량/시간/면수 + STEP/STL 다운로드
src/ui/SketchView.tsx    2D 도면 렌더 + 치수 클릭 편집 (파라미터 → 3D 재생성)
src/ui/ProjectionView.tsx 커널 투상도 (drawProjection, 숨은선 제거)
src/ui/FeatureTree.tsx   형상 생성 8단계 스펙 트리
src/ui/Viewer.tsx        r3f 뷰어 (면+모서리, OrbitControls, 축/기즈모, 자동 프레이밍)
tests/                   vitest (Node). setup.ts 가 wasm 을 locateFile 로 로드해 setOC
docs/screenshot.png      헤드리스 Chromium 스크린샷
```

## 규칙
- 형상 생성 순서(몸통→속 파기→슬리퍼 스커트→핀 보스 fuse→핀 구멍→링 홈→밸브 포켓→배유 구멍)는 불리언 실패를 피하기 위한 순서다. 바꾸지 말 것.
- 필렛 금지. 챔퍼는 크라운 바깥 모서리 1곳만 try/catch.
- export 는 워커에 캐시된 마지막 성공 solid 로만 처리 (재생성 금지).
- 테스트 통과를 위해 검증 조건(면 ≥ 40, 체적 80k~120k, STEP > 50k 자 …)을 낮추지 말 것.
- 애매한 결정은 `DECISIONS.md` 에 한 줄씩 기록.

## 검증 명령 (전부 통과해야 완료)
```
npm run typecheck   # tsc --noEmit, 오류 0
npm run build       # vite build → dist/
npm test            # vitest run (Node 에서 wasm 로드, ~10초)
npm run build:standalone   # (선택) 단일 HTML 파일 → dist-standalone/, claude.ai 아티팩트 게시용
```
브라우저 확인은 전역 설치된 playwright + `/opt/pw-browsers` Chromium 으로 `vite preview` 를 열어 확인한다 (앱 의존성 아님).

## 알아둘 것
- `npm install` 은 `.npmrc` 의 `legacy-peer-deps=true` 로 동작한다 (npm 10.9 arborist 버그 회피).
- wasm(약 23 MB, gzip 약 7.3 MB)은 워커에서 `replicad-opencascadejs/wasm?url` 로 URL 만 받아 `locateFile` 로 로드한다.
- replicad 의 `angularTolerance` 는 라디안이다 (15° → `15 * DEG2RAD`).
- 2D 도면은 커널을 쓰지 않는다. `sketch.ts` 는 `derive(params)` 만 보고 그리므로 워커를 기다리지 않고 즉시 갱신된다.
- 투상도만 커널을 쓴다 (`drawProjection`). 캐시된 마지막 성공 solid 에서 뽑으며 재생성하지 않는다.
