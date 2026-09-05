/**
 * 파라미터 ↔ URL 쿼리스트링 동기화 (순수 함수). 기본값과 다른 값만 쿼리에 넣는다.
 * 예: ?D=90&CH=32&valvePockets=0
 */
import {
  BOOLEAN_PARAM_SPECS,
  DEFAULT_PARAMS,
  NUMERIC_PARAM_SPECS,
  clampParams,
  type PistonParams,
} from "./params";

export function paramsToQuery(p: PistonParams): string {
  const q = new URLSearchParams();
  for (const s of NUMERIC_PARAM_SPECS) {
    if (p[s.key] !== DEFAULT_PARAMS[s.key]) q.set(s.key, String(p[s.key]));
  }
  for (const s of BOOLEAN_PARAM_SPECS) {
    if (p[s.key] !== DEFAULT_PARAMS[s.key]) q.set(s.key, p[s.key] ? "1" : "0");
  }
  return q.toString();
}

/** 쿼리에서 파라미터를 읽는다. 없거나 잘못된 키는 기본값. 범위 밖은 잘라냄. */
export function queryToParams(query: string): PistonParams {
  const q = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const p: PistonParams = { ...DEFAULT_PARAMS };
  for (const s of NUMERIC_PARAM_SPECS) {
    const raw = q.get(s.key);
    if (raw === null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) p[s.key] = n;
  }
  for (const s of BOOLEAN_PARAM_SPECS) {
    const raw = q.get(s.key);
    if (raw === null) continue;
    const v = raw.trim().toLowerCase();
    if (v === "1" || v === "true" || v === "on") p[s.key] = true;
    else if (v === "0" || v === "false" || v === "off") p[s.key] = false;
  }
  return clampParams(p);
}
