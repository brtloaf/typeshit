// typeshit worker: serves the static site from ./public and runs one Room durable object per friends room.
import { DurableObject } from "cloudflare:workers";

const MAX_PLAYERS = 8;
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
    return env.ASSETS.fetch(request);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map(); // socket -> player
    this.phase = "lobby";     // lobby | countdown | race | results
    this.host = null;
    this.n = 30;
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
    const p = { id: "p" + this.nextId++, name: "anon", p: 0, wpm: 0, acc: 0, done: false, place: 0, sit: busy, joined: false };
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
        if (p.id === this.host && idle && [15, 30, 60].includes(m.n)) { this.n = m.n; this.broadcast(); }
        break;
      case "start":
        if (p.id === this.host && idle) this.start();
        break;
      case "prog":
        if (this.phase === "race" && !p.sit && !p.done) {
          p.p = Math.max(0, Math.min(1, +m.p || 0));
          p.wpm = Math.max(0, Math.min(400, Math.round(+m.wpm || 0)));
          this.broadcastSoon();
        }
        break;
      case "done":
        if (this.phase === "race" && !p.sit && !p.done) {
          p.done = true; p.p = 1;
          p.wpm = Math.max(0, Math.min(400, Math.round(+m.wpm || 0)));
          p.acc = Math.max(0, Math.min(100, Math.round(+m.acc || 0)));
          p.place = ++this.finished;
          if (p.place === 1) { this.endsAt = Date.now() + GRACE_MS; this.timer(GRACE_MS, () => this.finish()); }
          if (!this.checkAllDone()) this.broadcast();
        }
        break;
    }
  }

  start() {
    this.clearTimers();
    for (const q of this.players.values()) Object.assign(q, { p: 0, wpm: 0, acc: 0, done: false, place: 0, sit: false });
    this.finished = 0; this.endsAt = 0;
    this.phase = "countdown";
    const seed = (Math.random() * 0xffffffff) >>> 0;
    this.send({ t: "go", seed, n: this.n, in: COUNTDOWN_MS });
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
      t: "state", phase: this.phase, host: this.host, n: this.n,
      endsIn: this.endsAt ? Math.max(0, this.endsAt - Date.now()) : 0,
      players: [...this.players.values()].filter((q) => q.joined)
        .map(({ id, name, p, wpm, acc, done, place, sit }) => ({ id, name, p, wpm, acc, done, place, sit })),
    });
  }
  broadcastSoon() {
    if (this.flush) return;
    this.flush = setTimeout(() => { this.flush = null; this.broadcast(); }, 150);
  }
}
