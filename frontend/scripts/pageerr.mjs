import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message, "\n", (e.stack || "").split("\n").slice(0, 4).join("\n")));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300), m.location()?.url?.slice(0, 120), m.location()?.lineNumber); });
await page.goto(process.argv[2], { waitUntil: "networkidle2", timeout: 120000 }).catch((e) => console.log("goto", e.message));
await new Promise((r) => setTimeout(r, 20000));
await browser.close();
