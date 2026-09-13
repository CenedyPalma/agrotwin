import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const client = await page.createCDPSession();
await client.send("Runtime.enable");
client.on("Runtime.exceptionThrown", (e) => { const d = e.exceptionDetails; console.log("EXC", d.text, "url:", d.url, "line:", d.lineNumber, "col:", d.columnNumber, d.scriptId); });
await page.goto(process.argv[2], { waitUntil: "networkidle2", timeout: 120000 }).catch((e) => console.log("goto", e.message));
await new Promise((r) => setTimeout(r, 15000));
await browser.close();
