import * as THREE from '/vendor/three/three.module.js';
import { buildWorld, FH } from './map.js';
import { makeAvatar, poseAvatar, hidePose, hideOpen, searchPose, nameTag, ENTER_DUR, HIDE_CAM, SHIRTS } from './avatar.js';
import * as A from './audio.js';

const SPOTS = window.SPOTS;
const SPOT = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const P = Math.PI;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------------- identidade / rede ----------------
let pid = store.get('pid');
if (!pid) { pid = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('pid', pid); }
const profile = { name: store.get('name') || '', color: store.get('color') || SHIRTS[Math.floor(Math.random() * SHIRTS.length)] };
const socket = io();

const S = {
  inRoom: false, code: null, phase: 'menu', role: null, round: 0, timeLeft: 0, me: null, host: false,
  mySpot: null, found: false, seekerId: null, hidersLeft: 0, hidersTotal: 0, players: [], tauntReadyAt: 0,
};
const nameOf = (id) => { const p = S.players.find((q) => q.id === id); return p ? p.name : '?'; };

// ---------------- render ----------------
const isTouch = matchMedia('(pointer:coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch || devicePixelRatio < 2, powerPreference: 'high-performance' });
let pr = Math.min(devicePixelRatio, isTouch ? 1.35 : 1.6);
const prMax = pr;
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0c1a');
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.05, 90);
const world = buildWorld(scene, SPOTS);
const raycaster = new THREE.Raycaster();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
const ambL = new THREE.AmbientLight('#ffffff', 1); scene.add(ambL);
const keyL = new THREE.DirectionalLight('#ffffff', 1); scene.add(keyL, keyL.target);
const tmpC = new THREE.Color();

// ---------------- personagens ----------------
function blob() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ map: world.shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -P / 2; m.renderOrder = 1; scene.add(m); return m;
}
const meAv = makeAvatar(scene, { shirt: profile.color, seed: pid });
const meShadow = blob();
const others = new Map(); // id -> outro jogador
function newOther(p) {
  const o = {
    id: p.id, name: p.name, color: p.color, key: '', av: null, shadow: blob(), tag: null,
    x: 0, y: 0, z: 0, ry: 0, tx: 0, ty: 0, tz: 0, tr: 0, has: false, hidden: false, m: false, lastT: 0, stepAcc: 0,
    act: null, search: null, foundShow: null, reveal: null, vis: { x: 0, y: 0, z: 0, ry: 0, pitch: 0, pose: {}, open: 0 },
  };
  others.set(p.id, o);
  return o;
}
function syncOthers() {
  const ids = new Set();
  for (const p of S.players) {
    if (p.id === S.me) continue;
    ids.add(p.id);
    const o = others.get(p.id) || newOther(p);
    Object.assign(o, { name: p.name, color: p.color, role: p.role, found: p.found, connected: p.connected });
    const key = p.name + '|' + p.color;
    if (key !== o.key) {
      o.key = key;
      const vis = o.av ? o.av.root.visible : false;
      if (o.av) scene.remove(o.av.root);
      o.av = makeAvatar(scene, { shirt: p.color, seed: p.name + p.id });
      o.av.root.visible = vis;
      if (o.tag) scene.remove(o.tag);
      o.tag = nameTag(p.name, p.color); scene.add(o.tag);
    }
  }
  for (const [id, o] of others) if (!ids.has(id)) { scene.remove(o.av.root); scene.remove(o.shadow); if (o.tag) scene.remove(o.tag); others.delete(id); }
}

// ---------------- estado local ----------------
const me = { x: 22.6, y: 0, z: 12.4, ry: P, moving: false };
let camYaw = P, camPitch = 0.32, hideYaw = 0, hidePitch = 0;
let practiceSpot = null; // esconder de treino (sala antes de começar)
let act = null; // minha animação de entrar/sair
let myReveal = null, myFoundShow = null;
let searchMe = null;
const checkAnims = [];
const hiddenId = () => (S.phase === 'end' || S.found ? null : S.mySpot || practiceSpot);
const isPractice = () => S.inRoom && S.phase === 'lobby';
const spectating = () => S.inRoom && (S.found || S.role === 'wait') && S.phase !== 'lobby' && S.phase !== 'end' && !myFoundShow;
function toWorld(s, lx, lz) { const c = Math.cos(s.r), sn = Math.sin(s.r); return [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c]; }

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
function spatial(x, y, z) {
  const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.hypot(dx, dz) + Math.abs(y - camera.position.y + 1.4) * 1.5;
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize();
  const pan = (dx * right.x + dz * right.z) / Math.max(0.01, Math.hypot(dx, dz));
  return { vol: Math.pow(clamp(1 - d / 18, 0, 1), 1.6), pan: pan * 0.8, d };
}

