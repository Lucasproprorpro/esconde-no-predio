import * as THREE from '/vendor/three/three.module.js';
import { buildWorld, animateSpot, FH } from './map.js';

const SPOTS = window.SPOTS;
const SPOT = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- identidade / rede ----------------
let pid = localStorage.getItem('pid');
if (!pid) { pid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('pid', pid); }
const socket = io();

const S = {
  inRoom: false, code: null, phase: 'menu', role: null, round: 0, timeLeft: 0,
  scores: { you: 0, opp: 0 }, mySpot: null, players: 0, oppConnected: false, tauntReadyAt: 0,
};

// ---------------- render ----------------
const renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#140c0e');
scene.fog = new THREE.Fog('#140c0e', 16, 42);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 80);
const world = buildWorld(scene, SPOTS);
const raycaster = new THREE.Raycaster();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---------------- personagens low poly ----------------
function makeAvatar(shirt, hair) {
  const g = new THREE.Group();
  const L = (c) => new THREE.MeshLambertMaterial({ color: c });
  const part = (w, h, d, c, x, y, z, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), L(c)); m.position.set(x, y, z); parent.add(m); return m; };
  const leg = (x) => { const p = new THREE.Group(); p.position.set(x, 0.75, 0); g.add(p); part(0.17, 0.72, 0.2, '#2d3550', 0, -0.37, 0, p); part(0.18, 0.1, 0.28, '#1a1a1a', 0, -0.72, 0.04, p); return p; };
  const arm = (x) => { const p = new THREE.Group(); p.position.set(x, 1.38, 0); g.add(p); part(0.13, 0.6, 0.15, shirt, 0, -0.28, 0, p); part(0.12, 0.12, 0.12, '#e0ac86', 0, -0.62, 0, p); return p; };
  const legL = leg(-0.11), legR = leg(0.11);
  part(0.46, 0.66, 0.28, shirt, 0, 1.1, 0);
  const armL = arm(-0.31), armR = arm(0.31);
  part(0.34, 0.34, 0.32, '#e0ac86', 0, 1.62, 0);
  part(0.37, 0.12, 0.35, hair, 0, 1.82, -0.01);
  part(0.37, 0.2, 0.08, hair, 0, 1.7, -0.16);
  part(0.06, 0.06, 0.02, '#1a1a1a', -0.08, 1.64, 0.165);
  part(0.06, 0.06, 0.02, '#1a1a1a', 0.08, 1.64, 0.165);
  scene.add(g);
  return { g, legL, legR, armL, armR, phase: 0 };
}
const meAv = makeAvatar('#e8862a', '#3a2214');
const opAv = makeAvatar('#2a9db0', '#151010');
opAv.g.visible = false;
function animAvatar(av, moving, dt) {
  av.phase += dt * (moving ? 10 : 0);
  const a = moving ? Math.sin(av.phase) * 0.6 : av.legL.rotation.x * 0.8;
  av.legL.rotation.x = a; av.legR.rotation.x = -a; av.armL.rotation.x = -a * 0.8; av.armR.rotation.x = a * 0.8;
}

// ---------------- estado local ----------------
const me = { x: 22, y: 0, z: 13, ry: Math.PI, moving: false };
const opp = { x: 0, y: 0, z: 0, ry: 0, tx: 0, ty: 0, tz: 0, tr: 0, has: false, hidden: false, m: false, lastT: 0 };
let camYaw = Math.PI, camPitch = 0.35, hideYaw = 0, hidePitch = 0;
let revealOpp = null; // posição do escondido revelado no fim da rodada

// ---------------- física simples ----------------
function groundY(x, z, y) {
  if (x > 24 && x < 27 && z > 2 && z < 12) return ((z - 2) / 10) * FH;
  return y > FH / 2 ? FH : 0;
}
function collide(p) {
  const L = p.y > FH / 2 ? 1 : 0, r = 0.3;
  for (let it = 0; it < 2; it++) for (const c of world.colliders) {
    if (c.level !== L) continue;
    const cx = clamp(p.x, c.minX, c.maxX), cz = clamp(p.z, c.minZ, c.maxZ);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; }
    else {
      const l = p.x - c.minX, rr = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z, m = Math.min(l, rr, t, b);
      if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === t) p.z = c.minZ - r; else p.z = c.maxZ + r;
    }
  }
  p.x = clamp(p.x, 0.35, 27.65); p.z = clamp(p.z, 0.35, 15.65);
}

