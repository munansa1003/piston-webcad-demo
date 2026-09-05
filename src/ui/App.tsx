import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Viewer from "./Viewer";
import ParamPanel from "./ParamPanel";
import Readout from "./Readout";
import { getCadWorker } from "../worker/client";
import {
  DEFAULT_PARAMS,
  checkRules,
  exportFileName,
  type BooleanParamKey,
  type NumericParamKey,
  type PistonParams,
} from "../cad/params";
import type { GenerateResult } from "../worker/api";
import { downloadBlob } from "./download";

type KernelState = { kind: "loading" } | { kind: "ready"; loadMs: number } | { kind: "error"; message: string };
type GenState = { kind: "idle" } | { kind: "generating" } | { kind: "error"; message: string };

const DEBOUNCE_MS = 300;

/** 형상에 영향을 주는 파라미터만 (density 는 질량 계산에만 쓰이므로 재생성 불필요) */
function geometryKey(p: PistonParams): string {
  const { density: _density, ...rest } = p;
  return JSON.stringify(rest);
}

function isDefaultParams(p: PistonParams): boolean {
  return (Object.keys(DEFAULT_PARAMS) as (keyof PistonParams)[]).every((k) => p[k] === DEFAULT_PARAMS[k]);
}

export default function App() {
  const [kernel, setKernel] = useState<KernelState>({ kind: "loading" });
  const [gen, setGen] = useState<GenState>({ kind: "generating" });
  const [params, setParams] = useState<PistonParams>({ ...DEFAULT_PARAMS });
  const [result, setResult] = useState<GenerateResult | null>(null);
  /** result 가 만들어진 파라미터 (마지막 성공본) */
  const [resultKey, setResultKey] = useState<string>("");
  const [frameRequest, setFrameRequest] = useState(0);
  const [exporting, setExporting] = useState<"step" | "stl" | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const busyRef = useRef(false);
  const pendingRef = useRef<PistonParams | null>(null);
  const latestParamsRef = useRef(params);
  latestParamsRef.current = params;

  const warnings = useMemo(() => checkRules(params), [params]);

  /** 한 번에 하나만 생성. 진행 중이면 최신 파라미터만 대기열에 남긴다. */
  const runGenerate = useCallback(async (p: PistonParams) => {
    if (busyRef.current) {
      pendingRef.current = p;
      return;
    }
    busyRef.current = true;
    setGen({ kind: "generating" });
    let ok = false;
    try {
      const r = await getCadWorker().generate(p);
      setResult(r);
      setResultKey(geometryKey(p));
      ok = true;
    } catch (err) {
      // 실패해도 마지막 성공 모델(result)은 유지
      setGen({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      busyRef.current = false;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next && (!ok || geometryKey(next) !== geometryKey(p))) {
        // 대기 중인 최신 파라미터로 곧바로 이어서 생성 ("준비됨" 으로 바꾸지 않음)
        void runGenerate(next);
      } else if (ok) {
        setGen({ kind: "idle" });
      }
    }
  }, []);

  // 커널 로드 (1회) → 기본값 생성
  useEffect(() => {
    let cancelled = false;
    getCadWorker()
      .init()
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
  }, [runGenerate]);

  // 파라미터 변경 → 300ms 디바운스 후 자동 재생성 (형상 파라미터가 바뀐 경우만). 첫 생성은 지연 없이.
  const paramsKey = geometryKey(params);
  useEffect(() => {
    if (kernel.kind !== "ready") return;
    if (paramsKey === resultKey && gen.kind !== "error") return;
    const delay = resultKey === "" ? 0 : DEBOUNCE_MS;
    const id = window.setTimeout(() => void runGenerate(latestParamsRef.current), delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, kernel.kind, runGenerate]);

  const onNumberChange = useCallback((key: NumericParamKey, value: number) => {
    setParams((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);
  const onBooleanChange = useCallback((key: BooleanParamKey, value: boolean) => {
    setParams((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);
  const onReset = useCallback(() => setParams({ ...DEFAULT_PARAMS }), []);

  const exportFile = useCallback(async (kind: "step" | "stl") => {
    setExporting(kind);
    try {
      const worker = getCadWorker();
      const blob = kind === "step" ? await worker.exportSTEP() : await worker.exportSTL();
      downloadBlob(blob, exportFileName(latestParamsRef.current, kind));
    } catch (err) {
      setGen({ kind: "error", message: `내보내기 실패: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setExporting(null);
    }
  }, []);

  const stale = result !== null && paramsKey !== resultKey;

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
            <span className="badge badge-error" title={gen.message}>
              생성 실패 (마지막 성공 모델 유지): {gen.message}
            </span>
          )}
        </div>
      </header>

      <div className="layout">
        <section className="viewer" data-testid="viewer" aria-label="3D 뷰어">
          <Viewer result={result} frameRequest={frameRequest} />
          <div className="viewer-tools">
            <button className="btn" type="button" onClick={() => setFrameRequest((n) => n + 1)}>
              뷰 맞춤
            </button>
          </div>
          {kernel.kind === "loading" && <div className="overlay">커널(wasm) 로딩 중… (약 23 MB)</div>}
          {kernel.kind === "ready" && gen.kind === "generating" && !result && <div className="overlay">생성 중…</div>}
        </section>

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
            <Readout
              result={result}
              density={params.density}
              exporting={exporting}
              canExport={result !== null}
              onExport={(k) => void exportFile(k)}
              stale={stale}
            />
            <ParamPanel
              params={params}
              warnings={warnings}
              onNumberChange={onNumberChange}
              onBooleanChange={onBooleanChange}
              onReset={onReset}
              isDefault={isDefaultParams(params)}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
