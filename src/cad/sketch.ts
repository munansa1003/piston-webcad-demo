/**
 * 2D 스케치(단면·평면도) 생성 — 파라미터에서 직접 계산하는 순수 함수. CAD 커널이 필요 없다.
 *
 * A경로(템플릿 파라메트릭)의 핵심: 3D 를 만드는 piston.ts 와 같은 유도값(derive)에서
 * 2D 도면도 만들기 때문에 둘이 어긋날 수 없다. 구속조건 솔버도, 토폴로지 네이밍도 필요 없다.
 *
 * 좌표계는 3D 와 같다. 단면도는 XZ 평면(y=0, 핀 축을 지나는 단면), 평면도는 XY 평면.
 */
import type { DerivedValues, NumericParamKey, PistonParams } from "./params";

export interface Point2 {
  x: number;
  y: number;
}

/** 축 정렬 사각형 (단면 재료 영역) */
interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export type LineRole = "outline" | "hidden" | "center" | "construction";

export interface SketchPath {
  id: string;
  role: LineRole;
  points: Point2[];
  closed: boolean;
}

export interface SketchCircle {
  id: string;
  role: LineRole;
  cx: number;
  cy: number;
  r: number;
}

export type DimKind = "h" | "v" | "dia-h" | "dia-v" | "radial" | "angle";

export interface SketchDim {
  id: string;
  /** 클릭하면 이 파라미터를 편집한다. null 이면 유도값이라 직접 편집 불가 */
  paramKey: NumericParamKey | null;
  label: string;
  value: number;
  unit: "mm" | "deg";
  kind: DimKind;
  /** h·dia-h: x 시작/끝, level = 치수선 y. v·dia-v: y 시작/끝, level = 치수선 x */
  from: number;
  to: number;
  level: number;
  /** 치수 보조선을 그릴 형상 쪽 좌표 (h 면 y, v 면 x) */
  ext?: number;
  /** 치수선 기준 글자 방향. v: -1 왼쪽 / +1 오른쪽, h: -1 아래 / +1 위 */
  side?: -1 | 1;
  /** 치수 간격이 좁을 때 글자를 어디에 둘지 */
  textAt?: "mid" | "before" | "after";
  /** radial: 중심에서의 각도(deg). angle: 시작각·끝각(deg)과 반지름 */
  angleFrom?: number;
  angleTo?: number;
  radius?: number;
  center?: Point2;
}

export interface Sketch {
  id: string;
  name: string;
  /** 단면 해칭을 채울 닫힌 영역 */
  regions: SketchPath[];
  paths: SketchPath[];
  circles: SketchCircle[];
  dims: SketchDim[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

// ---------------------------------------------------------------------------
// 축 정렬 사각형들의 합집합 → 외곽선 루프 (격자 마칭)
// ---------------------------------------------------------------------------

const EPS = 1e-7;

function uniqSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last === undefined || Math.abs(v - last) > EPS) out.push(v);
  }
  return out;
}

/**
 * 겹치거나 맞닿은 사각형들을 합쳐 닫힌 외곽선 루프들로 만든다.
 * 모든 변이 축에 정렬돼 있으므로 격자 셀의 채움 여부만 보고 경계 변을 모은 뒤 이어 붙인다.
 */
