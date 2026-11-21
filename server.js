const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const SPOTS = require('./public/spots.js');

const PORT = process.env.PORT || 3000;
const HIDE_TIME = Number(process.env.HIDE_TIME || 30);
const SEEK_TIME = Number(process.env.SEEK_TIME || 120);
const BREAK_TIME = Number(process.env.BREAK_TIME || 6);
const TAUNT_CD = Number(process.env.TAUNT_CD || 12) * 1000;
const DROP_GRACE = 45000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build')));
app.get('/health', (_req, res) => res.send('ok'));

const SPOT = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
const SPAWN = {
  hider: { x: 22, y: 0, z: 13, ry: Math.PI },
  seeker: { x: 9, y: 0, z: 7.5, ry: 0 },
};

const rooms = new Map();
const sockRoom = new Map(); // socket.id -> code

function newCode() {
  let c;
  do c = String(Math.floor(1000 + Math.random() * 9000));
  while (rooms.has(c));
  return c;
}
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) + Math.abs((a.y || 0) - (b.y || 0)) * 2;
const other = (room, pid) => room.players.find((p) => p.pid !== pid);
const me = (room, pid) => room.players.find((p) => p.pid === pid);

function stateFor(room, p) {
  const o = other(room, p.pid);
  const role = room.phase === 'lobby' ? null : room.hiderPid === p.pid ? 'hider' : 'seeker';
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    timeLeft: room.timeLeft,
    role,
    mySpot: role === 'hider' ? room.spot : null,
    players: room.players.length,
    oppConnected: !!(o && o.connected),
    scores: { you: room.scores[p.pid] || 0, opp: o ? room.scores[o.pid] || 0 : 0 },
    tauntReadyIn: role === 'hider' ? Math.max(0, room.tauntAt + TAUNT_CD - Date.now()) : 0,
  };
}
function emitState(room) {
  for (const p of room.players) if (p.connected) io.to(p.sid).emit('state', stateFor(room, p));
}
function emitAll(room, ev, data) {
  for (const p of room.players) if (p.connected) io.to(p.sid).emit(ev, data);
}
function stopTimer(room) {
  clearInterval(room.timer);
  clearTimeout(room.breakTimer);
  room.timer = null;
}

function startRound(room) {
  stopTimer(room);
  if (room.players.length < 2) return toLobby(room);
  room.round++;
  if (room.round === 1) room.hiderPid = room.players[0].pid;
  else room.hiderPid = other(room, room.hiderPid).pid;
  room.seekerPid = other(room, room.hiderPid).pid;
  room.phase = 'hiding';
  room.timeLeft = HIDE_TIME;
  room.spot = null;
  room.tauntAt = 0;
  room.checkAt = 0;
  for (const p of room.players) {
    const role = p.pid === room.hiderPid ? 'hider' : 'seeker';
    p.pos = { ...SPAWN[role] };
    if (p.connected) io.to(p.sid).emit('roundStart', { role, spawn: SPAWN[role], round: room.round });
  }
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
    if (room.phase === 'seeking') return endRound(room, 'hider', 'timeout');
  }
  emitAll(room, 'tick', { t: room.timeLeft, phase: room.phase });
}

function endRound(room, winnerRole, reason) {
  stopTimer(room);
  const winPid = winnerRole === 'hider' ? room.hiderPid : room.seekerPid;
  room.scores[winPid] = (room.scores[winPid] || 0) + 1;
  room.phase = 'end';
  room.timeLeft = BREAK_TIME;
  const hider = me(room, room.hiderPid);
  for (const p of room.players) {
    if (!p.connected) continue;
    io.to(p.sid).emit('roundEnd', {
      winnerRole,
      youWon: p.pid === winPid,
      reason,
      spotId: room.spot,
      hiderPos: hider && hider.pos,
      scores: stateFor(room, p).scores,
    });
  }
  emitState(room);
  room.breakTimer = setTimeout(() => startRound(room), BREAK_TIME * 1000);
}

