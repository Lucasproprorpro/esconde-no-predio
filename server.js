const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const SPOTS = require('./public/spots.js');

const PORT = process.env.PORT || 3000;
const HIDE_TIME = Number(process.env.HIDE_TIME || 30);
const SEEK_TIME = Number(process.env.SEEK_TIME || 240); // 4 minutos para achar todo mundo
const BREAK_TIME = Number(process.env.BREAK_TIME || 8);
const TAUNT_CD = Number(process.env.TAUNT_CD || 12) * 1000;
const MAX_PLAYERS = 7;
const DROP_GRACE = 45000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build'), { maxAge: '7d' }));
app.get('/health', (_req, res) => res.send('ok'));

const SPOT = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
const SEEKER_SPAWN = { x: 8.0, y: 0, z: 8.8, ry: Math.PI / 2 };
const HIDER_SPAWNS = [[22.6, 12.4], [21.4, 12.0], [23.4, 11.2], [21.2, 10.6], [22.4, 9.6], [23.4, 13.6], [21.0, 8.4]];
const COLORS = ['#e8862a', '#2a9db0', '#d64f6b', '#5b9b4a', '#8a5cc7', '#e0b23a', '#3f6fd1', '#e86fae'];

const rooms = new Map();
const sockRoom = new Map(); // socket.id -> code

