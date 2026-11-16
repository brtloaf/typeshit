// typeshit worker: serves the static site from ./public and runs one Room durable object per friends room.
// The room only keeps score and timing; each browser runs its own game from a shared seed.
import { DurableObject } from "cloudflare:workers";

const MAX_PLAYERS = 8;
// game kinds the host can pick, and the option values each one accepts (null = no option)
const KINDS = { race: [15, 30, 60], time: [15, 30, 60], death: [null], chase: [null], scramble: [null], rain: [null] };
const COUNTDOWN_MS = 3500;
const GRACE_MS = 30000;      // time the rest get after the first finisher
const HARD_CAP_MS = 300000;  // a race never runs longer than this

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/ws\/([A-Za-z]{4})$/);
    if (m) {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("expected a websocket", { status: 426 });
      const id = env.ROOMS.idFromName(m[1].toUpperCase());
      return env.ROOMS.get(id).fetch(request);
    }
    if (url.pathname.startsWith("/api/")) return env.BOARD.get(env.BOARD.idFromName("main")).fetch(request);
    return env.ASSETS.fetch(request);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map(); // socket -> player
    this.phase = "lobby";     // lobby | countdown | race | results
    this.host = null;
    this.kind = "race";
    this.opt = 30;
    this.nextId = 1;
    this.finished = 0;
    this.endsAt = 0;
    this.timers = [];
    this.flush = null;
  }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    if (this.players.size >= MAX_PLAYERS) {
      server.close(4001, "that room is full.");
      return new Response(null, { status: 101, webSocket: client });
    }
    const busy = this.phase === "race" || this.phase === "countdown";
    const p = { id: "p" + this.nextId++, name: "anon", p: 0, score: 0, wpm: 0, acc: 0, done: false, doneAt: 0, place: 0, sit: busy, joined: false };
    this.players.set(server, p);
    server.addEventListener("message", (e) => {
      try { this.onMessage(server, p, JSON.parse(e.data)); } catch {}
    });
    const bye = () => this.drop(server);
    server.addEventListener("close", bye);
    server.addEventListener("error", bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(ws, p, m) {
    const idle = this.phase === "lobby" || this.phase === "results";
    switch (m.t) {
      case "join":
        p.name = String(m.name || "anon").replace(/[<>]/g, "").trim().slice(0, 14) || "anon";
        p.joined = true;
        if (!this.host) this.host = p.id;
        ws.send(JSON.stringify({ t: "you", id: p.id }));
        this.broadcast();
        break;
      case "cfg":
        if (p.id === this.host && idle && KINDS[m.kind] && KINDS[m.kind].includes(m.opt ?? null)) {
          this.kind = m.kind; this.opt = m.opt ?? null; this.broadcast();
        }
        break;
      case "end":
        if (p.id === this.host) this.finish();
        break;
      case "start":
        if (p.id === this.host && idle) this.start();
        break;
      case "prog":
        if (this.phase === "race" && !p.sit && !p.done) {
          p.p = Math.max(0, Math.min(1, +m.p || 0));
          p.score = Math.max(0, Math.min(9999, Math.round(+m.score || 0)));
          this.broadcastSoon();
        }
        break;
      case "done":
        if (this.phase === "race" && !p.sit && !p.done) {
          p.done = true; p.doneAt = Date.now();
          p.score = Math.max(0, Math.min(9999, Math.round(+m.score || 0)));
          p.wpm = Math.max(0, Math.min(400, Math.round(+m.wpm || 0)));
          p.acc = Math.max(0, Math.min(100, Math.round(+m.acc || 0)));
          if (this.kind === "race") {   // a race is won by finishing first; every other game is ranked by score at the end
            p.p = 1; p.place = ++this.finished;
            if (p.place === 1) { this.endsAt = Date.now() + GRACE_MS; this.timer(GRACE_MS, () => this.finish()); }
          }
          if (!this.checkAllDone()) this.broadcast();
        }
        break;
    }
  }

  start() {
    this.clearTimers();
    for (const q of this.players.values()) Object.assign(q, { p: 0, score: 0, wpm: 0, acc: 0, done: false, doneAt: 0, place: 0, sit: false });
    this.finished = 0; this.endsAt = 0;
    this.phase = "countdown";
    const seed = (Math.random() * 0xffffffff) >>> 0;
    this.send({ t: "go", seed, kind: this.kind, opt: this.opt, in: COUNTDOWN_MS });
    this.broadcast();
    this.timer(COUNTDOWN_MS, () => { this.phase = "race"; this.broadcast(); });
    this.timer(COUNTDOWN_MS + HARD_CAP_MS, () => this.finish());
  }

  checkAllDone() {
    const racers = [...this.players.values()].filter((q) => q.joined && !q.sit);
    if (this.phase === "race" && racers.length && racers.every((q) => q.done)) { this.finish(); return true; }
    return false;
  }

  finish() {
    if (this.phase !== "race" && this.phase !== "countdown") return;
    this.clearTimers();
    this.phase = "results"; this.endsAt = 0;
    if (this.kind !== "race") {
      [...this.players.values()].filter((q) => q.joined && !q.sit)
        .sort((a, b) => b.score - a.score || (a.doneAt || 9e15) - (b.doneAt || 9e15))
        .forEach((q, i) => { q.place = i + 1; });
    }
    this.broadcast();
  }

  drop(ws) {
    const p = this.players.get(ws);
    if (!p) return;
    this.players.delete(ws);
    if (this.host === p.id) this.host = [...this.players.values()].find((q) => q.joined)?.id || null;
    if (!this.players.size) { this.clearTimers(); this.phase = "lobby"; return; }
    if (!this.checkAllDone()) this.broadcast();
  }

  timer(ms, fn) { this.timers.push(setTimeout(fn, ms)); }
  clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }

  send(obj) {
    const s = JSON.stringify(obj);
    for (const ws of this.players.keys()) { try { ws.send(s); } catch {} }
  }
  broadcast() {
    this.send({
      t: "state", phase: this.phase, host: this.host, kind: this.kind, opt: this.opt,
      endsIn: this.endsAt ? Math.max(0, this.endsAt - Date.now()) : 0,
      players: [...this.players.values()].filter((q) => q.joined)
        .map(({ id, name, p, score, wpm, acc, done, place, sit }) => ({ id, name, p, score, wpm, acc, done, place, sit })),
    });
  }
  broadcastSoon() {
    if (this.flush) return;
    this.flush = setTimeout(() => { this.flush = null; this.broadcast(); }, 150);
  }
}