export function unionRects(rects: Rect[]): Point2[][] {
  if (rects.length === 0) return [];
  const xs = uniqSorted(rects.flatMap((r) => [r.x0, r.x1]));
  const ys = uniqSorted(rects.flatMap((r) => [r.y0, r.y1]));
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  if (nx < 1 || ny < 1) return [];

  const grid: boolean[] = new Array(nx * ny).fill(false);
  for (let i = 0; i < nx; i++) {
    const cx = ((xs[i] as number) + (xs[i + 1] as number)) / 2;
    for (let j = 0; j < ny; j++) {
      const cy = ((ys[j] as number) + (ys[j + 1] as number)) / 2;
      const inside = rects.some((r) => cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1);
      if (inside) grid[i * ny + j] = true;
    }
  }
  const filled = (i: number, j: number): boolean =>
    i >= 0 && j >= 0 && i < nx && j < ny && grid[i * ny + j] === true;

  // 채워진 셀을 왼쪽에 두고 도는 방향으로 경계 변을 모은다 (반시계)
  type Edge = { a: Point2; b: Point2; used: boolean };
  const edges: Edge[] = [];
  for (let i = 0; i < nx; i++) {
    const x0 = xs[i] as number;
    const x1 = xs[i + 1] as number;
    for (let j = 0; j < ny; j++) {
      if (!filled(i, j)) continue;
      const y0 = ys[j] as number;
      const y1 = ys[j + 1] as number;
      if (!filled(i, j - 1)) edges.push({ a: { x: x0, y: y0 }, b: { x: x1, y: y0 }, used: false });
      if (!filled(i + 1, j)) edges.push({ a: { x: x1, y: y0 }, b: { x: x1, y: y1 }, used: false });
      if (!filled(i, j + 1)) edges.push({ a: { x: x1, y: y1 }, b: { x: x0, y: y1 }, used: false });
      if (!filled(i - 1, j)) edges.push({ a: { x: x0, y: y1 }, b: { x: x0, y: y0 }, used: false });
    }
  }

  const key = (p: Point2): string => `${p.x.toFixed(6)}|${p.y.toFixed(6)}`;
  const outgoing = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = key(e.a);
    const list = outgoing.get(k);
    if (list) list.push(e);
    else outgoing.set(k, [e]);
  }

  const loops: Point2[][] = [];
  for (const start of edges) {
    if (start.used) continue;
    const startKey = key(start.a);
    const loop: Point2[] = [start.a];
    let current: Edge | undefined = start;
    // 변 개수만큼만 돌아 무한 루프를 막는다
    for (let guard = 0; guard <= edges.length && current; guard++) {
      current.used = true;
      loop.push(current.b);
      if (key(current.b) === startKey) break;
      const candidates: Edge[] = outgoing.get(key(current.b)) ?? [];
      const next: Edge | undefined = candidates.find((e) => !e.used);
      current = next;
    }
    if (loop.length >= 4) loops.push(simplifyCollinear(loop));
  }
  return loops;
}

/** 일직선 위의 중간 점을 제거 */
function simplifyCollinear(points: Point2[]): Point2[] {
  const pts = [...points];
  // 시작점과 끝점이 같으면 하나 제거 (닫힌 루프로 다룬다)
  const first = pts[0] as Point2;
  const last = pts[pts.length - 1] as Point2;
  if (Math.abs(first.x - last.x) < EPS && Math.abs(first.y - last.y) < EPS) pts.pop();
  const n = pts.length;
  const out: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n] as Point2;
    const cur = pts[i] as Point2;
    const next = pts[(i + 1) % n] as Point2;
    const cross = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
    if (Math.abs(cross) > EPS) out.push(cur);
  }
  return out.length >= 3 ? out : pts;
}

// ---------------------------------------------------------------------------
// 단면도 (XZ 평면, y=0 — 핀 축을 지나는 단면)
// ---------------------------------------------------------------------------

interface Groove {
  z0: number;
  z1: number;
  depth: number;
  name: string;
  widthKey: NumericParamKey;
  depthKey: NumericParamKey;
}

function grooveList(p: PistonParams, d: DerivedValues): Groove[] {
  return [
    { z0: d.g1Bot, z1: d.g1Top, depth: p.ringDepth, name: "1번 압축링 홈", widthKey: "ringW", depthKey: "ringDepth" },
    { z0: d.g2Bot, z1: d.g2Top, depth: p.ringDepth, name: "2번 압축링 홈", widthKey: "ringW", depthKey: "ringDepth" },
    { z0: d.oilBot, z1: d.oilTop, depth: p.oilDepth, name: "오일링 홈", widthKey: "oilW", depthKey: "oilDepth" },
  ];
}