// ---------------- UI ----------------
let toastT = 0;
function toast(text, ms = 1800) { const el = $('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms); }
const fmt = (n) => String(n).replace('.', ',').replace(',5', '½').replace(/^0½$/, '½');
function fmtTime(t) { t = Math.max(0, t); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
const HIDE_CLASS = { wardrobe: 'slats', pantry: 'door', closet: 'door', bed: 'low', table: 'cloth', tub: 'curtain', sofa: 'peek', counter: 'peek', curtain: 'drape', chest: 'crack', box: 'cardboard', coats: 'coats' };
const SEEK_LABEL = { wardrobe: 'Abrir', pantry: 'Abrir', closet: 'Abrir', tub: 'Abrir', chest: 'Abrir', box: 'Abrir', curtain: 'Puxar', coats: 'Afastar', bed: 'Olhar', table: 'Olhar', sofa: 'Olhar', counter: 'Olhar' };

function renderBoard() {
  const playing = S.phase === 'hiding' || S.phase === 'seeking' || S.phase === 'end';
  const rows = [...S.players].sort((a, b) => b.score - a.score).map((p) => {
    const ic = !playing ? '' : p.role === 'seeker' ? '🔍' : p.role === 'wait' ? '⏳' : p.found ? '✖' : '🙈';
    const cls = (p.id === S.me ? 'me ' : '') + (p.found ? 'out ' : '') + (p.connected ? '' : 'off');
    return `<div class="${cls}"><i style="background:${esc(p.color)}"></i><span>${esc(p.name)}</span><em>${ic}</em><b>${fmt(p.score)}</b></div>`;
  });
  $('board').innerHTML = rows.join('');
}
function renderHUD() {
  renderBoard();
  const tEl = $('timer');
  if (S.phase === 'hiding' || S.phase === 'seeking') {
    tEl.textContent = fmtTime(S.timeLeft);
    tEl.classList.toggle('warn', S.phase === 'seeking' && S.timeLeft <= 20);
  } else tEl.textContent = S.phase === 'end' ? '…' : S.phase === 'lobby' ? 'treino' : '--';
  const cnt = $('count');
  cnt.textContent = S.phase === 'seeking' || S.phase === 'hiding' ? `🙈 ${S.hidersLeft}/${S.hidersTotal}` : '';
  const rb = $('roleBadge');
  let txt = '', cls = S.role || '';
  if (isPractice()) { txt = 'Treino livre — teste os esconderijos'; cls = 'practice'; }
  else if (S.role === 'wait') { txt = 'Assistindo — você entra na próxima rodada'; cls = 'practice'; }
  else if (S.role === 'hider') txt = S.found ? 'Te acharam — assistindo 👀' : S.phase === 'hiding' ? 'Esconda-se! (' + S.timeLeft + 's)' : hiddenId() ? 'Escondido — fica quietinho' : 'Esconda-se!';
  else if (S.role === 'seeker') txt = S.phase === 'hiding' ? 'Você procura' : `Ache todo mundo! Faltam ${S.hidersLeft}`;
  rb.className = cls; rb.textContent = S.phase === 'end' ? '' : txt;
  $('blind').classList.toggle('show', S.role === 'seeker' && S.phase === 'hiding');
  $('blindCount').textContent = S.timeLeft;
  // sala antes de começar
  const lobby = S.inRoom && S.phase === 'lobby';
  $('waitBar').classList.toggle('hidden', !lobby);
  $('waitCode').textContent = S.code || '----';
  $('waitN').textContent = `${S.players.length}/7`;
  $('btnStart').classList.toggle('hidden', !(S.host && S.players.length >= 2));
  $('waitMsg').textContent = S.players.length < 2 ? 'Chame os amigos! Enquanto isso, teste os esconderijos.' : S.host ? 'Quando todos chegarem, aperte Começar.' : 'Esperando o anfitrião começar…';
  $('btnTaunt').classList.toggle('hidden', !(S.mySpot && !S.found && S.phase === 'seeking' && !act));
}
function renderHideView() {
  const hv = $('hideView');
  const id = hiddenId();
  const want = id && !act ? 'show ' + HIDE_CLASS[SPOT[id].kind] : '';
  if (hv.className !== want) hv.className = want;
}

let actionMode = null, actionSpot = null, actionTarget = null, lastLabel = '';
function updateAction() {
  let label = '', mode = null, spot = null, target = null;
  const playing = S.phase === 'hiding' || S.phase === 'seeking';
  const practice = isPractice();
  if (act || S.found) { /* nada */ }
  else if (hiddenId() && (playing || practice)) { label = 'Sair'; mode = 'unhide'; }
  else if ((playing && S.role === 'hider') || practice) { spot = nearestSpot(); if (spot) { label = 'Esconder'; mode = 'hide'; } }
  else if (S.phase === 'seeking' && S.role === 'seeker') {
    for (const o of others.values()) {
      if (o.role !== 'hider' || o.found || o.hidden || !o.av.root.visible) continue;
      if (Math.hypot(o.x - me.x, o.z - me.z) < 1.6 && Math.abs(o.y - me.y) < 1) { target = o; break; }
    }
    if (target) { label = 'Pegar!'; mode = 'catch'; }
    else { spot = nearestSpot(); if (spot) { label = SEEK_LABEL[spot.kind]; mode = 'check'; } }
  }
  actionMode = mode; actionSpot = spot; actionTarget = target;
  const btn = $('btnAction');
  const key = label + (S.role === 'seeker' ? 's' : 'h');
  if (key !== lastLabel) {
    lastLabel = key; btn.textContent = label; btn.classList.toggle('hidden', !label);
    btn.classList.toggle('seek', S.role === 'seeker' && mode !== 'unhide');
    btn.classList.toggle('pulse', mode === 'hide' || mode === 'check' || mode === 'catch');
  }
  const sn = $('spotName');
  const id = hiddenId();
  const nm = id && !act ? SPOT[id].name : spot ? spot.name : '';
  if (sn.textContent !== nm) sn.textContent = nm;
  const tb = $('btnTaunt');
  const left = Math.ceil((S.tauntReadyAt - performance.now()) / 1000);
  const dis = left > 0;
  if (tb.disabled !== dis) tb.disabled = dis;
  const tl = dis ? left + 's' : 'Provocar';
  if (tb.firstChild.textContent !== tl) tb.firstChild.textContent = tl;
}
function nearestSpot() {
  let best = null, bs = 1e9;
  const fx = Math.sin(me.ry), fz = Math.cos(me.ry);
  for (const s of SPOTS) {
    const r = SPOTS.reach(s, me.x, me.z, me.y);
    if (r > SPOTS.REACH) continue;
    const dx = s.x - me.x, dz = s.z - me.z, d = Math.hypot(dx, dz) || 1;
    const score = r - ((dx * fx + dz * fz) / d) * 0.35;
    if (score < bs) { bs = score; best = s; }
  }
  return best;
}
function sendPosNow() { socket.emit('pos', { x: me.x, y: me.y, z: me.z, ry: me.ry, m: 0 }); }
function startEnter(s, local) {
  const d = Math.hypot(s.ex - me.x, s.ez - me.z);
  act = { type: 'enter', s, t: 0, ap: clamp(d / 3.2, 0.12, 0.6), from: { x: me.x, z: me.z }, local, sounded: false };
  hideYaw = 0; hidePitch = 0;
  if (local) practiceSpot = s.id;
  else { sendPosNow(); socket.emit('hide', { spotId: s.id }); }
}
function startExit() {
  const id = hiddenId(); if (!id) return;
  const s = SPOT[id];
  act = { type: 'exit', s, t: 0, ap: 0, local: !!practiceSpot, sounded: false };
  A.sSpot(s.kind, 0.18);
  if (practiceSpot) practiceSpot = null; else socket.emit('unhide');
}
function doAction() {
  A.ac();
  if (actionMode === 'hide' && actionSpot) startEnter(actionSpot, isPractice());
  else if (actionMode === 'unhide') startExit();
  else if (actionMode === 'check' && actionSpot) { sendPosNow(); socket.emit('check', { spotId: actionSpot.id }); me.ry = Math.atan2(actionSpot.x - me.x, actionSpot.z - me.z); }
  else if (actionMode === 'catch' && actionTarget) { sendPosNow(); socket.emit('catch', { id: actionTarget.id }); }
}
function onBtn(el, fn) { el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); }
onBtn($('btnAction'), doAction);
onBtn($('btnTaunt'), () => { A.ac(); socket.emit('taunt'); });
onBtn($('btnMute'), () => { A.ac(); A.setMuted(!A.isMuted()); $('btnMute').textContent = A.isMuted() ? '🔇' : '🔊'; });
$('btnMute').textContent = A.isMuted() ? '🔇' : '🔊';
onBtn($('btnLeave'), () => {
  if (!confirm('Sair da sala?')) return;
  socket.emit('leave'); try { sessionStorage.removeItem('room'); } catch (_) {}
  setTimeout(() => location.reload(), 150);
});
onBtn($('btnStart'), () => socket.emit('start'));
onBtn($('btnBoard'), () => $('board').classList.toggle('open'));

// ---------------- controles touch / mouse / teclado ----------------
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const look = { id: null, lx: 0, ly: 0 };
const touchEl = $('touch');
touchEl.addEventListener('pointerdown', (e) => {
  A.ac();
  if (e.clientX < innerWidth * 0.45 && joy.id === null && e.pointerType !== 'mouse') {
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
    if (hiddenId() && !act) { hideYaw = clamp(hideYaw - dx * 0.006, -1.0, 1.0); hidePitch = clamp(hidePitch - dy * 0.005, -0.45, 0.45); }
    else { camYaw -= dx * 0.0065; camPitch = clamp(camPitch + dy * 0.005, -0.2, 1.05); }
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
  if (e.code === 'KeyE' || e.code === 'Space') { e.preventDefault(); doAction(); }
  if (e.code === 'KeyQ') socket.emit('taunt');
  if (e.code === 'Tab') { e.preventDefault(); $('board').classList.toggle('open'); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------------- menu ----------------
const nameIn = $('nameIn');
nameIn.value = profile.name;
function buildSwatches() {
  const box = $('swatches'); box.innerHTML = '';
  for (const c of SHIRTS) {
    const b = document.createElement('button'); b.className = 'sw' + (c === profile.color ? ' on' : ''); b.style.background = c; b.setAttribute('aria-label', 'cor ' + c);
    b.onclick = () => { profile.color = c; store.set('color', c); meAv.setShirt(c); buildSwatches(); socket.emit('profile', { color: c }); };
    box.appendChild(b);
  }
}
buildSwatches();
nameIn.addEventListener('input', () => { profile.name = nameIn.value.trim().slice(0, 14); store.set('name', profile.name); });
const prof = () => ({ name: profile.name || 'Jogador', color: profile.color });
function enterGameUI() {
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  try { if (document.documentElement.requestFullscreen && isTouch) document.documentElement.requestFullscreen().catch(() => {}); } catch (_) {}
}
function joined(r) {
  S.inRoom = true; S.code = r.code;
  try { sessionStorage.setItem('room', r.code); } catch (_) {}
  enterGameUI(); renderHUD();
}
$('btnCreate').onclick = () => {
  A.ac();
  socket.emit('create', { pid, ...prof() }, (r) => {
    if (!r.ok) return ($('menuMsg').textContent = r.error);
    joined(r); toast('Sala ' + r.code + ' criada!', 2500);
  });
};
$('btnJoin').onclick = () => {
  A.ac();
  const code = $('codeIn').value.trim();
  if (!/^\d{4}$/.test(code)) return ($('menuMsg').textContent = 'Digite os 4 números');
  socket.emit('join', { pid, code, ...prof() }, (r) => {
    if (!r.ok) return ($('menuMsg').textContent = r.error);
    joined(r);
  });
};
$('codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
const qsCode = new URLSearchParams(location.search).get('sala');
if (qsCode) $('codeIn').value = qsCode;
$('btnShare').onclick = async () => {
  const url = location.origin + '/?sala=' + S.code;
  const text = 'Bora jogar esconde-esconde no prédio! Código da sala: ' + S.code;
  try { if (navigator.share) await navigator.share({ title: 'Esconde no Prédio', text, url }); else { await navigator.clipboard.writeText(text + ' ' + url); toast('Link copiado!'); } } catch (_) {}
};

// ---------------- eventos do servidor ----------------
socket.on('connect', () => {
  let code = S.code;
  try { code = code || sessionStorage.getItem('room'); } catch (_) {}
  if (!code) return;
  socket.emit('rejoin', { pid, code, ...prof() }, (r) => {
    if (r.ok) {
      S.inRoom = true; S.code = r.code; enterGameUI();
      if (r.pos) Object.assign(me, { x: r.pos.x, y: r.pos.y, z: r.pos.z });
    } else if (S.inRoom) { S.inRoom = false; try { sessionStorage.removeItem('room'); } catch (_) {} location.reload(); }
    else { try { sessionStorage.removeItem('room'); } catch (_) {} }
  });
});
function resetRound() {
  checkAnims.length = 0;
  for (const id in world.spotFx) world.spotFx[id].set(0);
  act = null; myReveal = null; myFoundShow = null; searchMe = null; practiceSpot = null;
  for (const o of others.values()) { o.act = null; o.search = null; o.foundShow = null; o.reveal = null; o.hidden = false; o.has = false; }
}
socket.on('state', (s) => {
  const wasPhase = S.phase;
  Object.assign(S, s);
  S.tauntReadyAt = performance.now() + (s.tauntReadyIn || 0);
  if (s.phase === 'lobby' && wasPhase !== 'lobby') { resetRound(); $('endPanel').classList.add('hidden'); }
  syncOthers();
  renderHUD();
});
socket.on('hideFail', ({ text }) => { if (act && act.type === 'enter') act = null; toast(text || 'Chegue mais perto'); });
socket.on('tick', ({ t }) => {
  S.timeLeft = t; renderHUD();
  if ((S.phase === 'seeking' && t <= 10) || (S.phase === 'hiding' && t <= 5)) A.sTick();
});
socket.on('phase', ({ phase }) => {
  if (phase !== 'seeking') return;
  if (S.role === 'seeker') { toast('Valendo! Ache todo mundo em 4 minutos!', 2500); A.sGo(); }
  else if (S.role === 'hider') toast(S.mySpot ? nameOf(S.seekerId) + ' começou a procurar… shhh' : nameOf(S.seekerId) + ' está procurando! Esconda-se!', 2400);
});
socket.on('roundStart', ({ role, spawn, round, seekerId }) => {
  $('endPanel').classList.add('hidden');
  Object.assign(me, { x: spawn.x, y: spawn.y, z: spawn.z, ry: spawn.ry });
  camYaw = spawn.ry; camPitch = 0.32;
  S.mySpot = null; S.found = false; S.seekerId = seekerId;
  resetRound();
  toast(`Rodada ${round}: ${role === 'seeker' ? 'você PROCURA!' : 'você ESCONDE! Quem procura: ' + nameOf(seekerId)}`, 2800);
});
socket.on('p', (d) => {
  const o = others.get(d.id); if (!o) return;
  if (d.hidden) {
    const s = d.spot && SPOT[d.spot];
    if (s && o.av.root.visible) o.act = { type: 'enter', s, t: 0, ap: clamp(Math.hypot(s.ex - o.x, s.ez - o.z) / 3.2, 0.12, 0.6), from: { x: o.x, z: o.z }, sounded: false };
    o.hidden = true; return;
  }
  if (d.unhid && SPOT[d.unhid]) {
    o.act = { type: 'exit', s: SPOT[d.unhid], t: 0, ap: 0, sounded: false };
    const sp = spatial(d.x, d.y, d.z); A.sSpot(SPOT[d.unhid].kind, 0.3 * Math.max(sp.vol, 0.2), sp.pan);
    o.x = o.tx = d.x; o.y = o.ty = d.y; o.z = o.tz = d.z; o.ry = o.tr = d.ry;
  }
  if (!o.has) { o.x = d.x; o.y = d.y; o.z = d.z; o.ry = d.ry; }
  o.has = true; o.hidden = false; o.tx = d.x; o.ty = d.y; o.tz = d.z; o.tr = d.ry; o.m = !!d.m; o.lastT = performance.now();
});
socket.on('placed', (p) => { Object.assign(me, { x: p.x, y: p.y, z: p.z, ry: p.ry }); });
socket.on('checked', ({ spotId, found, by }) => {
  const s = SPOT[spotId];
  checkAnims.push({ id: spotId, t: 0, dur: found ? 0.8 : 1.6, hold: found });
  const sp = spatial(s.x, s.y, s.z);
  A.sSpot(s.kind, 0.3 * Math.max(sp.vol, 0.3), sp.pan);
  const anim = { kind: s.kind, s, t: 0 };
  if (by === S.me) searchMe = anim; else { const o = others.get(by); if (o) o.search = anim; }
  if (!found && S.role === 'seeker') toast('Vazio…', 900);
  if (!found && S.role === 'hider' && spotId !== S.mySpot && !S.found) toast(nameOf(by) + ' abriu: ' + s.name, 1500);
});
socket.on('found', ({ id, name, reason, spotId, pos }) => {
  A.sPop();
  const show = { spot: spotId ? SPOT[spotId] : null, pos, t: 3.2 };
  if (spotId) checkAnims.push({ id: spotId, t: 0, dur: 0.8, hold: true, ttl: 3.2 });
  if (id === S.me) {
    act = null; myFoundShow = show;
    toast(reason === 'caught' ? 'Te pegaram no flagra! Agora é só assistir 👀' : 'Te acharam! Agora é só assistir 👀', 2600);
  } else {
    const o = others.get(id); if (o) { o.act = null; o.foundShow = show; }
    toast((S.role === 'seeker' ? 'Achou ' : '') + name + (S.role === 'seeker' ? '!' : ' foi encontrado(a)!') + (S.hidersLeft > 1 ? '' : ''), 1800);
  }
});
socket.on('taunt', ({ x, y, z, id }) => {
  const sp = spatial(x, y, z);
  if (id === S.me) { A.sTaunt(0.25, 0); toast('+½ ponto de provocação!', 1400); return; }
  A.sTaunt(clamp(sp.vol * 0.5 + 0.08, 0.08, 0.5), sp.pan);
  if (S.role === 'seeker') toast('Ouviu isso? 👀', 1500);
});
let hint = { d: 99, t: 0, x: 0, y: 0, z: 0 }, hintNext = 0;
socket.on('hint', (h) => { hint = { ...h, t: performance.now() }; });
socket.on('toast', ({ text }) => toast(text));
socket.on('left', ({ name }) => toast(name + ' saiu da sala', 1800));
socket.on('roundEnd', ({ winner, reason, youWon, seekerId, reveal, players }) => {
  act = null;
  for (const r of reveal) {
    const show = { spot: r.spot ? SPOT[r.spot] : null, pos: r.pos };
    if (r.id === S.me) myReveal = show; else { const o = others.get(r.id); if (o) { o.reveal = show; o.act = null; } }
  }
  (youWon ? A.sWin : A.sLose)();
  const survivors = reveal.filter((r) => !r.found).map((r) => nameOf(r.id));
  let title, text;
  if (reason === 'left') { title = 'Rodada encerrada'; text = 'Quem procurava saiu da sala.'; }
  else if (winner === 'seeker') {
    title = S.role === 'seeker' ? 'Você achou todo mundo! 🎉' : nameOf(seekerId) + ' achou todo mundo!';
    text = S.role === 'seeker' ? '+1 ponto pra você' : 'Ninguém escapou desta vez.';
  } else {
    title = S.role === 'seeker' ? 'O tempo acabou! 😅' : youWon ? 'Ninguém te achou! 🎉' : 'Acharam você…';
    text = 'Escaparam (+1): ' + (survivors.join(', ') || '—');
  }
  $('endTitle').textContent = title;
  $('endText').textContent = text;
  $('endScore').innerHTML = [...players].sort((a, b) => b.score - a.score)
    .map((p) => `<div class="${p.id === S.me ? 'me' : ''}"><i style="background:${esc(p.color)}"></i><span>${esc(p.name)}</span><b>${fmt(p.score)}</b></div>`).join('');
  setTimeout(() => $('endPanel').classList.remove('hidden'), 1500);
  renderHUD();
});

// ---------------- animação de um personagem ----------------
function fromAct(a, o) {
  const s = a.s, kind = s.kind, dur = ENTER_DUR[kind] * (a.type === 'exit' ? 0.7 : 1);
  if (a.type === 'enter' && a.t < a.ap) {
    const k = a.t / a.ap;
    o.x = lerp(a.from.x, s.ex, k); o.z = lerp(a.from.z, s.ez, k); o.y = s.y;
    const dd = Math.hypot(s.ex - a.from.x, s.ez - a.from.z);
    o.ry = dd > 0.25 ? Math.atan2(s.ex - a.from.x, s.ez - a.from.z) : s.r + P;
    o.pitch = 0; o.pose = { walk: 1 }; o.open = 0; o.tt = 0;
    return false;
  }
  const tt = a.type === 'enter' ? clamp((a.t - a.ap) / dur, 0, 1) : 1 - clamp(a.t / dur, 0, 1);
  const hp = hidePose(kind, tt, a.type === 'exit');
  const [x, z] = toWorld(s, hp.lx, hp.lz);
  o.x = x; o.z = z; o.y = s.y + hp.ly; o.ry = s.r + hp.yaw; o.pitch = hp.pitch; o.pose = hp; o.open = hideOpen(kind, tt); o.tt = tt;
  return a.type === 'enter' ? a.t >= a.ap + dur : a.t >= dur;
}
// pose de "revelado": dentro do esconderijo ou em pé onde foi pego
function posedShow(show, o) {
  if (show.spot) {
    const s = show.spot, hp = hidePose(s.kind, 1);
    const [x, z] = toWorld(s, hp.lx, hp.lz);
    Object.assign(o, { x, z, y: s.y + hp.ly, ry: s.r + hp.yaw, pitch: hp.pitch });
    o.pose = { ...hp, armsUp: ['wardrobe', 'pantry', 'closet', 'curtain', 'coats'].includes(s.kind) ? 0.35 : 0 };
  } else if (show.pos) {
    Object.assign(o, { x: show.pos.x, y: show.pos.y, z: show.pos.z, ry: show.pos.ry || 0, pitch: 0, pose: { armsUp: 0.8 } });
  }
}
function placeAvatar(av, sh, o) {
  av.root.position.set(o.x, o.y, o.z);
  av.root.rotation.y = o.ry; av.root.rotation.x = o.pitch || 0;
  poseAvatar(av, o.pose);
  const gy = groundY(o.x, o.z, o.y + 0.3);
  sh.position.set(o.x, gy + 0.015, o.z);
  sh.material.opacity = clamp(1 - (o.y - gy) * 1.5, 0.3, 1);
  sh.visible = av.root.visible;
}

// ---------------- loop ----------------
const camTarget = new THREE.Vector3();
const camWant = new THREE.Vector3();
const camDir = new THREE.Vector3();
const V = { x: 0, y: 0, z: 0, ry: 0, pitch: 0, pose: {}, open: 0 };
let lastSend = 0, stepAcc = 0, lastSent = '';
let prev = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0;
let openPrev = new Set();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
  const tSec = now / 1000;

  // --- resolução adaptativa (mantém 30+ fps no celular) ---
  fpsAcc += dt; fpsN++;
  if (now - fpsT > 2500) {
    const fps = fpsN / fpsAcc; fpsT = now; fpsAcc = 0; fpsN = 0;
    if (fps < 40 && pr > 0.7) { pr = Math.max(0.7, pr - 0.15); renderer.setPixelRatio(pr); }
    else if (fps > 57 && pr < prMax) { pr = Math.min(prMax, pr + 0.1); renderer.setPixelRatio(pr); }
  }

  // --- mover jogador ---
  const hid = hiddenId();
  const canMove = S.inRoom && !hid && !act && !S.found && S.role !== 'wait' && !(S.role === 'seeker' && S.phase === 'hiding') && S.phase !== 'end';
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
    let dr = Math.atan2(mx, mz) - me.ry; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); me.ry += dr * Math.min(1, dt * 12);
    me.moving = true; searchMe = null;
    stepAcc += dt * mag; if (stepAcc > 0.34) { stepAcc = 0; A.sStep(0.04); }
  }
  me.y = groundY(me.x, me.z, me.y);

  // --- meu personagem ---
  meAv.root.visible = true;
  if (myFoundShow) { myFoundShow.t -= dt; if (myFoundShow.t <= 0) myFoundShow = null; }
  if (act) {
    act.t += dt;
    const done = fromAct(act, V);
    if (!act.sounded && (act.type === 'exit' || act.t >= act.ap)) { act.sounded = true; if (act.type === 'enter') A.sSpot(act.s.kind, 0.22); }
    if (done) {
      if (act.type === 'exit') { me.x = act.s.ex; me.z = act.s.ez; me.y = act.s.y; me.ry = act.s.r; camYaw = act.s.r; }
      else if (act.s.kind === 'bed' || act.s.kind === 'table') A.sThump(0.12);
      act = null;
    }
    meAv.phase += dt * 9 * (V.pose.walk || 0);
  } else if (S.phase === 'end' && myReveal) posedShow(myReveal, V);
  else if (myFoundShow) posedShow(myFoundShow, V);
  else if (hid || S.found || S.role === 'wait') meAv.root.visible = false;
  else {
    V.x = me.x; V.y = me.y; V.z = me.z; V.ry = me.ry; V.pitch = 0;
    meAv.phase += dt * (me.moving ? 10 * mag : 0);
    let pose = { walk: me.moving ? Math.min(1, mag * 1.2) : 0 };
    if (searchMe) { searchMe.t += dt / 1.1; pose = { ...pose, ...searchPose(searchMe.kind, searchMe.t) }; if (searchMe.t >= 1) searchMe = null; }
    V.pose = pose;
  }
  if (meAv.root.visible) placeAvatar(meAv, meShadow, V); else meShadow.visible = false;

  // --- enviar posição ---
  if (canMove && now - lastSend > 80) {
    const key = me.x.toFixed(2) + me.z.toFixed(2) + me.ry.toFixed(2);
    if (key !== lastSent || now - lastSend > 1000) {
      lastSend = now; lastSent = key;
      socket.volatile.emit('pos', { x: me.x, y: me.y, z: me.z, ry: me.ry, m: me.moving ? 1 : 0 });
    }
  }

  // --- outros jogadores ---
  const k = 1 - Math.exp(-dt * 12);
  const blind = S.role === 'seeker' && S.phase === 'hiding';
  const open = new Map();
  const put = (id, o) => { if (!open.has(id) || o > open.get(id)) open.set(id, o); };
  for (const o of others.values()) {
    o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k;
    let d = o.tr - o.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); o.ry += d * k;
    const moving = o.m && now - o.lastT < 400;
    const O = o.vis, av = o.av;
    if (o.foundShow) { o.foundShow.t -= dt; if (o.foundShow.t <= 0) o.foundShow = null; }
    if (o.act) {
      o.act.t += dt;
      const done = fromAct(o.act, O);
      if (!o.act.sounded && o.act.t >= o.act.ap) { o.act.sounded = true; const sp = spatial(O.x, O.y, O.z); if (o.act.type === 'enter') A.sSpot(o.act.s.kind, 0.3 * Math.max(sp.vol, 0.2), sp.pan); }
      av.phase += dt * 9 * (O.pose.walk || 0);
      av.root.visible = !blind;
      put(o.act.s.id, O.open || 0);
      if (done) o.act = null;
    } else if (S.phase === 'end' && o.reveal) { posedShow(o.reveal, O); av.root.visible = true; }
    else if (o.foundShow) { posedShow(o.foundShow, O); av.root.visible = true; }
    else {
      av.root.visible = o.has && !o.hidden && o.connected !== false && !blind && !o.found && o.role !== 'wait' && S.inRoom;
      Object.assign(O, { x: o.x, y: o.y, z: o.z, ry: o.ry, pitch: 0 });
      av.phase += dt * (moving ? 10 : 0);
      let pose = { walk: moving ? 1 : 0 };
      if (o.search) { o.search.t += dt / 1.1; pose = { ...pose, ...searchPose(o.search.kind, o.search.t) }; if (o.search.t >= 1) o.search = null; }
      O.pose = pose;
      if (av.root.visible && moving) {
        o.stepAcc += dt; if (o.stepAcc > 0.36) { o.stepAcc = 0; const sp = spatial(o.x, o.y, o.z); A.sStep(sp.vol * 0.35, sp.pan); }
      }
    }
    if (av.root.visible) placeAvatar(av, o.shadow, O); else o.shadow.visible = false;
    if (o.tag) { o.tag.visible = av.root.visible && !(o.act && o.act.type === 'enter' && O.tt > 0.5); o.tag.position.set(O.x, O.y + 2.0, O.z); }
  }

  // --- dica: passinhos baixinhos perto de alguém escondido ---
  if (S.role === 'seeker' && S.phase === 'seeking' && now - hint.t < 1200 && hint.d < 5.5 && now > hintNext) {
    const sp = spatial(hint.x, hint.y, hint.z);
    A.sStep(0.05 + (1 - hint.d / 5.5) * 0.18, sp.pan);
    hintNext = now + 500 + hint.d * 160 + Math.random() * 300;
  }

  // --- móveis abrindo/fechando ---
  if (act) put(act.s.id, V.open || 0);
  for (let i = checkAnims.length - 1; i >= 0; i--) {
    const a = checkAnims[i]; a.t += dt;
    const p = a.hold ? Math.min(0.5, (a.t / a.dur) * 0.5) : a.t / a.dur;
    put(a.id, Math.sin(Math.min(1, p) * P));
    if ((!a.hold && p >= 1) || (a.ttl && a.t > a.ttl)) checkAnims.splice(i, 1);
  }
  if (S.phase === 'end') {
    const reveals = [myReveal, ...[...others.values()].map((o) => o.reveal)];
    for (const r of reveals) if (r && r.spot) put(r.spot.id, r.spot.kind === 'sofa' || r.spot.kind === 'counter' ? 0 : r.spot.kind === 'bed' ? 1 : 0.9);
  }
  for (const id of openPrev) if (!open.has(id)) world.spotFx[id].set(0);
  for (const [id, o] of open) world.spotFx[id].set(o);
  openPrev = new Set(open.keys());

  // --- destaque do esconderijo ao alcance ---
  world.setHighlight((actionMode === 'hide' || actionMode === 'check') && actionSpot ? actionSpot.id : null, tSec, actionMode === 'check' ? 'seek' : 'hide');

  // --- câmera ---
  let follow = V;
  if (spectating()) { const sk = others.get(S.seekerId); if (sk) follow = sk.vis; }
  if (!S.inRoom) {
    const a = tSec * 0.06;
    camera.position.set(12 + Math.sin(a) * 5.5, 2.0 + Math.sin(a * 0.7) * 0.3, 7.5 + Math.cos(a) * 4.5);
    camera.lookAt(12, 1.0, 6.5);
  } else if (hid && !act) {
    const s = SPOT[hid], c = HIDE_CAM[s.kind];
    const [cx, cz] = toWorld(s, c[0], c[2]);
    camera.position.set(cx, s.y + c[1], cz);
    const yaw = s.r + hideYaw;
    camWant.set(cx + Math.sin(yaw), s.y + c[1] + Math.sin(hidePitch), cz + Math.cos(yaw));
    camera.lookAt(camWant);
  } else {
    const low = follow === V && act ? Math.max(V.pose.crouch || 0, (V.pitch || 0) / (P / 2), V.pose.sit || 0) : 0;
    camTarget.set(follow.x, follow.y + 1.45 - low * 0.7, follow.z);
    const dist = act || follow !== V ? 3.5 : 3.1;
    camDir.set(-Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), -Math.cos(camYaw) * Math.cos(camPitch));
    raycaster.set(camTarget, camDir); raycaster.far = dist;
    const hit = raycaster.intersectObjects(world.blockers, false)[0];
    const d = hit ? Math.max(0.35, hit.distance - 0.2) : dist;
    camWant.copy(camTarget).addScaledVector(camDir, d);
    camera.position.lerp(camWant, hit ? 1 : 1 - Math.exp(-dt * 14));
    camera.lookAt(camTarget);
    if (meAv.root.visible && follow === V && d < 0.6) meAv.root.visible = false;
  }

  // --- luz dos personagens conforme o cômodo ---
  world.sampleLight(follow.x || me.x, follow.y || 0, follow.z || me.z, tmpC);
  ambL.color.copy(tmpC).multiplyScalar(0.85); ambL.intensity = P;
  keyL.color.copy(tmpC); keyL.intensity = P * 0.9;
  keyL.position.set(camera.position.x + 1, camera.position.y + 3, camera.position.z + 1);
  keyL.target.position.set(follow.x || me.x, (follow.y || 0) + 1, follow.z || me.z);

  // --- som ambiente ---
  const zone = world.zoneAt(camera.position.x, camera.position.y, camera.position.z);
  A.updateAmbient(zone, Math.hypot(camera.position.x - 19.5, camera.position.z - 12.4) + Math.abs(camera.position.y - 1.5), S.phase === 'seeking');

  updateAction();
  renderHideView();
  world.update(dt, tSec, camera.position);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
window.__g = { me, S, SPOT, action: doAction, world, others, get yaw() { return camYaw; }, set yaw(v) { camYaw = v; }, get pitch() { return camPitch; }, set pitch(v) { camPitch = v; }, get act() { return act; }, get practice() { return practiceSpot; }, renderer, camera, scene };
renderHUD();
