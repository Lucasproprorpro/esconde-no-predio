import * as THREE from '/vendor/three/three.module.js';

const P = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const seg = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1));

export const SHIRTS = ['#e8862a', '#2a9db0', '#d64f6b', '#5b9b4a', '#8a5cc7', '#e0b23a', '#3f6fd1', '#e86fae'];
const HAIRS = ['#3a2214', '#151010', '#7a4a22', '#b8763a', '#2a1a12', '#5a2a1a', '#d9b26a', '#1d1d2a'];
const SKINS = ['#f1c7a3', '#e0ac86', '#c98e62', '#a8714a', '#7d5236', '#f3d2b8'];

function hashStr(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

const geoCache = {};
const G = (k, f) => geoCache[k] || (geoCache[k] = f());

export function makeAvatar(scene, { shirt = SHIRTS[0], seed = 'x' } = {}) {
  const h = hashStr(seed);
  const L = (c) => new THREE.MeshLambertMaterial({ color: c });
  const mats = { shirt: L(shirt), pants: L(['#2d3550', '#3a3a3a', '#4a3a2a', '#2f4a5a'][h % 4]), skin: L(SKINS[h % SKINS.length]), hair: L(HAIRS[(h >> 3) % HAIRS.length]), shoe: L('#2a1a12'), dark: L('#1a1210'), white: new THREE.MeshBasicMaterial({ color: '#ffffff' }) };
  const blush = new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: 0.45, depthWrite: false });
  const add = (geo, mat, parent, x = 0, y = 0, z = 0, s) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (s) m.scale.set(...s); parent.add(m); return m; };
  const cap = (r, l) => G('c' + r + l, () => new THREE.CapsuleGeometry(r, l, 3, 8));
  const sph = (r, a = 12, b = 8) => G('s' + r + a, () => new THREE.SphereGeometry(r, a, b));

  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const body = new THREE.Group(); body.scale.setScalar(0.95); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.66; body.add(hips);
  add(G('pelvis', () => new THREE.CylinderGeometry(0.19, 0.17, 0.18, 10)), mats.pants, hips, 0, 0, 0);
  const legs = [];
  for (const sx of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(sx * 0.1, -0.02, 0); hips.add(thigh);
    add(cap(0.08, 0.17), mats.pants, thigh, 0, -0.15, 0);
    const knee = new THREE.Group(); knee.position.y = -0.31; thigh.add(knee);
    add(cap(0.072, 0.16), mats.pants, knee, 0, -0.13, 0);
    add(G('shoe', () => new THREE.BoxGeometry(0.14, 0.08, 0.24)), mats.shoe, knee, 0, -0.3, 0.04);
    legs.push({ thigh, knee, sx });
  }
  const torso = new THREE.Group(); torso.position.y = 0.04; hips.add(torso);
  add(cap(0.19, 0.2), mats.shirt, torso, 0, 0.26, 0, [1, 1, 0.82]);
  add(G('collar', () => new THREE.TorusGeometry(0.1, 0.03, 6, 12)), mats.shirt, torso, 0, 0.52, 0).rotation.x = P / 2;
  const head = new THREE.Group(); head.position.y = 0.56; torso.add(head);
  add(sph(0.245, 16, 12), mats.skin, head, 0, 0.22, 0);
  add(sph(0.05), mats.skin, head, -0.24, 0.2, 0); add(sph(0.05), mats.skin, head, 0.24, 0.2, 0);
  add(sph(0.026), mats.skin, head, 0, 0.17, 0.24);
  for (const sx of [-1, 1]) {
    add(sph(0.036, 10, 8), mats.dark, head, sx * 0.088, 0.225, 0.212, [1, 1.25, 0.6]);
    add(sph(0.012, 6, 4), mats.white, head, sx * 0.088 + 0.012, 0.24, 0.232);
    add(G('blush', () => new THREE.CircleGeometry(0.042, 10)), blush, head, sx * 0.145, 0.15, 0.196).rotation.y = sx * 0.6;
    add(G('brow', () => new THREE.BoxGeometry(0.07, 0.015, 0.02)), mats.hair, head, sx * 0.09, 0.3, 0.215).rotation.z = -sx * 0.12;
  }
  add(G('mouth', () => new THREE.TorusGeometry(0.032, 0.009, 4, 8, P)), mats.dark, head, 0, 0.125, 0.232).rotation.z = P;
  // cabelo (estilo pelo "seed")
  const style = (h >> 5) % 4;
  add(G('hairCap', () => new THREE.SphereGeometry(0.262, 16, 10, 0, P * 2, 0, P * 0.52)), mats.hair, head, 0, 0.235, -0.01);
  add(G('fringe', () => new THREE.BoxGeometry(0.36, 0.08, 0.1)), mats.hair, head, 0, 0.39, 0.17).rotation.x = 0.35;
  if (style === 1) add(sph(0.25), mats.hair, head, 0, 0.13, -0.06, [1.08, 0.95, 0.95]);
  if (style === 2) { add(sph(0.11), mats.hair, head, 0, 0.47, -0.12); }
  if (style === 3) for (let i = 0; i < 7; i++) { const a = (i / 7) * P * 2; add(G('curl', () => new THREE.IcosahedronGeometry(0.09, 0)), mats.hair, head, Math.cos(a) * 0.2, 0.36 + (i % 2) * 0.04, Math.sin(a) * 0.2 - 0.03); }
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.255, 0.44, 0); torso.add(sh);
    add(cap(0.066, 0.16), mats.shirt, sh, 0, -0.11, 0);
    const el = new THREE.Group(); el.position.y = -0.24; sh.add(el);
    add(cap(0.056, 0.12), mats.skin, el, 0, -0.08, 0);
    add(sph(0.068), mats.skin, el, 0, -0.2, 0.01);
    arms.push({ sh, el, sx });
  }
  scene.add(root);
  const av = { root, body, hips, torso, head, legs, arms, mats, phase: 0, walk: 0 };
  av.setShirt = (c) => mats.shirt.color.set(c);
  return av;
}

