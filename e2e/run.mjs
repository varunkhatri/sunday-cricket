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

// new day — today (UK time), so it isn't locked
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
page.on("dialog", (d) => d.accept());
await page.goto(BASE + "/admin");
await page.locator("input[name=date]").fill(today);
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
// 1. common player chosen at the toss
await page.locator("select[name=common_player_id]").selectOption({ label: "Varun Khatri" });
await page.getByRole("button", { name: "Start match" }).click();
await page.getByText("Opening bowler").waitFor();
ok(await page.getByText("common player: Varun Khatri").isVisible(), "common player set at the toss");

const sel = async (label, name) => {
  const select = page.locator("label", { hasText: label }).locator("select");
  const value = await select.locator("option", { hasText: name }).first().getAttribute("value");
  await select.selectOption(value);
};
const scoreText = () => page.locator("p.font-display.text-5xl").innerText();
await sel("Next batter (on strike)", "Test One");
await sel("Next batter (non-striker)", "Test Two");
await sel("Opening bowler", "Test Four");
await shot("08-scorer-start");

const tap = async (txt) => { await page.getByRole("button", { name: txt, exact: true }).click(); await page.waitForTimeout(250); };
const settle = async () => { await page.waitForFunction(() => !document.body.innerText.includes("Saving…"), null, { timeout: 10000 }); await page.waitForTimeout(300); };
await tap("1"); await settle();
await tap("Wide"); await tap("Just wide"); await settle();
await tap("4"); await settle();
await tap("No ball"); await tap("+2"); await settle();
ok((await scoreText()).startsWith("9/0"), "score after 1, wd, 4, nb+2 is 9/0");
ok((await page.getByText("0.2 / 1 ov").count()) === 1, "wide & no-ball not counted as legal balls");
await shot("08b-scorer-extras");
await tap("6"); await settle();
await tap("↶ Undo last"); await settle(); await page.waitForTimeout(800);
ok((await scoreText()).startsWith("9/0"), "undo removed the six");
await tap("OUT"); await tap("Caught");
await page.locator("[role=dialog] select").selectOption({ label: "Test Five" });
await page.getByRole("button", { name: /Confirm/ }).click(); await settle();
await sel("Next batter", "Test Three");

// 2. change overs mid-innings
await page.getByRole("button", { name: /Overs \(1\)/ }).click();
await page.getByRole("button", { name: "+", exact: true }).click();
await page.getByRole("button", { name: "Save — 2 overs" }).click();
await page.getByText("0.3 / 2 ov").waitFor();
ok(true, "overs changed from 1 to 2 during the innings");

// 7. retire a batter — no ball used
await page.getByRole("button", { name: "🚶 Retire batter" }).click();
await page.getByRole("button", { name: /Retire Test Three/ }).click(); await settle();
ok((await page.getByText("0.3 / 2 ov").count()) === 1 && (await scoreText()).startsWith("9/1"), "retiring a batter used no ball and wasn't a wicket");
const retiredOpt = await page.locator("label", { hasText: "Next batter" }).locator("option", { hasText: "retired" }).count();
ok(retiredOpt === 1, "retired batter can come back later");
await sel("Next batter", "Varun Khatri");

// 3. add a brand-new player mid-game
await page.getByRole("button", { name: "➕ Add player" }).click();
await page.locator("[role=dialog]").getByRole("button", { name: "Alpha" }).click();
await page.locator("[role=dialog]").getByRole("button", { name: "New player" }).click();
await page.locator("[role=dialog] input").fill("Late Larry");
await page.getByRole("button", { name: "Add to team" }).click();
await page.getByText("Player added").waitFor();
ok(true, "new player added to Alpha mid-match");

await tap("2"); await settle();
await tap("•"); await settle();
await shot("09-scorer-mid");
await tap("4"); await settle();
await sel("Bowler for the next over", "Test Five");
// 8. out of box
await tap("OUT"); await tap("Out of box"); await page.getByRole("button", { name: /Confirm/ }).click(); await settle();
await sel("Next batter", "Late Larry");
for (let i = 0; i < 5; i++) { await tap("•"); await settle(); }
await page.waitForTimeout(1200);
await page.getByText("2nd innings").waitFor({ timeout: 10000 });
ok(true, "innings 1 ended after the new 2 overs");
await sel("Next batter (on strike)", "Test Four");
await sel("Next batter (non-striker)", "Test Five");
await sel("Opening bowler", "Test One");
await tap("6"); await settle();
await tap("OUT"); await tap("Bowled"); await page.getByRole("button", { name: /Confirm/ }).click(); await settle();
await sel("Next batter", "Varun Khatri"); // the common player bats for the other side too
await tap("OUT"); await tap("LBW"); await page.getByRole("button", { name: /Confirm/ }).click(); await settle();
await sel("Next batter", "Test Six");
await tap("OUT"); await tap("Caught");
await page.locator("[role=dialog] select").selectOption({ label: "Test Two" });
await page.getByRole("button", { name: /Confirm/ }).click(); await settle();
// last batter carries on alone and keeps the strike
await page.getByText("Last batter standing — Test Five").waitFor();
ok(true, "last batter continues alone");
await tap("1"); await settle();
await page.getByText("Last batter standing — Test Five").waitFor();
ok(true, "lone batter keeps the strike after a single");
await shot("09c-batting-alone");
await tap("OUT"); await tap("Bowled"); await page.getByRole("button", { name: /Confirm/ }).click(); await settle();
await page.getByRole("button", { name: /All batters are out/ }).click();
await page.waitForTimeout(1500);
await page.reload();
await page.getByText(/won by/).first().waitFor({ timeout: 10000 });
const result = await page.getByText(/won by/).first().innerText();
ok(/Alpha won by 8 runs/.test(result), `result correct: ${result}`);
ok(await page.getByText("📰 Match report").isVisible(), "match report generated");
await shot("10-scorer-done");