// ---------------------------------------------------------------------------------------------
// Board: accounts, the four daily games and every leaderboard. One durable object with SQLite.
// ---------------------------------------------------------------------------------------------
/* shared:start  (this block is identical in public/daily.js and src/worker.js; change both together) */
const DAY_MS = 864e5, DAY_SHIFT = 6 * 36e5, GUESS_SECONDS = 180;   // days roll over at midnight UTC-6
const dayNum = (t = Date.now()) => Math.floor((t - DAY_SHIFT) / DAY_MS);
function seeded(a) { a >>>= 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dailyLetters(day) {
  const r = seeded(day * 2654435761), V = "aaaaeeeeeeiiiooouu", C = "bbccddddffgghhjkllllmmmnnnnppqrrrrrssssttttttvvwwxyyz";
  const out = [], take = (bag, n) => { while (n) { const c = bag[Math.floor(r() * bag.length)]; if (out.filter((x) => x === c).length < 2) { out.push(c); n--; } } };
  take(V, 5); take(C, 7);
  return out.join("");
}
function canMake(word, letters) {
  const pool = [...letters];
  for (const c of word) { const i = pool.indexOf(c); if (i < 0) return false; pool.splice(i, 1); }
  return true;
}
const dleAnswer = (data, day) => data.typdle[(day * 7919) % data.typdle.length];
const textoSecret = (data, day) => data.texto.secrets[(day * 31 + 7) % data.texto.secrets.length];
function illionPrompts(data, day) {
  const r = seeded(day * 40503 + 11), idx = data.trivia.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, 7).map((i) => data.trivia[i]);
}
const ILLION_POINTS = [10, 30, 60, 100];
const normAns = (s) => String(s).toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// an answer counts if it matches an accepted answer exactly, as a plural, or within a small typo
function scoreAnswer(prompt, text) {
  const t = normAns(text);
  let best = null;
  if (t) prompt.tiers.forEach((list, tier) => list.forEach((entry) => entry.split("|").forEach((alias) => {
    const a = normAns(alias);
    const d = a === t || a + "s" === t || a === t + "s" || a + "es" === t || a === t + "es" ? 0 : (a.length >= 5 && t.length >= 5 ? lev(a, t) : 9);
    if ((d === 0 || d === 1 || (d === 2 && a.length >= 9)) && (!best || d < best.d)) best = { d, tier, pts: ILLION_POINTS[tier], match: entry.split("|")[0] };
  })));
  return best ? { pts: best.pts, tier: best.tier, match: best.match } : { pts: 0, tier: -1, match: "" };
}
/* shared:end */

