/**
 * 2단계 임시 구현: 원기둥 하나. (4단계에서 5절 형상 생성으로 교체)
 */
import { makeCylinder, type Shape3D } from "replicad";
import type { PistonParams } from "./params";

export interface BuildResult {
  solid: Shape3D;
  /** 크라운 챔퍼 적용 여부 (실패 시 false) */
  chamferApplied: boolean;
}

export function buildPiston(p: PistonParams): BuildResult {
  return { solid: makeCylinder(p.D / 2, p.TH), chamferApplied: false };
}
