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
- (아티팩트) 아티팩트 뷰어는 일반 다운로드 링크를 막고 `downloads` 기능으로만 파일을 건네며 허용 확장자에 .step/.stl 이 없다. 단일 파일 빌드는 STEP(원래 텍스트)과 ASCII STL 을 `.step.txt` / `.stl.txt` 로 저장하게 하고(받은 뒤 `.txt` 제거), 정식 앱은 그대로 바이너리 STL + 일반 다운로드.

## A경로 시제품 (2D 스케치 ↔ 3D 연동)
- 2D 단면도·평면도는 `src/cad/sketch.ts` 에서 `derive(params)` 만으로 계산한다 (커널 무관, 순수 함수). 3D 와 같은 유도값을 쓰므로 도면과 모델이 어긋날 수 없다 — A경로(템플릿 파라메트릭)의 핵심 근거.
- 단면 재료 영역은 z 구간별 x 구간(사각형)으로 만든 뒤 격자 마칭으로 합집합 외곽선을 뽑는다(`unionRects`). 축 정렬 사각형만 다루므로 다각형 클리핑 라이브러리가 필요 없다. 바깥 루프는 반시계, 구멍은 시계 방향으로 나와 `fill-rule: evenodd` 로 해칭이 정확히 채워진다.
- 치수는 클릭하면 그 자리에서 값을 고칠 수 있고, 고치면 같은 파라미터로 3D 가 다시 만들어진다 (CATIA 의 치수 더블클릭에 대응).
- 좁은 치수(홈 폭 1.2 mm 등)는 화살표를 바깥에서 안으로 돌리고 글자를 옆으로 뺀다. 랜드/홈 체인은 두 단(R+10, R+27)으로 엇갈리게 배치해 겹침을 피한다.
- 투상도(`ProjectionView`)는 replicad 의 `drawProjection` 으로 커널이 3D 솔리드에서 직접 뽑는다. 숨은선 제거(HLR)까지 커널이 하므로 형상이 복잡해져도 도면이 자동으로 나온다. 기본값에서 정면도 379 ms, 보이는 선 34 · 숨은선 81.
- 커널 능력 확인 (검증용 probe 로 실측 후 삭제): `drawProjection` 정면/평면/우측면 260~410 ms · 절단면 HLR 79 ms · 간섭 체적 계산 93 ms · 관성 모멘트/회전 반지름은 raw OC 로 접근 가능(`MatrixOfInertia`·`PrincipalProperties` 는 타입 미바인딩으로 막힘) · STEP 은 AP242 스키마로 PRODUCT/NAME/COLOUR 포함 · STEP 재가져오기 116 ms 에 면 58개 보존.
- 피처 트리(`FeatureTree.tsx`)는 8단계를 CATIA 스펙 트리처럼 보여주고, 실패한 단계는 오류 메시지의 "[단계 N:" 에서 뽑아 표시한다. 단계를 고르면 그 단계가 쓰는 파라미터만 패널에서 밝게 남는다.
- (설계표 실현 가능성, 실측) 파라미터 40행을 헤드리스로 연속 생성: 40/40 성공, 합계 26.8 s, 행당 평균 671 ms (최소 504 · 최대 1,589). 설계표(배치 생성)는 A경로에서 그대로 된다. 다만 브라우저에서 돌리면 단일 스레드라 40행에 27초가 걸리므로 진행률 표시와 취소가 필요하다.
- (설계표 주의점 1) `clampParams` 는 범위를 벗어난 행을 조용히 잘라낸다. D=130·pinD=40 을 넣으면 D=110·pinD=30 으로 바뀌어 "성공" 한다. 설계표 UI 는 잘린 행을 반드시 표시해야 한다 (요청값 ≠ 생성값).
- (설계표 주의점 2) 규칙 경고가 있어도 형상은 만들어진다. rodGap=36·bossWall=10·bossRecess=8·D=60 은 "보스 폭이 남지 않음" 경고가 뜬 채로 solid 1개(면 94)를 만든다. 즉 "생성 성공" 은 "설계로 타당" 을 뜻하지 않으므로, 배치 결과표에는 경고 열을 함께 내보내야 한다.

