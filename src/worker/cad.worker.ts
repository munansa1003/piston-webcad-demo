/// <reference lib="webworker" />
/**
 * CAD 워커: OpenCascade wasm 을 한 번 로드하고 replicad 에 주입한 뒤,
 * comlink 로 init / generate / exportSTEP / exportSTL 을 노출한다.
 * 참고: replicad 모노리포 packages/replicad-app-example/src/worker.js
 */
import opencascade from "replicad-opencascadejs";
import opencascadeWasmUrl from "replicad-opencascadejs/wasm?url";
import { expose } from "comlink";
import { createCadApi } from "./cadApi";

expose(createCadApi(() => opencascade({ locateFile: () => opencascadeWasmUrl })));