/** 단면의 재료 영역을 사각형 목록으로. 3D 생성 8단계와 같은 논리를 2D 로 옮긴 것. */
export function sectionRects(p: PistonParams, d: DerivedValues): Rect[] {
  const R = d.R;
  const grooves = grooveList(p, d);
  const crownBottom = p.TH - p.crownT;

  const zBreaks = uniqSorted(
    [
      0,
      p.TH,
      d.zSkirtTop,
      d.zBeltBottom,
      crownBottom,
      d.bossZ0,
      d.bossTop,
      d.zPin - d.pinR,
      d.zPin + d.pinR,
      ...grooves.flatMap((g) => [g.z0, g.z1]),
    ].filter((z) => z > -EPS && z < p.TH + EPS)
  );

  const halfRects: Rect[] = [];
  for (let k = 0; k < zBreaks.length - 1; k++) {
    const z0 = zBreaks[k] as number;
    const z1 = zBreaks[k + 1] as number;
    if (z1 - z0 < EPS) continue;
    const zm = (z0 + z1) / 2;

    // 5단계 핀 구멍: X축 방향 원기둥이라 이 z 띠의 재료를 전부 없앤다
    if (Math.abs(zm - d.zPin) < d.pinR) continue;

    // 1·2·3·6단계: 몸통 → 속 파기 → 슬리퍼 스커트 → 링 홈
    const groove = grooves.find((g) => zm > g.z0 && zm < g.z1);
    let outer = groove ? R - groove.depth : R;
    let inner: number;
    if (zm >= crownBottom) {
      inner = 0; // 크라운은 속을 파지 않는다
    } else {
      inner = zm < d.zBeltBottom ? R - p.skirtWall : R - p.beltWall;
      if (zm < d.zSkirtTop) outer = Math.min(outer, d.xc); // 슬리퍼 스커트 절단
    }
    if (outer - inner > EPS) halfRects.push({ x0: inner, x1: outer, y0: z0, y1: z1 });

    // 4단계 핀 보스 (슬리퍼 절단 뒤에 fuse 되므로 절단되지 않는다)
    if (zm > d.bossZ0 && zm < d.bossTop) {
      const bx0 = Math.min(p.rodGap / 2, d.bossX);
      if (d.bossX - bx0 > EPS) halfRects.push({ x0: bx0, x1: d.bossX, y0: z0, y1: z1 });
    }
  }

  // x<0 쪽은 대칭
  return [...halfRects, ...halfRects.map((r) => ({ x0: -r.x1, x1: -r.x0, y0: r.y0, y1: r.y1 }))];
}

