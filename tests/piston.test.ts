import { describe, expect, it } from "vitest";
import { measureVolume } from "replicad";
import "./setup";
import { DEFAULT_PARAMS, checkRules, type PistonParams } from "../src/cad/params";
import { buildPiston } from "../src/cad/piston";

function timed<T>(fn: () => T): { value: T; ms: number } {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
}

describe("piston.ts (OpenCascade wasm, Node)", () => {
  it("(1) 기본값으로 generate 성공: 면 ≥ 40, 체적 80,000~120,000 mm³", () => {
    const { value, ms } = timed(() => buildPiston(DEFAULT_PARAMS));
    const solid = value.solid;
    const faceCount = solid.faces.length;
    const volume = measureVolume(solid);
    // 성능 기록 (README 에 적음)
    console.log(
      `[perf] 기본값 생성 ${ms.toFixed(0)} ms, 면 ${faceCount}개, 체적 ${volume.toFixed(0)} mm³, ` +
        `챔퍼 ${value.chamferApplied ? "적용" : "생략"}, wasm 로드 ${globalThis.__wasmLoadMs?.toFixed(0)} ms`
    );
    expect(faceCount).toBeGreaterThanOrEqual(40);
    expect(volume).toBeGreaterThanOrEqual(80_000);
    expect(volume).toBeLessThanOrEqual(120_000);
    expect(solid.solids.length).toBe(1);
  });

  it("(4) 극단값 (D=60, TH=35, CH=20) 에서도 예외 없이 생성 (경고는 허용)", () => {
    const p: PistonParams = { ...DEFAULT_PARAMS, D: 60, TH: 35, CH: 20 };
    expect(checkRules(p).length).toBeGreaterThan(0);
    const { value, ms } = timed(() => buildPiston(p));
    console.log(`[perf] 극단값(소) 생성 ${ms.toFixed(0)} ms, 면 ${value.solid.faces.length}개, 체적 ${measureVolume(value.solid).toFixed(0)} mm³`);
    expect(value.solid.faces.length).toBeGreaterThan(10);
    expect(measureVolume(value.solid)).toBeGreaterThan(0);
  });

  it("(4) 극단값 (D=110, TH=80, CH=50) 에서도 예외 없이 생성 (경고는 허용)", () => {
    const p: PistonParams = { ...DEFAULT_PARAMS, D: 110, TH: 80, CH: 50 };
    const { value, ms } = timed(() => buildPiston(p));
    console.log(`[perf] 극단값(대) 생성 ${ms.toFixed(0)} ms, 면 ${value.solid.faces.length}개, 체적 ${measureVolume(value.solid).toFixed(0)} mm³`);
    expect(value.solid.faces.length).toBeGreaterThan(10);
    expect(measureVolume(value.solid)).toBeGreaterThan(0);
  });

  it("밸브 포켓·배유 구멍을 끄면 체적이 커지고 면이 줄어든다", () => {
    const withAll = buildPiston(DEFAULT_PARAMS).solid;
    const without = buildPiston({ ...DEFAULT_PARAMS, valvePockets: false, drainHoles: false }).solid;
    expect(measureVolume(without)).toBeGreaterThan(measureVolume(withAll));
    expect(without.faces.length).toBeLessThan(withAll.faces.length);
  });

  it("단계 실패 시 오류 메시지에 단계 번호가 들어간다", () => {
    // 스커트 벽이 외경보다 두꺼운 말도 안 되는 값 → 속 파기(2단계) 원기둥 반경이 음수
    const bad: PistonParams = { ...DEFAULT_PARAMS, skirtWall: 500 };
    expect(() => buildPiston(bad)).toThrow(/\[단계 \d+:/);
  });
});