function toLobby(room) {
  stopTimer(room);
  room.phase = 'lobby';
  room.round = 0;
  room.spot = null;
  room.hiderPid = room.seekerPid = null;
  for (const p of room.players) room.scores[p.pid] = 0;
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

function removePlayer(room, pid) {
  room.players = room.players.filter((p) => p.pid !== pid);
  delete room.scores[pid];
  if (room.players.length === 0) {
    stopTimer(room);
    rooms.delete(room.code);
    return;
  }
  toLobby(room);
}

io.on('connection', (socket) => {
  const ctx = () => {
    const code = sockRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return {};
    const p = room.players.find((x) => x.sid === socket.id);
    return { room, p };
  };

  socket.on('create', ({ pid } = {}, cb = () => {}) => {
    if (!pid) return cb({ ok: false, error: 'Sem id' });
    leaveCurrent(socket);
    const code = newCode();
    const room = { code, players: [], scores: {}, round: 0, phase: 'lobby', spot: null, timer: null, timeLeft: 0, tauntAt: 0, checkAt: 0 };
    rooms.set(code, room);
    const p = { pid, pos: { ...SPAWN.hider } };
    room.players.push(p);
    room.scores[pid] = 0;
    attach(socket, room, p);
    cb({ ok: true, code });
    emitState(room);
  });

  socket.on('join', ({ pid, code } = {}, cb = () => {}) => {
    code = String(code || '').trim();
    const room = rooms.get(code);
    if (!room) return cb({ ok: false, error: 'Sala não encontrada' });
    let p = me(room, pid);
    if (!p) {
      if (room.players.length >= 2) return cb({ ok: false, error: 'Sala cheia' });
      if (sockRoom.get(socket.id) !== code) leaveCurrent(socket);
      p = { pid, pos: { ...SPAWN.seeker } };
      room.players.push(p);
      room.scores[pid] = 0;
    }
    attach(socket, room, p);
    cb({ ok: true, code, rejoined: false });
    emitState(room);
    if (room.players.length === 2 && room.phase === 'lobby') {
      clearTimeout(room.breakTimer);
      room.breakTimer = setTimeout(() => startRound(room), 2500);
      emitAll(room, 'toast', { text: 'Os dois chegaram! Começando...' });
    }
  });

  socket.on('rejoin', ({ pid, code } = {}, cb = () => {}) => {
    const room = rooms.get(String(code || ''));
    const p = room && me(room, pid);
    if (!p) return cb({ ok: false });
    attach(socket, room, p);
    cb({ ok: true, code: room.code, pos: p.pos, phase: room.phase });
    emitState(room);
  });

  socket.on('leave', () => leaveCurrent(socket));

  let lastHint = 0;
  socket.on('pos', (d) => {
    const { room, p } = ctx();
    if (!room || !p || !d) return;
    if (room.phase === 'hiding' && p.pid === room.seekerPid) return; // procurador congelado
    if (p.pid === room.hiderPid && room.spot) return; // escondido não anda
    p.pos = { x: +d.x || 0, y: +d.y || 0, z: +d.z || 0, ry: +d.ry || 0 };
    const o = other(room, p.pid);
    if (!o || !o.connected) return;
    const isHider = p.pid === room.hiderPid;
    if (isHider && room.phase === 'hiding') return; // procurador não vê nada
    io.to(o.sid).volatile.emit('opp', { ...p.pos, m: d.m ? 1 : 0 });
    // dica de passos pro procurador quando chega perto do esconderijo
    if (!isHider && room.phase === 'seeking' && room.spot) {
      const now = Date.now();
      if (now - lastHint > 400) {
        lastHint = now;
        const s = SPOT[room.spot];
        socket.emit('hint', { d: dist2(p.pos, s), x: s.x, y: s.y, z: s.z });
      }
    }
  });

  socket.on('hide', ({ spotId } = {}) => {
    const { room, p } = ctx();
    const s = SPOT[spotId];
    if (!room || !p || !s || p.pid !== room.hiderPid || room.spot) return;
    if (room.phase !== 'hiding' && room.phase !== 'seeking') return;
    if (dist2(p.pos, s) > 2.8) return socket.emit('toast', { text: 'Chegue mais perto' });
    room.spot = spotId;
    const o = other(room, p.pid);
    if (o && o.connected) io.to(o.sid).emit('opp', { ...p.pos, hidden: 1 });
    emitState(room);
  });

  socket.on('unhide', () => {
    const { room, p } = ctx();
    if (!room || !p || p.pid !== room.hiderPid || !room.spot) return;
    if (room.phase !== 'hiding' && room.phase !== 'seeking') return;
    const s = SPOT[room.spot];
    room.spot = null;
    p.pos = { x: s.ex, y: s.y, z: s.ez, ry: s.r };
    socket.emit('placed', p.pos);
    emitState(room);
  });

  socket.on('check', ({ spotId } = {}) => {
    const { room, p } = ctx();
    const s = SPOT[spotId];
    if (!room || !p || !s || p.pid !== room.seekerPid || room.phase !== 'seeking') return;
    const now = Date.now();
    if (now - room.checkAt < 1200) return;
    if (dist2(p.pos, s) > 2.8) return socket.emit('toast', { text: 'Chegue mais perto' });
    room.checkAt = now;
    const found = room.spot === spotId;
    emitAll(room, 'checked', { spotId, found });
    if (found) endRound(room, 'seeker', 'found');
  });

  socket.on('catch', () => {
    const { room, p } = ctx();
    if (!room || !p || p.pid !== room.seekerPid || room.phase !== 'seeking' || room.spot) return;
    const h = me(room, room.hiderPid);
    if (h && dist2(p.pos, h.pos) < 1.9) endRound(room, 'seeker', 'caught');
  });

  socket.on('taunt', () => {
    const { room, p } = ctx();
    if (!room || !p || p.pid !== room.hiderPid || room.phase !== 'seeking' || !room.spot) return;
    const now = Date.now();
    if (now - room.tauntAt < TAUNT_CD) return;
    room.tauntAt = now;
    room.scores[p.pid] = (room.scores[p.pid] || 0) + 0.5;
    const s = SPOT[room.spot];
    emitAll(room, 'taunt', { x: s.x, y: s.y, z: s.z });
    emitState(room);
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