// p: { walk (0..1), crouch, sit, reach, armsUp, lean, look }
export function poseAvatar(av, p = {}) {
  const w = p.walk || 0, c = p.crouch || 0, s = p.sit || 0, ph = av.phase;
  const swing = Math.sin(ph) * 0.7 * w;
  for (const lg of av.legs) {
    const k = lg.sx;
    lg.thigh.rotation.x = swing * k - 1.85 * c - 1.45 * s;
    lg.knee.rotation.x = Math.max(0, Math.sin(ph * 1 + (k > 0 ? 0 : P)) * 0.7 * w) + 2.25 * c + 0.25 * s;
    lg.thigh.rotation.z = -k * 0.12 * c;
  }
  av.hips.position.y = 0.66 - 0.4 * c - 0.42 * s + Math.abs(Math.cos(ph)) * 0.03 * w;
  av.torso.rotation.x = 0.45 * c + (p.lean || 0) + 0.05 * w;
  const up = p.armsUp || 0, re = p.reach || 0;
  for (const a of av.arms) {
    a.sh.rotation.x = -swing * a.sx * 0.9 - 2.9 * up - 1.35 * re - 0.7 * c;
    a.sh.rotation.z = a.sx * (0.08 + 0.35 * up + 0.15 * c);
    a.el.rotation.x = -0.35 * w - 0.5 * re - 0.6 * c - 0.3 * s;
  }
  av.head.rotation.x = p.look || 0;
}

// =================== entrar/sair dos esconderijos ===================
// tempos (s) da animação de entrar
export const ENTER_DUR = { wardrobe: 1.5, pantry: 1.35, closet: 1.35, bed: 1.7, table: 1.6, tub: 1.7, sofa: 0.9, counter: 0.9, curtain: 1.35, chest: 1.6, box: 1.6, coats: 1.2 };
// câmera do escondido (coordenadas locais do esconderijo, olhando para +z)
export const HIDE_CAM = {
  wardrobe: [0, 1.45, 0.42], pantry: [0.1, 1.45, 0.5], closet: [0.1, 1.45, 0.5], bed: [0, 0.22, 1.16], table: [0, 0.27, 1.02],
  tub: [0, 1.05, 0.52], sofa: [0, 1.0, 0.02], counter: [0, 1.2, 0.35], curtain: [0, 1.5, 0.44], chest: [0, 0.78, 0.42], box: [0, 0.98, 0.58], coats: [0, 1.5, 0.48],
};
const EXIT = { wardrobe: 1.0, pantry: 0.95, closet: 0.95, bed: 1.55, table: 1.45, tub: 0.95, sofa: 0, counter: 0, curtain: 0.85, chest: 0.95, box: 0.95, coats: 0.9 };

