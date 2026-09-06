/**
 * CAD API 구현 (워커/단일 파일 공용). OC 로더만 바깥에서 주입한다.
 * - 워커: cad.worker.ts 가 locateFile(wasm URL) 로더를 넣고 comlink 로 expose
 * - 단일 파일(아티팩트) 빌드: src/standalone/ 이 wasmBinary 로더를 넣고 메인 스레드에서 직접 호출
 */
import { setOC, DEG2RAD, measureVolume, makeBox, type Shape3D } from "replicad";
import type { OpenCascadeInstance } from "replicad-opencascadejs";

import { buildPiston } from "../cad/piston";
import { describeCadError } from "../cad/errors";
import { checkRules, derive, type PistonParams } from "../cad/params";
import type { CadWorkerApi, GenerateResult } from "./api";

export interface CadApiOptions {
  /** 동기 형상 생성 직전에 호출 (메인 스레드 변형이 "생성 중" 을 그릴 시간을 주는 용도) */
  beforeBuild?: () => Promise<void>;
  /** STL 을 바이너리로 내보낼지 (기본 true). 아티팩트 뷰어처럼 텍스트만 저장 가능한 곳은 false */
  stlBinary?: boolean;
}

export function createCadApi(loadOC: () => Promise<OpenCascadeInstance>, options: CadApiOptions = {}): CadWorkerApi {
const { beforeBuild, stlBinary = true } = options;
let initPromise: Promise<{ loadMs: number }> | null = null;

/** 마지막 성공 solid (export 는 이것만 사용, 재생성 금지) */
let lastSolid: Shape3D | null = null;

function safeDelete(shape: Shape3D | null): void {
  if (!shape) return;
  try {
    shape.delete();
  } catch {
    /* ignore */
  }
}

const api: CadWorkerApi = {
  init() {
    if (!initPromise) {
      initPromise = (async () => {
        const t0 = performance.now();
        const OC = await loadOC();
        setOC(OC);
        return { loadMs: performance.now() - t0 };
      })();
      initPromise.catch(() => {
        // 실패하면 다음 init() 호출에서 다시 시도할 수 있게 초기화
        initPromise = null;
      });
    }
    return initPromise;
  },

  async generate(params: PistonParams, options = {}): Promise<GenerateResult> {
    await api.init();
    if (beforeBuild) await beforeBuild();
    const derived = derive(params);
    const warnings = checkRules(params, derived);

    const t0 = performance.now();
    let solid: Shape3D;
    let chamferApplied = false;
    try {
      const built = buildPiston(params);
      solid = built.solid;
      chamferApplied = built.chamferApplied;
    } catch (err) {
      throw new Error(describeCadError(err));
    }
    const buildMs = performance.now() - t0;

    let display: Shape3D = solid;
    let cutawayApplied = false;
    if (options.cutaway) {
      // 1/4 절개 보기: x>0, y>0 사분면 제거 (표시 전용, 캐시/내보내기에는 영향 없음). 실패하면 전체 모델로 표시.
      try {
        const big = Math.max(params.D, params.TH) * 2;
        const quadrant = makeBox([0, 0, -1], [big, big, params.TH + 1]);
        display = solid.cut(quadrant);
        cutawayApplied = true;
      } catch {
        display = solid;
      }
    }

    let faces: ReturnType<Shape3D["mesh"]>;
    let edges: ReturnType<Shape3D["meshEdges"]>;
    let volume: number;
    let faceCount: number;
    let min: [number, number, number];
    let max: [number, number, number];
    try {
      faces = display.mesh({ tolerance: 0.1, angularTolerance: 15 * DEG2RAD });
      edges = display.meshEdges({ tolerance: 0.1, angularTolerance: 15 * DEG2RAD });
      volume = measureVolume(solid);
      faceCount = solid.faces.length;
      const bounds = solid.boundingBox.bounds;
      min = [bounds[0][0], bounds[0][1], bounds[0][2]];
      max = [bounds[1][0], bounds[1][1], bounds[1][2]];
    } catch (err) {
      // 새로 만든 solid 는 캐시되지 않으므로 여기서 해제 (마지막 성공본은 그대로 유지)
      safeDelete(display !== solid ? display : null);
      safeDelete(solid);
      throw new Error(`[단계 9: 메시 추출] ${describeCadError(err)}`);
    }
    const timeMs = performance.now() - t0;

    // 이전 캐시 정리 후 교체
    if (lastSolid && lastSolid !== solid) safeDelete(lastSolid);
    lastSolid = solid;
    if (display !== solid) safeDelete(display);

    return {
      faces: {
        vertices: faces.vertices,
        triangles: faces.triangles,
        normals: faces.normals,
        faceGroups: faces.faceGroups,
      },
      edges: { lines: edges.lines, edgeGroups: edges.edgeGroups },
      volume,
      faceCount,
      timeMs,
      buildMs,
      bbox: { min, max },
      warnings,
      chamferApplied,
      cutawayApplied,
    };
  },

  async exportSTEP(): Promise<Blob> {
    if (!lastSolid) throw new Error("내보낼 모델이 없습니다 (먼저 생성하세요)");
    return lastSolid.blobSTEP();
  },

  async exportSTL(): Promise<Blob> {
    if (!lastSolid) throw new Error("내보낼 모델이 없습니다 (먼저 생성하세요)");
    return lastSolid.blobSTL({ tolerance: 0.05, angularTolerance: 10 * DEG2RAD, binary: stlBinary });
  },

  async hasCached(): Promise<boolean> {
    return lastSolid !== null;
  },
};


  return api;
}
