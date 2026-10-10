# 🏏 Sunday Cricket

A mobile-first web app for scoring our Sunday cricket ball by ball.

- **Umpire (admin) scoring:** runs, wides, no-balls, byes, leg byes, wickets (with fielder), undo, swap strike and end innings. Unsent balls are kept on the phone if signal drops.
- **Teams and players:** set up fresh teams and captains each Sunday from one shared roster.
- **3–4 matches a day:** the series winner is worked out automatically (most wins, then net run rate).
- **Match reports:** an exciting write-up for every match, generated from the ball-by-ball data.
- **Player of the Day:** a 🏆 award with an encouraging shout-out, based on MVP points.
- **Monthly history:** awards for each month, a searchable and filterable stats leaderboard, a captains' win/loss table, and player profiles.
- **Photos of the day:** up to 4 per Sunday, each with a caption.
- **Read-only for everyone else:** only the admin can change anything, and this is enforced on the server.

👉 **See [SETUP.md](SETUP.md) to put it online for free (Supabase + Vercel).**

Built with Next.js 14, TypeScript, Tailwind and Supabase.