// score boards a browser may post to: [lowest sane value, highest sane value, lower is better]
const BOARDS = {
  "classic:15": [1, 300], "classic:30": [1, 300], "classic:60": [1, 300],
  "sentences:short": [1, 300], "sentences:long": [1, 300],
  "rain:drizzle": [1, 2000], "rain:rain": [1, 2000], "rain:storm": [1, 2000],
  "death:": [1, 300], "chase:": [1, 300], "bomb:": [1, 2000], "memory:": [1, 500],
  "scramble:": [1, 200], "mirror:": [1, 200],
  "alphabet:a-z": [1, 600, true], "alphabet:z-a": [1, 600, true],
};

const ADJ = "sleepy,speedy,grumpy,sneaky,fuzzy,salty,jumpy,cosmic,rusty,mellow,spicy,wobbly,quiet,loud,lucky,dizzy,frosty,sunny,clumsy,brave,chunky,zesty,soggy,turbo,mighty,tiny,fancy,feral,noble,crispy".split(",");
const ANIMAL = "otter,badger,gecko,walrus,pigeon,moose,ferret,panda,llama,wombat,heron,possum,beetle,marmot,puffin,lemur,toad,yak,stoat,crab,falcon,newt,bison,koala,mantis,shrimp,goose,raccoon,sloth,ibis".split(",");

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));
const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
async function hashPassword(pass, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: 100000 }, key, 256));
}
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fail = (error, status = 400) => json({ error }, status);

