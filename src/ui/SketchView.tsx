/**
 * 2D 스케치 뷰 — sketch.ts 가 만든 도면을 SVG 로 그린다.
 * 치수를 클릭하면 그 자리에서 값을 고칠 수 있고, 고치면 같은 파라미터로 3D 도 다시 만들어진다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NUMERIC_PARAM_SPECS, type NumericParamKey } from "../cad/params";
import type { Sketch, SketchDim, SketchPath, Point2 } from "../cad/sketch";

export interface SketchViewProps {
  sketch: Sketch;
  onChangeParam: (key: NumericParamKey, value: number) => void;
  /** 패널에서 만지고 있는 파라미터를 도면에서 강조 */
  highlightParam: NumericParamKey | null;
  onHoverParam: (key: NumericParamKey | null) => void;
  /** 재생성 중이면 도면을 살짝 흐리게 */
  stale: boolean;
}

const SPEC_BY_KEY = new Map(NUMERIC_PARAM_SPECS.map((s) => [s.key, s]));

/** 도면 좌표(Z 위) → SVG 좌표(y 아래) */
const sy = (v: number): number => -v;

function pathD(points: Point2[], closed: boolean): string {
  if (points.length === 0) return "";
  const head = points[0] as Point2;
  let d = `M${head.x.toFixed(3)},${sy(head.y).toFixed(3)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i] as Point2;
    d += `L${p.x.toFixed(3)},${sy(p.y).toFixed(3)}`;
  }
  return closed ? `${d}Z` : d;
}

function roleClass(role: SketchPath["role"]): string {
  return `sk-${role}`;
}

export default function SketchView({ sketch, onChangeParam, highlightParam, onHoverParam, stale }: SketchViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [editing, setEditing] = useState<{ key: NumericParamKey; dimId: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { minX, minY, maxX, maxY } = sketch.bounds;
  const w = maxX - minX;
  const h = maxY - minY;
  const span = Math.max(w, h);
  const font = span / 58;
  const thin = span / 900;
  const thick = span / 340;
  const arrow = span / 90;

  // 편집 입력창 위치를 화면 좌표로 계산
  const editingDim = editing ? sketch.dims.find((d) => d.id === editing.dimId) : undefined;
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || !editingDim) {
      setBox(null);
      return;
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const anchor = dimTextAnchor(editingDim, font);
    const pt = svg.createSVGPoint();
    pt.x = anchor.x;
    pt.y = sy(anchor.y);
    const p = pt.matrixTransform(ctm);
    const host = svg.parentElement?.getBoundingClientRect();
    setBox({ left: p.x - (host?.left ?? 0), top: p.y - (host?.top ?? 0) });
  }, [editingDim, sketch, font]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // 도면이 바뀌어 그 치수가 사라지면 편집 종료
  useEffect(() => {
    if (editing && !sketch.dims.some((d) => d.id === editing.dimId)) setEditing(null);
  }, [sketch, editing]);

  const startEdit = (dim: SketchDim) => {
    if (!dim.paramKey) return;
    setEditing({ key: dim.paramKey, dimId: dim.id });
    setDraft(String(dim.value));
  };

  const commit = () => {
    if (!editing) return;
    const spec = SPEC_BY_KEY.get(editing.key);
    const n = Number(draft);
    if (spec && Number.isFinite(n)) {
      onChangeParam(editing.key, Math.min(spec.max, Math.max(spec.min, n)));
    }
    setEditing(null);
  };

  return (
    <div className={`sketch-host${stale ? " sketch-stale" : ""}`}>
      <svg
        ref={svgRef}
        className="sketch-svg"
        viewBox={`${minX} ${sy(maxY)} ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={sketch.name}
      >
        <defs>
          <pattern
            id={`hatch-${sketch.id}`}
            patternUnits="userSpaceOnUse"
            width={span / 26}
            height={span / 26}
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2={span / 26} stroke="currentColor" strokeWidth={thin * 1.1} opacity="0.5" />
          </pattern>
          <marker id={`ar-${sketch.id}`} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <path d="M0,0 L10,4 L0,8 Z" fill="currentColor" />
          </marker>
        </defs>

        {/* 단면 재료 (해칭) */}
        <g className="sk-fill">
          <path
            d={sketch.regions.map((r) => pathD(r.points, true)).join(" ")}
            fill={`url(#hatch-${sketch.id})`}
            fillRule="evenodd"
            stroke="none"
          />
          <path
            d={sketch.regions.map((r) => pathD(r.points, true)).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={thick}
            strokeLinejoin="round"
          />
        </g>

        {/* 선 (외형·숨은선·중심선·보조선) */}
        {sketch.paths.map((p) => (
          <path
            key={p.id}
            className={roleClass(p.role)}
            d={pathD(p.points, p.closed)}
            fill="none"
            strokeWidth={p.role === "outline" ? thick : thin * 1.6}
            strokeDasharray={
              p.role === "hidden"
                ? `${span / 90} ${span / 150}`
                : p.role === "center"
                  ? `${span / 40} ${span / 160} ${span / 300} ${span / 160}`
                  : undefined
            }
          />
        ))}

        {/* 원 */}
        {sketch.circles.map((c) => (
          <circle
            key={c.id}
            className={roleClass(c.role)}
            cx={c.cx}
            cy={sy(c.cy)}
            r={c.r}
            fill="none"
            strokeWidth={c.role === "outline" ? thick : thin * 1.6}
            strokeDasharray={c.role === "hidden" ? `${span / 90} ${span / 150}` : undefined}
          />
        ))}

        {/* 치수 */}
        {sketch.dims.map((dim) => (
          <Dimension
            key={dim.id}
            dim={dim}
            font={font}
            thin={thin}
            arrow={arrow}
            markerId={`ar-${sketch.id}`}
            active={dim.paramKey !== null && dim.paramKey === highlightParam}
            editing={editing?.dimId === dim.id}
            onPick={() => startEdit(dim)}
            onHover={(on) => onHoverParam(on ? dim.paramKey : null)}
          />
        ))}
      </svg>

      {editing && box && (
        <div className="sketch-edit" style={{ left: box.left, top: box.top }}>
          <input
            ref={inputRef}
            type="number"
            step={SPEC_BY_KEY.get(editing.key)?.step ?? 0.1}
            min={SPEC_BY_KEY.get(editing.key)?.min}
            max={SPEC_BY_KEY.get(editing.key)?.max}
            value={draft}
            aria-label={`${SPEC_BY_KEY.get(editing.key)?.label ?? editing.key} 값`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(null);
            }}
          />
          <span className="sketch-edit-key">{editing.key}</span>
        </div>
      )}

      <div className="sketch-caption">
        <span>{sketch.name}</span>
        <span className="sketch-hint">치수를 누르면 값을 고칠 수 있습니다</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function dimTextAnchor(dim: SketchDim, font: number): Point2 {
  const mid = (dim.from + dim.to) / 2;
  const side = dim.side ?? 1;
  if (dim.kind === "angle") {
    const a = (((dim.angleFrom ?? 0) + (dim.angleTo ?? 0)) / 2) * (Math.PI / 180);
    const r = (dim.radius ?? 10) * 0.72;
    const c = dim.center ?? { x: 0, y: 0 };
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  }
  const horizontal = dim.kind === "h" || dim.kind === "dia-h";
  if (horizontal) {
    const x =
      dim.textAt === "after"
        ? Math.max(dim.from, dim.to) + font * 0.5
        : dim.textAt === "before"
          ? Math.min(dim.from, dim.to) - font * 0.5
          : mid;
    return { x, y: dim.level + (dim.textAt && dim.textAt !== "mid" ? 0 : side * font * 0.45) };
  }
  return { x: dim.level + side * font * 0.5, y: mid };
}

interface DimensionProps {
  dim: SketchDim;
  font: number;
  thin: number;
  arrow: number;
  markerId: string;
  active: boolean;
  editing: boolean;
  onPick: () => void;
  onHover: (on: boolean) => void;
}

function Dimension({ dim, font, thin, arrow, markerId, active, editing, onPick, onHover }: DimensionProps) {
  const clickable = dim.paramKey !== null;
  const cls = `sk-dim${clickable ? " sk-dim-editable" : ""}${active ? " sk-dim-active" : ""}${editing ? " sk-dim-editing" : ""}`;
  const prefix = dim.kind === "dia-h" || dim.kind === "dia-v" ? "⌀" : "";
  const text = `${prefix}${formatValue(dim.value)}${dim.unit === "deg" ? "°" : ""}`;
  const anchor = dimTextAnchor(dim, font);
  const horizontal = dim.kind === "h" || dim.kind === "dia-h";
  const side = dim.side ?? 1;
  const span = Math.abs(dim.to - dim.from);
  /** 치수 간격이 화살표 두 개보다 좁으면 화살표를 바깥에서 안으로 */
  const tight = span < arrow * 2.8;
  const sw = thin * 1.4;
  const parts: JSX.Element[] = [];

  if (dim.kind === "angle") {
    const c = dim.center ?? { x: 0, y: 0 };
    const r = dim.radius ?? 10;
    const a0 = (dim.angleFrom ?? 0) * (Math.PI / 180);
    const a1 = (dim.angleTo ?? 0) * (Math.PI / 180);
    const p0 = { x: c.x + r * Math.cos(a0), y: c.y + r * Math.sin(a0) };
    const p1 = { x: c.x + r * Math.cos(a1), y: c.y + r * Math.sin(a1) };
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    parts.push(
      <path key="arc" d={`M${p0.x},${sy(p0.y)} A${r},${r} 0 ${large} 0 ${p1.x},${sy(p1.y)}`} fill="none" strokeWidth={sw} markerEnd={`url(#${markerId})`} markerStart={`url(#${markerId})`} />
    );
    parts.push(<line key="l0" x1={c.x} y1={sy(c.y)} x2={p0.x * 1.18} y2={sy(p0.y * 1.18)} strokeWidth={sw} opacity="0.5" />);
    parts.push(<line key="l1" x1={c.x} y1={sy(c.y)} x2={p1.x * 1.18} y2={sy(p1.y * 1.18)} strokeWidth={sw} opacity="0.5" />);
  } else if (horizontal) {
    const y = sy(dim.level);
    const a = Math.min(dim.from, dim.to);
    const b = Math.max(dim.from, dim.to);
    // 형상까지의 치수 보조선
    if (dim.ext !== undefined) {
      const ey = sy(dim.ext);
      parts.push(<line key="e0" x1={a} y1={ey} x2={a} y2={y - Math.sign(y - ey) * arrow * 0.4} strokeWidth={sw} opacity="0.6" />);
      parts.push(<line key="e1" x1={b} y1={ey} x2={b} y2={y - Math.sign(y - ey) * arrow * 0.4} strokeWidth={sw} opacity="0.6" />);
    }
    parts.push(
      <line key="dim" x1={tight ? a - arrow * 1.6 : a} y1={y} x2={tight ? b + arrow * 1.6 : b} y2={y} strokeWidth={sw} />
    );
    parts.push(<Arrow key="a0" x={a} y={y} dir={tight ? 1 : -1} horizontal size={arrow} />);
    parts.push(<Arrow key="a1" x={b} y={y} dir={tight ? -1 : 1} horizontal size={arrow} />);
    parts.push(<line key="t0" x1={a} y1={y - arrow * 0.45} x2={a} y2={y + arrow * 0.45} strokeWidth={sw} opacity="0.6" />);
    parts.push(<line key="t1" x1={b} y1={y - arrow * 0.45} x2={b} y2={y + arrow * 0.45} strokeWidth={sw} opacity="0.6" />);
  } else {
    const x = dim.level;
    const a = Math.min(dim.from, dim.to);
    const b = Math.max(dim.from, dim.to);
    if (dim.ext !== undefined) {
      parts.push(<line key="e0" x1={dim.ext} y1={sy(a)} x2={x + Math.sign(x - dim.ext) * arrow * 0.4} y2={sy(a)} strokeWidth={sw} opacity="0.6" />);
      parts.push(<line key="e1" x1={dim.ext} y1={sy(b)} x2={x + Math.sign(x - dim.ext) * arrow * 0.4} y2={sy(b)} strokeWidth={sw} opacity="0.6" />);
    }
    parts.push(
      <line key="dim" x1={x} y1={sy(tight ? a - arrow * 1.6 : a)} x2={x} y2={sy(tight ? b + arrow * 1.6 : b)} strokeWidth={sw} />
    );
    parts.push(<Arrow key="a0" x={x} y={sy(a)} dir={tight ? -1 : 1} horizontal={false} size={arrow} />);
    parts.push(<Arrow key="a1" x={x} y={sy(b)} dir={tight ? 1 : -1} horizontal={false} size={arrow} />);
    parts.push(<line key="t0" x1={x - arrow * 0.45} y1={sy(a)} x2={x + arrow * 0.45} y2={sy(a)} strokeWidth={sw} opacity="0.6" />);
    parts.push(<line key="t1" x1={x - arrow * 0.45} y1={sy(b)} x2={x + arrow * 0.45} y2={sy(b)} strokeWidth={sw} opacity="0.6" />);
  }

  const textAnchor =
    dim.kind === "angle"
      ? "middle"
      : horizontal
        ? dim.textAt === "after"
          ? "start"
          : dim.textAt === "before"
            ? "end"
            : "middle"
        : side > 0
          ? "start"
          : "end";
  const baseline = horizontal && (!dim.textAt || dim.textAt === "mid") ? (side > 0 ? "auto" : "hanging") : "middle";

  return (
    <g
      className={cls}
      onClick={clickable ? onPick : undefined}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={clickable ? { cursor: "pointer" } : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${dim.label} ${text}, 누르면 편집` : `${dim.label} ${text}`}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onPick();
        }
      }}
    >
      {parts}
      <text
        className="sk-dim-text"
        x={anchor.x}
        y={sy(anchor.y)}
        fontSize={font}
        strokeWidth={font * 0.28}
        textAnchor={textAnchor}
        dominantBaseline={baseline}
      >
        {text}
      </text>
      {/* 클릭 판정용 넓은 영역 */}
      {dim.kind === "angle" ? null : horizontal ? (
        <rect x={Math.min(dim.from, dim.to) - arrow} y={sy(dim.level) - font * 0.9} width={Math.abs(dim.to - dim.from) + arrow * 2 + font * 3} height={font * 1.8} fill="transparent" stroke="none" />
      ) : (
        <rect x={dim.level - (side > 0 ? font * 0.9 : font * 3)} y={sy(Math.max(dim.from, dim.to)) - arrow} width={font * 3.9} height={Math.abs(dim.to - dim.from) + arrow * 2} fill="transparent" stroke="none" />
      )}
    </g>
  );
}

function Arrow({ x, y, dir, horizontal, size }: { x: number; y: number; dir: number; horizontal: boolean; size: number }) {
  const d = horizontal
    ? `M${x},${y} L${x - dir * size},${y - size * 0.3} L${x - dir * size},${y + size * 0.3} Z`
    : `M${x},${y} L${x - size * 0.3},${y + dir * size} L${x + size * 0.3},${y + dir * size} Z`;
  return <path d={d} fill="currentColor" stroke="none" />;
}

function formatValue(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(Math.abs(r) < 10 ? 2 : 1).replace(/\.?0+$/, "");
}
