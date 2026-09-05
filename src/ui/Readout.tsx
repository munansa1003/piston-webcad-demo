/**
 * 계산 표시: 체적(mm³), 예상 질량(g), 생성 시간(ms), 면 개수 + 내보내기 버튼
 */
import { massFromVolume } from "../cad/params";
import type { GenerateResult } from "../worker/api";

export interface ReadoutProps {
  result: GenerateResult | null;
  density: number;
  exporting: "step" | "stl" | null;
  canExport: boolean;
  onExport: (kind: "step" | "stl") => void;
  stale: boolean;
}

const fmt = (n: number, digits = 0) => n.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export default function Readout({ result, density, exporting, canExport, onExport, stale }: ReadoutProps) {
  return (
    <div className={`readout${stale ? " readout-stale" : ""}`} data-testid="readout" data-stale={stale ? "true" : "false"}>
      <dl className="readout-grid">
        <div>
          <dt>체적</dt>
          <dd data-testid="volume">{result ? `${fmt(result.volume)} mm³` : "—"}</dd>
        </div>
        <div>
          <dt>예상 질량 (밀도 {density.toFixed(2)})</dt>
          <dd data-testid="mass">{result ? `${fmt(massFromVolume(result.volume, density), 1)} g` : "—"}</dd>
        </div>
        <div>
          <dt>생성 시간</dt>
          <dd data-testid="time">{result ? `${fmt(result.timeMs)} ms` : "—"}</dd>
        </div>
        <div>
          <dt>면 개수</dt>
          <dd data-testid="faces">{result ? `${result.faceCount}개` : "—"}</dd>
        </div>
      </dl>
      <div className="export-actions">
        <button className="btn btn-primary" type="button" disabled={!canExport || exporting !== null} onClick={() => onExport("step")}>
          {exporting === "step" ? "STEP 생성 중…" : "STEP 다운로드"}
        </button>
        <button className="btn" type="button" disabled={!canExport || exporting !== null} onClick={() => onExport("stl")}>
          {exporting === "stl" ? "STL 생성 중…" : "STL 다운로드"}
        </button>
      </div>
      {result && !result.chamferApplied && <p className="hint">크라운 챔퍼는 이 형상에서 생략되었습니다.</p>}
    </div>
  );
}