export function sectionXZ(p: PistonParams, d: DerivedValues): Sketch {
  const R = d.R;
  const crownBottom = p.TH - p.crownT;
  const grooves = grooveList(p, d);
  const loops = unionRects(sectionRects(p, d));

  const regions: SketchPath[] = loops.map((pts, i) => ({
    id: `sec-region-${i}`,
    role: "outline" as const,
    points: pts,
    closed: true,
  }));

  const paths: SketchPath[] = [
    { id: "sec-axis-v", role: "center", points: [{ x: 0, y: -8 }, { x: 0, y: p.TH + 8 }], closed: false },
    {
      id: "sec-axis-pin",
      role: "center",
      points: [{ x: -R - 12, y: d.zPin }, { x: R + 12, y: d.zPin }],
      closed: false,
    },
    // 핀 구멍 윤곽 (단면에서는 뚫린 자리라 보조선으로 표시)
    {
      id: "sec-pin-hole",
      role: "hidden",
      points: [
        { x: -d.bossX, y: d.zPin - d.pinR },
        { x: d.bossX, y: d.zPin - d.pinR },
        { x: d.bossX, y: d.zPin + d.pinR },
        { x: -d.bossX, y: d.zPin + d.pinR },
      ],
      closed: true,
    },
  ];

  const gMid = (z0: number, z1: number): number => (z0 + z1) / 2;
  const dims: SketchDim[] = [
    // 전체 치수 (왼쪽, 글자 바깥)
    { id: "d-TH", paramKey: "TH", label: "전체 높이", value: p.TH, unit: "mm", kind: "v", from: 0, to: p.TH, level: -R - 30, side: -1, ext: -R },
    { id: "d-CH", paramKey: "CH", label: "압축고", value: p.CH, unit: "mm", kind: "v", from: d.zPin, to: p.TH, level: -R - 16, side: -1, ext: -R },
    // 랜드·홈 체인 (오른쪽, 두 단으로 엇갈리게)
    { id: "d-topLand", paramKey: "topLand", label: "톱 랜드", value: p.topLand, unit: "mm", kind: "v", from: d.g1Top, to: p.TH, level: R + 10, side: 1, ext: R },
    { id: "d-ringW1", paramKey: "ringW", label: "1번 압축링 홈 폭", value: p.ringW, unit: "mm", kind: "v", from: d.g1Bot, to: d.g1Top, level: R + 27, side: 1, ext: R },
    { id: "d-land2", paramKey: "land2", label: "1~2번 랜드", value: p.land2, unit: "mm", kind: "v", from: d.g2Top, to: d.g1Bot, level: R + 10, side: 1, ext: R },
    { id: "d-ringW2", paramKey: "ringW", label: "2번 압축링 홈 폭", value: p.ringW, unit: "mm", kind: "v", from: d.g2Bot, to: d.g2Top, level: R + 27, side: 1, ext: R },
    { id: "d-land3", paramKey: "land3", label: "2번~오일 랜드", value: p.land3, unit: "mm", kind: "v", from: d.oilTop, to: d.g2Bot, level: R + 10, side: 1, ext: R },
    { id: "d-oilW", paramKey: "oilW", label: "오일링 홈 폭", value: p.oilW, unit: "mm", kind: "v", from: d.oilBot, to: d.oilTop, level: R + 27, side: 1, ext: R },
    { id: "d-beltBelowOil", paramKey: "beltBelowOil", label: "오일 홈 아래 여유", value: p.beltBelowOil, unit: "mm", kind: "v", from: d.zBeltBottom, to: d.oilBot, level: R + 10, side: 1, ext: R },
    { id: "d-relief", paramKey: "reliefBelowBelt", label: "스커트 시작 여유", value: p.reliefBelowBelt, unit: "mm", kind: "v", from: d.zSkirtTop, to: d.zBeltBottom, level: R + 27, side: 1, ext: R },
    { id: "d-crownT", paramKey: "crownT", label: "크라운 두께", value: p.crownT, unit: "mm", kind: "v", from: crownBottom, to: p.TH, level: R + 44, side: 1, ext: R },
    // 홈 깊이·벽 두께 (왼쪽 벽에서 안쪽으로, 글자는 안쪽)
    { id: "d-ringDepth", paramKey: "ringDepth", label: "압축링 홈 깊이", value: p.ringDepth, unit: "mm", kind: "h", from: -R, to: -R + p.ringDepth, level: gMid(d.g1Bot, d.g1Top), side: 1, textAt: "after" },
    { id: "d-oilDepth", paramKey: "oilDepth", label: "오일링 홈 깊이", value: p.oilDepth, unit: "mm", kind: "h", from: -R, to: -R + p.oilDepth, level: gMid(d.oilBot, d.oilTop), side: 1, textAt: "after" },
    { id: "d-beltWall", paramKey: "beltWall", label: "링 벨트 벽", value: p.beltWall, unit: "mm", kind: "h", from: -R, to: -R + p.beltWall, level: gMid(d.g2Top, d.g1Bot), side: 1, textAt: "after" },
    // 아래쪽 수평
    { id: "d-D", paramKey: "D", label: "외경", value: p.D, unit: "mm", kind: "dia-h", from: -R, to: R, level: -17, side: -1, ext: 0 },
    { id: "d-rodGap", paramKey: "rodGap", label: "로드 자리", value: p.rodGap, unit: "mm", kind: "h", from: -p.rodGap / 2, to: p.rodGap / 2, level: d.bossZ0 - 8, side: -1, ext: d.bossZ0 },
    { id: "d-bossRecess", paramKey: "bossRecess", label: "보스 끝면 들어간 양", value: p.bossRecess, unit: "mm", kind: "h", from: d.bossX, to: R, level: d.bossZ0 - 8, side: -1, ext: d.bossZ0, textAt: "after" },
    // 핀 주변
    { id: "d-pinD", paramKey: "pinD", label: "핀 지름", value: p.pinD, unit: "mm", kind: "dia-v", from: d.zPin - d.pinR, to: d.zPin + d.pinR, level: 0, side: 1 },
    { id: "d-bossBelow", paramKey: "bossBelow", label: "핀 아래 보스 살", value: p.bossBelow, unit: "mm", kind: "v", from: d.bossZ0, to: d.zPin - d.pinR, level: d.bossX + 8, side: 1, ext: d.bossX },
  ];

  // 링 홈 이름표를 보조선으로 (홈 위치를 눈으로 찾기 쉽게)
  for (const g of grooves) {
    paths.push({
      id: `sec-groove-${g.name}`,
      role: "construction",
      points: [
        { x: -R - 2, y: (g.z0 + g.z1) / 2 },
        { x: -R + 1, y: (g.z0 + g.z1) / 2 },
      ],
      closed: false,
    });
  }

  return {
    id: "section-xz",
    name: "단면도 A-A (핀 축 단면)",
    regions,
    paths,
    circles: [],
    dims,
    bounds: { minX: -R - 48, minY: -26, maxX: R + 60, maxY: p.TH + 8 },
  };
}

