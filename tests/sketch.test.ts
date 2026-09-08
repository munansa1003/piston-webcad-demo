import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, derive, type PistonParams } from "../src/cad/params";
import { buildSketches, sectionRects, sectionXZ, skirtOutline, topView, unionRects } from "../src/cad/sketch";

/** 다각형 넓이 (부호 있음) */
function area(points: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

describe("unionRects (축 정렬 사각형 합집합)", () => {
  it("사각형 하나는 네 점 루프", () => {
    const loops = unionRects([{ x0: 0, x1: 10, y0: 0, y1: 5 }]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
    expect(Math.abs(area(loops[0]!))).toBeCloseTo(50, 6);
  });

  it("맞닿은 두 사각형은 하나의 루프로 합쳐진다", () => {
    const loops = unionRects([
      { x0: 0, x1: 10, y0: 0, y1: 5 },
      { x0: 10, x1: 20, y0: 0, y1: 5 },
    ]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4); // 중간 세로선은 사라진다
    expect(Math.abs(area(loops[0]!))).toBeCloseTo(100, 6);
  });

  it("겹치는 사각형도 넓이가 이중 계산되지 않는다", () => {
    const loops = unionRects([
      { x0: 0, x1: 10, y0: 0, y1: 10 },
      { x0: 5, x1: 15, y0: 0, y1: 10 },
    ]);
    expect(loops).toHaveLength(1);
    expect(Math.abs(area(loops[0]!))).toBeCloseTo(150, 6);
  });

  it("떨어진 사각형은 별개 루프", () => {
    const loops = unionRects([
      { x0: 0, x1: 10, y0: 0, y1: 5 },
      { x0: 20, x1: 30, y0: 0, y1: 5 },
    ]);
    expect(loops).toHaveLength(2);
  });

  it("L 자 모양은 여섯 점", () => {
    const loops = unionRects([
      { x0: 0, x1: 10, y0: 0, y1: 4 },
      { x0: 0, x1: 4, y0: 4, y1: 12 },
    ]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(6);
    expect(Math.abs(area(loops[0]!))).toBeCloseTo(10 * 4 + 4 * 8, 6);
  });

  it("가운데 구멍이 있으면 바깥 루프와 안쪽 루프 두 개", () => {
    // 도넛: 큰 사각형에서 가운데를 비운 형태를 네 조각으로 구성
    const loops = unionRects([
      { x0: 0, x1: 30, y0: 0, y1: 10 },
      { x0: 0, x1: 30, y0: 20, y1: 30 },
      { x0: 0, x1: 10, y0: 10, y1: 20 },
      { x0: 20, x1: 30, y0: 10, y1: 20 },
    ]);
    expect(loops).toHaveLength(2);
    const areas = loops.map((l) => area(l)).sort((a, b) => a - b);
    // 바깥은 반시계(+), 안쪽 구멍은 시계(−) 방향
    expect(areas[0]!).toBeLessThan(0);
    expect(areas[1]!).toBeGreaterThan(0);
    expect(areas[1]! + areas[0]!).toBeCloseTo(30 * 30 - 10 * 10, 6);
  });

  it("빈 입력은 빈 결과", () => {
    expect(unionRects([])).toEqual([]);
  });
});

describe("sectionXZ (핀 축 단면)", () => {
  const p = DEFAULT_PARAMS;
  const d = derive(p);

  it("좌우 대칭이다", () => {
    const rects = sectionRects(p, d);
    for (const r of rects) {
      const mirrored = rects.some(
        (o) => Math.abs(o.x0 + r.x1) < 1e-6 && Math.abs(o.x1 + r.x0) < 1e-6 && o.y0 === r.y0 && o.y1 === r.y1
      );
      expect(mirrored, `${r.x0}~${r.x1} @ ${r.y0}~${r.y1}`).toBe(true);
    }
  });

  it("핀 구멍 높이에는 재료가 없다", () => {
    const rects = sectionRects(p, d);
    const inHole = rects.filter((r) => (r.y0 + r.y1) / 2 > d.zPin - d.pinR && (r.y0 + r.y1) / 2 < d.zPin + d.pinR);
    expect(inHole).toHaveLength(0);
  });

  it("크라운은 중심까지 꽉 찼고 벨트 아래는 비었다", () => {
    const rects = sectionRects(p, d);
    const crownZ = p.TH - p.crownT / 2;
    const atCrown = rects.filter((r) => r.y0 < crownZ && r.y1 > crownZ);
    expect(atCrown.some((r) => Math.abs(r.x0) < 1e-9)).toBe(true);

    const beltZ = (d.zBeltBottom + d.oilBot) / 2;
    const atBelt = rects.filter((r) => r.y0 < beltZ && r.y1 > beltZ && r.x1 > 0);
    // 벨트 높이의 오른쪽 벽은 R-beltWall 에서 시작
    expect(atBelt.some((r) => Math.abs(r.x0 - (d.R - p.beltWall)) < 1e-6)).toBe(true);
  });

  it("슬리퍼 스커트 높이에서 y=0 단면에는 핀 보스만 남는다", () => {
    const rects = sectionRects(p, d);
    const z = (d.bossZ0 + d.zPin - d.pinR) / 2; // 핀 구멍 아래, 보스 안
    const at = rects.filter((r) => r.y0 < z && r.y1 > z && r.x1 > 0);
    expect(at).toHaveLength(1);
    expect(at[0]!.x0).toBeCloseTo(p.rodGap / 2, 6);
    expect(at[0]!.x1).toBeCloseTo(d.bossX, 6);
  });

  it("링 홈 높이에서는 바깥 지름이 홈 깊이만큼 줄어든다", () => {
    const rects = sectionRects(p, d);
    const z = (d.g1Bot + d.g1Top) / 2;
    const at = rects.filter((r) => r.y0 < z && r.y1 > z && r.x1 > 0);
    expect(at.some((r) => Math.abs(r.x1 - (d.R - p.ringDepth)) < 1e-6)).toBe(true);
  });

  it("닫힌 외곽선이 만들어지고 넓이가 양수다", () => {
    const s = sectionXZ(p, d);
    expect(s.regions.length).toBeGreaterThan(0);
    const total = s.regions.reduce((sum, r) => sum + area(r.points), 0);
    expect(total).toBeGreaterThan(0);
    for (const r of s.regions) expect(r.points.length).toBeGreaterThanOrEqual(4);
  });

  it("치수는 모두 유효한 파라미터 키를 갖고 값이 파라미터와 일치한다", () => {
    const s = sectionXZ(p, d);
    expect(s.dims.length).toBeGreaterThanOrEqual(15);
    for (const dim of s.dims) {
      if (dim.paramKey === null) continue;
      expect(p[dim.paramKey], dim.id).toBeCloseTo(dim.value, 6);
    }
  });

  it("극단값에서도 예외 없이 만들어진다", () => {
    for (const extreme of [
      { ...p, D: 60, TH: 35, CH: 20 },
      { ...p, D: 110, TH: 80, CH: 50 },
      { ...p, valvePockets: false, drainHoles: false },
    ] as PistonParams[]) {
      const dd = derive(extreme);
      const s = sectionXZ(extreme, dd);
      expect(s.regions.length).toBeGreaterThan(0);
    }
  });
});

describe("topView (평면도)", () => {
  const p = DEFAULT_PARAMS;
  const d = derive(p);

  it("밸브 포켓 4개와 배유 구멍 4개가 원으로 들어간다", () => {
    const s = topView(p, d);
    expect(s.circles.filter((c) => c.id.startsWith("top-vp-"))).toHaveLength(4);
    expect(s.circles.filter((c) => c.id.startsWith("top-dh-"))).toHaveLength(4);
  });

  it("끄면 사라진다", () => {
    const off = { ...p, valvePockets: false, drainHoles: false };
    const s = topView(off, derive(off));
    expect(s.circles.filter((c) => c.id.startsWith("top-vp-"))).toHaveLength(0);
    expect(s.circles.filter((c) => c.id.startsWith("top-dh-"))).toHaveLength(0);
  });

  it("슬리퍼 윤곽은 ±X 가 xc 에서 잘린다", () => {
    const pts = skirtOutline(d.R, d.xc);
    const maxX = Math.max(...pts.map((q) => q.x));
    const maxY = Math.max(...pts.map((q) => q.y));
    expect(maxX).toBeCloseTo(d.xc, 6);
    expect(maxY).toBeCloseTo(d.R, 2);
  });

  it("panelAngle 이 180 이상이면 잘리지 않는다", () => {
    const pts = skirtOutline(40, 40);
    expect(Math.max(...pts.map((q) => q.x))).toBeCloseTo(40, 6);
  });
});

describe("buildSketches", () => {
  it("단면도와 평면도 두 장을 준다", () => {
    const s = buildSketches(DEFAULT_PARAMS, derive(DEFAULT_PARAMS));
    expect(s.map((x) => x.id)).toEqual(["section-xz", "top-view"]);
  });
});
