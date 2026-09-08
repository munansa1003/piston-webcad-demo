import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Viewer from "./Viewer";
import SketchView from "./SketchView";
import ProjectionView from "./ProjectionView";
import FeatureTree, { FEATURES, parseFailedStep } from "./FeatureTree";
import ParamPanel from "./ParamPanel";
import Readout from "./Readout";
import { getCadWorker, workerFailure } from "../worker/client";
import {
  DEFAULT_PARAMS,
  checkRules,
  derive,
  exportFileName,
  type BooleanParamKey,
  type NumericParamKey,
  type PistonParams,
} from "../cad/params";
import { paramsToQuery, queryToParams } from "../cad/urlState";
import { buildSketches } from "../cad/sketch";
import type { GenerateResult, ProjectionPlaneName, ProjectionResult } from "../worker/api";
import { downloadBlob } from "./download";

type KernelState = { kind: "loading" } | { kind: "ready"; loadMs: number } | { kind: "error"; message: string };
type GenState = { kind: "idle" } | { kind: "generating" } | { kind: "error"; message: string };

interface GenRequest {
  params: PistonParams;
  cutaway: boolean;
}

const DEBOUNCE_MS = 300;

type ViewMode = "split" | "sketch" | "solid";

/** 형상에 영향을 주는 파라미터만 (density 는 질량 계산에만 쓰이므로 재생성 불필요) + 절개 보기 여부 */
function requestKey(req: GenRequest): string {
  const { density: _density, ...rest } = req.params;
  return JSON.stringify(rest) + (req.cutaway ? "#cutaway" : "");
}

function isDefaultParams(p: PistonParams): boolean {
  return (Object.keys(DEFAULT_PARAMS) as (keyof PistonParams)[]).every((k) => p[k] === DEFAULT_PARAMS[k]);
}

function initialParams(): PistonParams {
  if (typeof window === "undefined") return { ...DEFAULT_PARAMS };
  return queryToParams(window.location.search);
}

