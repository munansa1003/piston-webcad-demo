import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../src/cad/params";
import { paramsToQuery, queryToParams } from "../src/cad/urlState";

describe("urlState.ts (URL 쿼리 동기화)", () => {
  it("기본값은 빈 쿼리", () => {
    expect(paramsToQuery(DEFAULT_PARAMS)).toBe("");
    expect(queryToParams("")).toEqual(DEFAULT_PARAMS);
  });

  it("기본값과 다른 값만 쿼리에 들어가고, 되돌리면 같은 파라미터", () => {
    const p = { ...DEFAULT_PARAMS, D: 90, CH: 32.5, valvePockets: false };
    const q = paramsToQuery(p);
    expect(q).toBe("D=90&CH=32.5&valvePockets=0");
    expect(queryToParams(`?${q}`)).toEqual(p);
  });

  it("잘못된 값은 무시하고 범위 밖은 잘라낸다", () => {
    const p = queryToParams("?D=abc&TH=999&pinD=1&drainHoles=maybe&unknown=3");
    expect(p.D).toBe(DEFAULT_PARAMS.D);
    expect(p.TH).toBe(80);
    expect(p.pinD).toBe(14);
    expect(p.drainHoles).toBe(true);
  });
});
