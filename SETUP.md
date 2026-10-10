# 🏏 Sunday Cricket: setup guide

Setup takes about 20 minutes and only has to be done once. Both services are free:

- **Supabase** stores the scores and photos.
- **Vercel** hosts the website.

You'll end up with a link like `https://sunday-cricket-yourname.vercel.app` that you can share in the group chat. Anyone with the link can **view** everything. Only you can **score**, after logging in.

---

## 1. Put the code on GitHub (5 min)
1. Create a free account at https://github.com if you don't have one.
2. Click **New repository** and name it `sunday-cricket`. Keep it **Private**.
3. Upload the contents of this folder. Either drag and drop the files on the repo page ("uploading an existing file"), or use git:
   ```bash
   cd sunday-cricket
   git init && git add . && git commit -m "Sunday Cricket" && git branch -M main
   git remote add origin https://github.com/YOUR-NAME/sunday-cricket.git
   git push -u origin main
   ```
   Don't upload `node_modules`, `.next` or `.data` (`.gitignore` already skips them).

## 2. Create the database (5 min)
1. Sign up at https://supabase.com and click **New project**. Pick any name and password, and the region nearest you (e.g. London).
2. Wait for the project to finish setting up. Then open **SQL Editor → New query**.
3. Open `supabase/schema.sql` from this folder, copy everything, paste it in and click **Run**. You should see "Success". This creates all the tables, the 4-photos-per-day rule and the photo storage bucket.
4. Go to **Project Settings → API** and copy two values:
   - **Project URL**: this is your `SUPABASE_URL`
   - **service_role** key (click "Reveal"): this is your `SUPABASE_SERVICE_ROLE_KEY`. ⚠️ Keep this secret and never post it anywhere.

## 3. Deploy the website (5 min)
1. Sign up at https://vercel.com using your GitHub account.
2. Click **Add New → Project** and import the `sunday-cricket` repo.
3. Before you click Deploy, open **Environment Variables** and add these:

   | Name | Value |
   |---|---|
   | `DATA_MODE` | `supabase` |
   | `SUPABASE_URL` | the Project URL from step 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 2 |
   | `ADMIN_USERNAME` | the username you'll log in with, e.g. `umpire` |
   | `ADMIN_PASSWORD` | a strong password that only you know |
   | `SESSION_SECRET` | any long random text (40+ characters), e.g. mash the keyboard |

4. Click **Deploy**. After about a minute you'll get your link. 🎉

## 4. First Sunday
1. Open your link, tap **Admin** (top right) and log in.
2. Go to **Umpire desk → Manage players** and paste in everyone's names, one per line.
3. Under **New Sunday**, pick the date and click **Create day**. Then make two teams (tick the players and pick a captain).
4. Under **Add match**, set the overs and players a side. Do the toss, then score ball by ball.
5. When a match finishes, its result, match report, series table and Player of the Day all update automatically.
6. At the end of the day, add up to 4 photos with captions from the day page.

Tip: on your phone, use **Add to Home Screen** so the scorer opens like an app.

## 5. Two-minute security check (do this once)
1. Open the site in a private/incognito window, where you're not logged in.
2. Go to `/admin`. It should send you to the login page.
3. Open a match page. There should be no scoring buttons and no "Manage" links.

All writes are checked on the server. The database has Row Level Security switched on with no write rules, so even someone holding the public Supabase key can't change anything.

---

## How the scoring works
- **Wide**: 1 run plus any extra runs taken. It doesn't count as a ball.
- **No ball**: 1 run plus runs off the bat. It doesn't count as a ball.
- **Bye / Leg bye**: the runs go to the team, not the batter or bowler, and the ball counts.
- **Strike** rotates automatically on odd runs and at the end of each over. Use "swap strike" if it ever needs correcting.
- **Undo last** removes the most recent ball. Use it as often as you like: every score is recalculated from the ball list, so totals can never drift.
- **End innings** is for when you run out of time or batters.
- **Match settings** lets you shorten the overs mid-match, e.g. when it rains.
- If your phone loses signal, balls are kept on the phone and sent automatically when signal returns. A red "Offline" badge shows while that's happening.

## How the awards work
- **Series of the day**: the team with the most wins. If wins are level, net run rate decides, and if that's also level the series is shared.
- **Player of the Day**: most MVP points. The formula is shown on the Stats page and can be changed in `src/lib/cricket/stats.ts` (`POINTS`):
  - 1 per run, +1 per four, +2 per six
  - 20 per wicket, 10 per maiden
  - 8 per catch, run-out or stumping
  - bonuses for 30+, 50+ and 3-wicket hauls
  - +5 for being on the winning side

## Trying it on your laptop first (optional)
You need Node.js 18 or newer.
```bash
npm install
cp .env.example .env.local     # then set DATA_MODE=local in .env.local
npm run seed:demo              # optional: fills in a month of demo matches
npm run dev                    # open http://localhost:3000, admin login is admin / admin
```
Local mode keeps data in the `.data/` folder. It's only for trying things out. The real site uses Supabase.

## Handy commands
- `npm test`: runs the cricket-rules unit tests
- `npm run build`: production build
- `node e2e/run.mjs http://localhost:3000`: full browser test against a **local-mode** server with the demo data. It adds test players, a day and a match.
