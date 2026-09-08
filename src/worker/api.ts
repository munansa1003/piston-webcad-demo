/**
 * 워커 ↔ 메인 스레드 공유 타입. 메인 스레드는 이 파일만 import 한다 (replicad 를 직접 import 하지 않음).
 */
import type { PistonParams, RuleWarning } from "../cad/params";

export interface MeshPayload {
  vertices: number[];
  triangles: number[];
  normals: number[];
  faceGroups: { start: number; count: number; faceId: number }[];
}

export interface EdgesPayload {
  lines: number[];
  edgeGroups: { start: number; count: number; edgeId: number }[];
}

export interface GenerateResult {
  faces: MeshPayload;
  edges: EdgesPayload;
  /** 체적 mm³ */
  volume: number;
  /** face 개수 */
  faceCount: number;
  /** 생성 시간 ms (형상 생성 + 메시 추출 포함) */
  timeMs: number;
  /** 형상 생성만 ms */
  buildMs: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  warnings: RuleWarning[];
  /** 챔퍼가 적용되었는지 (실패 시 생략됨) */
  chamferApplied: boolean;
  /** 절개 보기를 요청했고 실제로 적용되었는지 (실패 시 전체 모델 표시) */
  cutawayApplied: boolean;
}

/** 커널이 3D 솔리드에서 직접 뽑은 투상도 (숨은선 제거) */
export interface ProjectionResult {
  plane: ProjectionPlaneName;
  /** SVG path d 문자열 */
  visible: string[];
  hidden: string[];
  viewBox: string;
  ms: number;
}

export type ProjectionPlaneName = "front" | "top" | "right";

export interface CadWorkerApi {
  /** wasm 로드 (1회). 여러 번 불러도 한 번만 로드된다. */
  init(): Promise<{ loadMs: number }>;
  /** 파라미터로 피스톤 생성. 실패하면 단계 번호가 포함된 Error 를 throw 한다. */
  generate(params: PistonParams, options?: { cutaway?: boolean }): Promise<GenerateResult>;
  /** 마지막 성공 solid 를 STEP 으로 내보냄 (재생성 없음) */
  exportSTEP(): Promise<Blob>;
  /** 마지막 성공 solid 를 STL 로 내보냄 (재생성 없음) */
  exportSTL(): Promise<Blob>;
  /** 마지막 성공 solid 에서 투상도를 뽑는다 (재생성 없음) */
  project(plane: ProjectionPlaneName): Promise<ProjectionResult>;
  /** 캐시된 solid 가 있는지 */
  hasCached(): Promise<boolean>;
}
