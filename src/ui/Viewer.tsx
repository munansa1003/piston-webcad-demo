/**
 * 3D 뷰어: 면(솔리드 색) + 모서리 선, OrbitControls(회전/줌/팬, 터치), 축 표시, 자동 카메라 프레이밍.
 * 참고: replicad-app-example 의 ThreeContext.jsx / ReplicadMesh.jsx
 */
import { memo, useEffect, useLayoutEffect, useRef, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { GizmoHelper, GizmoViewport, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { syncFaces, syncLines } from "replicad-threejs-helper";
import type { EdgesPayload, GenerateResult, MeshPayload } from "../worker/api";

// replicad 는 Z 가 위 (three 기본은 Y). 표현용 기본값만 바꾼다.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

type BBox = GenerateResult["bbox"];

const ShapeMeshes = memo(function ShapeMeshes({ faces, edges }: { faces: MeshPayload; edges: EdgesPayload }) {
  const { invalidate } = useThree();
  const body = useRef(new THREE.BufferGeometry());
  const lines = useRef(new THREE.BufferGeometry());

  useLayoutEffect(() => {
    syncFaces(body.current, faces);
    syncLines(lines.current, edges);
    invalidate();
  }, [faces, edges, invalidate]);

  useEffect(() => {
    const b = body.current;
    const l = lines.current;
    return () => {
      b.dispose();
      l.dispose();
      invalidate();
    };
  }, [invalidate]);

  return (
    <group>
      <mesh geometry={body.current} castShadow receiveShadow>
        <meshStandardMaterial
          color="#8fa7b8"
          metalness={0.25}
          roughness={0.55}
          polygonOffset
          polygonOffsetFactor={2.0}
          polygonOffsetUnits={1.0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={lines.current}>
        <lineBasicMaterial color="#1f2d38" />
      </lineSegments>
    </group>
  );
});

/**
 * 바운딩 박스가 처음 오거나 크기가 크게(>20%) 바뀌면 카메라를 자동으로 맞춘다.
 * frameRequest 값이 바뀌면 강제로 다시 맞춘다 ("뷰 맞춤" 버튼).
 */
function AutoFrame({ bbox, frameRequest }: { bbox: BBox | null; frameRequest: number }) {
  const { camera, controls, invalidate } = useThree();
  const lastDiag = useRef(0);
  const lastRequest = useRef(frameRequest);

  useEffect(() => {
    if (!bbox) return;
    const [x0, y0, z0] = bbox.min;
    const [x1, y1, z1] = bbox.max;
    const diag = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const forced = frameRequest !== lastRequest.current;
    lastRequest.current = frameRequest;
    const changed = lastDiag.current === 0 || Math.abs(diag - lastDiag.current) / lastDiag.current > 0.2;
    if (!forced && !changed) return;
    lastDiag.current = diag;

    const center = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const persp = camera as THREE.PerspectiveCamera;
    const fov = ((persp.fov ?? 50) * Math.PI) / 180;
    const dist = (diag / 2 / Math.tan(fov / 2)) * 1.15;
    const dir = new THREE.Vector3(1, -1.2, 0.8).normalize();
    camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
    camera.near = Math.max(0.1, dist / 100);
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (orbit) {
      orbit.target.copy(center);
      orbit.update();
    } else {
      camera.lookAt(center);
    }
    invalidate();
  }, [bbox, frameRequest, camera, controls, invalidate]);

  return null;
}

export interface ViewerProps {
  result: GenerateResult | null;
  /** 값이 바뀔 때마다 카메라를 다시 맞춤 */
  frameRequest: number;
}

export default function Viewer({ result, frameRequest }: ViewerProps) {
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1;
  const axisLen = result ? Math.max(result.bbox.max[0] - result.bbox.min[0], result.bbox.max[2]) * 0.8 : 50;

  return (
    <Suspense fallback={null}>
      <Canvas
        className="viewer-canvas"
        dpr={dpr}
        frameloop="demand"
        camera={{ position: [120, -140, 100], fov: 45, near: 0.5, far: 5000 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      >
        <OrbitControls makeDefault enableDamping={false} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[200, -150, 300]} intensity={2.0} />
        <directionalLight position={[-150, 200, 100]} intensity={0.8} />
        <hemisphereLight args={["#ffffff", "#667788", 0.6]} />
        <axesHelper args={[axisLen]} />
        {result && <ShapeMeshes faces={result.faces} edges={result.edges} />}
        <AutoFrame bbox={result?.bbox ?? null} frameRequest={frameRequest} />
        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport axisColors={["#e0483e", "#3fa34d", "#3b82f6"]} labelColor="#ffffff" />
        </GizmoHelper>
      </Canvas>
    </Suspense>
  );
}
