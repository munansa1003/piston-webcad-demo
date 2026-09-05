import { describe, expect, it } from "vitest";
import { makeCylinder } from "replicad";
import "./setup";
import { describeCadError } from "../src/cad/errors";
import { DEFAULT_PARAMS } from "../src/cad/params";
import { buildPiston } from "../src/cad/piston";

describe("errors.ts (OpenCascade 예외 메시지)", () => {
  it("wasm 예외가 '[object WebAssembly.Exception]' 이 아닌 읽을 수 있는 메시지로 바뀐다", () => {
    let caught: unknown = null;
    try {
      makeCylinder(-100, 10);
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect(caught instanceof Error).toBe(false);
    const msg = describeCadError(caught);
    console.log(`[errors] 음수 반경 원기둥 → ${msg}`);
    expect(msg).not.toContain("[object");
    expect(msg.length).toBeGreaterThan(5);
  });

  it("단계 오류 메시지에도 커널 메시지가 들어간다", () => {
    let message = "";
    try {
      buildPiston({ ...DEFAULT_PARAMS, skirtWall: 500 });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    console.log(`[errors] 단계 오류 → ${message}`);
    expect(message).toMatch(/^\[단계 \d+:/);
    expect(message).not.toContain("[object");
  });
});
