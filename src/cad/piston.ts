/**
 * 피스톤 형상 생성 — 요청서 5절의 순서를 그대로 따른다 (불리언 실패를 피하는 순서).
 * 각 단계는 별도 함수이며, 실패하면 단계 번호가 들어간 Error 를 던진다.
 *
 * 좌표계: Z 위. 바닥 z=0, 크라운 상면 z=TH. 핀 축 = X축. 스커트 판은 ±Y 쪽.
 */
import { makeBox, makeCylinder, type Shape3D } from "replicad";
import { derive, type DerivedValues, type PistonParams } from "./params";

export interface BuildResult {
  solid: Shape3D;
  /** 크라운 챔퍼 적용 여부 (실패 시 false, 생략됨) */
  chamferApplied: boolean;
}

/** 불리언 도구 형상이 경계면과 정확히 겹치지 않게 주는 여유 */
const EPS = 1.0;

class StepError extends Error {
  constructor(step: number, name: string, cause: unknown) {
    super(`[단계 ${step}: ${name}] ${describe(cause)}`);
    this.name = "PistonStepError";
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "number") return `OpenCascade 예외 (코드 ${err})`;
  return String(err);
}

function runStep<T>(step: number, name: string, fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    throw new StepError(step, name, err);
  }
}

/** Z 방향 원기둥: z0 → z1 */
function zCylinder(radius: number, z0: number, z1: number): Shape3D {
  return makeCylinder(radius, z1 - z0, [0, 0, z0], [0, 0, 1]);
}

/** 1. 몸통: 원기둥 반경 R, 높이 TH. 크라운 바깥 모서리 챔퍼 0.8 은 시도만 (실패 시 생략) */
export function stepBody(p: PistonParams, d: DerivedValues): { solid: Shape3D; chamferApplied: boolean } {
  return runStep(1, "몸통", () => {
    const body = zCylinder(d.R, 0, p.TH);
    try {
      const chamfered = body.chamfer(0.8, (e) => e.inPlane("XY", p.TH).ofCurveType("CIRCLE"));
      if (chamfered.faces.length >= body.faces.length) {
        return { solid: chamfered, chamferApplied: true };
      }
    } catch {
      /* 챔퍼 실패 → 생략 */
    }
    return { solid: body, chamferApplied: false };
  });
}

/** 2. 속 파기: (a) R−skirtWall 원기둥 z 0→zBeltBottom, (b) R−beltWall 원기둥 z zBeltBottom→TH−crownT */
export function stepHollow(solid: Shape3D, p: PistonParams, d: DerivedValues): Shape3D {
  return runStep(2, "속 파기", () => {
    const skirtCavity = zCylinder(d.R - p.skirtWall, -EPS, d.zBeltBottom);
    let s = solid.cut(skirtCavity);
    const beltCavity = zCylinder(d.R - p.beltWall, d.zBeltBottom, p.TH - p.crownT);
    s = s.cut(beltCavity);
    return s;
  });
}

/** 3. 슬리퍼 스커트: ±X 쪽에서 |x| > xc 인 영역을 z 0→zSkirtTop 높이로 박스 cut (Y 는 D+10 으로 넉넉히) */
export function stepSlipperSkirt(solid: Shape3D, p: PistonParams, d: DerivedValues): Shape3D {
  return runStep(3, "슬리퍼 스커트", () => {
    const halfY = (p.D + 10) / 2;
    const xFar = d.R + EPS;
    const plusX = makeBox([d.xc, -halfY, -EPS], [xFar, halfY, d.zSkirtTop]);
    const minusX = makeBox([-xFar, -halfY, -EPS], [-d.xc, halfY, d.zSkirtTop]);
    return solid.cut(plusX).cut(minusX);
  });
}

/** 4. 핀 보스: 박스(±bossX, ±bossY, bossZ0→bossTop) 에서 가운데(±rodGap/2, Z 0→TH−crownT) 를 먼저 빼고 몸통에 fuse */
export function stepPinBoss(solid: Shape3D, p: PistonParams, d: DerivedValues): Shape3D {
  return runStep(4, "핀 보스", () => {
    const boss = makeBox([-d.bossX, -d.bossY, d.bossZ0], [d.bossX, d.bossY, d.bossTop]);
    const halfY = (p.D + 10) / 2;
    const rodSlot = makeBox([-p.rodGap / 2, -halfY, 0], [p.rodGap / 2, halfY, p.TH - p.crownT]);
    const bossPair = boss.cut(rodSlot);
    return solid.fuse(bossPair);
  });
}