// ---------------------------------------------------------------------------
// 평면도 (XY 평면, 위에서 본 모습)
// ---------------------------------------------------------------------------

/** 슬리퍼 스커트로 ±X 가 잘린 원의 윤곽 (스커트 높이에서 본 바깥선) */
export function skirtOutline(R: number, xc: number, steps = 96): Point2[] {
  if (xc >= R) {
    return Array.from({ length: steps }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return { x: R * Math.cos(a), y: R * Math.sin(a) };
    });
  }
  const pts: Point2[] = [];
  const a0 = Math.acos(Math.min(1, xc / R)); // +X 쪽 잘린 각
  // +X 평면 → 위쪽 호 → −X 평면 → 아래쪽 호
  pts.push({ x: xc, y: -R * Math.sin(a0) });
  pts.push({ x: xc, y: R * Math.sin(a0) });
  for (let i = 0; i <= steps / 2; i++) {
    const a = a0 + (i / (steps / 2)) * (Math.PI - 2 * a0);
    pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
  }
  pts.push({ x: -xc, y: R * Math.sin(a0) });
  pts.push({ x: -xc, y: -R * Math.sin(a0) });
  for (let i = 0; i <= steps / 2; i++) {
    const a = Math.PI + a0 + (i / (steps / 2)) * (Math.PI - 2 * a0);
    pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
  }
  return pts;
}

