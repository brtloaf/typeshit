# typeshit

A minimal typing trainer with six games, live races with friends, and a stats tab.

## What is in here

| Path | What it is |
| --- | --- |
| `public/` | The whole site: `index.html`, `style.css`, `app.js` (games), `stats.js` (stats tab), `friends.js` (race client). No build step. |
| `src/worker.js` | Cloudflare Worker. Serves `public/` and runs one `Room` Durable Object per friends room over WebSockets. |
| `wrangler.toml` | Worker config: static assets plus the `ROOMS` Durable Object binding. |

## Deploy on Cloudflare from GitHub

1. Push this folder to a GitHub repo.
2. In the Cloudflare dashboard go to Workers & Pages, create a Worker, and import the repo.
3. Leave the build command empty and keep the deploy command as `npx wrangler deploy`.

The Durable Object uses the SQLite backend, which is available on the free plan.

To run it locally: `npm install`, then `npm run dev`.

## Notes

- Friends mode needs the Worker. If you host only `public/` as plain static files (GitHub Pages, for example), every solo game and the stats tab still work, but rooms cannot connect.
- Invite links look like `https://your-domain/#room-ABCD`.
- Stats and best scores live in each player's browser (`localStorage`). Nothing is stored on the server; a room disappears when everyone leaves.
- Race results are reported by each player's browser, so a friend who edits the page can cheat. It is built for friends, not for ranked play.
