// End-to-end check against a running local-mode server: node e2e/run.mjs http://localhost:3100
import { chromium } from "playwright-core";
const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS ?? "/tmp/claude-0/shots";
import { existsSync } from "fs";
const defaultChrome = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync(defaultChrome) ? defaultChrome : undefined) });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const ok = (cond, msg) => { if (!cond) throw new Error("FAILED: " + msg); console.log("✓", msg); };
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });

// ---------- public, logged out ----------
await page.goto(BASE + "/");
ok(await page.getByText("Player of the Day").isVisible(), "home shows Player of the Day");
await shot("01-home");
await page.goto(BASE + "/history");
await shot("02-history");
await page.goto(BASE + "/stats?month=2026-09");
await page.getByLabel("Search player").fill("raj");
ok((await page.locator("tbody tr").count()) >= 1, "stats search filters players");
await page.getByLabel("Search player").fill("");
await page.getByRole("button", { name: "🎯 Bowling" }).click();
await shot("03-stats");
await page.goto(BASE + "/captains");
await shot("04-captains");
await page.goto(BASE + "/");
await page.locator("a[href^='/matches/']").first().click();
await page.waitForURL(/\/matches\//);
await shot("05-match");
await page.locator("a[href^='/players/']").first().click();
await page.waitForURL(/\/players\//);
await shot("06-player");
ok(!(await page.getByText("Umpire", { exact: true }).isVisible()), "viewer sees no admin controls");

// viewers cannot write
const denied = await page.evaluate(async () => {
  const r = await fetch("/api/matches/abc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo" }) });
  const p = await fetch("/api/days/abc/photos", { method: "POST", body: new FormData() });
  return [r.status, p.status];
});
ok(denied[0] === 401 && denied[1] === 401, "write APIs reject non-admins");
await page.goto(BASE + "/admin");
ok(page.url().includes("/login"), "admin area redirects to login");

// ---------- admin login ----------
await page.getByLabel("Username").fill("admin");
await page.getByLabel("Password").fill("wrong");
await page.getByRole("button", { name: "Log in" }).click();
await page.getByText("Wrong username or password").waitFor();
ok(true, "wrong password rejected");
await page.getByLabel("Password").fill("admin");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL(BASE + "/admin");
ok(true, "admin logged in");

// new players
await page.goto(BASE + "/admin/players");
await page.locator("textarea[name=names]").fill("Test One\nTest Two, Test Three\nTest Four\nTest Five\nTest Six");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.getByText("Added 6 players").waitFor();
ok(true, "bulk-added players");

