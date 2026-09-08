/**
 * 투상도 뷰 — 커널(OpenCascade)이 3D 솔리드에서 직접 뽑은 정투상 도면.
 * 숨은선 제거(HLR)까지 커널이 해 주므로 형상이 아무리 복잡해도 도면이 자동으로 나온다.
 * sketch.ts 의 파라메트릭 단면과 달리 치수는 붙지 않는다 (도면은 결과, 단면은 입력).
 */
import type { ProjectionPlaneName, ProjectionResult } from "../worker/api";

export interface ProjectionViewProps {
  projection: ProjectionResult | null;
  plane: ProjectionPlaneName;
  onPlaneChange: (plane: ProjectionPlaneName) => void;
  busy: boolean;
  error: string | null;
  showHidden: boolean;
  onToggleHidden: (on: boolean) => void;
}

const PLANES: [ProjectionPlaneName, string][] = [
  ["front", "정면도"],
  ["top", "평면도"],
  ["right", "우측면도"],
];

export default function ProjectionView({
  projection,
  plane,
  onPlaneChange,
  busy,
  error,
  showHidden,
  onToggleHidden,
}: ProjectionViewProps) {
  // 선 굵기를 도면 크기에 맞춘다
  const vb = projection?.viewBox.split(/\s+/).map(Number) ?? [];
  const span = vb.length === 4 ? Math.max(vb[2] as number, vb[3] as number) : 100;

  return (
    <div className="sketch-host">
      <div className="proj-bar">
        <div className="segmented" role="group" aria-label="투상 방향">
          {PLANES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`seg${plane === key ? " seg-on" : ""}`}
              aria-pressed={plane === key}
              onClick={() => onPlaneChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="proj-check">
          <input type="checkbox" checked={showHidden} onChange={(e) => onToggleHidden(e.target.checked)} />
          <span>숨은선</span>
        </label>
      </div>

      {projection ? (
        <svg
          className="sketch-svg"
          viewBox={projection.viewBox}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${PLANES.find(([k]) => k === plane)?.[1] ?? plane} 투상도`}
        >
          {showHidden &&
            projection.hidden.map((d, i) => (
              <path
                key={`h${i}`}
                className="sk-hidden"
                d={d}
                fill="none"
                strokeWidth={span / 420}
                strokeDasharray={`${span / 90} ${span / 150}`}
              />
            ))}
          {projection.visible.map((d, i) => (
            <path key={`v${i}`} className="sk-outline" d={d} fill="none" strokeWidth={span / 260} strokeLinejoin="round" />
          ))}
        </svg>
      ) : (
        <div className="proj-empty">{error ?? (busy ? "투상도 계산 중…" : "모델을 만들면 투상도가 나옵니다")}</div>
      )}

      <div className="sketch-caption">
        <span>
          투상도 · 커널이 3D 에서 자동 생성{" "}
          {projection && (
            <span className="proj-stat">
              보이는 선 {projection.visible.length} · 숨은선 {projection.hidden.length} · {Math.round(projection.ms)} ms
            </span>
          )}
        </span>
        {busy && <span className="sketch-hint">갱신 중…</span>}
      </div>
    </div>
  );
}