export function topView(p: PistonParams, d: DerivedValues): Sketch {
  const R = d.R;
  const circles: SketchCircle[] = [
    { id: "top-outer", role: "outline", cx: 0, cy: 0, r: R },
  ];
  const paths: SketchPath[] = [
    { id: "top-axis-x", role: "center", points: [{ x: -R - 12, y: 0 }, { x: R + 12, y: 0 }], closed: false },
    { id: "top-axis-y", role: "center", points: [{ x: 0, y: -R - 12 }, { x: 0, y: R + 12 }], closed: false },
    { id: "top-skirt", role: "hidden", points: skirtOutline(R, d.xc), closed: true },
    // 핀 보스 (숨은선)
    {
      id: "top-boss",
      role: "hidden",
      points: [
        { x: -d.bossX, y: -d.bossY },
        { x: d.bossX, y: -d.bossY },
        { x: d.bossX, y: d.bossY },
        { x: -d.bossX, y: d.bossY },
      ],
      closed: true,
    },
    // 로드 자리 (숨은선)
    {
      id: "top-rodgap",
      role: "hidden",
      points: [
        { x: -p.rodGap / 2, y: -d.bossY },
        { x: -p.rodGap / 2, y: d.bossY },
      ],
      closed: false,
    },
    {
      id: "top-rodgap2",
      role: "hidden",
      points: [
        { x: p.rodGap / 2, y: -d.bossY },
        { x: p.rodGap / 2, y: d.bossY },
      ],
      closed: false,
    },
  ];

  // 속 파기 안쪽 벽 (숨은선)
  circles.push({ id: "top-inner-skirt", role: "hidden", cx: 0, cy: 0, r: R - p.skirtWall });

  // 밸브 포켓
  if (p.valvePockets) {
    for (const [i, vp] of d.valvePockets.entries()) {
      circles.push({ id: `top-vp-${i}`, role: "outline", cx: vp.x, cy: vp.y, r: vp.diameter / 2 });
    }
  }
  // 배유 구멍 (오일 홈 높이라 평면도에서는 숨은선)
  if (p.drainHoles) {
    for (const [i, h] of d.drainHoles.entries()) {
      const a = (h.angleDeg * Math.PI) / 180;
      const rr = R - p.beltWall / 2;
      circles.push({ id: `top-dh-${i}`, role: "hidden", cx: rr * Math.cos(a), cy: rr * Math.sin(a), r: h.diameter / 2 });
    }
  }

  const dims: SketchDim[] = [
    { id: "t-D", paramKey: "D", label: "외경", value: p.D, unit: "mm", kind: "dia-h", from: -R, to: R, level: -R - 18, side: -1, ext: -R },
    { id: "t-skirtWall", paramKey: "skirtWall", label: "스커트 벽 두께", value: p.skirtWall, unit: "mm", kind: "h", from: -R, to: -R + p.skirtWall, level: 0, side: 1, textAt: "after" },
    { id: "t-rodGap", paramKey: "rodGap", label: "로드 자리", value: p.rodGap, unit: "mm", kind: "h", from: -p.rodGap / 2, to: p.rodGap / 2, level: R + 16, side: 1, ext: d.bossY },
    { id: "t-bossY", paramKey: "bossWall", label: "핀 보스 벽", value: p.bossWall, unit: "mm", kind: "v", from: d.pinR, to: d.bossY, level: R + 4, side: 1, textAt: "after" },
    {
      id: "t-panelAngle",
      paramKey: "panelAngle",
      label: "스커트 판 각도",
      value: p.panelAngle,
      unit: "deg",
      kind: "angle",
      from: 0,
      to: 0,
      level: 0,
      angleFrom: -p.panelAngle / 2,
      angleTo: p.panelAngle / 2,
      radius: R * 0.62,
      center: { x: 0, y: 0 },
    },
  ];
  if (p.valvePockets) {
    const vp = d.valvePockets[0];
    if (vp) {
      dims.push({
        id: "t-vp",
        paramKey: null,
        label: "흡기 포켓 (D 비례, 자동)",
        value: vp.diameter,
        unit: "mm",
        kind: "dia-h",
        from: vp.x - vp.diameter / 2,
        to: vp.x + vp.diameter / 2,
        level: R + 4,
        side: 1,
        ext: vp.y,
      });
    }
  }

  return {
    id: "top-view",
    name: "평면도 (크라운 위에서)",
    regions: [],
    paths,
    circles,
    dims,
    bounds: { minX: -R - 32, minY: -R - 30, maxX: R + 40, maxY: R + 26 },
  };
}

/** 두 도면을 한 번에 */
export function buildSketches(p: PistonParams, d: DerivedValues): Sketch[] {
  return [sectionXZ(p, d), topView(p, d)];
}