// new day
await page.goto(BASE + "/admin");
await page.locator("input[name=date]").fill("2026-10-11");
await page.getByRole("button", { name: "Create day" }).click();
await page.waitForURL(/\/admin\/days\//);
const dayUrl = page.url();

async function makeTeam(name, players, captain) {
  const form = page.locator("details:has(summary:text('+ New team')) form");
  await form.locator("input[name=name]").fill(name);
  for (const p of players) await form.locator("label", { hasText: new RegExp(`^${p}$`) }).locator("input").check();
  await form.locator("select[name=captain_id]").selectOption({ label: captain });
  await form.getByRole("button", { name: "Create team" }).click();
  await page.locator("summary", { hasText: name }).waitFor();
}
await makeTeam("Alpha", ["Test One", "Test Two", "Test Three"], "Test One");
await page.reload();
await makeTeam("Bravo", ["Test Four", "Test Five", "Test Six"], "Test Four");
await page.reload();
ok(await page.getByText("Add match 1").isVisible(), "two teams created");
await shot("07-admin-day");

await page.locator("input[name=overs]").fill("1");
await page.locator("input[name=players_per_side]").fill("3");
await page.getByRole("button", { name: /Add .* go to toss/ }).click();
await page.waitForURL(/\/score$/);
await page.getByRole("button", { name: "Start match" }).click();
await page.getByText("Opening bowler").waitFor();

const sel = async (label, name) => page.locator("label", { hasText: label }).locator("select").selectOption({ label: name });
await sel("Next batter (on strike)", "Test One");
await sel("Next batter (non-striker)", "Test Two");
await sel("Opening bowler", "Test Four");
await shot("08-scorer-start");

const tap = async (txt) => { await page.getByRole("button", { name: txt, exact: true }).click(); await page.waitForTimeout(250); };
const settle = () => page.waitForFunction(() => !document.body.innerText.includes("Saving…"), null, { timeout: 10000 });
await tap("1"); await settle();
await tap("Wide"); await tap("Just wide"); await settle();
await tap("4"); await settle();
await tap("No ball"); await tap("+2"); await settle();
const score1 = await page.locator("p.font-display.text-5xl").innerText();
ok(score1.startsWith("9/0"), `score after 1, wd, 4, nb+2 is 9/0 (got ${score1})`);
ok((await page.getByText("0.2 / 1 ov").count()) === 1, "wide & no-ball not counted as legal balls");
await tap("6"); await settle();
await tap("↶ Undo last"); await settle(); await page.waitForTimeout(800);
const score2 = await page.locator("p.font-display.text-5xl").innerText();
ok(score2.startsWith("9/0"), `undo removed the six (got ${score2})`);
await tap("OUT"); await tap("Caught");
await page.locator("[role=dialog] select").selectOption({ label: "Test Five" });
await page.getByRole("button", { name: /Confirm/ }).click(); await settle();
await sel("Next batter", "Test Three");
await tap("2"); await settle();
await tap("•"); await settle();
await shot("09-scorer-mid");
await tap("4"); await settle();
await page.waitForTimeout(1200);
await page.getByText("2nd innings").waitFor({ timeout: 10000 });
ok(true, "innings 1 ended after 1 over, 2nd innings started");
await sel("Next batter (on strike)", "Test Four");
await sel("Next batter (non-striker)", "Test Five");
await sel("Opening bowler", "Test One");
await tap("6"); await settle();
await tap("OUT"); await tap("Bowled"); await page.getByRole("button", { name: /Confirm/ }).click(); await settle();
await sel("Next batter", "Test Six");
await tap("OUT"); await tap("LBW"); await page.getByRole("button", { name: /Confirm/ }).click(); await settle();
await page.waitForTimeout(1500);
await page.reload();
await page.getByText(/won by/).first().waitFor({ timeout: 10000 });
const result = await page.getByText(/won by/).first().innerText();
ok(/Alpha won by 9 runs/.test(result), `result correct: ${result}`);
ok(await page.getByText("📰 Match report").isVisible(), "match report generated");
await shot("10-scorer-done");

// photos
await page.goto(dayUrl);
for (let i = 1; i <= 4; i++) {
  await page.locator("input[type=file]").setInputFiles(`${SHOTS}/photo${i}.jpg`);
  await page.locator("input[name=caption]").last().fill(`Caption ${i}`);
  await page.getByRole("button", { name: /Upload photo/ }).click();
  await page.getByText(`Photos of the day (${i}/4)`).waitFor({ timeout: 15000 });
}
ok(await page.getByText("maximum of 4 photos").isVisible(), "uploader hidden after 4 photos");
const fifth = await page.evaluate(async (u) => {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array([1, 2, 3])], "x.jpg", { type: "image/jpeg" }));
  const r = await fetch(u, { method: "POST", body: fd });
  return r.status;
}, dayUrl.replace("/admin/days/", "/api/days/") + "/photos");
ok(fifth === 400, "5th photo rejected by server");

// public day page
await page.goto(BASE + "/");
await page.getByText("Alpha won by 9 runs").first().waitFor();
await shot("11-home-new-day");
await ctx.setDefaultTimeout(5000);
console.log(errors.length ? "Console errors:\n" + errors.join("\n") : "✓ no browser console errors");
await browser.close();