## CATIA 어셈블리 화면 대비 커널 능력 실측 (probe 후 삭제)
- **트위스트 익형 블레이드(팬/터빈 블레이드)는 만들어진다.** NACA 4자리 익형 9단면에 코드 테이퍼와 스태거 각 법칙(허브 58° → 팁 6°)을 주고 `drawPointsInterpolation` → `sketchOnPlane` → `loftWith` 로 로프트: 단면 생성 118 ms + 로프트 93 ms, 결과는 솔리드 1개·면 4개·체적 368,870 mm³, 면 종류 `BSPLINE_SURFACE` + `PLANE`. 즉 CATIA Multi-Section Solid 급 형상이 이 스택에서 나온다.
- **자유곡면의 진짜 비용은 생성이 아니라 메시화다.** 같은 블레이드: tolerance 0.2 → 4,000 ms / 삼각형 141,760개, 0.5 → 559 ms / 33,722개, 1.0 → 194 ms / 13,100개. 뷰어 성능은 공차로 조절해야 하고, 블레이드가 많은 어셈블리는 GPU 인스턴싱이 필수다.
- **어셈블리 STEP 이 이름·색·제품 구조와 함께 나간다.** `exportSTEP([{shape,name,color}, ...])` 로 3개 부품 내보내기 87 ms, 250,099자, `PRODUCT` 3개 · `SHAPE_REPRESENTATION` 3개 · `COLOUR_RGB` 3개, 이름 3개 모두 보존. AP242 제품 구조를 쓰므로 CATIA/NX 로 넘길 때 부품이 따로 들어간다.
- **간섭(클래시) 검사는 불리언 교차로 바로 된다.** 피스톤 vs 과대 핀 교차 체적 5,296.1 mm³ 를 77 ms 에 계산.
- 결론: 그 스크린샷에서 어려운 것은 형상(블레이드)도, 데이터 교환(어셈블리 STEP)도, 간섭 검사도 아니다. 어려운 것은 (a) 3D 어셈블리 구속 솔버, (b) 자유 작도용 2D 구속 솔버와 토폴로지 네이밍, (c) 대형 어셈블리 성능, (d) PLM(ENOVIA) 연동이다.
- **어셈블리 STEP 의 한계와 해결 경로 (실측).** replicad 의 `exportSTEP([여러 shape])` 는 사실 **진짜 어셈블리 트리가 아니다**: 세 부품을 넣으면 `PRODUCT_DEFINITION` 3개 · `MANIFOLD_SOLID_BREP` 3개 · `PRESENTATION_STYLE_ASSIGNMENT` 3개는 나오지만 `NEXT_ASSEMBLY_USAGE_OCCURRENCE` 0개 · `CONTEXT_DEPENDENT_SHAPE_REPRESENTATION` 0개 — 즉 부품이 나란히 놓인 평면 구조이고, 다시 읽으면 Compound 하나로 들어온다(86 ms). CATIA 의 "Compressor.1 / Compressor 2.1" 같은 **인스턴스(occurrence)** 개념이 없다.
- 다만 raw OpenCascade 의 XDE 계층이 이 wasm 빌드에 **바인딩되어 있다**: `TDocStd_Document`, `XCAFDoc_DocumentTool`, `XCAFDoc_ShapeTool`(`AddShape`·`AddComponent`·`SetLocation`·`FindComponent`·`RemoveComponent`·SHUO 관련), `XCAFDoc_ColorTool`, `XCAFDoc_LengthUnit`, `STEPCAFControl_Writer`. 하나의 부품 정의를 위치만 바꿔 여러 번 배치하는 진짜 어셈블리 트리는 이 API 로 만들 수 있다 — 연구 과제가 아니라 구현 과제.
- 규모 감각 (단순 형상 기준): 부품 N개를 복제·이동·메시하는 데 N=10 → 117 ms, N=50 → 399 ms, N=200 → 622 ms / 삼각형 38,400개. 형상이 단순하면 수백 개도 무난하고, 블레이드처럼 자유곡면이면 메시 공차와 GPU 인스턴싱이 관건이다.

