import * as THREE from '/vendor/three/three.module.js';

export const FH = 3.2; // altura do andar
export const WH = 3.0; // altura da parede
const T = 0.2; // espessura
const P = Math.PI;

// ---------- texturas procedurais (leves) ----------
function canvasTex(draw, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX = {};
function texWood(a, b) {
  return canvasTex((g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? a : b; g.globalAlpha = 0.35; g.fillRect(0, i * s / 4, s, s / 4); g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * s / 4, s, 2);
      g.fillRect(((i * 53) % s), i * s / 4, 2, s / 4);
    }
  });
}
function texChecker(a, b, n = 2) {
  return canvasTex((g, s) => {
    const k = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * k, j * k, k, k); }
  });
}
function texTile(a, line) {
  return canvasTex((g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s); g.fillStyle = line;
    for (let i = 0; i < 4; i++) { g.fillRect(i * s / 4, 0, 2, s); g.fillRect(0, i * s / 4, s, 2); }
  });
}
function texBrick() {
  return canvasTex((g, s) => {
    g.fillStyle = '#d9c9b6'; g.fillRect(0, 0, s, s);
    const h = s / 8;
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
      g.fillStyle = ['#8e3b2c', '#9c4532', '#83352a', '#a14b36'][(r * 3 + c + 4) % 4];
      g.fillRect(c * s / 4 + (r % 2) * s / 8 + 2, r * h + 2, s / 4 - 4, h - 4);
    }
  });
}
function texStripes(a, b) {
  return canvasTex((g, s) => { g.fillStyle = a; g.fillRect(0, 0, s, s); g.fillStyle = b; for (let i = 0; i < 4; i++) g.fillRect(i * s / 4, 0, s / 10, s); });
}
function texSky() {
  return canvasTex((g, s) => {
    const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#0d1430'); gr.addColorStop(1, '#3a2a4a');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9; i++) {
      const w = 10 + (i * 37) % 18, h = 40 + (i * 53) % 60, x = (i * 29) % s;
      g.fillStyle = '#141018'; g.fillRect(x, s - h, w, h);
      g.fillStyle = '#ffcf6b';
      for (let k = 0; k < 6; k++) if ((i + k) % 3) g.fillRect(x + 2 + (k % 2) * 5, s - h + 5 + k * 6, 2, 3);
    }
  }, 128);
}
function texCloth(a, b) {
  return canvasTex((g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s); g.fillStyle = b; g.globalAlpha = 0.6;
    for (let i = 0; i < 8; i += 2) { g.fillRect(i * s / 8, 0, s / 8, s); g.fillRect(0, i * s / 8, s, s / 8); }
  });
}

const matCache = new Map();
function M(c, o = {}) {
  const k = (typeof c === 'string' ? c : c.uuid || c) + JSON.stringify(o);
  if (matCache.has(k)) return matCache.get(k);
  const m = typeof c === 'number' || typeof c === 'string'
    ? new THREE.MeshLambertMaterial({ color: c, ...o })
    : new THREE.MeshLambertMaterial({ map: c, ...o });
  matCache.set(k, m);
  return m;
}
const B = (c) => { const k = 'basic' + c; if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color: c })); return matCache.get(k); };

function scaleUV(g, sx, sy) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
}