// ---------------- áudio sintetizado ----------------
let actx = null, noiseBuf = null;
function ac() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    actx = new AC();
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function out(vol, pan) {
  const a = ac(); if (!a) return null;
  const g = a.createGain(); g.gain.value = vol;
  if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = clamp(pan || 0, -1, 1); g.connect(p); p.connect(a.destination); }
  else g.connect(a.destination);
  return g;
}
function sStep(vol = 0.15, pan = 0) {
  const a = ac(); if (!a || vol < 0.005) return; const o = out(vol, pan);
  const src = a.createBufferSource(); src.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380 + Math.random() * 250;
  const e = a.createGain(); const t = a.currentTime;
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.01); e.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(f); f.connect(e); e.connect(o); src.start(t, Math.random() * 0.3); src.stop(t + 0.15);
}
function tone(freqs, dur, type = 'square', vol = 0.15, pan = 0, gap = 0) {
  const a = ac(); if (!a) return; const o = out(vol, pan); let t = a.currentTime;
  for (const fr of freqs) {
    const osc = a.createOscillator(); osc.type = type; const e = a.createGain();
    if (Array.isArray(fr)) { osc.frequency.setValueAtTime(fr[0], t); osc.frequency.exponentialRampToValueAtTime(fr[1], t + dur); }
    else osc.frequency.value = fr;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.02); e.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(e); e.connect(o); osc.start(t); osc.stop(t + dur + 0.02); t += dur + gap;
  }
}
const sTaunt = (vol, pan) => { tone([[900, 1500], [1500, 700]], 0.22, 'triangle', vol, pan, 0.05); setTimeout(() => tone([[500, 380], [520, 360], [540, 340]], 0.1, 'square', vol * 0.5, pan, 0.03), 520); };
const sCreak = (vol = 0.2, pan = 0) => tone([[140, 95]], 0.5, 'sawtooth', vol * 0.5, pan);
const sWin = () => tone([523, 659, 784, 1046], 0.13, 'triangle', 0.22);
const sLose = () => tone([392, 330, 262], 0.2, 'triangle', 0.2);
const sTick = () => tone([1200], 0.05, 'square', 0.06);
const sGo = () => tone([660, 990], 0.15, 'triangle', 0.2);
function spatial(x, y, z) {
  const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.hypot(dx, dz) + Math.abs(y - me.y) * 1.5;
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize();
  const pan = d > 0.01 ? (dx * right.x + dz * right.z) / Math.hypot(dx, dz) : 0;
  return { vol: Math.pow(clamp(1 - d / 18, 0, 1), 1.6), pan: pan * 0.8, d };
}

