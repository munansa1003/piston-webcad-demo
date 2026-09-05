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
