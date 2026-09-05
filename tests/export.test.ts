import { describe, expect, it } from "vitest";
import { DEG2RAD } from "replicad";
import "./setup";
import { DEFAULT_PARAMS } from "../src/cad/params";
import { buildPiston } from "../src/cad/piston";

describe("STEP / STL 내보내기 (워커의 exportSTEP/exportSTL 과 같은 replicad 호출)", () => {
  it("(2) STEP blob 텍스트가 ISO-10303-21 로 시작하고 길이 > 50,000자", async () => {
    const { solid } = buildPiston(DEFAULT_PARAMS);
    const t0 = performance.now();
    const blob = solid.blobSTEP();
    const text = await blob.text();
    console.log(`[perf] STEP 내보내기 ${(performance.now() - t0).toFixed(0)} ms, ${text.length.toLocaleString()} 자`);
    expect(text.startsWith("ISO-10303-21")).toBe(true);
    expect(text.length).toBeGreaterThan(50_000);
  });

  it("(3) STL blob 길이 > 10,000", async () => {
    const { solid } = buildPiston(DEFAULT_PARAMS);
    const t0 = performance.now();
    const blob = solid.blobSTL({ tolerance: 0.05, angularTolerance: 10 * DEG2RAD, binary: true });
    const buf = await blob.arrayBuffer();
    console.log(`[perf] STL 내보내기 ${(performance.now() - t0).toFixed(0)} ms, ${buf.byteLength.toLocaleString()} 바이트`);
    expect(buf.byteLength).toBeGreaterThan(10_000);
    // 바이너리 STL: 80바이트 헤더 + 4바이트 삼각형 수 + 50바이트 × n
    const n = new DataView(buf).getUint32(80, true);
    expect(buf.byteLength).toBe(84 + 50 * n);
    expect(n).toBeGreaterThan(200);
  });
});
