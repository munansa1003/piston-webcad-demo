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
import { paramsToQuery, queryToParams } from "../cad/urlState";
import type { GenerateResult } from "../worker/api";
import { downloadBlob } from "./download";

type KernelState = { kind: "loading" } | { kind: "ready"; loadMs: number } | { kind: "error"; message: string };
type GenState = { kind: "idle" } | { kind: "generating" } | { kind: "error"; message: string };

interface GenRequest {
  params: PistonParams;
  cutaway: boolean;
}

const DEBOUNCE_MS = 300;

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

  const busyRef = useRef(false);
  const pendingRef = useRef<GenRequest | null>(null);
  const latestRef = useRef<GenRequest>({ params, cutaway });
  latestRef.current = { params, cutaway };
  /** 캐시된(마지막 성공) solid 를 만든 파라미터 — 내보내기 파일명은 이것으로 짓는다 */
  const resultParamsRef = useRef<PistonParams | null>(null);
  /** 첫 생성 시도 이후에는 항상 디바운스를 적용 */
  const firstAttemptRef = useRef(false);

  const warnings = useMemo(() => checkRules(params), [params]);

  /** 한 번에 하나만 생성. 진행 중이면 최신 요청만 대기열에 남긴다. */
  const runGenerate = useCallback(async (req: GenRequest) => {
    if (busyRef.current) {
      pendingRef.current = req;
      return;
    }
    busyRef.current = true;
    firstAttemptRef.current = true;
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
  }, []);

  // 파라미터/절개 변경 → 300ms 디바운스 후 자동 재생성 (형상에 영향 있는 경우만). 첫 생성은 지연 없이.
  const currentKey = requestKey({ params, cutaway });
  useEffect(() => {
    if (kernel.kind !== "ready") return;
    if (currentKey === resultKey && gen.kind !== "error") return;
    const delay = firstAttemptRef.current ? DEBOUNCE_MS : 0;
    const id = window.setTimeout(() => void runGenerate(latestRef.current), delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, kernel.kind, runGenerate]);

  // 파라미터 → URL 쿼리스트링 (기본값과 다른 값만). 링크로 공유 가능.
  useEffect(() => {
    const q = paramsToQuery(params);
    const url = `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", url);
    }
  }, [params]);

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
      downloadBlob(blob, exportFileName(named, kind));
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
        <section className="viewer" data-testid="viewer" aria-label="3D 뷰어">
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
            <ParamPanel
              params={params}
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