export class Board extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.sql = ctx.storage.sql;
    this.words = null;
    this.tries = new Map();   // ip -> [minute, count] for sign-up and log-in attempts
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, salt TEXT, hash TEXT, guest INTEGER NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user INTEGER NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS dailies(game TEXT NOT NULL, day INTEGER NOT NULL, user INTEGER NOT NULL, key INTEGER NOT NULL, v INTEGER NOT NULL, secs INTEGER NOT NULL, x INTEGER NOT NULL, pts INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(game, day, user));
      CREATE TABLE IF NOT EXISTS scores(board TEXT NOT NULL, day INTEGER NOT NULL, user INTEGER NOT NULL, value REAL NOT NULL, PRIMARY KEY(board, day, user));
    `);
  }
  q(query, ...args) { return this.sql.exec(query, ...args).toArray(); }

  async fetch(request) {
    try {
      const url = new URL(request.url), path = url.pathname.slice(5);
      const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
      const user = await this.whoIs(request);
      const ip = request.headers.get("CF-Connecting-IP") || "?";
      if (path === "guest" && request.method === "POST") return this.guest();
      if (path === "signup" && request.method === "POST") return this.throttled(ip) || this.signup(body, user);
      if (path === "login" && request.method === "POST") return this.throttled(ip) || this.login(body);
      if (path === "logout" && request.method === "POST") return this.logout(request);
      if (path === "me") return user ? json({ name: user.name, guest: !!user.guest }) : fail("not signed in", 401);
      if (path === "daily" && request.method === "POST") return user ? this.daily(body, user, request) : fail("not signed in", 401);
      if (path === "score" && request.method === "POST") return user ? this.score(body, user) : fail("not signed in", 401);
      if (path === "board") return this.board(url.searchParams, user);
      return fail("not found", 404);
    } catch (e) {
      return fail("server error", 500);
    }
  }

  // ---- accounts ----
  async whoIs(request) {
    const m = (request.headers.get("Authorization") || "").match(/^Bearer ([0-9a-f]{64})$/);
    if (!m) return null;
    return this.q("SELECT u.id, u.name, u.guest FROM sessions s JOIN users u ON u.id = s.user WHERE s.token = ?", await sha(m[1]))[0] || null;
  }
  throttled(ip) {
    const minute = Math.floor(Date.now() / 60000), t = this.tries.get(ip);
    if (!t || t[0] !== minute) { this.tries.set(ip, [minute, 1]); if (this.tries.size > 5000) this.tries.clear(); return null; }
    return ++t[1] > 10 ? fail("too many attempts. wait a minute and try again.", 429) : null;
  }
  async session(userId) {
    const token = hex(crypto.getRandomValues(new Uint8Array(32)));
    this.sql.exec("INSERT INTO sessions(token, user, created) VALUES(?, ?, ?)", await sha(token), userId, Date.now());
    return token;
  }
  async guest() {
    for (let i = 0; i < 20; i++) {
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      const name = `${pick(ADJ)}-${pick(ANIMAL)}-${Math.floor(10 + Math.random() * 90)}`;
      if (this.q("SELECT 1 FROM users WHERE name = ?", name).length) continue;
      const id = this.q("INSERT INTO users(name, guest, created) VALUES(?, 1, ?) RETURNING id", name, Date.now())[0].id;
      return json({ token: await this.session(id), name, guest: true });
    }
    return fail("could not make a guest name", 500);
  }
  async signup(body, user) {
    const name = String(body.name || "").trim(), pass = String(body.pass || "");
    if (!/^[A-Za-z0-9_-]{3,14}$/.test(name)) return fail("names are 3 to 14 letters, numbers, - or _.");
    if (pass.length < 8 || pass.length > 200) return fail("passwords need at least 8 characters.");
    if (this.q("SELECT 1 FROM users WHERE name = ?", name).length) return fail("that name is taken.");
    const salt = hex(crypto.getRandomValues(new Uint8Array(16))), hash = await hashPassword(pass, salt);
    let id;
    if (user && user.guest) {   // a guest keeps every score they already posted
      id = user.id;
      this.sql.exec("UPDATE users SET name = ?, salt = ?, hash = ?, guest = 0 WHERE id = ?", name, salt, hash, id);
      this.sql.exec("DELETE FROM sessions WHERE user = ?", id);
    } else {
      id = this.q("INSERT INTO users(name, salt, hash, guest, created) VALUES(?, ?, ?, 0, ?) RETURNING id", name, salt, hash, Date.now())[0].id;
    }
    return json({ token: await this.session(id), name, guest: false });
  }
  async login(body) {
    const name = String(body.name || "").trim(), pass = String(body.pass || "").slice(0, 200);
    const u = this.q("SELECT id, name, salt, hash FROM users WHERE name = ? AND guest = 0", name)[0];
    // hash even when the name is unknown so the reply takes the same time either way
    const got = await hashPassword(pass, u ? u.salt : "00000000000000000000000000000000");
    if (!u || !same(got, u.hash)) return fail("wrong name or password.", 401);
    return json({ token: await this.session(u.id), name: u.name, guest: false });
  }
  async logout(request) {
    const m = (request.headers.get("Authorization") || "").match(/^Bearer ([0-9a-f]{64})$/);
    if (m) this.sql.exec("DELETE FROM sessions WHERE token = ?", await sha(m[1]));
    return json({ ok: true });
  }

  // ---- daily word game: the server re-checks every word, so the score is counted here ----
  async assets(request) {
    if (!this.words) {
      // the same files the browser loads: self.WORDLIST="word word"; and self.DAILYDATA={...};
      const text = await (await this.env.ASSETS.fetch(new URL("/words.js", request.url))).text();
      this.words = new Set(text.slice(text.indexOf('"') + 1, text.lastIndexOf('"')).split(" "));
      const d = await (await this.env.ASSETS.fetch(new URL("/daily-data.js", request.url))).text();
      this.data = JSON.parse(d.slice(d.indexOf("{"), d.lastIndexOf("}") + 1));
    }
    return { dict: this.words, data: this.data };
  }
  // every daily game is re-scored here from what the player actually typed
  async daily(body, user, request) {
    const today = dayNum(), day = Number(body.day), game = String(body.game || "");
    if (day !== today && day !== today - 1) return fail("that puzzle is closed.");
    const { dict, data } = await this.assets(request);
    const list = (v, max) => (Array.isArray(v) ? v : []).slice(0, max).map((w) => String(w).toLowerCase().slice(0, 40));
    const secsOf = (n) => Math.max(1, Math.min(86400, Math.round(+body.secs || 0)));
    let key = 0, v = 0, secs = 0, x = 0, pts = 0;   // key ranks (higher wins, then fewer secs); v and x are shown; pts feeds the totals board
    if (game === "guess") {
      const words = [...new Set(list(body.words, 2000))].filter((w) => w.length >= 3 && w.length <= 12 && dict.has(w) && canMake(w, dailyLetters(day)));
      if (words.length > GUESS_SECONDS * 3) return fail("nobody types that fast.");
      const total = words.reduce((a, w) => a + w.length, 0);
      v = words.length; x = Math.max(0, ...words.map((w) => w.length)); key = v * 1000 + total; pts = Math.min(100, v * 2);
    } else if (game === "dle") {
      const answer = dleAnswer(data, day), g = list(body.guesses, 7);
      if (!g.length || g.some((w) => w.length !== 6 || !(dict.has(w) || data.typdle.includes(w)))) return fail("those guesses are not valid.");
      const at = g.indexOf(answer);
      if (at < 0 && g.length < 7) return fail("that game is not finished.");
      v = at + 1; secs = secsOf(); key = v ? 8 - v : 0; pts = v ? 100 - (v - 1) * 12 : 0;
    } else if (game === "texto") {
      const g = [...new Set(list(body.guesses, 5000))], at = g.indexOf(textoSecret(data, day).w);
      v = at + 1; x = g.length; secs = secsOf(); key = v ? 100000 - v : 0; pts = v ? Math.max(10, 101 - v) : 0;
    } else if (game === "illion") {
      const a = (Array.isArray(body.answers) ? body.answers : []).slice(0, 7);
      v = illionPrompts(data, day).reduce((s, p, i) => s + scoreAnswer(p, String(a[i] || "").slice(0, 60)).pts, 0);
      key = v; pts = Math.round(v / 7);
    } else return fail("no such game.");
    // first submission of the day is the one that counts
    this.sql.exec("INSERT OR IGNORE INTO dailies(game, day, user, key, v, secs, x, pts, at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)", game, day, user.id, key, v, secs, x, pts, Date.now());
    const m = this.q("SELECT key, v, secs, at FROM dailies WHERE game = ? AND day = ? AND user = ?", game, day, user.id)[0];
    return json({ v: m.v, rank: this.rankOf(game, day, m), players: this.q("SELECT COUNT(*) n FROM dailies WHERE game = ? AND day = ?", game, day)[0].n });
  }
  rankOf(game, day, m) {
    return this.q("SELECT COUNT(*) n FROM dailies WHERE game = ? AND day = ? AND (key > ? OR (key = ? AND secs < ?) OR (key = ? AND secs = ? AND at < ?))", game, day, m.key, m.key, m.secs, m.key, m.secs, m.at)[0].n + 1;
  }

  score(body, user) {
    const spec = BOARDS[body.board], v = Number(body.value);
    if (!spec || !(v >= spec[0] && v <= spec[1])) return fail("that score was not accepted.");
    const better = spec[2] ? "MIN" : "MAX";
    this.sql.exec(`INSERT INTO scores(board, day, user, value) VALUES(?, ?, ?, ?) ON CONFLICT(board, day, user) DO UPDATE SET value = ${better}(value, excluded.value)`, body.board, dayNum(), user.id, v);
    return json({ ok: true });
  }

  // ---- leaderboards ----
  board(params, user) {
    const board = params.get("board") || "daily:guess", range = params.get("range") || "day", today = dayNum();
    const since = range === "all" ? 0 : range === "week" ? today - 6 : today;
    let rows, mine = null;
    if (board.startsWith("daily:")) {
      const game = board.slice(6), day = Math.min(today, Number(params.get("day")) || today);
      rows = this.q("SELECT u.id, u.name, u.guest, d.v, d.secs, d.x FROM dailies d JOIN users u ON u.id = d.user WHERE d.game = ? AND d.day = ? ORDER BY d.key DESC, d.secs ASC, d.at ASC LIMIT 50", game, day);
      if (user && !rows.some((r) => r.id === user.id)) {
        const m = this.q("SELECT key, v, secs, x, at FROM dailies WHERE game = ? AND day = ? AND user = ?", game, day, user.id)[0];
        if (m) mine = { v: m.v, secs: m.secs, x: m.x, rank: this.rankOf(game, day, m) };
      }
    } else if (board === "daily-total") {
      const from = range === "day" ? today - 6 : since;
      rows = this.q("SELECT u.id, u.name, u.guest, SUM(d.pts) v, COUNT(*) x FROM dailies d JOIN users u ON u.id = d.user WHERE d.day >= ? GROUP BY d.user ORDER BY v DESC, x ASC LIMIT 50", from);
      if (user && !rows.some((r) => r.id === user.id)) {
        const m = this.q("SELECT SUM(pts) v, COUNT(*) x FROM dailies WHERE day >= ? AND user = ?", from, user.id)[0];
        if (m && m.x) mine = { v: m.v, x: m.x, rank: this.q("SELECT COUNT(*) n FROM (SELECT SUM(pts) v FROM dailies WHERE day >= ? GROUP BY user) WHERE v > ?", from, m.v)[0].n + 1 };
      }
    } else if (BOARDS[board]) {
      const low = BOARDS[board][2], agg = low ? "MIN" : "MAX", dir = low ? "ASC" : "DESC", cmp = low ? "<" : ">";
      rows = this.q(`SELECT u.id, u.name, u.guest, ${agg}(s.value) v FROM scores s JOIN users u ON u.id = s.user WHERE s.board = ? AND s.day >= ? GROUP BY s.user ORDER BY v ${dir} LIMIT 50`, board, since);
      if (user && !rows.some((r) => r.id === user.id)) {
        const m = this.q(`SELECT ${agg}(value) v FROM scores WHERE board = ? AND day >= ? AND user = ?`, board, since, user.id)[0];
        if (m && m.v !== null) mine = { v: m.v, rank: this.q(`SELECT COUNT(*) n FROM (SELECT ${agg}(value) v FROM scores WHERE board = ? AND day >= ? GROUP BY user) WHERE v ${cmp} ?`, board, since, m.v)[0].n + 1 };
      }
    } else return fail("no such board", 404);
    return json({
      rows: rows.map((r, i) => ({ rank: i + 1, name: r.name, guest: !!r.guest, v: r.v, secs: r.secs, x: r.x, me: !!user && r.id === user.id })),
      mine: mine && user ? { ...mine, name: user.name, guest: !!user.guest, me: true } : null,
    });
  }
}
