import { describe, expect, it } from "vitest";
import {
  BOOLEAN_PARAM_SPECS,
  DEFAULT_PARAMS,
  NUMERIC_PARAM_SPECS,
  checkRules,
  clampParams,
  derive,
  exportFileName,
  massFromVolume,
} from "../src/cad/params";

describe("params.ts (순수 함수)", () => {
  it("모든 파라미터 스펙의 기본값이 범위 안에 있다", () => {
    for (const s of NUMERIC_PARAM_SPECS) {
      expect(s.defaultValue, s.key).toBeGreaterThanOrEqual(s.min);
      expect(s.defaultValue, s.key).toBeLessThanOrEqual(s.max);
    }
    expect(NUMERIC_PARAM_SPECS.length + BOOLEAN_PARAM_SPECS.length).toBe(24);
    expect(DEFAULT_PARAMS.D).toBe(81.95);
    expect(DEFAULT_PARAMS.valvePockets).toBe(true);
    expect(DEFAULT_PARAMS.drainHoles).toBe(true);
  });

  it("기본값 유도값이 4절 수식과 일치한다", () => {
    const d = derive(DEFAULT_PARAMS);
    expect(d.R).toBeCloseTo(40.975, 6);
    expect(d.pinR).toBeCloseTo(10.5, 6);
    expect(d.zPin).toBeCloseTo(22, 6);
    expect(d.g1Top).toBeCloseTo(47.5, 6);
    expect(d.g1Bot).toBeCloseTo(46.3, 6);
    expect(d.g2Top).toBeCloseTo(43.1, 6);
    expect(d.g2Bot).toBeCloseTo(41.9, 6);
    expect(d.oilTop).toBeCloseTo(38.9, 6);
    expect(d.oilBot).toBeCloseTo(36.9, 6);
    expect(d.zBeltBottom).toBeCloseTo(35.4, 6);
    expect(d.zSkirtTop).toBeCloseTo(34.4, 6);
    expect(d.xc).toBeCloseTo(40.975 * Math.cos((55 * Math.PI) / 180), 6);
    expect(d.bossX).toBeCloseTo(36.975, 6);
    expect(d.bossY).toBeCloseTo(16.5, 6);
    expect(d.bossZ0).toBeCloseTo(6.5, 6);
    expect(d.bossTop).toBeCloseTo(46.0, 6);
    expect(d.valvePockets).toHaveLength(4);
    expect(d.valvePockets[0]).toMatchObject({ kind: "intake", depth: 1.0 });
    expect(d.valvePockets[0]!.diameter).toBeCloseTo(0.33 * 81.95, 6);
    expect(d.valvePockets[2]).toMatchObject({ kind: "exhaust", depth: 0.7 });
    expect(d.drainHoles.map((h) => h.angleDeg)).toEqual([60, 120, 240, 300]);
    expect(d.drainHoles[0]!.z).toBeCloseTo(37.9, 6);
    expect(d.drainHoles[0]!.diameter).toBe(1.8);
  });

  it("기본값에서는 경고가 없다", () => {
    expect(checkRules(DEFAULT_PARAMS)).toEqual([]);
  });

  it("(5) beltWall=3 → 벽 두께 경고", () => {
    const w = checkRules({ ...DEFAULT_PARAMS, beltWall: 3 });
    expect(w.map((x) => x.code)).toContain("thin-belt-wall");
    expect(w.find((x) => x.code === "thin-belt-wall")?.message).toBe("링 홈 뒤 벽이 너무 얇음");
  });

  it("핀 보스가 바닥 아래로 나가면 경고", () => {
    // D=60, TH=35, CH=20 → zPin=15, bossZ0 = 15-10.5-5 = -0.5
    const w = checkRules({ ...DEFAULT_PARAMS, D: 60, TH: 35, CH: 20 });
    expect(w.map((x) => x.code)).toContain("boss-below-floor");
    expect(w.map((x) => x.code)).toContain("belt-overlaps-pin");
  });

  it("압축고 비율 범위 밖이면 경고", () => {
    expect(checkRules({ ...DEFAULT_PARAMS, D: 110, CH: 20 }).map((x) => x.code)).toContain("ch-ratio-out-of-range");
    expect(checkRules({ ...DEFAULT_PARAMS, D: 60, CH: 50 }).map((x) => x.code)).toContain("ch-ratio-out-of-range");
  });

  it("보스 폭이 남지 않으면 경고", () => {
    // rodGap + 2*bossWall >= 2*bossX : 36 + 20 = 56 >= 2*(30-8)=44
    const w = checkRules({ ...DEFAULT_PARAMS, D: 60, rodGap: 36, bossWall: 10, bossRecess: 8 });
    expect(w.map((x) => x.code)).toContain("no-boss-width");
  });

  it("clampParams 는 범위를 벗어난 값을 자르고 NaN 은 기본값으로", () => {
    const c = clampParams({ ...DEFAULT_PARAMS, D: 500, TH: -3, pinD: Number.NaN });
    expect(c.D).toBe(110);
    expect(c.TH).toBe(35);
    expect(c.pinD).toBe(21);
    expect(c.valvePockets).toBe(true);
  });

  it("파일명과 질량 계산", () => {
    expect(exportFileName(DEFAULT_PARAMS, "step")).toBe("piston_D82_CH30.step");
    expect(exportFileName({ ...DEFAULT_PARAMS, D: 60.4, CH: 20 }, "stl")).toBe("piston_D60_CH20.stl");
    expect(massFromVolume(100_000, 2.7)).toBeCloseTo(270, 6);
  });
});
