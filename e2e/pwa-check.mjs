// Checks the installable-app (PWA) setup against a running server: node e2e/pwa-check.mjs http://localhost:3100
import { chromium, devices } from "playwright-core";
import { existsSync } from "fs";
import { execSync } from "child_process";
// "no signal": stop the local server (Playwright's offline switch doesn't reach service workers)
const stopServer = () => {
  for (const line of execSync("ps -eo pid,comm").toString().split("\n"))
    if (/next-server/.test(line)) try { process.kill(Number(line.trim().split(/\s+/)[0])); } catch {}
};
const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS ?? "/tmp/claude-0/shots";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync(exe) ? exe : undefined) });
const ok = (c, m) => { if (!c) throw new Error("FAILED: " + m); console.log("✓", m); };

// iPhone Safari: shows Add to Home Screen instructions
const ictx = await browser.newContext({ ...devices["iPhone 13"] });
const ipage = await ictx.newPage();
await ipage.goto(BASE + "/");
await ipage.getByText("Get the Sunday Cricket app").waitFor();
ok(await ipage.getByText("Add to Home Screen").isVisible(), "iPhone: shows Add to Home Screen instructions");
await ipage.screenshot({ path: `${SHOTS}/pwa-iphone-banner.png` });
await ipage.getByRole("button", { name: "Not now" }).click();
await ipage.reload();
await ipage.waitForTimeout(800);
ok(!(await ipage.getByText("Get the Sunday Cricket app").isVisible()), "'Not now' hides the banner for good");
const head = await ipage.evaluate(() => ({
  capable: document.querySelector('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]')?.getAttribute("content"),
  title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content"),
}));
ok(head.capable === "yes" && head.title === "Sunday Cricket", "iPhone full-screen app tags present");
await ictx.close();

// Android-ish Chrome
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE + "/");
const manifest = await (await page.request.get(BASE + "/manifest.webmanifest")).json();
ok(manifest.display === "standalone" && manifest.icons.length === 4, "manifest served (standalone, 4 icons)");
for (const i of manifest.icons) ok((await page.request.get(BASE + i.src)).ok(), `icon ${i.src} loads`);
ok((await page.request.get(BASE + "/icons/apple-touch-icon.png")).ok(), "iPhone home-screen icon loads");
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
ok(await page.evaluate(() => !!navigator.serviceWorker.controller), "service worker active and controlling the page");
const cdp = await ctx.newCDPSession(page);
const { installabilityErrors: raw } = await cdp.send("Page.getInstallabilityErrors");
// test browsers always run "incognito", which Chrome reports separately — it says nothing about the app
const installabilityErrors = raw.filter((e) => e.errorId !== "in-incognito");
ok(installabilityErrors.length === 0, `Chrome says the app is installable${installabilityErrors.length ? " — " + JSON.stringify(installabilityErrors) : ""}`);

// visit a couple of pages so they are saved for offline use
await page.goto(BASE + "/stats");
await page.goto(BASE + "/");
await page.waitForTimeout(1000);
stopServer();
await page.waitForTimeout(1000);
await page.reload();
ok(await page.getByText("Player of the Day").first().isVisible(), "offline: last-seen Today page still opens");
await page.goto(BASE + "/captains");
ok(await page.getByText("No signal at the ground?").isVisible(), "offline: unvisited page shows the friendly offline screen");
await page.screenshot({ path: `${SHOTS}/pwa-offline.png` });
await page.goto(BASE + "/admin").catch(() => {});
ok(await page.getByText("No signal at the ground?").isVisible(), "offline: umpire desk is never served from an old copy");
await ctx.close();
console.log("(the local server was stopped for the offline test — start it again before other tests)");

await browser.close();