// 4. MVP of the day by players' vote
await page.goto(dayUrl);
await page.locator("select[name=mvp_player_id]").selectOption({ label: "Test Four" });
await page.locator("input[name=mvp_note]").fill("Brilliant captaincy and great energy");
await page.getByRole("button", { name: "Save MVP" }).click();
await page.getByText("MVP of the day saved").waitFor();
ok(true, "MVP of the day saved");

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
await page.getByText("Alpha won by 8 runs").first().waitFor();
await shot("11-home-new-day");
ok(await page.getByText("MVP of the Day · chosen by the players").isVisible(), "MVP card shown on the day page");
ok(await page.getByText("Best Batsman of the Day").isVisible() && await page.getByText("Best Bowler of the Day").isVisible() && await page.getByText("Best Fielder of the Day").isVisible(), "best batsman / bowler / fielder cards shown");
await page.getByText("Stars of the day").scrollIntoViewIfNeeded();
await shot("11b-stars");
await page.locator("a[href^='/matches/']", { hasText: "Alpha" }).first().click();
await page.waitForURL(/\/matches\//);
await page.getByText("Run rate — both teams").waitFor();
ok(true, "run rate charts shown");
ok(await page.getByText("out of box b Test Five").isVisible(), "out of box shown in scorecard");
await page.getByText("Run rate — both teams").scrollIntoViewIfNeeded();
await shot("12-match-charts");

// 6. previous Sundays are locked
const days = await page.evaluate(async () => (await fetch("/api/export")).json());
ok(Array.isArray(days.balls) && days.balls.length > 0, "backup download works");
const oldMatch = days.matches.find((m) => days.match_days.find((d) => d.id === m.match_day_id).date < "2026-10-01");
const locked = await page.evaluate(async (id) => {
  const r = await fetch(`/api/matches/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo" }) });
  return [r.status, (await r.json()).error];
}, oldMatch.id);
ok(locked[0] === 400 && /locked/.test(locked[1]), "scores of a previous Sunday can't be changed");
await page.goto(BASE + `/admin/days/${oldMatch.match_day_id}`);
ok(await page.getByText("This Sunday is locked").isVisible(), "previous Sunday shows as locked");
await shot("13-locked-day");
ok(await page.getByRole("button", { name: "Unlock for corrections" }).isVisible(), "super admin can unlock a previous Sunday");

// match counts: someone added to a team AFTER match 1 must not count as having played it
await page.goto(BASE + "/admin/players");
await page.locator("textarea[name=names]").fill("Newbie Nick");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.getByText("Added 1 player").waitFor();
await page.goto(dayUrl);
await page.locator("summary", { hasText: "Alpha" }).click();
const alphaForm = page.locator("details:has(summary:has-text('Alpha')) form").first();
await alphaForm.locator("label", { hasText: /^Newbie Nick$/ }).locator("input").check();
await alphaForm.getByRole("button", { name: "Save team" }).click();
await page.getByText("Team updated").waitFor();
await page.goto(BASE + "/players");
await page.getByLabel("Search players").fill("Newbie");
const nickCard = await page.locator("a[href^='/players/']", { hasText: "Newbie Nick" }).innerText();
ok(/0 matches/.test(nickCard), `late arrival not counted in earlier match (${nickCard.replace(/\n/g, " ")})`);
await page.getByLabel("Search players").fill("Late Larry");
const larryCard = await page.locator("a[href^='/players/']", { hasText: "Late Larry" }).innerText();
ok(/1 match\b/.test(larryCard), "player added during a match counts for that match");

// points: today's Sunday uses the new points
await page.goto(BASE + "/stats");
await page.getByText("How are MVP points worked out?").click();
ok(await page.getByText(/15 per wicket, 15 per maiden/).isVisible(), "new points rules shown");

// second role: admin (not super admin)
await page.getByRole("button", { name: "Log out" }).click();
await page.goto(BASE + "/login");
await page.getByLabel("Username").fill("umpire");
await page.getByLabel("Password").fill("umpire");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL(BASE + "/admin");
ok(await page.getByText("Logged in as Admin").isVisible(), "admin (non-super) can log in");
const staffOld = await page.evaluate(async (id) => {
  const r = await fetch(`/api/matches/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo" }) });
  return [r.status, (await r.json()).error];
}, oldMatch.id);
ok(staffOld[0] === 400 && /super admin/.test(staffOld[1]), "admin can't change a previous Sunday");
await page.goto(BASE + `/admin/days/${oldMatch.match_day_id}`);
ok(await page.getByText("Previous Sunday — view only").isVisible(), "admin sees previous Sunday as view-only");
ok((await page.getByRole("button", { name: "Unlock for corrections" }).count()) === 0, "admin has no unlock button");
await shot("14-admin-old-day");
await page.goto(dayUrl);
ok(await page.getByRole("button", { name: /Add .* go to toss/ }).isVisible(), "admin can still manage today's Sunday");
await page.goto(BASE + "/admin/players");
ok(await page.getByText("Only the super admin can rename players").isVisible(), "admin can't rename players");
await ctx.setDefaultTimeout(5000);
console.log(errors.length ? "Console errors:\n" + errors.join("\n") : "✓ no browser console errors");
await browser.close();
