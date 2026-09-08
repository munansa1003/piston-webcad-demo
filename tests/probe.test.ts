/// <reference types="node" />
import "./setup";
import { test, expect } from "vitest";
import { exportSTEP, createAssembly, makeBox, makeCylinder, loft, drawProjection, measureShapeVolumeProperties, importSTEP, draw, type Wire } from "replicad";
import { buildPiston } from "../src/cad/piston";
import { DEFAULT_PARAMS } from "../src/cad/params";

test("assembly: N instances + colours + names in one STEP", () => {
  const p = buildPiston(DEFAULT_PARAMS).solid;
  const shapes: any[] = [];
  for (let i = 0; i < 4; i++) {
    shapes.push({ shape: p.clone().translate([i * 100, 0, 0]), color: "#aa3333", name: `Piston.${i + 1}` });
  }
  shapes.push({ shape: makeBox([-60, -60, -20], [360, 60, 0]), color: "#3333aa", name: "Block.1" });
  const t0 = performance.now();
  const blob = exportSTEP(shapes);
  const ms = performance.now() - t0;
  return blob.text().then((txt) => {
    const products = (txt.match(/PRODUCT\(/g) || []).length;
    const nauo = (txt.match(/NEXT_ASSEMBLY_USAGE_OCCURRENCE/g) || []).length;
    const colours = (txt.match(/COLOUR_RGB/g) || []).length;
    const schema = (txt.match(/FILE_SCHEMA[^;]*/) || [""])[0];
    console.log(`[assembly] shapes=5 exportMs=${ms.toFixed(0)} chars=${txt.length} PRODUCT=${products} NAUO=${nauo} COLOUR_RGB=${colours}`);
    console.log(`[assembly] ${schema.slice(0, 120)}`);
    console.log(`[assembly] names present: ${["Piston.1","Piston.4","Block.1"].map(n => txt.includes(n)).join(",")}`);
    expect(products).toBeGreaterThan(1);
  });
});

test("createAssembly runtime surface", () => {
  const a = createAssembly([{ shape: makeBox([0,0,0],[1,1,1]), name: "a" }]);
  const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(a));
  console.log(`[createAssembly] methods: ${proto.join(", ")}`);
});

test("freeform: twisted airfoil by loft of 9 sections", () => {
  const naca = (t: number, c: number): [number, number][] => {
    const pts: [number, number][] = [];
    const N = 40;
    for (let i = 0; i <= N; i++) { const x = i / N; const y = 5*t*c*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x**3-0.1015*x**4); pts.push([x*c, y]); }
    for (let i = N - 1; i > 0; i--) { const x = i / N; const y = 5*t*c*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x**3-0.1015*x**4); pts.push([x*c, -y]); }
    return pts;
  };
  const t0 = performance.now();
  const sections: any[] = [];
  const NS = 9;
  for (let i = 0; i < NS; i++) {
    const f = i / (NS - 1);
    const chord = 60 - 25 * f;
    const twist = -35 * f;               // degrees
    const z = 200 * f;
    const pts = naca(0.12, chord);
    let d = draw([pts[0][0] - chord/2, pts[0][1]]);
    for (const [x, y] of pts.slice(1)) d = d.lineTo([x - chord/2, y]);
    const bp = d.close();
    const sk = bp.sketchOnPlane("XY", z).wire.rotate(twist, [0,0,z], [0,0,1]);
    sections.push(sk);
  }
  const blade = loft(sections as Wire[], { ruled: false });
  const buildMs = performance.now() - t0;
  const props = measureShapeVolumeProperties(blade);
  const t1 = performance.now();
  const proj = drawProjection(blade, "front");
  const projMs = performance.now() - t1;
  const surfTypes = new Set(blade.faces.map((f: any) => f.surface.surfaceType));
  console.log(`[airfoil] loftMs=${buildMs.toFixed(0)} faces=${blade.faces.length} vol=${props.volume.toFixed(0)} surfaces=${[...surfTypes].join("/")} projMs=${projMs.toFixed(0)} visible=${proj.visible.toSVGPaths().length} hidden=${proj.hidden.toSVGPaths().length}`);
  expect(blade.faces.length).toBeGreaterThan(2);
});
