import puppeteer from "puppeteer-core";
const [,, url, waitMs = "60000"] = process.argv;
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist", "--window-size=1600,1000"] });
const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 1000 });
const logs = []; page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 }).catch(() => {});
await new Promise((r) => setTimeout(r, +waitMs));
const info = await page.evaluate(() => {
  const v = window.__agrotwinViewer; const out = [];
  for (let i = 0; i < v.scene.primitives.length; i++) {
    const p = v.scene.primitives.get(i);
    if (!p.statistics) continue;
    const s = p.statistics;
    out.push({ url: p.resource?.url?.slice(-40), selected: s.selected, visited: s.visited, ready: s.numberOfTilesWithContentReady, tris: s.numberOfTrianglesSelected ?? s.numberOfFeaturesSelected, failed: s.numberOfTilesFailed ?? p._statistics?.numberOfTilesFailed, mse: p.maximumScreenSpaceError, rootErr: p.root?.geometricError, rootContentReady: p.root?.contentReady, rootRefine: p.root?.refine });
  }
  return out;
});
console.log(JSON.stringify(info));
console.log(logs.filter((l) => !/DevTools|HMR|Fast Refresh/.test(l)).slice(0, 12).join("\n"));
await browser.close();
