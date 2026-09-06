// 단일 HTML 파일 빌드: vite(standalone 설정) → JS/CSS 인라인 + wasm(gzip→base64) 내장
// 결과: dist-standalone/piston-webcad-standalone.html (외부 요청 0건)
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const OUT = "dist-standalone";

execSync("npx vite build -c vite.standalone.config.ts", { stdio: "inherit" });

const assets = readdirSync(`${OUT}/assets`);
const jsFile = assets.find((f) => f.startsWith("index-") && f.endsWith(".js"));
const cssFile = assets.find((f) => f.endsWith(".css"));
if (!jsFile) throw new Error("index-*.js 를 찾지 못했습니다");
const extraJs = assets.filter((f) => f.endsWith(".js") && f !== jsFile);
if (extraJs.length) console.warn("주의: 추가 JS 청크가 있습니다 (인라인 안 됨):", extraJs);

let html = readFileSync(`${OUT}/index.html`, "utf8");
const js = readFileSync(`${OUT}/assets/${jsFile}`, "utf8").replace(/<\/script/gi, "<\\/script");
const css = cssFile ? readFileSync(`${OUT}/assets/${cssFile}`, "utf8") : "";

const wasmPath = require.resolve("replicad-opencascadejs/wasm");
const wasm = readFileSync(wasmPath);
const gz = gzipSync(wasm, { level: 9 });
const b64 = gz.toString("base64");

html = html
  .replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/, "")
  .replace(/<link rel="stylesheet"[^>]*>/, "")
  .replace(/<link rel="modulepreload"[^>]*>/g, "");

// 아티팩트는 <!doctype>/<html>/<head>/<body> 골격을 밖에서 씌우므로 본문 조각만 남긴다
const title = "피스톤 WebCAD 데모";
const body = `<title>${title}</title>
<style>${css}</style>
<div id="root"></div>
<script id="wasm-gz" type="application/octet-stream">${b64}</script>
<script type="module">${js}</script>
`;
writeFileSync(`${OUT}/piston-webcad-standalone.html`, body);

// 로컬 확인용 완전한 HTML 도 같이 (file:// 또는 정적 서버)
const full = `<!doctype html>\n<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>\n${body}</body></html>\n`;
writeFileSync(`${OUT}/piston-webcad-standalone.full.html`, full);

const size = statSync(`${OUT}/piston-webcad-standalone.html`).size;
console.log(`wasm ${wasm.length.toLocaleString()} B → gzip ${gz.length.toLocaleString()} B → base64 ${b64.length.toLocaleString()} 자`);
console.log(`JS ${js.length.toLocaleString()} 자, CSS ${css.length.toLocaleString()} 자`);
console.log(`→ ${OUT}/piston-webcad-standalone.html ${size.toLocaleString()} B (${(size / 1024 / 1024).toFixed(2)} MiB)`);
