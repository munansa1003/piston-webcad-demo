import { useCallback, useEffect, useRef, useState } from "react";
import Viewer from "./Viewer";
import { getCadWorker } from "../worker/client";
import { DEFAULT_PARAMS, exportFileName, type PistonParams } from "../cad/params";
import type { GenerateResult } from "../worker/api";
import { downloadBlob } from "./download";

type KernelState = { kind: "loading" } | { kind: "ready"; loadMs: number } | { kind: "error"; message: string };
type GenState = { kind: "idle" } | { kind: "generating" } | { kind: "error"; message: string };

export default function App() {
  const [kernel, setKernel] = useState<KernelState>({ kind: "loading" });
  const [gen, setGen] = useState<GenState>({ kind: "idle" });
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [frameRequest, setFrameRequest] = useState(0);
  const [exporting, setExporting] = useState<"step" | "stl" | null>(null);
  const params = useRef<PistonParams>({ ...DEFAULT_PARAMS });

  const exportFile = useCallback(async (kind: "step" | "stl") => {
    setExporting(kind);
    try {
      const worker = getCadWorker();
      const blob = kind === "step" ? await worker.exportSTEP() : await worker.exportSTL();
      downloadBlob(blob, exportFileName(params.current, kind));
    } catch (err) {
      setGen({ kind: "error", message: `내보내기 실패: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setExporting(null);
    }
  }, []);

  const generate = useCallback(async (p: PistonParams) => {
    setGen({ kind: "generating" });
    try {
      const r = await getCadWorker().generate(p);
      setResult(r);
      setGen({ kind: "idle" });
    } catch (err) {
      setGen({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCadWorker()
      .init()
      .then(({ loadMs }) => {
        if (cancelled) return;
        setKernel({ kind: "ready", loadMs });
        void generate(params.current);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setKernel({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [generate]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>피스톤 파라메트릭 WebCAD 데모</h1>
        <div className="status" data-testid="status">
          {kernel.kind === "loading" && <span className="badge badge-loading">커널(wasm) 로딩 중…</span>}
          {kernel.kind === "error" && <span className="badge badge-error">커널 오류: {kernel.message}</span>}
          {kernel.kind === "ready" && gen.kind === "generating" && <span className="badge badge-busy">생성 중…</span>}
          {kernel.kind === "ready" && gen.kind === "idle" && (
            <span className="badge badge-ok">준비됨 (커널 {Math.round(kernel.loadMs)} ms)</span>
          )}
          {kernel.kind === "ready" && gen.kind === "error" && <span className="badge badge-error">생성 실패: {gen.message}</span>}
        </div>
      </header>
      <section className="viewer" data-testid="viewer">
        <Viewer result={result} frameRequest={frameRequest} />
        <button className="btn btn-float" type="button" onClick={() => setFrameRequest((n) => n + 1)}>
          뷰 맞춤
        </button>
      </section>
      {result && (
        <section className="readout" data-testid="readout">
          <span>면 {result.faceCount}개</span>
          <span>체적 {Math.round(result.volume).toLocaleString()} mm³</span>
          <span>생성 {Math.round(result.timeMs)} ms</span>
          <button className="btn" type="button" disabled={exporting !== null} onClick={() => void exportFile("step")}>
            {exporting === "step" ? "STEP 생성 중…" : "STEP 다운로드"}
          </button>
          <button className="btn" type="button" disabled={exporting !== null} onClick={() => void exportFile("stl")}>
            {exporting === "stl" ? "STL 생성 중…" : "STL 다운로드"}
          </button>
        </section>
      )}
    </div>
  );
}