// ---------------- UI ----------------
let toastT = 0;
function toast(text, ms = 1800) { const el = $('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms); }
const fmt = (n) => String(n).replace('.', ',').replace(',5', '½').replace(/^0½$/, '½');
function fmtTime(t) { t = Math.max(0, t); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
const HIDE_CLASS = { wardrobe: 'slats', pantry: 'door', closet: 'door', bed: 'low', table: 'cloth', tub: 'curtain', sofa: 'peek', counter: 'peek' };
const CAM_H = { wardrobe: 1.5, pantry: 1.5, closet: 1.5, bed: 0.22, table: 0.35, tub: 0.75, sofa: 0.95, counter: 1.12 };
const CAM_F = { wardrobe: 0.15, pantry: 0.2, closet: 0.2, bed: 1.0, table: 0.55, tub: 0.1, sofa: 0.15, counter: 0 };
const SEEK_LABEL = { wardrobe: 'Abrir', pantry: 'Abrir', closet: 'Abrir', tub: 'Abrir', bed: 'Procurar', table: 'Procurar', sofa: 'Procurar', counter: 'Procurar' };

function renderHUD() {
  $('sMe').textContent = fmt(S.scores.you);
  $('sOp').textContent = fmt(S.scores.opp);
  const tEl = $('timer');
  if (S.phase === 'hiding' || S.phase === 'seeking') {
    tEl.textContent = fmtTime(S.timeLeft);
    tEl.classList.toggle('warn', S.phase === 'seeking' && S.timeLeft <= 15);
  } else tEl.textContent = S.phase === 'end' ? '…' : '--';
  const rb = $('roleBadge');
  rb.className = S.role || '';
  rb.textContent = !S.role ? '' : S.role === 'hider'
    ? (S.phase === 'hiding' ? 'Esconda-se! (' + S.timeLeft + 's)' : S.mySpot ? 'Escondido — fica quietinho' : 'Você esconde')
    : (S.phase === 'hiding' ? 'Você procura' : 'Procure! Abra os esconderijos');
  $('blind').classList.toggle('show', S.role === 'seeker' && S.phase === 'hiding');
  $('blindCount').textContent = S.timeLeft;
  $('waitBar').classList.toggle('hidden', !(S.inRoom && S.players < 2));
  $('waitCode').textContent = S.code || '----';
  const hv = $('hideView');
  if (S.mySpot) { hv.className = 'show ' + HIDE_CLASS[SPOT[S.mySpot].kind]; } else hv.className = '';
  $('btnTaunt').classList.toggle('hidden', !(S.mySpot && S.phase === 'seeking'));
}

let actionMode = null, actionSpot = null, lastLabel = '';
function updateAction() {
  let label = '', mode = null, spot = null;
  const playing = S.phase === 'hiding' || S.phase === 'seeking';
  if (playing && S.role === 'hider') {
    if (S.mySpot) { label = 'Sair'; mode = 'unhide'; }
    else { spot = nearestSpot(); if (spot) { label = 'Esconder'; mode = 'hide'; } }
  } else if (S.phase === 'seeking' && S.role === 'seeker') {
    if (opp.has && !opp.hidden && opAv.g.visible && Math.hypot(opp.x - me.x, opp.z - me.z) < 1.6 && Math.abs(opp.y - me.y) < 1) { label = 'Pegar!'; mode = 'catch'; }
    else { spot = nearestSpot(); if (spot) { label = SEEK_LABEL[spot.kind]; mode = 'check'; } }
  }
  actionMode = mode; actionSpot = spot;
  const btn = $('btnAction');
  if (label !== lastLabel) {
    lastLabel = label; btn.textContent = label; btn.classList.toggle('hidden', !label);
    btn.classList.toggle('seek', S.role === 'seeker');
  }
  const sn = $('spotName');
  const nm = S.mySpot ? SPOT[S.mySpot].name : spot ? spot.name : '';
  if (sn.textContent !== nm) sn.textContent = nm;
  // provocar cooldown
  const tb = $('btnTaunt');
  const left = Math.ceil((S.tauntReadyAt - performance.now()) / 1000);
  const dis = left > 0;
  if (tb.disabled !== dis) tb.disabled = dis;
  const tl = dis ? left + 's' : 'Provocar';
  if (tb.firstChild.textContent !== tl) tb.firstChild.textContent = tl;
}
function nearestSpot() {
  let best = null, bd = 1.8;
  const lvl = me.y > FH / 2 ? 1 : 0;
  for (const s of SPOTS) {
    if (s.level !== lvl) continue;
    const d = Math.hypot(s.x - me.x, s.z - me.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function doAction() {
  ac();
  if (actionMode === 'hide' && actionSpot) socket.emit('hide', { spotId: actionSpot.id });
  else if (actionMode === 'unhide') socket.emit('unhide');
  else if (actionMode === 'check' && actionSpot) socket.emit('check', { spotId: actionSpot.id });
  else if (actionMode === 'catch') socket.emit('catch');
}
function onBtn(el, fn) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
}
onBtn($('btnAction'), doAction);
onBtn($('btnTaunt'), () => { ac(); socket.emit('taunt'); });

// ---------------- controles touch / mouse / teclado ----------------
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const look = { id: null, lx: 0, ly: 0 };
const touchEl = $('touch');
touchEl.addEventListener('pointerdown', (e) => {
  ac();
  if (e.clientX < innerWidth * 0.45 && joy.id === null) {
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
    const b = $('joyBase'); b.style.display = 'block'; b.style.left = e.clientX + 'px'; b.style.top = e.clientY + 'px';
    $('joyKnob').style.transform = '';
  } else if (look.id === null) { look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY; }
  touchEl.setPointerCapture(e.pointerId);
});
touchEl.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy), R = 55;
    if (d > R) { dx *= R / d; dy *= R / d; }
    joy.x = dx / R; joy.y = dy / R;
    $('joyKnob').style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === look.id) {
    const dx = e.clientX - look.lx, dy = e.clientY - look.ly; look.lx = e.clientX; look.ly = e.clientY;
    if (S.mySpot) { hideYaw = clamp(hideYaw - dx * 0.006, -0.9, 0.9); hidePitch = clamp(hidePitch - dy * 0.005, -0.4, 0.4); }
    else { camYaw -= dx * 0.0065; camPitch = clamp(camPitch + dy * 0.005, -0.25, 1.1); }
  }
});
function endPtr(e) {
  if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joyBase').style.display = 'none'; }
  if (e.pointerId === look.id) look.id = null;
}
touchEl.addEventListener('pointerup', endPtr);
touchEl.addEventListener('pointercancel', endPtr);
const keys = {};
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (e.code === 'KeyE' || e.code === 'Space') doAction();
  if (e.code === 'KeyQ') socket.emit('taunt');
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---------------- menu ----------------
function enterGameUI() {
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  try { if (document.documentElement.requestFullscreen && matchMedia('(pointer:coarse)').matches) document.documentElement.requestFullscreen().catch(() => {}); } catch (_) {}
}
$('btnCreate').onclick = () => {
  ac();
  socket.emit('create', { pid }, (r) => {
    if (!r.ok) return ($('menuMsg').textContent = r.error);
    S.inRoom = true; S.code = r.code; sessionStorage.setItem('room', r.code);
    enterGameUI(); renderHUD(); toast('Sala ' + r.code + ' criada!', 2500);
  });
};
$('btnJoin').onclick = () => {
  ac();
  const code = $('codeIn').value.trim();
  if (!/^\d{4}$/.test(code)) return ($('menuMsg').textContent = 'Digite os 4 números');
  socket.emit('join', { pid, code }, (r) => {
    if (!r.ok) return ($('menuMsg').textContent = r.error);
    S.inRoom = true; S.code = r.code; sessionStorage.setItem('room', r.code);
    enterGameUI(); renderHUD();
  });
};
$('codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
const qsCode = new URLSearchParams(location.search).get('sala');
if (qsCode) $('codeIn').value = qsCode;
$('btnShare').onclick = async () => {
  const url = location.origin + '/?sala=' + S.code;
  const text = 'Bora jogar esconde-esconde! Código da sala: ' + S.code;
  try { if (navigator.share) await navigator.share({ title: 'Esconde no Prédio', text, url }); else { await navigator.clipboard.writeText(text + ' ' + url); toast('Link copiado!'); } } catch (_) {}
};

// ---------------- eventos do servidor ----------------
socket.on('connect', () => {
  const code = S.code || sessionStorage.getItem('room');
  if (!code) return;
  socket.emit('rejoin', { pid, code }, (r) => {
    if (r.ok) {
      S.inRoom = true; S.code = r.code; enterGameUI();
      if (r.pos) Object.assign(me, { x: r.pos.x, y: r.pos.y, z: r.pos.z });
    } else if (S.inRoom) { S.inRoom = false; sessionStorage.removeItem('room'); location.reload(); }
    else sessionStorage.removeItem('room');
  });
});
socket.on('state', (s) => {
  const wasSpot = S.mySpot;
  Object.assign(S, s);
  S.tauntReadyAt = performance.now() + (s.tauntReadyIn || 0);
  if (s.mySpot && !wasSpot) { hideYaw = 0; hidePitch = 0; sCreak(0.15); }
  if (s.phase === 'lobby') { opp.has = false; revealOpp = null; }
  renderHUD();
});
socket.on('tick', ({ t }) => {
  S.timeLeft = t; renderHUD();
  if ((S.phase === 'seeking' && t <= 10) || (S.phase === 'hiding' && t <= 5)) sTick();
});
socket.on('phase', ({ phase }) => {
  if (phase === 'seeking') {
    if (S.role === 'seeker') { toast('Valendo! Procure!', 2000); sGo(); }
    else toast(S.mySpot ? 'Ele começou a procurar… shhh' : 'Ele está procurando! Esconda-se!', 2200);
  }
});
socket.on('roundStart', ({ role, spawn, round }) => {
  $('endPanel').classList.add('hidden');
  Object.assign(me, { x: spawn.x, y: spawn.y, z: spawn.z, ry: spawn.ry });
  camYaw = spawn.ry; camPitch = 0.35;
  opp.has = false; opp.hidden = false; revealOpp = null; S.mySpot = null;
  toast(`Rodada ${round}: ${role === 'hider' ? 'você ESCONDE! Corra!' : 'você PROCURA'}`, 2500);
});
socket.on('opp', (d) => {
  if (d.hidden) { opp.hidden = true; return; }
  if (!opp.has) { opp.x = d.x; opp.y = d.y; opp.z = d.z; opp.ry = d.ry; }
  opp.has = true; opp.hidden = false; opp.tx = d.x; opp.ty = d.y; opp.tz = d.z; opp.tr = d.ry; opp.m = !!d.m; opp.lastT = performance.now();
});
socket.on('placed', (p) => { Object.assign(me, { x: p.x, y: p.y, z: p.z, ry: p.ry }); camYaw = p.ry + Math.PI; });
const anims = [];
socket.on('checked', ({ spotId, found }) => {
  anims.push({ id: spotId, t: 0, dur: found ? 0.8 : 1.5, hold: found });
  const s = SPOT[spotId]; const sp = spatial(s.x, s.y, s.z);
  sCreak(0.25 * Math.max(sp.vol, 0.3), sp.pan);
  if (!found && S.role === 'seeker') toast('Vazio…', 900);
  if (!found && S.role === 'hider' && spotId !== S.mySpot) toast('Ele abriu: ' + s.name, 1500);
});
socket.on('taunt', ({ x, y, z }) => {
  const sp = spatial(x, y, z);
  if (S.role === 'seeker') { sTaunt(clamp(sp.vol * 0.5 + 0.08, 0.08, 0.5), sp.pan); toast('Ouviu isso? 👀', 1500); }
  else { sTaunt(0.25, 0); toast('+½ ponto de provocação!', 1400); }
});
let hint = { d: 99, t: 0, x: 0, y: 0, z: 0 }, hintNext = 0;
socket.on('hint', (h) => { hint = { ...h, t: performance.now() }; });
socket.on('toast', ({ text }) => toast(text));
socket.on('roundEnd', ({ winnerRole, youWon, reason, spotId, hiderPos, scores }) => {
  S.scores = scores;
  if (spotId) { const s = SPOT[spotId]; revealOpp = { x: s.x, y: s.y, z: s.z, ry: s.r }; }
  else if (hiderPos && S.role === 'seeker') revealOpp = hiderPos;
  if (S.role === 'hider') revealOpp = null;
  (youWon ? sWin : sLose)();
  const msgs = {
    found: S.role === 'seeker' ? 'Achou! Estava em: ' + SPOT[spotId].name : 'Te acharam em: ' + SPOT[spotId].name,
    caught: S.role === 'seeker' ? 'Pegou no flagra!' : 'Te pegaram no meio do caminho!',
    timeout: S.role === 'hider' ? 'Ninguém te achou!' + (spotId ? ' (' + SPOT[spotId].name + ')' : '') : 'O tempo acabou…' + (spotId ? ' Estava em: ' + SPOT[spotId].name : ''),
  };
  $('endTitle').textContent = youWon ? 'Ponto seu! 🎉' : 'Ponto do rival';
  $('endText').textContent = msgs[reason] || '';
  $('endScore').innerHTML = `<span style="color:#ffb24a">Você ${fmt(scores.you)}</span> × <span style="color:#6fd3e0">${fmt(scores.opp)} Rival</span>`;
  setTimeout(() => $('endPanel').classList.remove('hidden'), 900);
  renderHUD();
});

// ---------------- loop ----------------
const camTarget = new THREE.Vector3();
const camWant = new THREE.Vector3();
let lastSend = 0, stepAcc = 0, oppStepAcc = 0, lastSent = '';
let prev = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now;

  // --- mover jogador ---
  const canMove = S.inRoom && !S.mySpot && !(S.role === 'seeker' && S.phase === 'hiding') && S.phase !== 'end';
  let ix = joy.x, iy = joy.y;
  if (keys.KeyW || keys.ArrowUp) iy = -1; if (keys.KeyS || keys.ArrowDown) iy = 1;
  if (keys.KeyA || keys.ArrowLeft) ix = -1; if (keys.KeyD || keys.ArrowRight) ix = 1;
  const mag = Math.min(1, Math.hypot(ix, iy));
  me.moving = false;
  if (canMove && mag > 0.12) {
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    let mx = fx * -iy + rx * ix, mz = fz * -iy + rz * ix; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const sp = 3.4 * mag;
    me.x += mx * sp * dt; me.z += mz * sp * dt;
    collide(me);
    const targetR = Math.atan2(mx, mz);
    let dr = targetR - me.ry; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); me.ry += dr * Math.min(1, dt * 12);
    me.moving = true;
    stepAcc += dt * mag; if (stepAcc > 0.36) { stepAcc = 0; sStep(0.04); }
  }
  me.y = groundY(me.x, me.z, me.y);
  meAv.g.position.set(me.x, me.y, me.z); meAv.g.rotation.y = me.ry;
  meAv.g.visible = !S.mySpot;
  animAvatar(meAv, me.moving, dt);

  // --- enviar posição ---
  if (S.inRoom && now - lastSend > 80) {
    const key = me.x.toFixed(2) + me.z.toFixed(2) + me.ry.toFixed(2);
    if (key !== lastSent || now - lastSend > 1000) {
      lastSend = now; lastSent = key;
      socket.volatile.emit('pos', { x: me.x, y: me.y, z: me.z, ry: me.ry, m: me.moving ? 1 : 0 });
    }
  }

  // --- oponente ---
  const k = 1 - Math.exp(-dt * 12);
  opp.x += (opp.tx - opp.x) * k; opp.y += (opp.ty - opp.y) * k; opp.z += (opp.tz - opp.z) * k;
  let dr = opp.tr - opp.ry; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); opp.ry += dr * k;
  const oppMoving = opp.m && now - opp.lastT < 400;
  if (revealOpp) {
    opAv.g.visible = true; opAv.g.position.set(revealOpp.x, revealOpp.y, revealOpp.z); opAv.g.rotation.y = revealOpp.ry || 0;
    animAvatar(opAv, false, dt);
  } else {
    const blind = S.role === 'seeker' && S.phase === 'hiding';
    opAv.g.visible = opp.has && !opp.hidden && S.oppConnected && !blind && S.players === 2;
    opAv.g.position.set(opp.x, opp.y, opp.z); opAv.g.rotation.y = opp.ry;
    animAvatar(opAv, oppMoving, dt);
    if (opAv.g.visible && oppMoving) {
      oppStepAcc += dt; if (oppStepAcc > 0.36) { oppStepAcc = 0; const sp = spatial(opp.x, opp.y, opp.z); sStep(sp.vol * 0.35, sp.pan); }
    }
  }

  // --- dica: passinhos baixinhos perto do escondido ---
  if (S.role === 'seeker' && S.phase === 'seeking' && now - hint.t < 1200 && hint.d < 5.5 && now > hintNext) {
    const sp = spatial(hint.x, hint.y, hint.z);
    sStep(0.05 + (1 - hint.d / 5.5) * 0.18, sp.pan);
    hintNext = now + 500 + hint.d * 160 + Math.random() * 300;
  }

  // --- animações de esconderijos ---
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]; a.t += dt;
    const p = a.hold ? Math.min(0.5, a.t / a.dur * 0.5) : a.t / a.dur;
    animateSpot(world.spotFx[a.id], p);
    if (!a.hold && p >= 1) { animateSpot(world.spotFx[a.id], 1); anims.splice(i, 1); }
  }
  if (S.phase === 'hiding' && anims.length) { for (const a of anims) animateSpot(world.spotFx[a.id], 1); anims.length = 0; }

  // --- câmera ---
  if (S.mySpot) {
    const s = SPOT[S.mySpot];
    const f = CAM_F[s.kind];
    camera.position.set(s.x + Math.sin(s.r) * f, s.y + CAM_H[s.kind], s.z + Math.cos(s.r) * f);
    const yaw = s.r + hideYaw;
    camWant.set(camera.position.x + Math.sin(yaw), camera.position.y + Math.sin(hidePitch), camera.position.z + Math.cos(yaw));
    camera.lookAt(camWant);
  } else {
    camTarget.set(me.x, me.y + 1.45, me.z);
    const dist = 3.1;
    const dir = new THREE.Vector3(-Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), -Math.cos(camYaw) * Math.cos(camPitch));
    raycaster.set(camTarget, dir); raycaster.far = dist;
    const hit = raycaster.intersectObjects(world.blockers, false)[0];
    const d = hit ? Math.max(0.35, hit.distance - 0.2) : dist;
    camWant.copy(camTarget).addScaledVector(dir, d);
    camera.position.lerp(camWant, hit ? 1 : 1 - Math.exp(-dt * 14));
    camera.lookAt(camTarget);
    meAv.g.visible = d > 0.6;
  }

  updateAction();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
window.__g = { me, S, SPOT, get yaw() { return camYaw; }, set yaw(v) { camYaw = v; } };

// tela de fundo do menu: câmera passeando
if (!sessionStorage.getItem('room')) renderHUD();