/** 5. 핀 구멍: X축 방향 원기둥 반경 pinR, 길이 D+10, 중심 (0,0,zPin) */
export function stepPinHole(solid: Shape3D, p: PistonParams, d: DerivedValues): Shape3D {
  return runStep(5, "핀 구멍", () => {
    const len = p.D + 10;
    const hole = makeCylinder(d.pinR, len, [-len / 2, 0, d.zPin], [1, 0, 0]);
    return solid.cut(hole);
  });
}

/** 6. 링 홈 3개: (R+2 원기둥 − R−depth 원기둥) 높이 = 홈 폭 인 링을 해당 z 에서 cut */
export function stepRingGrooves(solid: Shape3D, p: PistonParams, d: DerivedValues): Shape3D {
  return runStep(6, "링 홈", () => {
    const grooves: { zBot: number; zTop: number; depth: number }[] = [
      { zBot: d.g1Bot, zTop: d.g1Top, depth: p.ringDepth },
      { zBot: d.g2Bot, zTop: d.g2Top, depth: p.ringDepth },
      { zBot: d.oilBot, zTop: d.oilTop, depth: p.oilDepth },
    ];
    let s = solid;
    for (const g of grooves) {
      const outer = zCylinder(d.R + 2, g.zBot, g.zTop);
      const inner = zCylinder(d.R - g.depth, g.zBot - EPS, g.zTop + EPS);
      const ring = outer.cut(inner);
      s = s.cut(ring);
    }
    return s;
  });
}

/** 7. 밸브 포켓 (on 일 때): 상면에서 아래로 깊이만큼 원기둥 cut (위로 +2 여유) */
export function stepValvePockets(solid: Shape3D, p: PistonParams, d: DerivedValues): Shape3D {
  if (!p.valvePockets) return solid;
  return runStep(7, "밸브 포켓", () => {
    let s = solid;
    for (const vp of d.valvePockets) {
      const pocket = makeCylinder(vp.diameter / 2, vp.depth + 2, [vp.x, vp.y, p.TH - vp.depth], [0, 0, 1]);
      s = s.cut(pocket);
    }
    return s;
  });
}

/** 8. 배유 구멍 (on 일 때): 오일 홈 중앙 높이에서 반경 방향 원기둥 4개 cut (벽만 뚫음) */
export function stepDrainHoles(solid: Shape3D, p: PistonParams, d: DerivedValues): Shape3D {
  if (!p.drainHoles) return solid;
  return runStep(8, "배유 구멍", () => {
    let s = solid;
    // 벨트 안쪽 공동에서 시작해 바깥으로 관통 (내부 보스를 건드리지 않도록 벽 근처에서만 시작)
    const rStart = Math.max(0, d.R - p.beltWall - EPS);
    const len = d.R + 2 - rStart;
    for (const h of d.drainHoles) {
      const a = (h.angleDeg * Math.PI) / 180;
      const dir: [number, number, number] = [Math.cos(a), Math.sin(a), 0];
      const start: [number, number, number] = [rStart * dir[0], rStart * dir[1], h.z];
      const hole = makeCylinder(h.diameter / 2, len, start, dir);
      s = s.cut(hole);
    }
    return s;
  });
}

/** 5절 전체: 1→8 순서로 실행 */
export function buildPiston(p: PistonParams): BuildResult {
  const d = derive(p);
  const { solid: body, chamferApplied } = stepBody(p, d);
  let s = stepHollow(body, p, d);
  s = stepSlipperSkirt(s, p, d);
  s = stepPinBoss(s, p, d);
  s = stepPinHole(s, p, d);
  s = stepRingGrooves(s, p, d);
  s = stepValvePockets(s, p, d);
  s = stepDrainHoles(s, p, d);
  return { solid: s, chamferApplied };
}
