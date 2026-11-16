# typesh!t

A minimal typing site with a pile of games, four daily puzzles, live games with friends, leaderboards, accounts, a stats tab and a customize tab.

## What is in here

| Path | What it is |
| --- | --- |
| `public/` | The whole site. No build step. |
| `public/app.js` | The solo games, input and page routing. |
| `public/daily.js` | The daily tab: typeguess, typdle, typetexto, typillion. |
| `public/friends.js` | Friends rooms, plus a practice room with bots that runs in the page. |
| `public/ranks.js` | Accounts, guest names and the leaderboard tab. |
| `public/stats.js` | The stats tab and its charts. |
| `public/settings.js` | The customize tab. |
| `public/words.js` | The dictionary for the daily games (about 101,000 words). |
| `public/daily-data.js` | typdle answers, typetexto word groups and typillion prompts. |
| `src/worker.js` | Cloudflare Worker. Serves `public/`, runs one `Room` durable object per friends room, and one `Board` durable object (SQLite) for accounts, daily scores and leaderboards. |
| `wrangler.toml` | Worker config: static assets plus the `ROOMS` and `BOARD` durable object bindings. |

## Deploy on Cloudflare from GitHub

1. Push this folder to a GitHub repo.
2. In the Cloudflare dashboard go to Workers & Pages, create a Worker, and import the repo.
3. Leave the build command empty and keep the deploy command as `npx wrangler deploy`.

If you already deployed an earlier version, pushing this one is enough. The `v2` migration in `wrangler.toml` creates the `Board` database on the next deploy. Both durable objects use the SQLite backend, which is available on the free plan.

To run it locally: `npm install`, then `npm run dev`.

## Notes

- Friends rooms, accounts, daily rankings and leaderboards need the Worker. If you host only `public/` as plain static files, the solo games, daily games, bots, stats and customize all still work, and scores stay on the device.
- Days roll over at midnight UTC-6. Change `DAY_SHIFT` in both `public/daily.js` and `src/worker.js` to move it; the block between `shared:start` and `shared:end` must stay identical in the two files.
- Daily scores are re-checked on the server from what the player typed. Solo game scores are taken from the browser within sane limits, so a friend who edits the page could cheat on those boards.
- The daily answers ship inside the page, so anyone reading the source can find them.
- Passwords are hashed (PBKDF2). There is no email, so a forgotten password cannot be recovered.
- The word list comes from SCOWL. Its licence is in `WORDLIST-LICENSE.txt`.