export function buildWorld(scene, SPOTS) {
  const colliders = [];
  const blockers = [];
  const spotFx = {}; // spotId -> {kind, parts}

  TEX.woodCafe = texWood('#6b4026', '#4e2d1a');
  TEX.woodApt = texWood('#b07a4a', '#93613a');
  TEX.woodB = texWood('#9a6a46', '#7b5034');
  TEX.checker = texChecker('#e9e2d0', '#2b2b2b', 4);
  TEX.tileBath = texTile('#bfe0dc', '#8fb3ae');
  TEX.tileKitchen = texChecker('#e8d8b0', '#b5462e', 4);
  TEX.brick = texBrick();
  TEX.paperA = texStripes('#e7d9b0', '#d8c58f');
  TEX.paperB = texStripes('#efd3c8', '#e2b9aa');
  TEX.sky = texSky();
  TEX.clothRed = texCloth('#f4efe6', '#b8322a');
  TEX.clothGreen = texCloth('#f4efe6', '#3d7a4f');
  TEX.carpet = texStripes('#7a2632', '#6a1e2a');

  function box(w, h, d, x, y, z, m, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (o.uv) scaleUV(g, o.uv[0], o.uv[1]);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y + h / 2, z);
    if (o.ry) mesh.rotation.y = o.ry;
    (o.parent || scene).add(mesh);
    if (o.col !== undefined) addCol(x, z, w, d, o.ry || 0, o.col);
    if (o.block) blockers.push(mesh);
    return mesh;
  }
  function cyl(rt, rb, h, x, y, z, m, o = {}) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 10, 1, !!o.open), m);
    mesh.position.set(x, y + h / 2, z);
    (o.parent || scene).add(mesh);
    if (o.col !== undefined) addCol(x, z, rb * 2, rb * 2, 0, o.col);
    return mesh;
  }
  function addCol(x, z, w, d, ry, level) {
    let hw = w / 2, hd = d / 2;
    if (Math.abs(Math.sin(ry)) > 0.5) [hw, hd] = [hd, hw];
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, level });
  }
  function group(x, y, z, ry) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; scene.add(g); return g;
  }

  // paredes: segmentos com vãos de porta [a,b]
  function segs(a1, a2, gaps) {
    const out = []; let cur = a1, curIsGap = false;
    for (const [a, b] of (gaps || []).slice().sort((p, q) => p[0] - q[0])) {
      if (a > cur) out.push([curIsGap ? cur : cur - T / 2, a]);
      out.push(null, [a, b]);
      cur = b; curIsGap = true;
    }
    if (a2 > cur) out.push([curIsGap ? cur : cur - T / 2, a2 + T / 2]);
    return out;
  }
  function wallX(x, z1, z2, lvl, m, gaps, h = WH) {
    const y0 = lvl * FH; let lintel = false;
    for (const s of segs(z1, z2, gaps)) {
      if (s === null) { lintel = true; continue; }
      const [a, b] = s, L = b - a;
      if (lintel) { if (h >= WH) box(T, WH - 2.2, L, x, y0 + 2.2, (a + b) / 2, m, { block: true, uv: [L / 1.5, 0.5] }); lintel = false; continue; }
      box(T, h, L, x, y0, (a + b) / 2, m, { col: lvl, block: h >= WH, uv: [L / 1.5, h / 1.5] });
    }
  }
  function wallZ(z, x1, x2, lvl, m, gaps, h = WH) {
    const y0 = lvl * FH; let lintel = false;
    for (const s of segs(x1, x2, gaps)) {
      if (s === null) { lintel = true; continue; }
      const [a, b] = s, L = b - a;
      if (lintel) { if (h >= WH) box(L, WH - 2.2, T, (a + b) / 2, y0 + 2.2, z, m, { block: true, uv: [L / 1.5, 0.5] }); lintel = false; continue; }
      box(L, h, T, (a + b) / 2, y0, z, m, { col: lvl, block: h >= WH, uv: [L / 1.5, h / 1.5] });
    }
  }
  function floor(x1, z1, x2, z2, lvl, tex, ts = 1.5) {
    const w = x2 - x1, d = z2 - z1;
    const g = new THREE.PlaneGeometry(w, d); scaleUV(g, w / ts, d / ts);
    const m = new THREE.Mesh(g, M(tex)); m.rotation.x = -P / 2; m.position.set((x1 + x2) / 2, lvl * FH + 0.005, (z1 + z2) / 2);
    scene.add(m);
  }
  function windowPane(x, y, z, ry, w = 1.4, h = 1.5) {
    const g = group(x, y, z, ry);
    box(w + 0.16, h + 0.16, 0.06, 0, -0.08, 0, M('#f2eadb'), { parent: g });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: TEX.sky }));
    pane.position.set(0, h / 2 - 0.08, 0.035); g.add(pane);
    box(0.05, h, 0.04, 0, -0.08, 0.05, M('#f2eadb'), { parent: g });
    box(w, 0.05, 0.04, 0, h / 2 - 0.1, 0.05, M('#f2eadb'), { parent: g });
  }
  function lamp(x, y, z, shade = '#e8b04a') {
    cyl(0.01, 0.01, 0.6, x, y - 0.6, z, M('#222'));
    cyl(0.12, 0.32, 0.25, x, y - 0.85, z, M(shade, { side: THREE.DoubleSide }), { open: true });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), B('#fff1c4')); b.position.set(x, y - 0.85, z); scene.add(b);
  }
  function plant(x, y, z) {
    cyl(0.18, 0.14, 0.35, x, y, z, M('#b4532d'));
    const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), M('#3f7a3a', { flatShading: true }));
    l.position.set(x, y + 0.7, z); scene.add(l);
    addCol(x, z, 0.4, 0.4, 0, y > 1 ? 1 : 0);
  }
  function frame(x, y, z, ry, c) {
    const g = group(x, y, z, ry);
    box(0.7, 0.5, 0.04, 0, 0, 0, M('#3b2a1a'), { parent: g });
    box(0.58, 0.38, 0.02, 0, 0.06, 0.025, M(c), { parent: g });
  }
  function radiator(x, y, z, ry) {
    const g = group(x, y, z, ry);
    for (let i = 0; i < 7; i++) box(0.08, 0.6, 0.15, -0.3 + i * 0.1, 0.1, 0, M('#d9d4c8'), { parent: g });
  }
  function chair(x, y, z, ry, c = '#5a3a22') {
    const g = group(x, y, z, ry);
    box(0.42, 0.06, 0.42, 0, 0.42, 0, M(c), { parent: g });
    box(0.42, 0.5, 0.06, 0, 0.45, -0.19, M(c), { parent: g });
    for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(0.05, 0.42, 0.05, a, 0, b, M('#2a1a10'), { parent: g });
  }
  function bistro(x, z) {
    cyl(0.35, 0.35, 0.04, x, 0.72, z, M('#2b2b2b'));
    cyl(0.04, 0.04, 0.72, x, 0, z, M('#2b2b2b'));
    cyl(0.04, 0.04, 0.12, x, 0.76, z, M('#f4efe6'));
    addCol(x, z, 0.7, 0.7, 0, 0);
    chair(x - 0.7, 0, z, P / 2); chair(x + 0.7, 0, z, -P / 2);
  }
  function sofaMesh(parent, c, w = 2.2) {
    box(w, 0.42, 0.9, 0, 0, 0, M(c), { parent });
    box(w, 0.5, 0.25, 0, 0.42, -0.33, M(c), { parent });
    box(0.22, 0.25, 0.9, -w / 2 + 0.11, 0.42, 0, M(c), { parent });
    box(0.22, 0.25, 0.9, w / 2 - 0.11, 0.42, 0, M(c), { parent });
    for (let i = 0; i < 2; i++) box(w / 2 - 0.3, 0.12, 0.6, (i - 0.5) * (w / 2 - 0.2), 0.42, 0.08, M(c, { emissive: '#120804' }), { parent });
  }

  // ---------- móveis que são esconderijos ----------
  function buildSpot(s) {
    const g = group(s.x, s.y, s.z, s.r);
    const fx = { kind: s.kind, g, parts: {} };
    const lvl = s.level;
    const wood = s.id.startsWith('b_') ? '#7b5034' : '#6b4a2e';
    switch (s.kind) {
      case 'wardrobe': {
        box(1.4, 2.2, 0.62, 0, 0, -0.02, M(wood), { parent: g });
        box(1.5, 0.08, 0.7, 0, 2.2, -0.02, M('#4a3020'), { parent: g });
        const doors = [];
        for (const side of [-1, 1]) {
          const pivot = new THREE.Group(); pivot.position.set(side * 0.7, 0, 0.31); g.add(pivot);
          box(0.68, 2.08, 0.04, -side * 0.34, 0.06, 0.02, M('#8a6040'), { parent: pivot });
          for (let k = 0; k < 6; k++) box(0.56, 0.03, 0.02, -side * 0.34, 0.9 + k * 0.12, 0.05, M('#5c3c24'), { parent: pivot });
          box(0.04, 0.12, 0.04, -side * 0.06, 1.0, 0.06, M('#d8b45a'), { parent: pivot });
          pivot.userData.side = side; doors.push(pivot);
        }
        fx.parts.doors = doors;
        addCol(s.x, s.z, 1.4, 0.65, s.r, lvl);
        break;
      }
      case 'pantry':
      case 'closet': {
        const w = 1.0, d = s.kind === 'pantry' ? 0.8 : 0.78;
        const c = s.kind === 'pantry' ? '#e9dfc8' : '#7a5a3c';
        box(w, 2.1, d, 0, 0, 0, M(c), { parent: g });
        const pivot = new THREE.Group(); pivot.position.set(-w / 2, 0, d / 2); g.add(pivot);
        box(w - 0.06, 2.0, 0.04, w / 2, 0.05, 0.02, M(s.kind === 'pantry' ? '#d9ccb0' : '#94704c'), { parent: pivot });
        for (let k = 0; k < 5; k++) box(w - 0.25, 0.03, 0.02, w / 2, 1.2 + k * 0.12, 0.05, M('#00000033' === '' ? '#000' : '#6a5038'), { parent: pivot });
        box(0.04, 0.12, 0.05, w - 0.12, 1.0, 0.06, M('#d8b45a'), { parent: pivot });
        pivot.userData.side = 1; fx.parts.doors = [pivot];
        addCol(s.x, s.z, w, d, s.r, lvl);
        break;
      }
      case 'bed': {
        box(1.6, 0.35, 2.1, 0, 0.0, 0, M('#3a2416'), { parent: g });
        const top = new THREE.Group(); g.add(top);
        box(1.55, 0.2, 2.0, 0, 0.35, 0, M('#f1ead8'), { parent: top });
        box(1.62, 0.12, 1.4, 0, 0.55, 0.3, M(s.id.startsWith('b_') ? '#6d8fb3' : '#b5523b'), { parent: top });
        box(1.62, 0.3, 0.04, 0, 0.3, 1.02, M(s.id.startsWith('b_') ? '#6d8fb3' : '#b5523b'), { parent: top }); // saia
        box(0.6, 0.14, 0.35, -0.38, 0.55, -0.75, M('#ffffff'), { parent: top });
        box(0.6, 0.14, 0.35, 0.38, 0.55, -0.75, M('#ffffff'), { parent: top });
        box(1.7, 1.0, 0.08, 0, 0.0, -1.06, M('#3a2416'), { parent: g });
        fx.parts.top = top;
        addCol(s.x, s.z, 1.6, 2.1, s.r, lvl);
        break;
      }
      case 'table': {
        cyl(0.7, 0.7, 0.04, 0, 0.74, 0, M('#5a3a22'), { parent: g });
        const cloth = new THREE.Group(); g.add(cloth);
        const ct = s.id.startsWith('c_') ? TEX.clothRed : TEX.clothGreen;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.86, 0.74, 12, 1, true), M(ct, { side: THREE.DoubleSide }));
        c.position.y = 0.41; cloth.add(c);
        const ctop = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.02, 12), M(ct)); ctop.position.y = 0.79; cloth.add(ctop);
        fx.parts.cloth = cloth;
        cyl(0.06, 0.08, 0.22, 0.15, 0.8, -0.1, M('#7fb0c9'), { parent: g });
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), M('#e85d75', { flatShading: true })); fl.position.set(0.15, 1.08, -0.1); g.add(fl);
        addCol(s.x, s.z, 1.6, 1.6, 0, lvl);
        for (const a of [0.9, -2.2]) chair(Math.sin(a + s.r) * 1.15 + s.x, s.y, Math.cos(a + s.r) * 1.15 + s.z, a + s.r + P);
        break;
      }
      case 'sofa': {
        const sg = new THREE.Group(); sg.position.set(0, 0, 0.75); g.add(sg);
        sofaMesh(sg, s.id.startsWith('c_') ? '#2f5d50' : s.id.startsWith('b_') ? '#8a3f5c' : '#a8682f');
        fx.parts.top = sg;
        addCol(s.x + Math.sin(s.r) * 0.75, s.z + Math.cos(s.r) * 0.75, 2.2, 0.9, s.r, lvl);
        break;
      }
      case 'tub': {
        box(1.7, 0.55, 0.8, 0, 0, 0, M('#f4f4f0'), { parent: g });
        box(1.5, 0.05, 0.6, 0, 0.5, 0, M('#a9d3e0'), { parent: g });
        cyl(0.015, 0.015, 1.7, 0, 2.0, 0.42, M('#aaa'), { parent: g }).rotation.z = P / 2;
        const curtain = new THREE.Group(); curtain.position.set(-0.85, 0, 0.42); g.add(curtain);
        const cm = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.55, 8, 1), M(s.id.startsWith('b_') ? '#f0c8d0' : '#cfe6f5', { side: THREE.DoubleSide }));
        const pos = cm.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 9) * 0.04);
        cm.geometry.computeVertexNormals();
        cm.position.set(0.85, 1.2, 0); curtain.add(cm);
        fx.parts.curtain = curtain;
        addCol(s.x, s.z, 1.7, 0.8, s.r, lvl);
        break;
      }
      case 'counter':
        fx.parts.top = null;
        break;
    }
    spotFx[s.id] = fx;
  }

  // ================= ESTRUTURA =================
  const brick = M(TEX.brick);
  const cream = M('#efe3c8');
  const paperA = M(TEX.paperA);
  const paperB = M(TEX.paperB);
  const tileW = M(TEX.tileBath);
  const hallM = M('#c9b48a');

  // pisos térreo
  floor(0, 0, 20, 16, 0, TEX.woodCafe, 1.2);
  floor(20, 0, 28, 16, 0, TEX.checker, 1.0);
  // laje entre andares (teto do térreo + piso de cima), com vão da escada (x24..27, z2..12)
  const slab = M('#efe6d2');
  box(24, 0.2, 16, 12, FH - 0.2, 8, slab, { block: true });
  box(1, 0.2, 16, 27.5, FH - 0.2, 8, slab, { block: true });
  box(3, 0.2, 2, 25.5, FH - 0.2, 1, slab, { block: true });
  box(3, 0.2, 4, 25.5, FH - 0.2, 14, slab, { block: true });
  // teto de cima
  box(28, 0.2, 16, 14, FH + WH, 8, M('#f3ead6'), { block: true });

  // paredes externas (2 andares)
  for (const lvl of [0, 1]) {
    const m = lvl === 0 ? brick : cream;
    wallX(0, 0, 16, lvl, lvl ? cream : brick);
    wallX(28, 0, 16, lvl, m);
    wallZ(0, 0, 28, lvl, m);
    wallZ(16, 0, 28, lvl, m);
  }
  // térreo: café | hall
  wallX(20, 0, 16, 0, brick, [[6, 10]]);
  // escada: paredes laterais no térreo
  wallX(24, 2, 12, 0, M('#d8c7a4'));
  wallX(27, 2, 12, 0, M('#d8c7a4'));
  wallZ(12, 24, 28, 0, M('#d8c7a4'));
  // degraus
  for (let i = 0; i < 16; i++) box(2.9, 0.2 * (i + 1), 0.625, 25.5, 0, 2 + 0.3125 + i * 0.625, M(i % 2 ? '#7a4a2c' : '#6a3e24'));
  // andar de cima: guarda-corpo do vão
  wallX(24, 2, 12, 1, M('#5a3a22'), [], 1.0);
  wallX(27, 2, 12, 1, M('#5a3a22'), [], 1.0);
  wallZ(2, 24, 27, 1, M('#5a3a22'), [], 1.0);

  // andar de cima: corredor z 7..9
  wallZ(7, 0, 20, 1, hallM, [[15, 16.2]]);
  wallZ(9, 0, 20, 1, hallM, [[15, 16.2]]);
  wallX(20, 0, 16, 1, hallM, [[7, 9]]);
  floor(0, 7, 20, 9, 1, TEX.carpet, 1.0);
  floor(20, 0, 24, 16, 1, TEX.woodB, 1.2);
  floor(24, 12, 28, 16, 1, TEX.woodB, 1.2);
  floor(27, 0, 28, 12, 1, TEX.woodB, 1.2);
  floor(24, 0, 27, 2, 1, TEX.woodB, 1.2);

  // ---------- apartamentos ----------
  function apartment(mirror) {
    const Z = (z) => (mirror ? 16 - z : z);
    const G = (a, b) => (mirror ? [16 - b, 16 - a] : [a, b]);
    const R = (r) => (mirror ? P - r : r);
    const z1 = Z(9), z2 = Z(16), zl = Math.min(z1, z2), zh = Math.max(z1, z2);
    const paper = mirror ? paperB : paperA;
    // paredes internas
    wallX(3.5, zl, zh, 1, tileW, [G(14.2, 15.4)]);
    wallX(9, zl, zh, 1, paper, [G(13.5, 14.7)]);
    wallX(13, zl, zh, 1, paper, [G(9.6, 12)]);
    // pisos
    floor(0, zl, 3.5, zh, 1, TEX.tileBath, 0.8);
    floor(3.5, zl, 9, zh, 1, mirror ? TEX.woodB : TEX.woodApt, 1.2);
    floor(9, zl, 13, zh, 1, TEX.tileKitchen, 0.8);
    floor(13, zl, 20, zh, 1, mirror ? TEX.woodB : TEX.woodApt, 1.2);
    const y = FH;
    // sala
    const tv = group(16.5, y, Z(15.45), R(P));
    box(1.6, 0.5, 0.45, 0, 0, 0, M('#4a3020'), { parent: tv });
    box(0.9, 0.65, 0.5, 0, 0.5, 0, M('#2a2a2a'), { parent: tv });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), B(mirror ? '#7fb7d9' : '#9ad1b0')); scr.position.set(0, 0.83, 0.26); tv.add(scr);
    addCol(16.5, Z(15.45), 1.6, 0.5, 0, 1);
    box(1.0, 0.4, 0.6, 16.5, y, Z(13.6), M('#5a3a22'), { col: 1 });
    box(2.6, 0.01, 1.8, 16.5, y, Z(13.4), M(mirror ? '#5c6f8a' : '#8a5c3a'));
    plant(19.5, y, Z(15.4));
    box(0.4, 1.8, 1.2, 19.75, y, Z(11.5), M('#4a3020'), { col: 1 }); // estante
    for (let k = 0; k < 4; k++) box(0.3, 0.3, 1.0, 19.7, y + 0.15 + k * 0.42, Z(11.5), M(['#b5523b', '#3d6f8f', '#d8b45a', '#4f7a43'][k]));
    windowPane(16.5, y + 0.9, Z(15.88), R(P));
    radiator(18.5, y, Z(15.8), R(P));
    frame(13.12, y + 1.6, Z(14), P / 2, '#d97a4a');
    lamp(16.5, y + WH, Z(12.5));
    // cozinha
    box(2.7, 0.9, 0.6, 10.45, y, Z(15.6), M('#e9dfc8'), { col: 1 });
    box(2.75, 0.05, 0.65, 10.45, y + 0.9, Z(15.6), M('#7a6a5a'));
    for (let k = 0; k < 4; k++) cyl(0.09, 0.09, 0.02, 9.5 + (k % 2) * 0.35, y + 0.95, Z(15.45 + Math.floor(k / 2) * 0.25), M('#222'));
    box(0.7, 1.8, 0.7, 12.55, y, Z(13.9), M('#f0efe8'), { col: 1 }); // geladeira
    box(0.03, 0.5, 0.05, 12.18, y + 1.0, Z(13.7), M('#999'));
    windowPane(10.5, y + 1.3, Z(15.88), R(P), 1.0, 1.0);
    lamp(11, y + WH, Z(12.5), '#f2f2f2');
    // quarto
    box(0.5, 0.55, 0.45, 4.7, y, Z(15.6), M('#5a3a22'), { col: 1 });
    cyl(0.1, 0.14, 0.4, 4.7, y + 0.55, Z(15.6), M('#e8b04a'));
    windowPane(8.0, y + 0.9, Z(15.88), R(P), 1.0, 1.4);
    frame(6.3, y + 1.6, Z(15.86), R(P), '#6d8fb3');
    box(1.6, 0.01, 1.0, 6.3, y, Z(12.8), M('#c9a36a'));
    lamp(6.3, y + WH, Z(12.5));
    // banheiro
    box(0.45, 0.42, 0.6, 2.9, y, Z(9.5), M('#f4f4f0'), { col: 1 }); // vaso
    box(0.45, 0.4, 0.2, 2.9, y + 0.42, Z(9.3), M('#f4f4f0'));
    box(0.6, 0.85, 0.45, 1.5, y, Z(15.65), M('#f4f4f0'), { col: 1 }); // pia
    box(0.5, 0.6, 0.03, 1.5, y + 1.2, Z(15.88), M('#bcd7e6'));
    lamp(1.7, y + WH, Z(12.5), '#f2f2f2');
    // porta de entrada (moldura) e plaquinha
    box(1.4, 0.12, 0.25, 15.6, y + 2.2, Z(9), M('#5a3a22'));
  }
  apartment(false);
  apartment(true);

  // corredor
  for (const x of [4, 10, 17]) lamp(x, FH + WH, 8, '#d9a441');
  radiator(10, FH, 7.18, 0);
  frame(6, FH + 1.6, 8.88, P, '#4f7a43');
  frame(12, FH + 1.6, 7.12, 0, '#b5523b');
  plant(19.4, FH, 15.4);
  lamp(22, FH + WH, 8, '#d9a441');
  lamp(26, FH + WH, 14, '#d9a441');
  windowPane(22, FH + 0.9, 15.88, P);

  // ---------- CAFÉ ----------
  const y0 = 0;
  // balcão
  box(8.8, 1.05, 0.7, 4.6, 0, 11.55, M('#5a3420'), { col: 0 });
  box(9.0, 0.06, 0.85, 4.6, 1.05, 11.55, M('#2b1b12'));
  box(8.8, 0.25, 0.04, 4.6, 0.75, 11.18, M('#d8b45a'));
  // vitrine de doces
  box(1.4, 0.4, 0.5, 2.2, 1.11, 11.55, M('#cfe6f5', { transparent: true, opacity: 0.45 }));
  for (let k = 0; k < 4; k++) cyl(0.08, 0.1, 0.08, 1.75 + k * 0.3, 1.13, 11.55, M(['#e8b04a', '#b5523b', '#f2d5a0', '#7a4a2c'][k]));
  // máquina de espresso + bancada de trás
  box(9.5, 0.9, 0.6, 4.95, 0, 15.6, M('#3a2416'), { col: 0 });
  box(0.9, 0.6, 0.5, 3.0, 0.9, 15.6, M('#b8b8b8'));
  box(0.5, 0.25, 0.3, 6.0, 0.9, 15.6, M('#8a2c2c'));
  // prateleiras com xícaras
  for (const yy of [1.6, 2.1]) {
    box(8, 0.05, 0.3, 4.6, yy, 15.75, M('#5a3420'));
    for (let k = 0; k < 10; k++) cyl(0.06, 0.05, 0.1, 1.2 + k * 0.75, yy + 0.05, 15.75, M(k % 3 ? '#f4efe6' : '#b5523b'));
  }
  // banquetas
  for (let k = 0; k < 5; k++) { cyl(0.2, 0.2, 0.06, 1.5 + k * 1.6, 0.72, 10.6, M('#8a2c2c')); cyl(0.04, 0.04, 0.72, 1.5 + k * 1.6, 0, 10.6, M('#222')); addCol(1.5 + k * 1.6, 10.6, 0.4, 0.4, 0, 0); }
  // lousa de cardápio
  box(2.2, 1.2, 0.05, 14, 1.3, 15.86, M('#2a3a2e'));
  box(2.3, 1.3, 0.03, 14, 1.25, 15.89, M('#6a4a2a'));
  // sofás, poltronas, mesinhas
  box(1.2, 0.4, 0.7, 15, 0, 2.8, M('#5a3a22'), { col: 0 });
  const arm1 = group(11.6, 0, 2.6, P / 2); sofaMesh(arm1, '#8a3f2c', 1.0); addCol(11.6, 2.6, 0.9, 1.0, 0, 0);
  const sofa2 = group(19.35, 0, 13.2, -P / 2); sofaMesh(sofa2, '#6d4a7a', 2.2); addCol(19.35, 13.2, 0.9, 2.2, 0, 0);
  box(0.8, 0.45, 0.8, 18.2, 0, 13.2, M('#5a3a22'), { col: 0 });
  bistro(3, 8.5);
  bistro(9.5, 2.3);
  bistro(16.5, 9.5);
  bistro(13.2, 13.4);
  box(3, 0.01, 2, 15, 0, 3.2, M('#7a2632'));
  plant(0.5, 0, 0.5); plant(19.5, 0, 0.5); plant(19.5, 0, 6.3); plant(0.5, 0, 10.4);
  for (const x of [2.5, 6.5, 13, 17]) windowPane(x, 0.9, 0.12, 0, 1.6, 1.6);
  windowPane(0.12, 0.9, 4, P / 2, 1.6, 1.6);
  box(1.2, 2.2, 0.08, 10.6, 0, 0.14, M('#3a2416')); // porta da rua
  box(0.9, 1.0, 0.02, 10.6, 1.0, 0.19, new THREE.MeshBasicMaterial({ map: TEX.sky }));
  for (const [x, z] of [[4, 4], [10, 5], [15, 6], [4, 13.5], [12, 11], [17, 11]]) lamp(x, WH, z);
  frame(19.88, 1.7, 3.5, -P / 2, '#d97a4a');
  frame(19.88, 1.7, 12, -P / 2, '#4f7a43');

  // HALL
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) box(0.28, 0.25, 0.06, 20.5 + c * 0.3, 1.0 + r * 0.28, 15.9, M('#b08a3a'));
  box(1.2, 2.2, 0.08, 22, 0, 0.14, M('#3a2416'));
  box(0.8, 1.2, 0.02, 22, 0.8, 0.19, new THREE.MeshBasicMaterial({ map: TEX.sky }));
  radiator(20.4, 0, 3, P / 2);
  plant(23.5, 0, 0.6);
  lamp(22, WH, 4, '#d9a441'); lamp(22, WH, 12, '#d9a441');
  floor(24, 12.2, 28, 16, 0, TEX.checker, 1.0);

  // esconderijos
  for (const s of SPOTS) buildSpot(s);

  // ---------- luz quente ----------
  scene.add(new THREE.HemisphereLight('#ffe2b8', '#3a2418', 1.6));
  scene.add(new THREE.AmbientLight('#ffd9a8', 0.35));
  for (const [x, y, z, i] of [[7, 2.6, 8, 30], [15, 2.6, 7, 25], [24, 2.6, 8, 14], [12, FH + 2.6, 12.5, 26], [12, FH + 2.6, 3.5, 26], [10, FH + 2.6, 8, 10]]) {
    const l = new THREE.PointLight('#ffb766', i, 14, 1.6); l.position.set(x, y, z); scene.add(l);
  }

  return { colliders, blockers, spotFx };
}

// ---------- animações de "abrir esconderijo" ----------
export function animateSpot(fx, p) {
  // p: 0..1 (abre e fecha)
  const a = Math.sin(Math.min(1, p) * P);
  const { parts } = fx;
  if (parts.doors) for (const d of parts.doors) d.rotation.y = d.userData.side * a * 1.7;
  if (parts.cloth) { parts.cloth.scale.y = 1 - a * 0.55; parts.cloth.position.y = a * 0.33; }
  if (parts.curtain) parts.curtain.scale.x = 1 - a * 0.8;
  if (parts.top) parts.top.position.x = Math.sin(p * 40) * 0.04 * (1 - p);
}
