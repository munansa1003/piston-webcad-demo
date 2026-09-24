import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const [file, outBase] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const report = {};
for (const [name, vp, scheme] of [["desk", { width: 1100, height: 900 }, "light"], ["phone", { width: 390, height: 844 }, "dark"]]) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto("file://" + file, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    wide: Array.from(document.querySelectorAll("body *")).filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 && !e.closest(".tablewrap") && getComputedStyle(e).position !== "fixed"; }).slice(0, 8).map((e) => e.className + ":" + Math.round(e.getBoundingClientRect().right)),
  }));
  await page.screenshot({ path: `${outBase}-${name}.png`, fullPage: true });
  report[name] = { errs, ...info };
  await ctx.close();
}
console.log(JSON.stringify(report, null, 1));
await browser.close();
