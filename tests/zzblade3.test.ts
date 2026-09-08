/// <reference types="node" />
import "./setup";
import { test } from "vitest";
import { getOC, cast, draw, loft, drawPointsInterpolation, makeBSplineApproximation,
  measureShapeVolumeProperties, type Wire } from "replicad";

function naca(t:number,c:number,N=60):[number,number][]{
  const y=(x:number)=>5*t*c*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x**3-0.1015*x**4);
  const p:[number,number][]=[];
  for(let i=0;i<=N;i++){const x=i/N;p.push([x*c,y(x)]);}
  for(let i=N-1;i>0;i--){const x=i/N;p.push([x*c,-y(x)]);}
  return p;
}
const err=(e:any)=>{try{const oc:any=getOC();return oc.getExceptionMessage?oc.getExceptionMessage(e):String(e);}catch{return String(e);}};

test("I: what degree is a section curve, really?", () => {
  const oc:any=getOC();
  const pts=naca(0.10,70);
  const probe=(label:string, w:any)=>{
    const eds=w.edges ?? [];
    const info=eds.map((e:any)=>{
      try{
        const r=oc.BRep_Tool.Curve(e.wrapped,0,0);
        const c=r.curve ?? r;
        return `${e.geomType}(deg=${c.Degree?.()??"?"},poles=${c.NbPoles?.()??"?"},cont=${c.Continuity?.()??"?"})`;
      }catch(x){return `${e.geomType}(?)`;}
    });
    console.log(`[curve ${label}] edges=${eds.length} :: ${info.slice(0,4).join(" ")}${eds.length>4?" ...":""}`);
  };
  // a) drawPointsInterpolation, closed by repeating first point
  probe("drawPointsInterpolation", drawPointsInterpolation(pts.concat([pts[0]]),{tolerance:1e-3}).sketchOnPlane("XY",0).wire);
  // b) tighter tolerance
  probe("interp tol=1e-6 degMax=5", drawPointsInterpolation(pts.concat([pts[0]]),{tolerance:1e-6,degMax:5}).sketchOnPlane("XY",0).wire);
  // c) polyline
  let d=draw(pts[0]); for(const p of pts.slice(1)) d=d.lineTo(p);
  probe("polyline", d.close().sketchOnPlane("XY",0).wire);
  // d) raw makeBSplineApproximation (3D edge)
  const e3=makeBSplineApproximation(pts.concat([pts[0]]).map(([x,y])=>[x,y,0] as [number,number,number]),{tolerance:1e-3,degMax:5});
  try{
    const r=oc.BRep_Tool.Curve((e3 as any).wrapped,0,0); const c=r.curve??r;
    console.log(`[curve makeBSplineApproximation] geom=${(e3 as any).geomType} deg=${c.Degree?.()} poles=${c.NbPoles?.()} cont=${c.Continuity?.()}`);
  }catch(x){console.log(`[curve makeBSplineApproximation] ${err(x)}`);}
});

test("J: does a smooth section give a smooth surface in U?", () => {
  const oc:any=getOC();
  const mk=(interp:(p:[number,number][])=>any)=>{
    const ws:Wire[]=[];
    for(let i=0;i<9;i++){
      const f=i/8, chord=70-30*f, st=-(58+(6-58)*f), z=220*f;
      ws.push(interp(naca(0.10,chord).map(([x,y])=>[x-chord*0.35,y] as [number,number])).sketchOnPlane("XY",z).wire.rotate(st,[0,0,z],[0,0,1]));
    }
    return ws;
  };
  for (const [label, fn] of [
    ["tol1e-3", (p:any)=>drawPointsInterpolation(p.concat([p[0]]),{tolerance:1e-3})],
    ["tol1e-6 degMax5", (p:any)=>drawPointsInterpolation(p.concat([p[0]]),{tolerance:1e-6,degMax:5})],
  ] as const) {
    try{
      const t0=performance.now();
      const b:any=loft(mk(fn as any),{ruled:false});
      const ms=performance.now()-t0;
      const s=oc.BRep_Tool.Surface(b.faces.find((f:any)=>f.surface.surfaceType==="BSPLINE_SURFACE").wrapped);
      console.log(`[surf ${label}] loftMs=${ms.toFixed(0)} faces=${b.faces.length} vol=${measureShapeVolumeProperties(b).volume.toFixed(0)} Udeg=${s.UDegree()} Vdeg=${s.VDegree()} nU=${s.NbUPoles()} nV=${s.NbVPoles()} cont=${s.Continuity()} isCNu1=${s.IsCNu(1)} isCNu2=${s.IsCNu(2)} isCNv2=${s.IsCNv(2)}`);
    }catch(e){console.log(`[surf ${label}] FAILED :: ${err(e)}`);}
  }
});