## 서피싱(블레이드) 정밀 실측 — 앞선 낙관 판정을 정정
- **단면을 스플라인으로 주는 것이 결정적이다.** 같은 블레이드를 폴리라인 단면으로 로프트하면 면 122개·로프트 872 ms, 스플라인 단면(`drawPointsInterpolation`)으로 주면 **면 3개·로프트 29 ms** (체적은 46,943 mm³ 로 동일). 익형 좌표를 그대로 폴리라인으로 넣으면 안 된다.
- **곡면 연속성은 C0 에 머문다 — 이것이 GSD 와의 진짜 차이다.** raw `BRepOffsetAPI_ThruSections` 에 연속성 C1/C2 를 요구해도 결과는 `GeomAbs_C0`, U 차수 1 로 변하지 않았다 (plain 139 ms / contC1 35 ms / contC2 29 ms, 셋 다 동일 체적·동일 차수). `smoothing` 을 켜면 곡면이 바뀌긴 하지만 2,835 ms (가중치까지 주면 5,535 ms) 로 느려지고 체적도 47,110~47,250 으로 흔들린다. CATIA GSD 가 주는 G2 품질은 이 경로로 안 나온다.
- **블레이드 루트 필렛이 실패한다 — 가장 중요한 부정적 결과.** 블레이드를 허브에 fuse 하는 것은 된다(1,021 ms, 면 5개, valid). 그러나 루트 필렛은 반경 1·2·4·8 mm **전부** `WebAssembly.Exception` 으로 실패했다 (각각 11.1 s / 1.2 s / 1.9 s / 2.1 s 소요 후 실패). 터보기계 부품에서 루트 필렛은 응력 집중 때문에 빼놓을 수 없는 형상이므로, 이 스택으로 "실제로 쓸 수 있는 블레이드"를 만들려면 필렛을 형상 생성 단계에 미리 녹여 넣는 설계(예: 단면 자체에 루트 라운드를 포함)가 필요하다.
- **가이드 커브 스윕은 raw `BRepOffsetAPI_MakePipeShell` 로 된다** (보조 스파인 포함 122 ms, 면 6개). replicad 의 `genericSweep` 에 보조 스파인을 주는 경로는 실패한다.
- **G2 채움 패치(`BRepOffsetAPI_MakeFilling`)는 실패한다.** 곡면 수선·연결 계열은 기대하지 말 것.
- **곡률 해석은 된다.** `Geom_Surface` 의 EvalD2 로 61×61=3,721 점의 가우스·평균 곡률을 91 ms 에 계산. 지브라/곡률 맵 같은 곡면 품질 검사 도구는 만들 수 있다.
- **블레이드 메시 비용 (공차별).** 0.05 → 1,615 ms / 삼각형 88,416개, 0.1 → 708 ms / 54,364개, 0.3 → 289 ms / 24,872개, 1.0 → 149 ms / 10,896개.
- **블레이드 24장 STEP**: 923 ms, 3,000,304자, `PRODUCT` 24개, `NEXT_ASSEMBLY_USAGE_OCCURRENCE` 0개 (역시 평면 구조).
- 정정된 결론: 블레이드의 **몸통 형상은 도달 가능**하지만, **루트 필렛과 G2 곡면 품질은 이 스택에서 도달 불가**다. 서피싱은 "된다"가 아니라 "형상은 되고 품질과 마무리는 안 된다"로 읽어야 한다.