function newCode() {
  let c;
  do c = String(Math.floor(1000 + Math.random() * 9000));
  while (rooms.has(c));
  return c;
}
const newId = () => Math.random().toString(36).slice(2, 8);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dist2 = (a, b) => flat(a, b) + Math.abs((a.y || 0) - (b.y || 0)) * 2;
const byPid = (room, pid) => room.players.find((p) => p.pid === pid);
const cleanName = (n, fb) => String(n || '').replace(/[<>]/g, '').trim().slice(0, 14) || fb;
const cleanColor = (c) => (/^#[0-9a-f]{6}$/i.test(String(c)) ? String(c) : COLORS[Math.floor(Math.random() * COLORS.length)]);
function setProfile(p, d) {
  if (d.name !== undefined) p.name = cleanName(d.name, p.name || 'Jogador');
  if (d.color !== undefined) p.color = cleanColor(d.color);
}
const seeker = (room) => room.players.find((p) => p.role === 'seeker');
const hiders = (room) => room.players.filter((p) => p.role === 'hider');
const aliveHiders = (room) => hiders(room).filter((p) => !p.found);
const playing = (room) => room.phase === 'hiding' || room.phase === 'seeking';

function newPlayer(pid, d) {
  const p = { pid, id: newId(), score: 0, role: null, spot: null, found: false, tauntAt: 0, connected: false };
  p.pos = { x: HIDER_SPAWNS[0][0], y: 0, z: HIDER_SPAWNS[0][1], ry: Math.PI };
  setProfile(p, { name: d.name || 'Jogador', color: d.color });
  return p;
}

function pub(room, p) {
  return { id: p.id, name: p.name, color: p.color, role: p.role, found: p.found, connected: p.connected, score: p.score };
}
function stateFor(room, p) {
  const sk = seeker(room);
  return {
    code: room.code, phase: room.phase, round: room.round, timeLeft: room.timeLeft,
    me: p.id, host: room.hostPid === p.pid, role: p.role, mySpot: p.spot, found: p.found,
    seekerId: sk ? sk.id : null, hidersLeft: playing(room) ? aliveHiders(room).length : 0, hidersTotal: hiders(room).length,
    players: room.players.map((q) => pub(room, q)), max: MAX_PLAYERS,
    tauntReadyIn: p.role === 'hider' ? Math.max(0, p.tauntAt + TAUNT_CD - Date.now()) : 0,
  };
}
const send = (p, ev, data) => { if (p && p.connected && p.sid) io.to(p.sid).emit(ev, data); };
function emitState(room) { for (const p of room.players) send(p, 'state', stateFor(room, p)); }
function emitAll(room, ev, data) { for (const p of room.players) send(p, ev, data); }
function stopTimer(room) { clearInterval(room.timer); clearTimeout(room.breakTimer); room.timer = null; }

function startRound(room) {
  stopTimer(room);
  if (room.players.length < 2) return toLobby(room);
  room.round++;
  room.seekerIdx = ((room.seekerIdx ?? -1) + 1) % room.players.length;
  room.phase = 'hiding';
  room.timeLeft = HIDE_TIME;
  room.checkAt = 0;
  room.lastTaunt = null;
  let hi = 0;
  room.players.forEach((p, i) => {
    p.role = i === room.seekerIdx ? 'seeker' : 'hider';
    p.spot = null; p.found = false; p.tauntAt = 0;
    if (p.role === 'seeker') p.pos = { ...SEEKER_SPAWN };
    else { const [x, z] = HIDER_SPAWNS[hi++ % HIDER_SPAWNS.length]; p.pos = { x, y: 0, z, ry: Math.PI }; }
  });
  const sk = seeker(room);
  for (const p of room.players) send(p, 'roundStart', { role: p.role, spawn: p.pos, round: room.round, seekerId: sk.id });
  emitState(room);
  room.timer = setInterval(() => tick(room), 1000);
}

function tick(room) {
  room.timeLeft--;
  if (room.timeLeft <= 0) {
    if (room.phase === 'hiding') {
      room.phase = 'seeking';
      room.timeLeft = SEEK_TIME;
      emitAll(room, 'phase', { phase: 'seeking' });
      emitState(room);
      return;
    }
    if (room.phase === 'seeking') return endRound(room, 'hiders', 'timeout');
  }
  emitAll(room, 'tick', { t: room.timeLeft, phase: room.phase });
}

function endRound(room, winner, reason) {
  if (!playing(room)) return;
  stopTimer(room);
  const survivors = aliveHiders(room);
  const sk = seeker(room);
  // quem procura só ganha se achar TODO mundo; senão, quem não foi achado ganha
  if (winner === 'hiders') for (const h of survivors) h.score += 1;
  else if (sk) sk.score += 1;
  room.phase = 'end';
  room.timeLeft = BREAK_TIME;
  const reveal = hiders(room).map((h) => ({ id: h.id, spot: h.spot, found: h.found, pos: h.pos }));
  for (const p of room.players) {
    const youWon = p.role === 'seeker' ? winner === 'seeker' : p.role === 'hider' ? !p.found : false;
    send(p, 'roundEnd', { winner, reason, youWon, seekerId: sk && sk.id, reveal, players: room.players.map((q) => pub(room, q)) });
  }
  emitState(room);
  room.breakTimer = setTimeout(() => startRound(room), BREAK_TIME * 1000);
}
function checkEnd(room) {
  if (room.phase !== 'seeking' && room.phase !== 'hiding') return;
  if (!seeker(room)) return endRound(room, 'hiders', 'left');
  if (hiders(room).length && !aliveHiders(room).length) endRound(room, 'seeker', 'allFound');
}

function toLobby(room) {
  stopTimer(room);
  room.phase = 'lobby';
  room.round = 0;
  room.seekerIdx = -1;
  for (const p of room.players) { p.role = null; p.spot = null; p.found = false; p.score = 0; }
  emitState(room);
}

function attach(socket, room, player) {
  player.sid = socket.id;
  player.connected = true;
  clearTimeout(player.dropTimer);
  sockRoom.set(socket.id, room.code);
  socket.join(room.code);
}
function leaveCurrent(socket) {
  const code = sockRoom.get(socket.id);
  if (!code) return;
  sockRoom.delete(socket.id);
  const room = rooms.get(code);
  if (!room) return;
  const p = room.players.find((x) => x.sid === socket.id);
  if (p) removePlayer(room, p.pid);
}
function deleteRoom(room) {
  stopTimer(room);
  rooms.delete(room.code);
}
function removePlayer(room, pid) {
  const idx = room.players.findIndex((p) => p.pid === pid);
  if (idx < 0) return;
  const [p] = room.players.splice(idx, 1);
  if (!room.players.length) return deleteRoom(room);
  if (room.hostPid === pid) room.hostPid = room.players[0].pid;
  if (idx <= room.seekerIdx) room.seekerIdx--;
  emitAll(room, 'left', { id: p.id, name: p.name });
  if (room.players.length < 2) return toLobby(room);
  if (playing(room)) {
    if (p.role === 'seeker') return endRound(room, 'hiders', 'left');
    checkEnd(room);
  }
  emitState(room);
}

// ---------------- ações (humanos e robôs) ----------------
function forward(room, p, msg) {
  // quem pode ver a posição de p
  for (const o of room.players) {
    if (o === p || !o.connected || !o.sid) continue;
    if (room.phase === 'hiding' && p.role === 'hider' && o.role === 'seeker') continue;
    io.to(o.sid).volatile.emit('p', msg);
  }
}
function doHide(room, p, s) {
  p.spot = s.id;
  p.pos = { x: s.ex, y: s.y, z: s.ez, ry: s.r + Math.PI };
  for (const o of room.players) {
    if (o === p) continue;
    const see = room.phase === 'seeking' || o.role !== 'seeker';
    send(o, 'p', { id: p.id, ...p.pos, hidden: 1, spot: see ? s.id : null });
  }
  emitState(room);
}
function markFound(room, h, reason, spotId) {
  h.found = true;
  const sk = seeker(room);
  emitAll(room, 'found', { id: h.id, name: h.name, reason, spotId: spotId || null, pos: h.pos, by: sk && sk.id });
  emitState(room);
  checkEnd(room);
}
function doCheck(room, p, spotId) {
  room.checkAt = Date.now();
  const h = aliveHiders(room).find((x) => x.spot === spotId);
  emitAll(room, 'checked', { spotId, found: !!h, by: p.id, who: h ? h.id : null });
  if (h) markFound(room, h, 'found', spotId);
}
function doTaunt(room, p) {
  p.tauntAt = Date.now();
  p.score += 0.5;
  const s = SPOT[p.spot];
  room.lastTaunt = { x: s.x, y: s.y, z: s.z, t: Date.now() };
  emitAll(room, 'taunt', { x: s.x, y: s.y, z: s.z, id: p.id });
  emitState(room);
}
const takenSpots = (room) => new Set(room.players.filter((q) => q.spot).map((q) => q.spot));

// ---------------- conexões ----------------
io.on('connection', (socket) => {
  const ctx = () => {
    const code = sockRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return {};
    const p = room.players.find((x) => x.sid === socket.id);
    return { room, p };
  };

  socket.on('create', (d = {}, cb = () => {}) => {
    if (!d.pid) return cb({ ok: false, error: 'Sem id' });
    leaveCurrent(socket);
    const code = newCode();
    const room = { code, players: [], round: 0, phase: 'lobby', timer: null, timeLeft: 0, checkAt: 0, seekerIdx: -1, hostPid: d.pid };
    rooms.set(code, room);
    const p = newPlayer(d.pid, d);
    room.players.push(p);
    attach(socket, room, p);
    cb({ ok: true, code });
    emitState(room);
  });

  socket.on('join', (d = {}, cb = () => {}) => {
    const code = String(d.code || '').trim();
    const room = rooms.get(code);
    if (!room) return cb({ ok: false, error: 'Sala não encontrada' });
    let p = byPid(room, d.pid);
    if (!p) {
      if (room.players.length >= MAX_PLAYERS) return cb({ ok: false, error: 'Sala cheia (máx. 7)' });
      if (sockRoom.get(socket.id) !== code) leaveCurrent(socket);
      p = newPlayer(d.pid, { name: d.name || 'Jogador ' + (room.players.length + 1), color: d.color });
      p.role = room.phase === 'lobby' ? null : 'wait';
      room.players.push(p);
      emitAll(room, 'toast', { text: p.name + ' entrou!' });
    }
    setProfile(p, { name: d.name || p.name, color: d.color });
    attach(socket, room, p);
    cb({ ok: true, code });
    emitState(room);
  });

  socket.on('rejoin', (d = {}, cb = () => {}) => {
    const room = rooms.get(String(d.code || ''));
    const p = room && byPid(room, d.pid);
    if (!p) return cb({ ok: false });
    setProfile(p, d);
    attach(socket, room, p);
    cb({ ok: true, code: room.code, pos: p.pos, phase: room.phase });
    emitState(room);
  });

  socket.on('profile', (d = {}) => {
    const { room, p } = ctx();
    if (!room || !p) return;
    setProfile(p, d);
    emitState(room);
  });

  socket.on('start', () => {
    const { room, p } = ctx();
    if (!room || !p || room.hostPid !== p.pid || room.phase !== 'lobby') return;
    if (room.players.length < 2) return socket.emit('toast', { text: 'Precisa de pelo menos 2 jogadores' });
    clearTimeout(room.breakTimer);
    emitAll(room, 'toast', { text: 'Começando…' });
    room.breakTimer = setTimeout(() => startRound(room), 1500);
  });

  socket.on('leave', () => leaveCurrent(socket));

  socket.on('pos', (d) => {
    const { room, p } = ctx();
    if (!room || !p || !d) return;
    if (room.phase === 'hiding' && p.role === 'seeker') return; // procurador congelado
    if (p.spot || p.found || p.role === 'wait') return;
    p.pos = { x: +d.x || 0, y: +d.y || 0, z: +d.z || 0, ry: +d.ry || 0 };
    forward(room, p, { id: p.id, ...p.pos, m: d.m ? 1 : 0 });
    // dica de passos: o escondido mais perto
    if (p.role === 'seeker' && room.phase === 'seeking') {
      const now = Date.now();
      if (now - (p.lastHint || 0) > 400) {
        p.lastHint = now;
        let best = null, bd = 1e9;
        for (const h of aliveHiders(room)) if (h.spot) { const s = SPOT[h.spot]; const dd = dist2(p.pos, s); if (dd < bd) { bd = dd; best = s; } }
        if (best) socket.emit('hint', { d: bd, x: best.x, y: best.y, z: best.z });
      }
    }
  });

  socket.on('hide', ({ spotId } = {}) => {
    const { room, p } = ctx();
    const s = SPOT[spotId];
    if (!room || !p || !s || p.role !== 'hider' || p.spot || p.found || !playing(room)) return;
    if (SPOTS.reach(s, p.pos.x, p.pos.z, p.pos.y) > SPOTS.REACH_SERVER) return socket.emit('hideFail', { text: 'Chegue mais perto' });
    if (takenSpots(room).has(s.id)) return socket.emit('hideFail', { text: 'Já tem alguém aí! 🤫' });
    doHide(room, p, s);
  });

  socket.on('unhide', () => {
    const { room, p } = ctx();
    if (!room || !p || p.role !== 'hider' || !p.spot || p.found || !playing(room)) return;
    const s = SPOT[p.spot];
    p.spot = null;
    p.pos = { x: s.ex, y: s.y, z: s.ez, ry: s.r };
    socket.emit('placed', p.pos);
    for (const o of room.players) {
      if (o === p) continue;
      if (room.phase === 'hiding' && o.role === 'seeker') continue;
      send(o, 'p', { id: p.id, ...p.pos, unhid: s.id });
    }
    emitState(room);
  });

  socket.on('check', ({ spotId } = {}) => {
    const { room, p } = ctx();
    const s = SPOT[spotId];
    if (!room || !p || !s || p.role !== 'seeker' || room.phase !== 'seeking') return;
    if (Date.now() - room.checkAt < 1200) return;
    if (SPOTS.reach(s, p.pos.x, p.pos.z, p.pos.y) > SPOTS.REACH_SERVER) return socket.emit('toast', { text: 'Chegue mais perto' });
    doCheck(room, p, spotId);
  });

  socket.on('catch', ({ id } = {}) => {
    const { room, p } = ctx();
    if (!room || !p || p.role !== 'seeker' || room.phase !== 'seeking') return;
    let best = null, bd = 1.9;
    for (const h of aliveHiders(room)) {
      if (h.spot || (id && h.id !== id)) continue;
      const d = dist2(p.pos, h.pos);
      if (d < bd) { bd = d; best = h; }
    }
    if (best) markFound(room, best, 'caught');
  });

  socket.on('taunt', () => {
    const { room, p } = ctx();
    if (!room || !p || p.role !== 'hider' || room.phase !== 'seeking' || !p.spot || p.found) return;
    if (Date.now() - p.tauntAt < TAUNT_CD) return;
    doTaunt(room, p);
  });

  socket.on('disconnect', () => {
    const code = sockRoom.get(socket.id);
    sockRoom.delete(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    const p = room.players.find((x) => x.sid === socket.id);
    if (!p) return;
    p.connected = false;
    emitState(room);
    p.dropTimer = setTimeout(() => {
      if (!p.connected && rooms.get(code)) removePlayer(room, p.pid);
    }, DROP_GRACE);
  });
});

server.listen(PORT, () => console.log(`Esconde no Prédio rodando na porta ${PORT}`));
