// Headless visual check of a Digital Twin view (uses the local Chrome + the
// Intel iGPU through ANGLE/EGL; SwiftShader is far too slow for terrain).
//   node scripts/shot.mjs "<url>" out.png [waitMs] [--diag]
import puppeteer from "puppeteer-core";

const [, , url, out = "shot.png", waitMs = "60000", ...flags] = process.argv;
const diag = flags.includes("--diag");
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=gl-egl", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--window-size=1600,1000", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
const logs = [];
const tiles = {};
page.on("console", (m) => { const t = m.type(); if (t === "error" || t === "warning") logs.push(`[${t}] ${m.text().slice(0, 300)}`); });
page.on("pageerror", (e) => logs.push(`[pageerror] ${String(e).slice(0, 300)}`));
page.on("response", (r) => {
  const u = r.url();
  if (r.status() >= 400) logs.push(`[${r.status()}] ${u.slice(0, 160)}`);
  const m = u.match(/\/tiles\/[^/]+\/([^/]+)\/(\d+)\//);
  const key = m ? `${m[1]} z${m[2]}` : u.includes("Terrain3D") ? "terrain" : u.includes("World_Imagery") ? "esri" : u.includes("/models/") || u.includes("/splats/") ? "3dtiles" : null;
  if (key) tiles[key] = (tiles[key] || 0) + 1;
});
await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 }).catch((e) => logs.push(`[goto] ${e.message}`));
// --toggle=Label,Label : click layer checkboxes by their label text once the page is up
const toggle = flags.find((f) => f.startsWith("--toggle="))?.slice(9).split(",") ?? [];
if (toggle.length) {
  await new Promise((r) => setTimeout(r, 15000));
  for (const t of toggle) {
    await page.evaluate((label) => {
      const el = [...document.querySelectorAll("label")].find((l) => l.textContent?.includes(label));
      el?.click();
    }, t);
  }
}
if (flags.includes("--noglobe")) {
  await new Promise((r) => setTimeout(r, 15000));
  await page.evaluate(() => { const v = window.__agrotwinViewer; if (v) { v.scene.globe.show = false; v.scene.skyAtmosphere.show = false; v.scene.backgroundColor = window.__Cesium.Color.fromCssColorString("#203040"); } });
}
await new Promise((r) => setTimeout(r, +waitMs));
if (diag) {
  const info = await page.evaluate(() => {
    const v = window.__agrotwinViewer, C = window.__Cesium;
    if (!v || !C) return "viewer not exposed";
    const out = [];
    for (let i = 0; i < v.scene.primitives.length; i++) {
      const p = v.scene.primitives.get(i);
      if (!p.boundingSphere) { out.push({ type: p.constructor.name }); continue; }
      const c = C.Cartographic.fromCartesian(p.boundingSphere.center);
      out.push({ type: p.constructor.name, url: p.resource?.url?.slice(0, 70), lon: +(c.longitude * 57.29578).toFixed(6), lat: +(c.latitude * 57.29578).toFixed(6), h: +c.height.toFixed(1), r: +p.boundingSphere.radius.toFixed(1), globeH: +(v.scene.globe.getHeight(c) ?? NaN).toFixed(1), tilesLoaded: p.tilesLoaded });
    }
    const cam = v.camera.positionCartographic;
    const boxes = [...document.querySelectorAll("label")].map((l) => `${l.textContent?.trim()}=${l.querySelector("input,button[role=checkbox]")?.checked ?? l.querySelector("button")?.getAttribute("aria-checked") ?? "?"}`);
    return { layers: boxes, prims: out, camera: { lon: +(cam.longitude * 57.29578).toFixed(6), lat: +(cam.latitude * 57.29578).toFixed(6), h: +cam.height.toFixed(1) } };
  });
  console.log(JSON.stringify(info, null, 1));
}
await page.screenshot({ path: out });
console.log(logs.slice(0, 20).join("\n") || "(no console errors)");
console.log("fetched:", JSON.stringify(tiles));
await browser.close();
