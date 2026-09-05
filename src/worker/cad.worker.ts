/// <reference lib="webworker" />
/**
 * CAD 워커: OpenCascade wasm 을 한 번 로드하고 replicad 에 주입한 뒤,
 * comlink 로 init / generate / exportSTEP / exportSTL 을 노출한다.
 * 참고: replicad 모노리포 packages/replicad-app-example/src/worker.js
 */
import opencascade from "replicad-opencascadejs";
import opencascadeWasmUrl from "replicad-opencascadejs/wasm?url";
import { setOC, getOC, DEG2RAD, measureVolume, makeBox, type Shape3D } from "replicad";
import { expose } from "comlink";

import { buildPiston } from "../cad/piston";
import { checkRules, derive, type PistonParams } from "../cad/params";
import type { CadWorkerApi, GenerateResult } from "./api";

let initPromise: Promise<{ loadMs: number }> | null = null;

/** 마지막 성공 solid (export 는 이것만 사용, 재생성 금지) */
let lastSolid: Shape3D | null = null;

/** wasm 예외 / Emscripten 포인터 / 일반 Error 를 사람이 읽을 수 있는 문자열로 */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    const oc = getOC() as unknown as {
      getExceptionMessage?: (e: unknown) => [string, string] | string;
    };
    if (typeof WebAssembly !== "undefined" && "Exception" in WebAssembly) {
      const ExceptionCtor = (WebAssembly as unknown as { Exception: new (...a: unknown[]) => unknown }).Exception;
      if (err instanceof ExceptionCtor && oc.getExceptionMessage) {
        const m = oc.getExceptionMessage(err);
        return Array.isArray(m) ? m.filter(Boolean).join(": ") : String(m);
      }
    }
    if (typeof err === "number" && oc.getExceptionMessage) {
      const m = oc.getExceptionMessage(err);
      return Array.isArray(m) ? m.filter(Boolean).join(": ") : String(m);
    }
  } catch {
    /* ignore */
  }
  return String(err);
}

const api: CadWorkerApi = {
  init() {
    if (!initPromise) {
      initPromise = (async () => {
        const t0 = performance.now();
        const OC = await opencascade({
          locateFile: () => opencascadeWasmUrl,
        });
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
      throw new Error(describeError(err));
    }
    const buildMs = performance.now() - t0;

    let display: Shape3D = solid;
    if (options.cutaway) {
      // 1/4 절개 보기: x>0, y>0 사분면 제거 (표시 전용, 캐시/내보내기에는 영향 없음)
      try {
        const big = Math.max(params.D, params.TH) * 2;
        const quadrant = makeBox([0, 0, -1], [big, big, params.TH + 1]);
        display = solid.cut(quadrant);
      } catch (err) {
        throw new Error(`절개 보기 실패: ${describeError(err)}`);
      }
    }

    const faces = display.mesh({ tolerance: 0.1, angularTolerance: 15 * DEG2RAD });
    const edges = display.meshEdges({ tolerance: 0.1, angularTolerance: 15 * DEG2RAD });
    const volume = measureVolume(solid);
    const faceCount = solid.faces.length;
    const [min, max] = solid.boundingBox.bounds;
    const timeMs = performance.now() - t0;

    // 이전 캐시 정리 후 교체
    if (lastSolid && lastSolid !== solid) {
      try {
        lastSolid.delete();
      } catch {
        /* ignore */
      }
    }
    lastSolid = solid;
    if (display !== solid) {
      try {
        display.delete();
      } catch {
        /* ignore */
      }
    }

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
      bbox: { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] },
      warnings,
      chamferApplied,
    };
  },

  async exportSTEP(): Promise<Blob> {
    if (!lastSolid) throw new Error("내보낼 모델이 없습니다 (먼저 생성하세요)");
    return lastSolid.blobSTEP();
  },

  async exportSTL(): Promise<Blob> {
    if (!lastSolid) throw new Error("내보낼 모델이 없습니다 (먼저 생성하세요)");
    return lastSolid.blobSTL({ tolerance: 0.05, angularTolerance: 10 * DEG2RAD, binary: true });
  },

  async hasCached(): Promise<boolean> {
    return lastSolid !== null;
  },
};

expose(api);