## 서피싱 정정 — G2 는 도달 가능하다 (앞 절의 "G2 불가" 를 바로잡음)
- **원인은 `ThruSections` 가 아니라 단면 곡선의 차수였다.** replicad `make2dInerpolatedBSplineCurve` 의 기본값이 `degMin=1, degMax=3, tolerance=1e-3` 이고, `Geom2dAPI_PointsToBSpline.Init(pnts, degMin, degMax, GeomAbs_C2, tol)` 에 그대로 넘어간다 (`node_modules/replicad/dist/replicad.js:601,614`). 익형 좌표는 촘촘해서 **차수 1(폴리라인)로도 1e-3 을 만족**하므로 "BSPLINE_CURVE" 라는 이름만 남고 실제로는 꺾인 선이 된다.
- **실측 (같은 9단면 블레이드, `loft(..., {ruled:false})`)**: `{tolerance:1e-3}`(기본) → Udeg=1 · nUPoles=107 · `GeomAbs_C0` · `IsCNu(1)=false`. 공차만 조여도(`1e-6`) → 여전히 Udeg=1 · C0. **`{tolerance:1e-6, degMax:5}` → Udeg=3 · Vdeg=7 · nUPoles=123 · `GeomAbs_C2` · `IsCNu(2)=true` · `IsCNv(2)=true`, 로프트 17 ms, valid=true.** `{tolerance:1e-3, degMin:3}` 로도 C2 가 나온다 (Udeg=3, 227 poles). 체적은 46,715~46,943 mm³ 로 0.5 % 안에서 움직인다.
- 즉 곡률연속(G2) 블레이드는 이 스택에서 **설정 한 줄**로 나온다. 반대로 아무 설정 없이 쓰면 "보기엔 매끈하지만 접선연속조차 아닌" 곡면이 나오는데 뷰어·메시·STEP 어디에서도 경고가 없다 — 서피싱 도구를 만든다면 `Continuity()`/`IsCNu` 를 읽어 사용자에게 표시해야 한다.
- 앞 절의 "`SetContinuity(C1/C2)` 를 줘도 안 바뀐다" 는 관찰 자체는 맞다. OCCT 는 `UseSmoothing` 이 켜졌을 때만 그 값을 쓰고, 켜면 15 ms → 2.3~5.2 s 가 된다. 정답은 스무딩이 아니라 입력 곡선 차수다.
- **루트 필렛은 여전히 불가 — C2 로 만들어도 마찬가지다.** C2 블레이드를 허브에 fuse 하는 것은 788 ms · 면 5개 · valid=true 로 되고 루트 모서리는 `BSPLINE_CURVE` 1개로 깨끗하게 잡힌다. 그러나 그 모서리에 `fillet(0.5)` 는 **110 초 안에 반환되지 않았다** (C0 블레이드에서는 1.2~11.1 s 뒤 예외). 던지느냐 매달리느냐만 달라진다.
- `loft` 의 replicad 기본값은 `ruled = true` 다. 블레이드는 반드시 `{ruled:false}` 로 불러야 한다.

### 위 정정을 직접 재현 확인 (독립 검증)
같은 9단면 블레이드, `loft(..., {ruled:false})`, `BRepAdaptor_Surface` 로 U 방향 차수와 연속성을 읽음:

| `drawPointsInterpolation` 설정 | 로프트 | U 차수 | U 연속성 | 체적 |
|---|---|---|---|---|
| 기본값 | 85 ms | 1 | `GeomAbs_C0` | 368,870 mm³ |
| `{tolerance: 1e-6}` | 38 ms | 3 | `GeomAbs_C2` | 364,930 mm³ |
| `{tolerance: 1e-6, degMax: 5}` | 35 ms | 3 | `GeomAbs_C2` | 371,415 mm³ |
| `{degMin: 3}` | 34 ms | 3 | `GeomAbs_C2` | 364,930 mm³ |

- 기본값의 U 차수가 **1** 이라는 것이 핵심이다. 이름은 BSPLINE 이지만 실제로는 꺾인 선이라 곡률이 정의되지 않는다.
- `degMin: 3` 한 줄이면 C2 가 나오고 로프트는 오히려 빨라진다 (85 → 34 ms).
- 체적이 1 % 남짓 달라진다. 기본값 쪽이 현(chord) 근사라 값이 다른 것이므로, **차수 설정은 품질 옵션이 아니라 형상 정의의 일부**로 다뤄야 한다.
- 결론: 이 스택에서 **G2 곡면은 도달 가능**하다. 앞 절의 "G2 불가" 는 취소한다. 단 **루트 필렛 불가는 그대로**이며 (C2 블레이드에서도 `fillet(0.5)` 가 110 초 내 미반환), 서피싱의 진짜 벽은 곡면 품질이 아니라 필렛·수선 계열이다.