export default function App() {
  const [kernel, setKernel] = useState<KernelState>({ kind: "loading" });
  const [gen, setGen] = useState<GenState>({ kind: "generating" });
  const [params, setParams] = useState<PistonParams>(initialParams);
  const [cutaway, setCutaway] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  /** result 가 만들어진 요청 키 (마지막 성공본) */
  const [resultKey, setResultKey] = useState<string>("");
  const [frameRequest, setFrameRequest] = useState(0);
  const [exporting, setExporting] = useState<"step" | "stl" | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [sketchIndex, setSketchIndex] = useState(0);
  const [highlightParam, setHighlightParam] = useState<NumericParamKey | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null);
  const [projPlane, setProjPlane] = useState<ProjectionPlaneName>("front");
  const [projection, setProjection] = useState<ProjectionResult | null>(null);
  const [projBusy, setProjBusy] = useState(false);
  const [projError, setProjError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(true);

  const busyRef = useRef(false);
  const pendingRef = useRef<GenRequest | null>(null);
  const latestRef = useRef<GenRequest>({ params, cutaway });
  latestRef.current = { params, cutaway };
  /** 캐시된(마지막 성공) solid 를 만든 파라미터 — 내보내기 파일명은 이것으로 짓는다 */
  const resultParamsRef = useRef<PistonParams | null>(null);
  /** 첫 생성 시도 이후에는 항상 디바운스를 적용 */
  const firstAttemptRef = useRef(false);
  /** 마지막으로 실제 시도한 요청 키 — 같은 값으로 실패한 뒤 자동 재시도(무한 루프)를 막는다 */
  const lastAttemptKeyRef = useRef("");
  /** 생성이 진행 중이면 투상도 요청을 미룬다 */
  const stalePending = useRef(false);

  const warnings = useMemo(() => checkRules(params), [params]);
  // 2D 도면은 3D 와 같은 유도값에서 만들어지므로 커널 없이 즉시 갱신된다
  const sketches = useMemo(() => buildSketches(params, derive(params)), [params]);
  const showProjection = sketchIndex >= sketches.length;
  const sketch = sketches[Math.min(sketchIndex, sketches.length - 1)] ?? sketches[0]!;
  const failedStep = parseFailedStep(gen.kind === "error" ? gen.message : null);
  const featureParams = useMemo(() => {
    if (selectedFeature === null) return null;
    return FEATURES.find((f) => f.step === selectedFeature)?.params ?? null;
  }, [selectedFeature]);

  /** 한 번에 하나만 생성. 진행 중이면 최신 요청만 대기열에 남긴다. */
  const runGenerate = useCallback(async (req: GenRequest) => {
    if (busyRef.current) {
      pendingRef.current = req;
      return;
    }
    busyRef.current = true;
    stalePending.current = true;
    firstAttemptRef.current = true;
    lastAttemptKeyRef.current = requestKey(req);
    setGen({ kind: "generating" });
    let ok = false;
    try {
      const r = await getCadWorker().generate(req.params, { cutaway: req.cutaway });
      resultParamsRef.current = req.params;
      setResult(r);
      setResultKey(requestKey(req));
      ok = true;
    } catch (err) {
      // 실패해도 마지막 성공 모델(result)은 유지
      setGen({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      busyRef.current = false;
      stalePending.current = pendingRef.current !== null;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next && (!ok || requestKey(next) !== requestKey(req))) {
        // 대기 중인 최신 요청으로 곧바로 이어서 생성 ("준비됨" 으로 바꾸지 않음)
        void runGenerate(next);
      } else if (ok) {
        setGen({ kind: "idle" });
      }
    }
  }, []);

  // 커널 로드 (1회)
  useEffect(() => {
    let cancelled = false;
    Promise.race([getCadWorker().init(), workerFailure()])
      .then(({ loadMs }) => {
        if (cancelled) return;
        setKernel({ kind: "ready", loadMs });
        // 첫 생성은 아래 디바운스 효과가 (지연 없이) 수행한다
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setKernel({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 파라미터/절개 변경 → 300ms 디바운스 후 자동 재생성 (형상에 영향 있는 경우만). 첫 생성은 지연 없이.
  // resultKey 도 의존성에 넣어, 생성 중에 파라미터가 바뀌었다 돌아온 경우(표시 모델 ≠ 현재 값)도 놓치지 않는다.
  const currentKey = requestKey({ params, cutaway });
  useEffect(() => {
    if (kernel.kind !== "ready") return;
    if (currentKey === resultKey) {
      // 표시 중인 모델이 현재 값과 일치. 다른 값에서 난 실패 상태만 정리한다.
      if (gen.kind === "error" && !busyRef.current) setGen({ kind: "idle" });
      return;
    }
    // 같은 값으로 이미 실패했으면 값이 바뀔 때까지 재시도하지 않는다
    if (gen.kind === "error" && currentKey === lastAttemptKeyRef.current) return;
    const delay = firstAttemptRef.current ? DEBOUNCE_MS : 0;
    const id = window.setTimeout(() => void runGenerate(latestRef.current), delay);
    return () => window.clearTimeout(id);
  }, [currentKey, resultKey, gen.kind, kernel.kind, runGenerate]);

  // 파라미터 → URL 쿼리스트링 (기본값과 다른 값만). 링크로 공유 가능.
  useEffect(() => {
    const q = paramsToQuery(params);
    const url = `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", url);
    }
  }, [params]);

  // 투상도는 커널이 캐시된 solid 에서 뽑는다. 탭을 열었을 때·모델이 바뀌었을 때만 요청.
  useEffect(() => {
    if (!showProjection || viewMode === "solid" || resultKey === "" || stalePending.current) return;
    let cancelled = false;
    setProjBusy(true);
    setProjError(null);
    getCadWorker()
      .project(projPlane)
      .then((r) => {
        if (!cancelled) setProjection(r);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setProjection(null);
          setProjError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setProjBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showProjection, viewMode, projPlane, resultKey]);

  const onNumberChange = useCallback((key: NumericParamKey, value: number) => {
    setParams((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);
  const onBooleanChange = useCallback((key: BooleanParamKey, value: boolean) => {
    setParams((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);
  const onReset = useCallback(() => setParams({ ...DEFAULT_PARAMS }), []);

  const onCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("링크를 복사하세요:", window.location.href);
    }
  }, []);

  const exportFile = useCallback(async (kind: "step" | "stl") => {
    setExporting(kind);
    setExportError(null);
    try {
      const worker = getCadWorker();
      const blob = kind === "step" ? await worker.exportSTEP() : await worker.exportSTL();
      // 파일명은 실제로 내보내는 캐시 solid 의 파라미터 기준 (아직 재생성 전인 최신 입력값이 아님)
      const named = resultParamsRef.current ?? latestRef.current.params;
      await downloadBlob(blob, exportFileName(named, kind));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(null);
    }
  }, []);

  const stale = result !== null && currentKey !== resultKey;

  return (
    <div className="app">
      <header className="app-header">
        <h1>피스톤 파라메트릭 WebCAD 데모</h1>
        <div className="status" data-testid="status" aria-live="polite">
          {kernel.kind === "loading" && <span className="badge badge-loading">커널(wasm) 로딩 중…</span>}
          {kernel.kind === "error" && <span className="badge badge-error">커널 오류: {kernel.message}</span>}
          {kernel.kind === "ready" && gen.kind === "generating" && <span className="badge badge-busy">생성 중…</span>}
          {kernel.kind === "ready" && gen.kind === "idle" && (
            <span className="badge badge-ok">준비됨 · 커널 {Math.round(kernel.loadMs)} ms</span>
          )}
          {kernel.kind === "ready" && gen.kind === "error" && (
            <span className="badge badge-error" data-testid="gen-error">
              생성 실패 (마지막 성공 모델 유지): {gen.message}
            </span>
          )}
          {exportError && (
            <span className="badge badge-error" data-testid="export-error">
              내보내기 실패: {exportError}
            </span>
          )}
        </div>
      </header>

      <div className="layout">
        <div className={`stage stage-${viewMode}`} data-testid="stage">
          <div className="stage-bar">
            <div className="segmented" role="group" aria-label="보기 모드">
              {([
                ["split", "2D + 3D"],
                ["sketch", "2D 도면"],
                ["solid", "3D"],
              ] as [ViewMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`seg${viewMode === mode ? " seg-on" : ""}`}
                  aria-pressed={viewMode === mode}
                  onClick={() => setViewMode(mode)}
                  data-testid={`view-${mode}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {viewMode !== "solid" && (
              <div className="segmented" role="group" aria-label="도면 선택">
                {sketches.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`seg${sketchIndex === i ? " seg-on" : ""}`}
                    aria-pressed={sketchIndex === i}
                    onClick={() => setSketchIndex(i)}
                  >
                    {i === 0 ? "단면도" : "평면도"}
                  </button>
                ))}
                <button
                  type="button"
                  className={`seg${showProjection ? " seg-on" : ""}`}
                  aria-pressed={showProjection}
                  onClick={() => setSketchIndex(sketches.length)}
                  data-testid="tab-projection"
                >
                  투상도
                </button>
              </div>
            )}
          </div>

          <div className="stage-body">
            {viewMode !== "solid" && (
              <section className="pane pane-sketch" data-testid="sketch" aria-label="2D 도면">
                {showProjection ? (
                  <ProjectionView
                    projection={projection}
                    plane={projPlane}
                    onPlaneChange={setProjPlane}
                    busy={projBusy}
                    error={projError}
                    showHidden={showHidden}
                    onToggleHidden={setShowHidden}
                  />
                ) : (
                  <SketchView
                    sketch={sketch}
                    onChangeParam={(k, v) => onNumberChange(k, v)}
                    highlightParam={highlightParam}
                    onHoverParam={setHighlightParam}
                    stale={false}
                  />
                )}
              </section>
            )}
            {viewMode !== "sketch" && (
              <section className="pane viewer" data-testid="viewer" aria-label="3D 뷰어">
                <Viewer result={result} frameRequest={frameRequest} />
                <div className="viewer-tools">
                  <button className="btn" type="button" onClick={() => setFrameRequest((n) => n + 1)}>
                    뷰 맞춤
                  </button>
                  <button
                    className={`btn${cutaway ? " btn-active" : ""}`}
                    type="button"
                    aria-pressed={cutaway}
                    onClick={() => setCutaway((c) => !c)}
                    data-testid="cutaway"
                  >
                    1/4 절개 {cutaway ? "켜짐" : "꺼짐"}
                  </button>
                </div>
                {kernel.kind === "loading" && <div className="overlay">커널(wasm) 로딩 중… (약 23 MB)</div>}
                {kernel.kind === "ready" && gen.kind === "generating" && !result && <div className="overlay">생성 중…</div>}
                {result && cutaway && !stale && !result.cutawayApplied && (
                  <div className="viewer-hint">절개 불리언이 실패해 전체 모델을 표시합니다</div>
                )}
              </section>
            )}
          </div>
        </div>

        <aside className={`panel${panelOpen ? "" : " panel-collapsed"}`} aria-label="파라미터 패널">
          <button
            className="panel-toggle"
            type="button"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((o) => !o)}
            data-testid="panel-toggle"
          >
            <span>파라미터 ({warnings.length > 0 ? `경고 ${warnings.length}` : "정상"})</span>
            <span aria-hidden="true">{panelOpen ? "▾" : "▸"}</span>
          </button>
          <div className="panel-body" hidden={!panelOpen}>
            {warnings.length > 0 && (
              <ul className="warnings" role="alert" data-testid="warnings">
                {warnings.map((w) => (
                  <li key={w.code}>⚠ {w.message}</li>
                ))}
              </ul>
            )}
            <Readout
              result={result}
              density={params.density}
              exporting={exporting}
              canExport={result !== null}
              onExport={(k) => void exportFile(k)}
              stale={stale}
            />
            <FeatureTree
              valvePockets={params.valvePockets}
              drainHoles={params.drainHoles}
              failedStep={failedStep}
              chamferApplied={result?.chamferApplied ?? true}
              selected={selectedFeature}
              onSelect={setSelectedFeature}
              onToggle={onBooleanChange}
            />
            <ParamPanel
              params={params}
              highlightParam={highlightParam}
              featureParams={featureParams}
              onHoverParam={setHighlightParam}
              onNumberChange={onNumberChange}
              onBooleanChange={onBooleanChange}
              onReset={onReset}
              onCopyLink={() => void onCopyLink()}
              copied={copied}
              isDefault={isDefaultParams(params)}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