// pose no espaço local do esconderijo para t (0 = parado na frente, 1 = escondido)
export function hidePose(kind, t, exiting = false) {
  const E = EXIT[kind];
  const o = { lx: 0, ly: 0, lz: E, yaw: P, pitch: 0, walk: 0, crouch: 0, sit: 0, lean: 0, reach: 0, look: 0 };
  const fy = exiting ? 0 : P; // de frente para o móvel ao entrar; de costas ao sair
  switch (kind) {
    case 'wardrobe': case 'pantry': case 'closet': case 'coats': case 'curtain': {
      const a = seg(t, 0, 0.42);
      o.lz = lerp(E, kind === 'curtain' ? 0 : 0.02, a);
      o.walk = t < 0.42 ? 1 : 0;
      o.yaw = t < 0.42 ? fy : lerp(fy, 0, seg(t, 0.42, 0.65));
      if (exiting) o.yaw = 0;
      o.reach = kind === 'coats' || kind === 'curtain' ? Math.sin(clamp(t / 0.42, 0, 1) * P) * 0.6 : seg(t, 0, 0.15) * (1 - seg(t, 0.3, 0.45)) * 0.8;
      break;
    }
    case 'bed': case 'table': {
      const z1 = kind === 'bed' ? 1.3 : 1.2, z2 = kind === 'bed' ? 0.95 : 0.88;
      o.lz = t < 0.25 ? lerp(E, z1, seg(t, 0, 0.25)) : lerp(z1, z2, seg(t, 0.45, 1));
      o.walk = t < 0.25 ? 1 : 0;
      o.crouch = seg(t, 0.25, 0.45) * (1 - seg(t, 0.5, 0.85));
      o.pitch = seg(t, 0.45, 0.9) * (P / 2);
      o.ly = seg(t, 0.5, 0.9) * 0.2;
      o.reach = seg(t, 0.45, 0.8);
      o.yaw = P;
      break;
    }
    case 'tub': {
      o.lz = t < 0.3 ? lerp(E, 0.5, seg(t, 0, 0.3)) : lerp(0.5, 0, seg(t, 0.3, 0.55));
      o.walk = t < 0.3 ? 1 : 0;
      o.ly = Math.sin(seg(t, 0.3, 0.55) * P) * 0.25 + seg(t, 0.3, 0.55) * 0.1;
      o.yaw = t < 0.3 ? fy : lerp(fy, P / 2, seg(t, 0.3, 0.55));
      o.sit = seg(t, 0.55, 0.9);
      if (exiting && t < 0.3) o.yaw = 0;
      break;
    }
    case 'sofa': case 'counter': {
      o.lz = 0; o.yaw = 0;
      o.crouch = seg(t, 0.15, 0.7);
      o.lean = seg(t, 0.15, 0.7) * 0.25;
      o.look = -seg(t, 0.5, 0.9) * 0.25;
      break;
    }
    case 'chest': case 'box': {
      const top = kind === 'chest' ? 0.55 : 0.98, floor = kind === 'chest' ? 0.12 : 0.04;
      o.lz = t < 0.25 ? lerp(E, 0.55, seg(t, 0, 0.25)) : lerp(0.55, 0, seg(t, 0.25, 0.5));
      o.walk = t < 0.25 ? 1 : 0;
      o.ly = seg(t, 0.25, 0.5) * floor + Math.sin(seg(t, 0.25, 0.5) * P) * top * 0.6;
      o.yaw = t < 0.25 ? fy : lerp(fy, 0, seg(t, 0.25, 0.5));
      if (exiting && t < 0.25) o.yaw = 0;
      o.crouch = seg(t, 0.5, 0.8);
      o.lean = seg(t, 0.55, 0.85) * 0.6;
      o.look = seg(t, 0.6, 0.9) * 0.4;
      break;
    }
  }
  return o;
}
// abertura do móvel durante a animação (0..1)
export function hideOpen(kind, t) {
  switch (kind) {
    case 'wardrobe': case 'pantry': case 'closet': return seg(t, 0, 0.2) * (1 - seg(t, 0.62, 0.95));
    case 'tub': return seg(t, 0, 0.22) * (1 - seg(t, 0.62, 0.95));
    case 'curtain': return seg(t, 0, 0.3) * (1 - seg(t, 0.55, 0.9)) * 0.9;
    case 'table': return seg(t, 0.25, 0.45) * (1 - seg(t, 0.8, 1)) * 0.75;
    case 'bed': return Math.sin(seg(t, 0.4, 1) * P) * 0.12;
    case 'chest': case 'box': return seg(t, 0, 0.2) * (1 - seg(t, 0.78, 1));
    case 'coats': return Math.sin(seg(t, 0.2, 0.8) * P) * 0.8;
    case 'sofa': case 'counter': return Math.sin(seg(t, 0.1, 0.7) * P) * 0.4;
  }
  return 0;
}
// pose de quem procura ao abrir/olhar
export function searchPose(kind, t) {
  const a = Math.sin(clamp(t, 0, 1) * P);
  if (kind === 'bed' || kind === 'table') return { crouch: a * 0.9, lean: a * 0.5, reach: a * 0.7, look: a * 0.3 };
  if (kind === 'sofa' || kind === 'counter' || kind === 'chest' || kind === 'box') return { lean: a * 0.55, reach: a * 0.8, look: a * 0.35 };
  return { reach: a, lean: a * 0.1 };
}

// etiqueta com nome
export function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px system-ui, sans-serif';
  const w = Math.min(240, g.measureText(text).width + 34);
  g.fillStyle = 'rgba(20,12,8,.72)';
  g.beginPath(); g.roundRect((256 - w) / 2, 8, w, 48, 22); g.fill();
  g.fillStyle = color || '#fff'; g.beginPath(); g.arc((256 - w) / 2 + 18, 32, 7, 0, 7); g.fill();
  g.fillStyle = '#fff4e0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128 + 8, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.0, 0.25, 1); s.renderOrder = 6;
  return s;
}
