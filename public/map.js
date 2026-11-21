import * as THREE from '/vendor/three/three.module.js';

export const FH = 3.2; // altura do andar
export const WH = 3.0; // altura da parede
const T = 0.2; // espessura da parede
const P = Math.PI;

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// =====================================================================
// TEXTURAS PROCEDURAIS
// =====================================================================
function hx(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(h, f) {
  const [r, g, b] = hx(h);
  return f >= 0 ? `rgb(${(r + (255 - r) * f) | 0},${(g + (255 - g) * f) | 0},${(b + (255 - b) * f) | 0})` : `rgb(${(r * (1 + f)) | 0},${(g * (1 + f)) | 0},${(b * (1 + f)) | 0})`;
}
function tex(draw, w = 256, h = w, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = o.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function noise(g, w, h, n, a = 0.06, sz = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a * rnd()})` : `rgba(255,255,255,${a * rnd()})`;
    g.fillRect(rnd() * w, rnd() * h, sz * (0.5 + rnd()), sz * (0.5 + rnd()));
  }
}
function texPlanks(base, rows = 6) {
  return tex((g, s) => {
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * s * 0.6;
      while (x < s) {
        const len = s * (0.4 + rnd() * 0.5);
        g.fillStyle = mix(base, (rnd() - 0.5) * 0.25); g.fillRect(x, r * rh, len, rh);
        for (let k = 0; k < 8; k++) {
          g.strokeStyle = `rgba(0,0,0,${0.04 + rnd() * 0.08})`; g.lineWidth = 0.6 + rnd();
          const yy = r * rh + rnd() * rh;
          g.beginPath(); g.moveTo(x, yy);
          g.bezierCurveTo(x + len * 0.3, yy + (rnd() - 0.5) * 5, x + len * 0.7, yy + (rnd() - 0.5) * 5, x + len, yy + (rnd() - 0.5) * 3); g.stroke();
        }
        if (rnd() < 0.3) { g.fillStyle = 'rgba(40,20,10,.25)'; g.beginPath(); g.ellipse(x + len * rnd(), r * rh + rh / 2, 3, 1.6, 0, 0, 7); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, r * rh, 1.5, rh);
        x += len;
      }
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, r * rh, s, 1.5);
      g.fillStyle = 'rgba(255,240,220,.07)'; g.fillRect(0, r * rh + 2, s, 1.2);
    }
    noise(g, s, s, 500, 0.05);
  });
}
function texBrick(cols, mortar) {
  return tex((g, s) => {
    g.fillStyle = mortar; g.fillRect(0, 0, s, s);
    const rows = 16, rh = s / rows, n = 5, cw = s / n;
    for (let r = 0; r < rows; r++) for (let c = -1; c <= n; c++) {
      const x = c * cw + (r % 2) * cw / 2;
      const ci = ((r * 7 + ((c + n) % n) * 3) * 13) % cols.length;
      g.fillStyle = mix(cols[ci], (((r * 31 + ((c + n) % n) * 17) % 10) - 5) / 40);
      g.fillRect(x + 1.5, r * rh + 1.5, cw - 3, rh - 3);
      g.fillStyle = 'rgba(255,230,200,.08)'; g.fillRect(x + 1.5, r * rh + 1.5, cw - 3, 1.5);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 1.5, r * rh + rh - 3, cw - 3, 1.5);
    }
    noise(g, s, s, 1600, 0.12, 1.5);
  });
}
function texPaper(base, acc, style) {
  return tex((g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    g.fillStyle = acc; g.strokeStyle = acc;
    if (style === 'stripe') {
      for (let i = 0; i < 8; i++) { g.globalAlpha = 0.55; g.fillRect(i * s / 8, 0, s / 16, s); g.globalAlpha = 1; g.fillRect(i * s / 8 + s / 16 + 3, 0, 1.5, s); }
    } else if (style === 'damask') {
      g.lineWidth = 2;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const cx = i * s / 4 + (j % 2) * s / 8, cy = j * s / 4;
        g.globalAlpha = 0.7;
        g.beginPath(); g.moveTo(cx, cy - 18); g.quadraticCurveTo(cx + 13, cy, cx, cy + 18); g.quadraticCurveTo(cx - 13, cy, cx, cy - 18); g.fill();
        g.globalAlpha = 0.45; g.beginPath(); g.arc(cx, cy - 24, 3, 0, 7); g.arc(cx, cy + 24, 3, 0, 7); g.fill();
        g.beginPath(); g.arc(cx + 16, cy, 2.2, 0, 7); g.arc(cx - 16, cy, 2.2, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    } else if (style === 'flower') {
      for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
        const cx = i * s / 6 + (j % 2) * s / 12, cy = j * s / 6 + 10;
        g.fillStyle = acc; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(cx + Math.cos(k * 1.256) * 4.5, cy + Math.sin(k * 1.256) * 4.5, 3.4, 0, 7); g.fill(); }
        g.fillStyle = '#e7c35a'; g.beginPath(); g.arc(cx, cy, 2.2, 0, 7); g.fill();
        g.fillStyle = '#7c9a68'; g.fillRect(cx + 5, cy + 6, 6, 2);
      }
    } else if (style === 'dots') {
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(i * s / 8 + (j % 2) * s / 16 + 8, j * s / 8 + 8, 2.4, 0, 7); g.fill(); }
    }
    noise(g, s, s, 600, 0.05);
  });
}
function texPanel(base) {
  return tex((g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2; i++) {
      const x = i * s / 2 + 14, w = s / 2 - 28;
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, 26, w, s - 52);
      g.fillStyle = mix(base, 0.08); g.fillRect(x + 6, 32, w - 12, s - 64);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, 26, w, 3);
    }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, s, 6);
    noise(g, s, s, 400, 0.05);
  });
}
function texTiles(base, grout, n) {
  return tex((g, s) => {
    g.fillStyle = grout; g.fillRect(0, 0, s, s);
    const k = s / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      g.fillStyle = mix(base, (rnd() - 0.5) * 0.08); g.fillRect(i * k + 1.5, j * k + 1.5, k - 3, k - 3);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(i * k + 3, j * k + 3, k * 0.4, 2);
    }
  });
}
function texChecker(a, b, n) {
  return tex((g, s) => {
    const k = s / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { g.fillStyle = mix((i + j) % 2 ? a : b, (rnd() - 0.5) * 0.06); g.fillRect(i * k, j * k, k, k); }
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (let i = 0; i <= n; i++) { g.fillRect(i * k - 1, 0, 2, s); g.fillRect(0, i * k - 1, s, 2); }
    noise(g, s, s, 500, 0.05);
  });
}
function texMarble() {
  return tex((g, s) => {
    const k = s / 2;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { g.fillStyle = (i + j) % 2 ? '#e8e2d6' : '#2a2a2e'; g.fillRect(i * k, j * k, k, k); }
    for (let v = 0; v < 14; v++) {
      g.strokeStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '120,110,100'},${0.15 + rnd() * 0.2})`; g.lineWidth = 0.8 + rnd() * 1.5;
      g.beginPath(); let x = rnd() * s, y = rnd() * s; g.moveTo(x, y);
      for (let q = 0; q < 6; q++) { x += (rnd() - 0.3) * 50; y += (rnd() - 0.5) * 50; g.lineTo(x, y); } g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(k - 1, 0, 2, s); g.fillRect(0, k - 1, s, 2); g.fillRect(0, 0, 2, s); g.fillRect(0, 0, s, 2);
  });
}
function texRunner() {
  return tex((g, s) => {
    g.fillStyle = '#6e1f29'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#4a141c'; g.fillRect(0, 0, s, 30); g.fillRect(0, s - 30, s, 30);
    g.fillStyle = '#c9a050'; g.fillRect(0, 30, s, 4); g.fillRect(0, s - 34, s, 4);
    for (let i = 0; i < 8; i++) {
      const cx = i * s / 8 + s / 16;
      g.fillStyle = '#c9a050'; g.beginPath(); g.moveTo(cx, 8); g.lineTo(cx + 9, 15); g.lineTo(cx, 22); g.lineTo(cx - 9, 15); g.fill();
      g.beginPath(); g.moveTo(cx, s - 8); g.lineTo(cx + 9, s - 15); g.lineTo(cx, s - 22); g.lineTo(cx - 9, s - 15); g.fill();
    }
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      const cx = i * s / 4 + (j % 2) * s / 8 + s / 8, cy = 60 + j * 68;
      g.strokeStyle = '#a8434c'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - 20); g.lineTo(cx + 20, cy); g.lineTo(cx, cy + 20); g.lineTo(cx - 20, cy); g.closePath(); g.stroke();
      g.fillStyle = '#d9b46a'; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill();
    }
    noise(g, s, s, 2500, 0.1, 1.5);
  });
}
function texRug(a, b, c) {
  return tex((g, s) => {
    g.fillStyle = c; g.fillRect(0, 0, s, s);
    g.fillStyle = b; g.fillRect(10, 10, s - 20, s - 20);
    g.fillStyle = a; g.fillRect(22, 22, s - 44, s - 44);
    g.strokeStyle = b; g.lineWidth = 3; g.strokeRect(34, 34, s - 68, s - 68);
    g.fillStyle = c; g.beginPath(); g.ellipse(s / 2, s / 2, 54, 42, 0, 0, 7); g.fill();
    g.fillStyle = b; g.beginPath(); g.ellipse(s / 2, s / 2, 34, 26, 0, 0, 7); g.fill();
    g.fillStyle = a; g.beginPath(); g.ellipse(s / 2, s / 2, 16, 12, 0, 0, 7); g.fill();
    g.fillStyle = b;
    for (const [x, y] of [[50, 50], [s - 50, 50], [50, s - 50], [s - 50, s - 50]]) { g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 12, y); g.lineTo(x, y + 12); g.lineTo(x - 12, y); g.fill(); }
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(12 + i * (s - 24) / 16, 12, (s - 24) / 32, 8); g.fillRect(12 + i * (s - 24) / 16, s - 20, (s - 24) / 32, 8); }
    noise(g, s, s, 3000, 0.12, 1.5);
  }, 256, 256, { clamp: true });
}
function texFabric() {
  return tex((g, s) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.04})`; g.fillRect(i, 0, 1, s); g.fillRect(0, i, s, 1); }
    noise(g, s, s, 1500, 0.07, 1.5);
  }, 128);
}
function texGrain() {
  return tex((g, s) => {
    g.fillStyle = '#ececec'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(0,0,0,${0.04 + rnd() * 0.1})`; g.lineWidth = 0.5 + rnd() * 1.2;
      const y = rnd() * s; g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + (rnd() - 0.5) * 10, s * 0.7, y + (rnd() - 0.5) * 10, s, y); g.stroke();
    }
    noise(g, s, s, 300, 0.05);
  }, 128);
}
function texFolds() {
  return tex((g, s) => {
    for (let x = 0; x < s; x++) { const v = 200 + Math.sin((x / s) * P * 2 * 6) * 40 + (rnd() - 0.5) * 6; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, s); }
    const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, 'rgba(0,0,0,.15)'); gr.addColorStop(0.15, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }, 128);
}
function texGingham(c) {
  return tex((g, s) => {
    g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, s, s);
    const k = s / 8; g.fillStyle = c;
    for (let i = 0; i < 8; i += 2) { g.globalAlpha = 0.55; g.fillRect(i * k, 0, k, s); g.fillRect(0, i * k, s, k); }
    g.globalAlpha = 1; noise(g, s, s, 600, 0.06, 1.5);
  }, 128);
}
function texStripes(a, b) {
  return tex((g, s) => { g.fillStyle = a; g.fillRect(0, 0, s, s); g.fillStyle = b; for (let i = 0; i < 6; i++) g.fillRect(i * s / 6, 0, s / 12, s); noise(g, s, s, 300, 0.05); }, 128);
}
function texArt(k) {
  return tex((g, w, h) => {
    if (k === 0) { // pôr do sol
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f2a65a'); gr.addColorStop(0.55, '#e0607e'); gr.addColorStop(1, '#6b3a6e');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffe3a1'; g.beginPath(); g.arc(w * 0.62, h * 0.52, 34, 0, 7); g.fill();
      g.fillStyle = '#4a2a4e'; g.beginPath(); g.moveTo(0, h * 0.7); g.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.72); g.quadraticCurveTo(w * 0.8, h * 0.62, w, h * 0.7); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = '#2e1a33'; g.fillRect(0, h * 0.85, w, h);
    } else if (k === 1) { // abstrato
      g.fillStyle = '#efe4cf'; g.fillRect(0, 0, w, h);
      const cs = ['#d9663a', '#2f6f8f', '#e8b84a', '#3d7a5a', '#b9405a'];
      for (let i = 0; i < 7; i++) { g.fillStyle = cs[i % 5]; g.globalAlpha = 0.85; if (i % 2) g.fillRect(rnd() * w * 0.8, rnd() * h * 0.8, 30 + rnd() * 60, 20 + rnd() * 50); else { g.beginPath(); g.arc(rnd() * w, rnd() * h, 15 + rnd() * 35, 0, 7); g.fill(); } }
      g.globalAlpha = 1; g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.moveTo(20, h - 30); g.bezierCurveTo(w * 0.3, 20, w * 0.6, h, w - 20, 30); g.stroke();
    } else if (k === 2) { // flores
      g.fillStyle = '#23303a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c47a3a'; g.beginPath(); g.moveTo(w / 2 - 22, h - 20); g.lineTo(w / 2 + 22, h - 20); g.lineTo(w / 2 + 30, h - 70); g.lineTo(w / 2 - 30, h - 70); g.fill();
      for (let i = 0; i < 9; i++) {
        const x = w / 2 + (rnd() - 0.5) * 110, y = 30 + rnd() * 70;
        g.strokeStyle = '#4f7a43'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, h - 70); g.lineTo(x, y); g.stroke();
        g.fillStyle = pick(['#e85d75', '#f2c14e', '#f4f1de', '#e07a5f', '#b8a1d9']);
        for (let p = 0; p < 6; p++) { g.beginPath(); g.arc(x + Math.cos(p) * 7, y + Math.sin(p) * 7, 6, 0, 7); g.fill(); }
      }
    } else if (k === 3) { // cidade à noite
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#16224a'); gr.addColorStop(1, '#4a3a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff2c4'; g.beginPath(); g.arc(w * 0.8, h * 0.2, 14, 0, 7); g.fill();
      for (let i = 0; i < 12; i++) { const bw = 14 + rnd() * 20, bh = 40 + rnd() * 100, x = (i / 12) * w; g.fillStyle = '#121626'; g.fillRect(x, h - bh, bw, bh); g.fillStyle = '#f2c14e'; for (let q = 0; q < 10; q++) if (rnd() < 0.5) g.fillRect(x + 2 + rnd() * (bw - 5), h - bh + 4 + rnd() * (bh - 8), 2, 3); }
    } else if (k === 4) { // barquinho
      g.fillStyle = '#9fd0e0'; g.fillRect(0, 0, w, h * 0.6); g.fillStyle = '#2f6f8f'; g.fillRect(0, h * 0.6, w, h);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w * 0.45, h * 0.15); g.lineTo(w * 0.45, h * 0.55); g.lineTo(w * 0.7, h * 0.55); g.fill();
      g.fillStyle = '#b5523b'; g.beginPath(); g.moveTo(w * 0.3, h * 0.58); g.lineTo(w * 0.75, h * 0.58); g.lineTo(w * 0.68, h * 0.68); g.lineTo(w * 0.36, h * 0.68); g.fill();
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(w * 0.15, h * 0.18, 16, 0, 7); g.fill();
    } else { // cartaz de jazz (original)
      g.fillStyle = '#e8b84a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d1d1d'; g.beginPath(); g.arc(w * 0.5, h * 0.42, 52, 0, 7); g.fill();
      g.fillStyle = '#e8b84a'; g.beginPath(); g.arc(w * 0.5, h * 0.42, 8, 0, 7); g.fill();
      g.fillStyle = '#b9405a'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('NOITE DE', w / 2, h - 46); g.fillText('JAZZ', w / 2, h - 14);
    }
    noise(g, w, h, 500, 0.06);
  }, 256, 192, { clamp: true });
}
function texChalk() {
  return tex((g, w, h) => {
    g.fillStyle = '#26332b'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 1500, 0.06);
    g.fillStyle = '#f4efe2'; g.textAlign = 'center';
    g.font = 'bold 44px "Comic Sans MS", "Segoe Print", cursive'; g.fillText('Café', w / 2, 58);
    g.font = 'bold 40px "Comic Sans MS", "Segoe Print", cursive'; g.fillText('Aconchego', w / 2, 100);
    g.font = '22px "Comic Sans MS", "Segoe Print", cursive'; g.textAlign = 'left';
    const items = [['Expresso', '5'], ['Cappuccino', '8'], ['Chocolate quente', '9'], ['Bolo de fubá', '6'], ['Pão de queijo', '4']];
    items.forEach(([a, b], i) => { g.fillText(a, 30, 150 + i * 32); g.textAlign = 'right'; g.fillText(b, w - 30, 150 + i * 32); g.textAlign = 'left'; });
    g.strokeStyle = '#e8b84a'; g.lineWidth = 2; g.beginPath(); g.moveTo(60, 118); g.lineTo(w - 60, 118); g.stroke();
    g.fillStyle = '#e85d75'; g.beginPath(); g.arc(w - 40, 40, 10, 0, 7); g.fill();
  }, 384, 320, { clamp: true });
}
function texNeon() {
  return tex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center'; g.font = 'italic bold 64px Georgia, serif';
    for (const [blur, a] of [[24, 0.6], [10, 0.9], [2, 1]]) { g.shadowColor = '#ff8a3c'; g.shadowBlur = blur; g.fillStyle = a === 1 ? '#fff0d0' : `rgba(255,150,70,${a})`; g.fillText('Aconchego', w / 2, 92); }
    g.shadowBlur = 14; g.strokeStyle = '#ffc06a'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(w / 2 - 150, 112); g.lineTo(w / 2 + 150, 112); g.stroke();
  }, 512, 128, { clamp: true });
}
function texSky() {
  return tex((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#060a1c'); gr.addColorStop(0.45, '#1a2350'); gr.addColorStop(0.75, '#43305a'); gr.addColorStop(1, '#6a4050');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.6})`; g.fillRect(rnd() * w, rnd() * h * 0.4, 1.2, 1.2); }
    g.fillStyle = '#fff6da'; g.shadowColor = '#fff6da'; g.shadowBlur = 30; g.beginPath(); g.arc(w * 0.73, h * 0.16, 18, 0, 7); g.fill(); g.shadowBlur = 0;
    // prédios ao fundo (camada clara) e na frente (escura)
    for (const [layer, col, minH, maxH] of [[0, '#272845', 0.25, 0.5], [1, '#15131f', 0.35, 0.72]]) {
      let x = 0;
      while (x < w) {
        const bw = 26 + rnd() * 60, bh = h * (minH + rnd() * (maxH - minH));
        g.fillStyle = col; g.fillRect(x, h - bh, bw, bh);
        if (layer === 1 && rnd() < 0.35) { // caixa d'água
          const tx = x + bw * 0.3, ty = h - bh; g.fillRect(tx, ty - 22, 16, 16); g.fillRect(tx + 2, ty - 6, 2, 6); g.fillRect(tx + 12, ty - 6, 2, 6);
          g.beginPath(); g.moveTo(tx - 2, ty - 22); g.lineTo(tx + 8, ty - 30); g.lineTo(tx + 18, ty - 22); g.fill();
        }
        const lit = layer ? 0.45 : 0.25;
        for (let yy = h - bh + 8; yy < h - 6; yy += 9) for (let xx = x + 4; xx < x + bw - 5; xx += 8) {
          if (rnd() < lit) { g.fillStyle = pick(['#ffd27a', '#ffc35c', '#ffe6a8', '#f7a64a', '#c9d8ff']); g.globalAlpha = layer ? 0.9 : 0.5; g.fillRect(xx, yy, 3.5, 4.5); g.globalAlpha = 1; }
        }
        x += bw + (layer ? 2 : 8);
      }
    }
  }, 1024, 512);
}
function texStreet() {
  return tex((g, s) => {
    g.fillStyle = '#121216'; g.fillRect(0, 0, s, s);
    noise(g, s, s, 2500, 0.12, 2);
    for (let i = 0; i < 6; i++) { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, 'rgba(255,190,110,0)'); gr.addColorStop(0.5, 'rgba(255,190,110,.18)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(rnd() * s, 0, 6 + rnd() * 10, s); }
  });
}
function texRain() {
  return tex((g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(150,175,215,0.07)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = rnd() * h, l = 6 + rnd() * 30;
      const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(200,220,255,0)'); gr.addColorStop(1, 'rgba(220,235,255,.55)');
      g.strokeStyle = gr; g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 2, y + l); g.stroke();
      g.fillStyle = 'rgba(230,240,255,.5)'; g.beginPath(); g.arc(x, y + l, 1.4, 0, 7); g.fill();
    }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(220,235,255,${0.2 + rnd() * 0.3})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, 0.8 + rnd() * 1.5, 0, 7); g.fill(); }
  }, 128, 256);
}
function texGlow() {
  return tex((g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.45)'); gr.addColorStop(0.55, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }, 64, 64, { clamp: true });
}
function texShadow() {
  return tex((g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }, 64, 64, { clamp: true });
}
function texRing() {
  return tex((g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, s * 0.28, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,220,140,0)'); gr.addColorStop(0.55, 'rgba(255,220,140,.9)'); gr.addColorStop(0.75, 'rgba(255,200,110,.35)'); gr.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }, 128, 128, { clamp: true });
}
function texCardboard() {
  return tex((g, s) => {
    g.fillStyle = '#b98a55'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 4) { g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.03})`; g.fillRect(i, 0, 2, s); }
    g.fillStyle = 'rgba(210,190,150,.8)'; g.fillRect(s / 2 - 18, 0, 36, s);
    g.fillStyle = '#7a2a1e'; g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('FRÁGIL', s / 2, s * 0.62);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 4;
    for (const x of [s * 0.2, s * 0.8]) { g.beginPath(); g.moveTo(x, s * 0.82); g.lineTo(x, s * 0.7); g.moveTo(x - 9, s * 0.76); g.lineTo(x, s * 0.7); g.lineTo(x + 9, s * 0.76); g.stroke(); }
    noise(g, s, s, 800, 0.06);
  }, 128);
}
function texTV() {
  return tex((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#5fa8d3'); gr.addColorStop(1, '#f2b46b'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7a4a2c'; g.fillRect(w * 0.15, h * 0.55, w * 0.7, h * 0.25);
    g.fillStyle = '#e07a5f'; g.beginPath(); g.arc(w * 0.35, h * 0.45, 10, 0, 7); g.fill(); g.fillStyle = '#3d7a5a'; g.beginPath(); g.arc(w * 0.62, h * 0.43, 10, 0, 7); g.fill();
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, w, 1); }
  }, 128, 96, { clamp: true });
}
function texJuke() {
  return tex((g, w, h) => {
    g.fillStyle = '#2a1414'; g.fillRect(0, 0, w, h);
    const cs = ['#ff5a6e', '#ffb84a', '#5ad1ff', '#9dff7a'];
    for (let i = 0; i < 4; i++) { g.strokeStyle = cs[i]; g.lineWidth = 7; g.beginPath(); g.arc(w / 2, h * 0.45, w * 0.42 - i * 9, P, 0); g.stroke(); }
    g.fillStyle = '#ffe9b0'; g.fillRect(w * 0.25, h * 0.5, w * 0.5, h * 0.18);
    for (let i = 0; i < 6; i++) { g.fillStyle = cs[i % 4]; g.fillRect(w * 0.2 + i * w * 0.1, h * 0.78, w * 0.06, h * 0.12); }
  }, 128, 256, { clamp: true });
}

// =====================================================================
// MATERIAIS "DESCRITORES" (a luz é assada nos vértices depois)
// =====================================================================
const DUMMY = new THREE.MeshBasicMaterial();
const mcache = new Map();
function M(c, o = {}) {
  const key = c + '|' + (o.tex ? o.tex.uuid : '') + '|' + (o.emi || 0) + '|' + (o.alpha || 1) + '|' + (o.side || 0) + '|' + (o.unlit ? 1 : 0) + '|' + (o.add ? 1 : 0) + '|' + (o.ts || 0);
  if (mcache.has(key)) return mcache.get(key);
  const d = { key, color: new THREE.Color(c), tex: o.tex || null, emi: o.emi || 0, alpha: o.alpha || 1, side: o.side || THREE.FrontSide, unlit: !!o.unlit, add: !!o.add, ts: o.ts || 1.5 };
  mcache.set(key, d);
  return d;
}
const bucketKey = (d) => (d.tex ? d.tex.uuid : 'c') + '|' + d.alpha + '|' + d.side + '|' + (d.unlit ? 'u' : '') + (d.add ? 'a' : '');
function finalMaterial(d) {
  return new THREE.MeshBasicMaterial({
    vertexColors: true, map: d.tex, side: d.side,
    transparent: d.alpha < 1 || d.add, opacity: d.alpha, depthWrite: d.alpha >= 1 && !d.add,
    blending: d.add ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

// =====================================================================
// MUNDO
// =====================================================================
export function buildWorld(scene, SPOTS) {
  seed = 7;
  const TX = makeTextures();
  const root = new THREE.Group(); scene.add(root);
  const colliders = [], blockers = [], lights = [], halosBig = [], halosSmall = [], fairy = [], spotFx = {};
  const fans = [], glassMats = [];

  // ---------- primitivas ----------
  function mk(geo, m, parent = root) { const mesh = new THREE.Mesh(geo, DUMMY); mesh.userData.m = m; parent.add(mesh); return mesh; }
  function seg(v) { return v > 1.3 ? Math.min(40, Math.ceil(v / 0.6)) : 1; }
  function B(w, h, d, x, y, z, m, o = {}) {
    const mesh = mk(new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d)), m, o.parent);
    mesh.position.set(x, y + h / 2, z);
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.rz) mesh.rotation.z = o.rz;
    if (o.col !== undefined) addCol(x, z, w, d, o.ry || 0, o.col);
    return mesh;
  }
  function C(rt, rb, h, x, y, z, m, o = {}) {
    const mesh = mk(new THREE.CylinderGeometry(rt, rb, h, o.seg || 12, 1, !!o.open, o.ts || 0, o.tl || P * 2), m, o.parent);
    // cilindro em pé: y = base; girado (rx/rz): y = centro
    mesh.position.set(x, o.rx || o.rz ? y : y + h / 2, z);
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.rz) mesh.rotation.z = o.rz;
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.col !== undefined) addCol(x, z, rb * 2, rb * 2, 0, o.col);
    return mesh;
  }
  function S(r, x, y, z, m, o = {}) {
    const mesh = mk(o.ico ? new THREE.IcosahedronGeometry(r, o.det || 0) : new THREE.SphereGeometry(r, o.seg || 12, o.seg2 || 8), m, o.parent);
    mesh.position.set(x, y, z);
    if (o.sc) mesh.scale.set(...o.sc);
    return mesh;
  }
  function PL(w, h, x, y, z, m, o = {}) {
    const mesh = mk(new THREE.PlaneGeometry(w, h, o.sx || 1, o.sy || 1), m, o.parent);
    mesh.position.set(x, y, z);
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.rx) mesh.rotation.x = o.rx;
    return mesh;
  }
  function G(x, y, z, ry = 0, parent = root) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; }
  function addCol(x, z, w, d, ry, level) {
    let hw = w / 2, hd = d / 2;
    if (Math.abs(Math.sin(ry)) > 0.5) [hw, hd] = [hd, hw];
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, level });
  }
  function addBlocker(x, y, z, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), DUMMY);
    m.position.set(x, y + h / 2, z); m.updateMatrixWorld(true); blockers.push(m);
  }
  function light(x, y, z, color, i, range, zones) { lights.push({ x, y, z, c: new THREE.Color(color), i, range, zones }); }
  // grade de piso/teto com UV em coordenadas do mundo
  function grid(x1, z1, x2, z2, y, m, down = false, step = 0.5) {
    const nx = Math.max(1, Math.ceil((x2 - x1) / step)), nz = Math.max(1, Math.ceil((z2 - z1) / step));
    const pos = [], nor = [], uv = [], idx = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x1 + ((x2 - x1) * i) / nx, z = z1 + ((z2 - z1) * j) / nz;
      pos.push(x, y, z); nor.push(0, down ? -1 : 1, 0); uv.push((x - x1) / m.ts, 1 - (z - z1) / m.ts);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      if (down) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return mk(g, m);
  }
  const floorR = (x1, z1, x2, z2, lvl, m) => grid(x1, z1, x2, z2, lvl * FH + 0.004, m);
  const ceilR = (x1, z1, x2, z2, y, m) => grid(x1, z1, x2, z2, y, m, true);

  // ---------- paredes com vãos (portas/janelas) e dois lados ----------
  function sideAt(spec, mid) { const s = typeof spec === 'function' ? spec(mid) : spec; return s && s.m ? s : { m: s }; }
  function subtract(ranges, a, b) {
    const out = [];
    for (const [p, q] of ranges) { if (b <= p || a >= q) out.push([p, q]); else { if (a > p) out.push([p, a]); if (b < q) out.push([b, q]); } }
    return out;
  }
  function wallPiece(axis, c, p, q, ya, yb, m, sign) {
    const L = q - p, H = yb - ya, mid = (p + q) / 2, off = c + (sign * T) / 4;
    const geo = axis === 'x' ? new THREE.BoxGeometry(L, H, T / 2, seg(L), seg(H), 1) : new THREE.BoxGeometry(T / 2, H, L, 1, seg(H), seg(L));
    if (axis === 'x') geo.translate(mid, ya + H / 2, off); else geo.translate(off, ya + H / 2, mid);
    const pa = geo.attributes.position, ua = geo.attributes.uv;
    for (let i = 0; i < pa.count; i++) ua.setXY(i, (axis === 'x' ? pa.getX(i) : pa.getZ(i)) / m.ts, pa.getY(i) / m.ts);
    mk(geo, m);
  }
  function wall(axis, c, a1, a2, lvl, sideA, sideB, openings = [], h = WH, o = {}) {
    const y0 = lvl * FH;
    const s = a1 - (o.noExt ? 0 : T / 2), e = a2 + (o.noExt ? 0 : T / 2);
    const cuts = new Set([s, e]);
    for (const op of openings) { cuts.add(op.a); cuts.add(op.b); }
    const xs = [...cuts].filter((v) => v >= s && v <= e).sort((p, q) => p - q);
    for (let i = 0; i < xs.length - 1; i++) {
      const p = xs[i], q = xs[i + 1];
      if (q - p < 1e-4) continue;
      const mid = (p + q) / 2;
      let ranges = [[0, h]];
      for (const op of openings) if (mid > op.a && mid < op.b) ranges = subtract(ranges, op.y0, op.y1);
      for (const [ya, yb] of ranges) {
        if (yb - ya < 1e-3) continue;
        for (const [spec, sign] of [[sideA, -1], [sideB, 1]]) {
          const sp = sideAt(spec, mid);
          if (sp.low && ya < sp.split) {
            wallPiece(axis, c, p, q, y0 + ya, y0 + Math.min(yb, sp.split), sp.low, sign);
            if (yb > sp.split) wallPiece(axis, c, p, q, y0 + sp.split, y0 + yb, sp.m, sign);
            if (yb > sp.split && sp.rail) wallPiece(axis, c + sign * 0.03, p, q, y0 + sp.split - 0.03, y0 + sp.split + 0.04, sp.rail, sign);
          } else wallPiece(axis, c, p, q, y0 + ya, y0 + yb, sp.m, sign);
        }
        const L = q - p;
        if (ya < 0.01) { if (axis === 'x') addCol(mid, c, L, T, 0, lvl); else addCol(c, mid, T, L, 0, lvl); }
        if (h >= WH - 0.01) { if (axis === 'x') addBlocker(mid, y0 + ya, c, L, yb - ya, T); else addBlocker(c, y0 + ya, mid, T, yb - ya, L); }
      }
    }
  }
  // janela: vão já aberto na parede; desenha moldura, vidro com chuva e peitoril (lado de dentro = inSign)
  const glassMat = M('#8fa6c8', { tex: null, unlit: true, alpha: 0.18 });
  function win(axis, c, a, b, lvl, y0, y1, inSign, o = {}) {
    const yb = lvl * FH;
    const W = b - a, H = y1 - y0, mid = (a + b) / 2;
    const frame = M(o.frame || '#efe7d6');
    const g = G(axis === 'x' ? mid : c, yb, axis === 'x' ? c : mid, axis === 'x' ? (inSign > 0 ? 0 : P) : (inSign > 0 ? P / 2 : -P / 2));
    // dentro do grupo: x = ao longo da parede, +z = para dentro do cômodo
    const fz = T / 2 + 0.02;
    B(W + 0.24, 0.1, 0.06, 0, y1, fz, frame, { parent: g });
    B(W + 0.24, 0.08, 0.06, 0, y0 - 0.08, fz, frame, { parent: g });
    B(0.1, H, 0.06, -W / 2 - 0.07, y0, fz, frame, { parent: g });
    B(0.1, H, 0.06, W / 2 + 0.07, y0, fz, frame, { parent: g });
    B(W + 0.34, 0.05, 0.22, 0, y0 - 0.02, T / 2 + 0.08, frame, { parent: g }); // peitoril
    // caixilhos
    const nV = W > 1.6 ? 2 : 1;
    for (let k = 1; k <= nV; k++) B(0.05, H, 0.05, -W / 2 + (k * W) / (nV + 1), y0, 0.02, frame, { parent: g });
    B(W, 0.05, 0.05, 0, y0 + H * 0.62, 0.02, frame, { parent: g });
    // laterais do vão (espessura da parede)
    B(W, 0.02, T, 0, y0 - 0.01, 0, frame, { parent: g });
    B(W, 0.02, T, 0, y1 - 0.01, 0, frame, { parent: g });
    B(0.02, H, T, -W / 2, y0, 0, frame, { parent: g });
    B(0.02, H, T, W / 2, y0, 0, frame, { parent: g });
    const gl = PL(W, H, 0, y0 + H / 2, 0, glassMat, { parent: g });
    gl.userData.glass = true;
    // luz da lua entrando
    const wx = axis === 'x' ? mid : c + inSign * 0.8, wz = axis === 'x' ? c + inSign * 0.8 : mid;
    light(wx, yb + y0 + H * 0.6, wz, '#6d86d6', o.moon ?? 0.35, 3.2);
  }
  function door(axis, c, a, b, lvl, o = {}) {
    // moldura nos dois lados + folha aberta 90° para o lado o.swing (+1/-1)
    const yb = lvl * FH, W = b - a, mid = (a + b) / 2, Hd = o.h || 2.2;
    const fr = M(o.frame || '#efe7d6');
    for (const sg of [-1, 1]) {
      const g = G(axis === 'x' ? mid : c, yb, axis === 'x' ? c : mid, axis === 'x' ? (sg > 0 ? 0 : P) : (sg > 0 ? P / 2 : -P / 2));
      B(W + 0.24, 0.1, 0.04, 0, Hd, T / 2 + 0.015, fr, { parent: g });
      B(0.1, Hd, 0.04, -W / 2 - 0.05, 0, T / 2 + 0.015, fr, { parent: g });
      B(0.1, Hd, 0.04, W / 2 + 0.05, 0, T / 2 + 0.015, fr, { parent: g });
    }
    if (o.leaf) {
      const sw = o.swing || 1;
      const hx_ = axis === 'x' ? a + 0.03 : c + sw * (T / 2 + 0.02), hz = axis === 'x' ? c + sw * (T / 2 + 0.02) : a + 0.03;
      const g = G(hx_, yb, hz, axis === 'x' ? (sw > 0 ? 0 : P) : (sw * P) / 2);
      // folha ao longo de +z local (para dentro do cômodo)
      const lw = W - 0.06, lm = M(o.leaf, { tex: TX.grain });
      B(0.045, Hd - 0.02, lw, 0, 0, lw / 2, lm, { parent: g });
      for (const [py, ph] of [[0.15, 0.85], [1.15, 0.9]]) B(0.06, ph, lw - 0.24, 0, py, lw / 2, M(o.leaf, { tex: TX.grain, emi: 0 }), { parent: g });
      S(0.035, 0.05, 1.0, lw - 0.1, M('#d8b45a'), { parent: g }); S(0.035, -0.05, 1.0, lw - 0.1, M('#d8b45a'), { parent: g });
      if (o.peep) { C(0.02, 0.02, 0.02, -0.03, 1.55, lw / 2, M('#d8b45a'), { parent: g, rz: P / 2 }); }
      // colisor da folha
      if (axis === 'x') addCol(a + 0.03, c + sw * (lw / 2 + 0.1), 0.08, lw, 0, lvl); else addCol(c + sw * (lw / 2 + 0.1), a + 0.03, lw, 0.08, 0, lvl);
    }
  }

  // ---------- decoração ----------
  const wood = (c) => M(c, { tex: TX.grain });
  const fab = (c) => M(c, { tex: TX.fabric });
  function halo(x, y, z, big = true) { (big ? halosBig : halosSmall).push(x, y, z); }
  function pendant(x, yTop, z, o = {}) {
    const len = o.len || 0.8, y = yTop - len;
    C(0.006, 0.006, len, x, y, z, M('#1d1d1d'));
    if (o.drum) C(0.3, 0.3, 0.24, x, y - 0.24, z, M(o.shade || '#f1dfb8', { emi: 0.5, side: THREE.DoubleSide }), { open: true, seg: 16 });
    else C(0.06, 0.25, 0.22, x, y - 0.22, z, M(o.shade || '#2f5a46', { emi: 0.12, side: THREE.DoubleSide }), { open: true, seg: 14 });
    S(0.055, x, y - 0.24, z, M('#fff1c8', { unlit: true }));
    halo(x, y - 0.26, z, true);
    light(x, y - 0.3, z, o.color || '#ffb46a', o.i ?? 1.5, o.r ?? 7, o.zones);
  }
  function floorLamp(x, y, z, o = {}) {
    C(0.16, 0.18, 0.04, x, y, z, M('#2a2420'));
    C(0.015, 0.015, 1.45, x, y, z, M('#3a2a1e'));
    C(0.17, 0.27, 0.32, x, y + 1.38, z, M(o.shade || '#f3d9a4', { emi: 0.85, side: THREE.DoubleSide }), { open: true, seg: 14 });
    halo(x, y + 1.5, z, true);
    light(x, y + 1.5, z, o.color || '#ffb060', o.i ?? 1.1, o.r ?? 5.5, o.zones);
    addCol(x, z, 0.36, 0.36, 0, y > 1 ? 1 : 0);
  }
  function tableLamp(x, y, z, o = {}) {
    C(0.07, 0.09, 0.22, x, y, z, M(o.base || '#c9785a'));
    C(0.1, 0.15, 0.18, x, y + 0.22, z, M(o.shade || '#f6e3b6', { emi: 0.9, side: THREE.DoubleSide }), { open: true });
    halo(x, y + 0.3, z, false);
    light(x, y + 0.32, z, '#ffb35c', o.i ?? 0.6, o.r ?? 3, o.zones);
  }
  function sconce(x, y, z, ry, o = {}) {
    const g = G(x, y, z, ry);
    B(0.1, 0.18, 0.03, 0, -0.09, 0.015, M('#c9a050'), { parent: g });
    C(0.05, 0.1, 0.15, 0, 0.0, 0.11, M(o.shade || '#f3dcae', { emi: 0.9, side: THREE.DoubleSide }), { parent: g, open: true });
    const wx = x + Math.sin(ry) * 0.12, wz = z + Math.cos(ry) * 0.12;
    halo(wx, y + 0.08, wz, false);
    light(x + Math.sin(ry) * 0.3, y + 0.05, z + Math.cos(ry) * 0.3, o.color || '#ffbf6a', o.i ?? 0.7, o.r ?? 3.5, o.zones);
  }
  function fairyLights(x1, y1, z1, x2, y2, z2, n, sag = 0.18) {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      fairy.push(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - Math.sin(t * P) * sag, z1 + (z2 - z1) * t);
    }
  }
  function plant(x, y, z, sz = 1, o = {}) {
    const pot = o.pot || pick(['#b4532d', '#c9785a', '#e9dfc8', '#3d6f8f']);
    C(0.18 * sz, 0.13 * sz, 0.32 * sz, x, y, z, M(pot));
    C(0.17 * sz, 0.17 * sz, 0.02, x, y + 0.31 * sz, z, M('#3a2416'));
    const lc = ['#3f7a3a', '#4f8a43', '#2f6a35', '#5a9a4a'];
    if (o.tall) {
      C(0.02, 0.025, 0.9 * sz, x, y + 0.3 * sz, z, M('#5a3a22'));
      for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 0.18 * sz; S(0.17 * sz, x + Math.cos(a) * r, y + (0.85 + (i % 3) * 0.22) * sz, z + Math.sin(a) * r, M(pick(lc)), { ico: true, sc: [1.2, 0.7, 1] }); }
    } else {
      for (let i = 0; i < 6; i++) { const a = i * 1.05, r = 0.12 * sz; S(0.16 * sz, x + Math.cos(a) * r, y + (0.45 + (i % 2) * 0.12) * sz, z + Math.sin(a) * r, M(pick(lc)), { ico: true, sc: [1, 1.3, 1] }); }
    }
    addCol(x, z, 0.4 * sz, 0.4 * sz, 0, y > 1 ? 1 : 0);
  }
  function frame(x, y, z, ry, w, h, art, fc = '#3b2a1a') {
    const g = G(x, y, z, ry);
    B(w + 0.1, h + 0.1, 0.04, 0, -h / 2 - 0.05, 0.02, M(fc), { parent: g });
    PL(w, h, 0, 0, 0.045, M('#ffffff', { tex: art }), { parent: g });
  }
  function radiator(x, y, z, ry, n = 8) {
    const g = G(x, y, z, ry);
    for (let i = 0; i < n; i++) B(0.07, 0.62, 0.14, (i - (n - 1) / 2) * 0.095, 0.1, 0, M('#d9d1c2'), { parent: g });
    B(n * 0.095, 0.04, 0.12, 0, 0.1, 0, M('#bdb4a4'), { parent: g });
  }
  function books(g, x, y, z, w, dir = 1) {
    let off = -w / 2;
    while (off < w / 2 - 0.05) {
      const bw = 0.03 + rnd() * 0.04, bh = 0.18 + rnd() * 0.1;
      B(bw, bh, 0.2, x + off + bw / 2, y, z, M(pick(['#8c2b2b', '#2c4a74', '#d8b45a', '#3d6f4f', '#6b3a5c', '#e9dfc8', '#c47a3a', '#1f2a36'])), { parent: g });
      off += bw + 0.004;
    }
  }
  function bookshelf(x, y, z, ry, w = 1.4, h = 2.0) {
    const g = G(x, y, z, ry);
    const wd = wood('#5a3a24');
    B(w, h, 0.04, 0, 0, -0.16, wd, { parent: g });
    B(0.04, h, 0.34, -w / 2, 0, 0, wd, { parent: g }); B(0.04, h, 0.34, w / 2, 0, 0, wd, { parent: g });
    const n = Math.round(h / 0.42);
    for (let i = 0; i <= n; i++) {
      B(w, 0.03, 0.34, 0, (i * (h - 0.03)) / n, 0, wd, { parent: g });
      if (i < n) books(g, 0, (i * (h - 0.03)) / n + 0.03, 0, w - 0.1);
    }
    addCol(x, z, w, 0.36, ry, y > 1 ? 1 : 0);
  }
  function chair(x, y, z, ry, c = '#4a2e1c', parent = root) {
    const g = G(x, y, z, ry, parent);
    const w = wood(c);
    B(0.42, 0.05, 0.42, 0, 0.44, 0, w, { parent: g });
    for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) C(0.02, 0.018, 0.44, a, 0, b, w, { parent: g, seg: 6 });
    C(0.018, 0.018, 0.5, -0.18, 0.47, -0.19, w, { parent: g, seg: 6 }); C(0.018, 0.018, 0.5, 0.18, 0.47, -0.19, w, { parent: g, seg: 6 });
    B(0.4, 0.14, 0.03, 0, 0.8, -0.19, w, { parent: g });
    B(0.4, 0.04, 0.03, 0, 0.62, -0.19, w, { parent: g });
    return g;
  }
  function stool(x, y, z, c = '#8a2c2c') {
    C(0.2, 0.2, 0.07, x, y + 0.72, z, fab(c));
    C(0.03, 0.04, 0.72, x, y, z, M('#2a2a2a'));
    C(0.15, 0.15, 0.02, x, y + 0.25, z, M('#555'), { open: true });
    C(0.18, 0.2, 0.03, x, y, z, M('#2a2a2a'));
    addCol(x, z, 0.4, 0.4, 0, y > 1 ? 1 : 0);
  }
  function cup(x, y, z, c = '#f4efe6', parent = root) {
    C(0.045, 0.035, 0.08, x, y, z, M(c), { parent, seg: 8 });
    C(0.07, 0.07, 0.01, x, y, z, M(c), { parent, seg: 10 });
  }
  function bistro(x, z, c = '#2b2b2b') {
    C(0.36, 0.36, 0.04, x, 0.72, z, wood('#6a4026'), { seg: 16 });
    C(0.03, 0.04, 0.72, x, 0, z, M(c)); C(0.22, 0.24, 0.03, x, 0, z, M(c));
    cup(x + 0.1, 0.76, z - 0.05);
    C(0.03, 0.035, 0.07, x - 0.12, 0.76, z + 0.08, M('#f4efe6', { emi: 0.4 }), { seg: 8 });
    addCol(x, z, 0.72, 0.72, 0, 0);
    chair(x - 0.72, 0, z, P / 2); chair(x + 0.72, 0, z, -P / 2);
    addCol(x - 0.72, z, 0.45, 0.45, 0, 0); addCol(x + 0.72, z, 0.45, 0.45, 0, 0);
  }
  function sofaMesh(parent, c, w = 2.2, o = {}) {
    const f = fab(c), fd = fab(mix(c, -0.12)), leg = wood('#3a2416');
    const d = o.d || 0.92;
    B(w, 0.26, d, 0, 0.1, 0, fd, { parent });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(0.035, 0.025, 0.1, a * (w / 2 - 0.1), 0, b * (d / 2 - 0.1), leg, { parent, seg: 6 });
    const n = w > 1.5 ? (w > 2.3 ? 3 : 2) : 1, cw = (w - 0.44) / n;
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + 0.22 + cw * (i + 0.5);
      B(cw - 0.02, 0.16, d - 0.28, cx, 0.36, 0.08, f, { parent });
      B(cw - 0.03, 0.46, 0.2, cx, 0.42, -d / 2 + 0.22, f, { parent, rx: -0.12 });
    }
    B(w, 0.56, 0.16, 0, 0.32, -d / 2 + 0.08, fd, { parent });
    for (const sx of [-1, 1]) {
      B(0.22, 0.34, d, sx * (w / 2 - 0.11), 0.32, 0, fd, { parent });
      C(0.11, 0.11, d, sx * (w / 2 - 0.11), 0.66, 0, f, { parent, rx: P / 2, seg: 10 });
    }
    if (o.pillows) {
      B(0.36, 0.34, 0.12, -w / 2 + 0.45, 0.5, -d / 2 + 0.38, fab(o.pillows[0]), { parent, rx: -0.25, rz: 0.15 });
      B(0.36, 0.34, 0.12, w / 2 - 0.45, 0.5, -d / 2 + 0.38, fab(o.pillows[1]), { parent, rx: -0.25, rz: -0.15 });
    }
  }
  function armchair(x, y, z, ry, c) {
    const g = G(x, y, z, ry);
    sofaMesh(g, c, 0.95, { d: 0.88 });
    addCol(x, z, 0.92, 0.9, ry, y > 1 ? 1 : 0);
  }
  function rug(x, y, z, w, d, t, ry = 0) { const m = PL(w, d, x, y + 0.012, z, M('#ffffff', { tex: t }), { rx: -P / 2 }); m.rotation.z = ry; }
  function coffeeTable(x, y, z, w = 1.2, d = 0.6, ry = 0) {
    const g = G(x, y, z, ry);
    B(w, 0.06, d, 0, 0.38, 0, wood('#6a4026'), { parent: g });
    B(w - 0.1, 0.03, d - 0.1, 0, 0.12, 0, wood('#5a3420'), { parent: g });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(0.05, 0.38, 0.05, a * (w / 2 - 0.06), 0, b * (d / 2 - 0.06), wood('#3a2416'), { parent: g });
    B(0.3, 0.03, 0.22, -0.25, 0.44, 0.05, M('#c9405a'), { parent: g, ry: 0.3 });
    B(0.28, 0.03, 0.2, -0.22, 0.47, 0.02, M('#2f6f8f'), { parent: g, ry: 0.1 });
    cup(0.25, 0.44, -0.05, '#e8b84a', g);
    addCol(x, z, w, d, ry, y > 1 ? 1 : 0);
    return g;
  }

  // =================================================================
  // ESTRUTURA
  // =================================================================
  const X = {
    brick: M('#ffffff', { tex: TX.brick, ts: 1.6 }),
    out: M('#ffffff', { tex: TX.brickDark, ts: 1.6 }),
    hall: { m: M('#ffffff', { tex: TX.hallPaper }), low: M('#ffffff', { tex: TX.panelGreen, ts: 1.0 }), split: 1.05, rail: wood('#2a4a3a') },
    stairIn: M('#cbb894'),
    corr: { m: M('#ffffff', { tex: TX.ochre }), low: M('#ffffff', { tex: TX.panelWood, ts: 1.0 }), split: 0.95, rail: wood('#4a2e1c') },
    livA: M('#ffffff', { tex: TX.lilac }), bedA: M('#ffffff', { tex: TX.roseFlower }),
    bathA: { m: M('#cfe8df'), low: M('#ffffff', { tex: TX.tileMint, ts: 1.0 }), split: 1.35, rail: M('#f4f4f0') },
    livB: M('#ffffff', { tex: TX.sage }), bedB: M('#ffffff', { tex: TX.blueStripe }),
    bathB: { m: M('#f1dcd8'), low: M('#ffffff', { tex: TX.tilePink, ts: 1.0 }), split: 1.35, rail: M('#f4f4f0') },
  };
  const roomA = (x) => (x < 3.5 ? X.bathA : x < 9 ? X.bedA : X.livA);
  const roomB = (x) => (x < 3.5 ? X.bathB : x < 9 ? X.bedB : X.livB);

  // pisos térreo
  floorR(0, 0, 20, 16, 0, M('#ffffff', { tex: TX.woodDark, ts: 1.7 }));
  floorR(20, 0, 28, 16, 0, M('#ffffff', { tex: TX.marble, ts: 1.0 }));
  // laje (teto do térreo) com vão da escada x24..27 z2..12
  const ceilCafe = M('#ffffff', { tex: TX.woodCeil, ts: 1.4 });
  const ceilHall = M('#efe4cc');
  ceilR(0, 0, 20, 16, FH - 0.2, ceilCafe);
  ceilR(20, 0, 24, 16, FH - 0.2, ceilHall); ceilR(27, 0, 28, 16, FH - 0.2, ceilHall);
  ceilR(24, 0, 27, 2, FH - 0.2, ceilHall); ceilR(24, 12, 27, 16, FH - 0.2, ceilHall);
  for (const [x, z, w, d] of [[12, 8, 24, 16], [27.5, 8, 1, 16], [25.5, 1, 3, 2], [25.5, 14, 3, 4]]) addBlocker(x, FH - 0.2, z, w, 0.2, d);
  // vigas do café
  for (let x = 2.5; x < 20; x += 2.5) B(0.18, 0.22, 16, x, FH - 0.42, 8, wood('#3a2416'));
  // teto de cima
  ceilR(0, 0, 28, 16, FH + WH, M('#efe4cc'));
  addBlocker(14, FH + WH, 8, 28, 0.2, 16);
  // sanca no topo das paredes de cima (corredor)
  // ---------- paredes térreo ----------
  const winCafe = [[1.0, 4.6], [5.4, 9.0], [11.6, 15.2], [16.0, 19.4]];
  wall('x', 0, 0, 20, 0, X.out, X.brick, winCafe.map(([a, b]) => ({ a, b, y0: 0.55, y1: 2.55 })));
  for (const [a, b] of winCafe) win('x', 0, a, b, 0, 0.55, 2.55, 1, { frame: '#3a2a20', moon: 0.45 });
  wall('x', 0, 20, 28, 0, X.out, X.hall, [{ a: 24.6, b: 26.4, y0: 1.0, y1: 2.5 }]);
  win('x', 0, 24.6, 26.4, 0, 1.0, 2.5, 1, { frame: '#efe7d6' });
  wall('x', 16, 0, 20, 0, X.brick, X.out);
  wall('x', 16, 20, 28, 0, X.hall, X.out, [{ a: 24.6, b: 26.4, y0: 1.0, y1: 2.5 }]);
  win('x', 16, 24.6, 26.4, 0, 1.0, 2.5, -1);
  wall('z', 0, 0, 16, 0, X.out, X.brick, [{ a: 1.6, b: 4.4, y0: 0.55, y1: 2.55 }]);
  win('z', 0, 1.6, 4.4, 0, 0.55, 2.55, 1, { frame: '#3a2a20' });
  wall('z', 28, 0, 16, 0, X.hall, X.out);
  wall('z', 20, 0, 16, 0, X.brick, X.hall, [{ a: 6, b: 10, y0: 0, y1: 2.6 }]);
  door('z', 20, 6, 10, 0, { h: 2.6, frame: '#3a2416' });
  // escada (paredes laterais no térreo)
  wall('z', 24, 2, 12, 0, X.hall, X.stairIn, [{ a: 9.45, b: 10.55, y0: 0, y1: 2.15 }], WH, { noExt: true });
  wall('z', 27, 2, 12, 0, X.stairIn, X.hall, [], WH, { noExt: true });
  wall('x', 12, 24, 27, 0, X.stairIn, X.hall, [], WH, { noExt: true });
  // degraus com passadeira
  for (let i = 0; i < 16; i++) {
    const z = 2 + 0.3125 + i * 0.625, h = 0.2 * (i + 1);
    B(2.8, h, 0.625, 25.5, 0, z, wood(i % 2 ? '#6a3e24' : '#5e361f'));
    B(1.5, 0.012, 0.625, 25.5, h, z, M('#ffffff', { tex: TX.runner, ts: 1.6 }));
    B(1.5, 0.2, 0.012, 25.5, h - 0.2, z - 0.3125, M('#6e1f29'));
    B(2.86, 0.03, 0.06, 25.5, h - 0.03, z - 0.3, wood('#3a2416'));
  }
  // andar de cima: guarda-corpo do vão
  function railing(axis, c, a1, a2) {
    const y = FH, L = a2 - a1, mid = (a1 + a2) / 2;
    const wd = wood('#4a2e1c');
    if (axis === 'x') { B(L + 0.1, 0.07, 0.1, mid, y + 0.95, c, wd); B(L, 0.05, 0.06, mid, y + 0.05, c, wd); }
    else { B(0.1, 0.07, L + 0.1, c, y + 0.95, mid, wd); B(0.06, 0.05, L, c, y + 0.05, mid, wd); }
    for (let t = a1 + 0.12; t < a2; t += 0.24) {
      if (axis === 'x') C(0.018, 0.018, 0.9, t, y + 0.05, c, M('#efe7d6'), { seg: 6 }); else C(0.018, 0.018, 0.9, c, y + 0.05, t, M('#efe7d6'), { seg: 6 });
    }
    if (axis === 'x') addCol(mid, c, L, 0.12, 0, 1); else addCol(c, mid, 0.12, L, 0, 1);
  }
  railing('z', 24, 2, 12); railing('z', 27, 2, 12); railing('x', 2, 24, 27);
  for (const [x, z] of [[24, 2], [27, 2], [24, 12], [27, 12]]) B(0.13, 1.15, 0.13, x, FH, z, wood('#3a2416'));

  // ---------- andar de cima ----------
  const winA = [
    { a: 13.6, b: 15.6, y0: 0.6, y1: 2.6 }, { a: 17.4, b: 19.4, y0: 0.6, y1: 2.6 },
    { a: 10.0, b: 11.4, y0: 1.2, y1: 2.3 }, { a: 8.1, b: 8.9, y0: 0.9, y1: 2.4 }, { a: 2.3, b: 3.1, y0: 1.5, y1: 2.3 },
  ];
  wall('x', 16, 0, 20, 1, roomA, X.out, winA);
  wall('x', 0, 0, 20, 1, X.out, roomB, winA);
  for (const w of winA) { win('x', 16, w.a, w.b, 1, w.y0, w.y1, -1); win('x', 0, w.a, w.b, 1, w.y0, w.y1, 1); }
  wall('x', 16, 20, 28, 1, X.corr, X.out, [{ a: 21.1, b: 23.3, y0: 0.5, y1: 2.6 }]);
  win('x', 16, 21.1, 23.3, 1, 0.5, 2.6, -1);
  wall('x', 0, 20, 28, 1, X.out, X.corr);
  wall('z', 0, 0, 16, 1, X.out, (m) => (m < 7 ? X.bathB : m < 9 ? X.corr : X.bathA));
  wall('z', 28, 0, 16, 1, X.corr, X.out);
  wall('z', 20, 0, 16, 1, (m) => (m < 7 ? X.livB : m < 9 ? X.corr : X.livA), X.corr, [{ a: 7, b: 9, y0: 0, y1: 2.4 }]);
  door('z', 20, 7, 9, 1, { h: 2.4 });
  // corredor
  wall('x', 7, 0, 20, 1, roomB, X.corr, [{ a: 15, b: 16.2, y0: 0, y1: 2.2 }]);
  wall('x', 9, 0, 20, 1, X.corr, roomA, [{ a: 15, b: 16.2, y0: 0, y1: 2.2 }]);
  door('x', 9, 15, 16.2, 1, { leaf: '#3f7a5a', swing: 1, peep: true, number: '3A' });
  door('x', 7, 15, 16.2, 1, { leaf: '#3f7a5a', swing: -1, peep: true, number: '3B' });
  floorR(0, 7, 20, 9, 1, M('#ffffff', { tex: TX.runner, ts: 2.0 }));
  floorR(20, 0, 24, 16, 1, M('#ffffff', { tex: TX.woodHoney, ts: 1.6 }));
  floorR(24, 12, 28, 16, 1, M('#ffffff', { tex: TX.woodHoney, ts: 1.6 }));
  floorR(27, 0, 28, 12, 1, M('#ffffff', { tex: TX.woodHoney, ts: 1.6 }));
  floorR(24, 0, 27, 2, 1, M('#ffffff', { tex: TX.woodHoney, ts: 1.6 }));

  // ---------- apartamentos ----------
  function apartment(mirror) {
    const Z = (z) => (mirror ? 16 - z : z);
    const Gp = (a, b) => (mirror ? { a: 16 - b, b: 16 - a } : { a, b });
    const R = (r) => (mirror ? P - r : r);
    const zl = mirror ? 0 : 9, zh = mirror ? 7 : 16;
    const y = FH;
    const liv = mirror ? X.livB : X.livA, bed = mirror ? X.bedB : X.bedA, bath = mirror ? X.bathB : X.bathA;
    const pal = mirror
      ? { sofa: '#c99a3a', arm: '#a8492f', rug: TX.rugB, floor: TX.woodAsh, kfloor: TX.checkMustard, bfloor: TX.tilePink, cab: '#c96f4a', duvet: '#5f86b0', zone: 'B', fridge: '#e9d3a0' }
      : { sofa: '#2f6a6e', arm: '#c9963a', rug: TX.rugA, floor: TX.woodHoney, kfloor: TX.checkBW, bfloor: TX.tileMint, cab: '#4a8f8a', duvet: '#b5523b', zone: 'A', fridge: '#efe3c4' };
    const zLiv = ['liv' + pal.zone, 'kit' + pal.zone];
    // paredes internas (lado A = x menor)
    wall('z', 3.5, zl, zh, 1, bath, bed, [{ ...Gp(14.2, 15.4), y0: 0, y1: 2.2 }]);
    wall('z', 9, zl, zh, 1, bed, liv, [{ ...Gp(13.5, 14.7), y0: 0, y1: 2.2 }]);
    wall('z', 13, zl, zh, 1, liv, liv, [{ ...Gp(9.6, 13.2), y0: 0, y1: 2.5 }]);
    door('z', 3.5, Gp(14.2, 15.4).a, Gp(14.2, 15.4).b, 1, { leaf: '#efe7d6', swing: 1 });
    door('z', 9, Gp(13.5, 14.7).a, Gp(13.5, 14.7).b, 1, { leaf: '#efe7d6', swing: -1 });
    door('z', 13, Gp(9.6, 13.2).a, Gp(9.6, 13.2).b, 1, { h: 2.5 });
    // pisos
    floorR(0, zl, 3.5, zh, 1, M('#ffffff', { tex: pal.bfloor, ts: 0.9 }));
    floorR(3.5, zl, 9, zh, 1, M('#ffffff', { tex: pal.floor, ts: 1.6 }));
    floorR(9, zl, 13, zh, 1, M('#ffffff', { tex: pal.kfloor, ts: 0.9 }));
    floorR(13, zl, 20, zh, 1, M('#ffffff', { tex: pal.floor, ts: 1.6 }));
    // ===== sala =====
    coffeeTable(16.4, y, Z(13.4));
    rug(16.4, y, Z(13.0), 3.6, 2.6, pal.rug);
    const tv = G(16.5, y, Z(15.6), R(P));
    B(1.4, 0.5, 0.45, 0, 0, 0, wood('#5a3a24'), { parent: tv });
    B(0.4, 0.02, 0.36, -0.35, 0.18, 0.02, M('#2a2a2a'), { parent: tv });
    B(0.8, 0.62, 0.55, 0.05, 0.5, 0, M('#3a3530'), { parent: tv });
    PL(0.6, 0.45, 0.05, 0.82, 0.28, M('#ffffff', { tex: TX.tvTex, unlit: true }), { parent: tv });
    C(0.008, 0.008, 0.45, -0.05, 1.3, 0, M('#888'), { parent: tv, rz: 0.5 }); C(0.008, 0.008, 0.45, 0.15, 1.3, 0, M('#888'), { parent: tv, rz: -0.5 });
    addCol(16.5, Z(15.6), 1.4, 0.5, 0, 1);
    light(16.5, y + 0.9, Z(15.0), '#8fb8ff', 0.35, 2.6, zLiv);
    armchair(19.0, y, Z(12.6), mirror ? -P / 2 : -P / 2, pal.arm);
    B(0.42, 0.55, 0.42, 19.5, y, Z(13.75), wood('#5a3a24'), { col: 1 });
    tableLamp(19.5, y + 0.55, Z(13.75), { zones: zLiv });
    floorLamp(14.6, y, Z(12.2), { zones: zLiv });
    bookshelf(19.75, y, Z(10.5), -P / 2, 1.4, 2.1);
    plant(14.25, y, Z(15.45), 1.1, { tall: true });
    frame(17.3, y + 2.1, Z(9.12), R(0), 1.1, 0.8, TX.art[mirror ? 4 : 0]);
    frame(14.0, y + 1.95, Z(9.12), R(0), 0.5, 0.65, TX.art[mirror ? 5 : 3]);
    pendant(16.4, y + WH, Z(13.4), { drum: true, shade: mirror ? '#f6e3b6' : '#e9c9f0', len: 0.3, i: 1.5, r: 7.5, zones: zLiv });
    fairyLights(13.6, y + 2.75, Z(15.82), 19.4, y + 2.75, Z(15.82), 26);
    radiator(16.5, y, Z(15.84), R(P), 6);
    // ===== cozinha =====
    const kz = Z(15.6);
    B(2.2, 0.86, 0.6, 10.3, y, kz, wood(pal.cab), { col: 1 });
    for (let i = 0; i < 3; i++) { B(0.6, 0.62, 0.02, 9.55 + i * 0.7, y + 0.12, Z(15.29), wood(mix(pal.cab, 0.1)), { ry: R(0) }); S(0.025, 9.55 + i * 0.7 + 0.2, y + 0.65, Z(15.27), M('#d8b45a')); }
    B(2.24, 0.05, 0.64, 10.3, y + 0.86, kz, M('#e9e4d8'));
    B(0.55, 0.06, 0.4, 10.0, y + 0.86, kz, M('#9aa3a8')); // pia
    C(0.015, 0.015, 0.3, 10.0, y + 0.9, Z(15.8), M('#c9c9c9'));
    B(0.68, 0.9, 0.62, 11.75, y, kz, M('#efe9dc'), { col: 1 }); // fogão
    C(0.09, 0.11, 0.16, 11.6, y + 0.91, Z(15.45), M(mirror ? '#c9405a' : '#e8b84a')); // chaleira
    C(0.16, 0.13, 0.1, 9.6, y + 0.91, Z(15.55), M('#efe7d6'));
    for (let k = 0; k < 3; k++) S(0.05, 9.55 + k * 0.06, y + 1.02, Z(15.55 + (k % 2) * 0.04), M(['#e85d2a', '#f2c14e', '#7fb03a'][k]));
    B(0.5, 0.36, 0.02, 11.75, y + 0.2, Z(15.28), M('#2a2a2a'));
    for (let k = 0; k < 4; k++) C(0.08, 0.08, 0.015, 11.6 + (k % 2) * 0.3, y + 0.9, Z(15.45 + Math.floor(k / 2) * 0.28), M('#1d1d1d'));
    for (let k = 0; k < 4; k++) S(0.022, 11.5 + k * 0.17, y + 0.8, Z(15.28), M('#2a2a2a'));
    B(2.9, 0.3, 0.02, 10.6, y + 0.91, Z(15.89), M('#ffffff', { tex: TX.tileMint, ts: 0.6 }));
    B(0.8, 0.75, 0.34, 9.55, y + 1.55, Z(15.73), wood(pal.cab));
    B(0.6, 0.75, 0.34, 11.75, y + 1.55, Z(15.73), wood(pal.cab));
    // geladeira retrô
    B(0.76, 1.55, 0.7, 12.52, y, Z(15.45), M(pal.fridge), { col: 1 });
    C(0.35, 0.35, 0.76, 12.52, y + 1.54, Z(15.45), M(pal.fridge), { rz: P / 2, ts: 0, tl: P });
    B(0.03, 0.4, 0.04, 12.22, y + 0.9, Z(15.08), M('#d0d0d0'));
    B(0.74, 0.01, 0.02, 12.52, y + 1.2, Z(15.1), M('#c9c0a8'));
    pendant(11.0, y + WH, Z(12.3), { shade: pal.cab, len: 0.95, i: 1.4, r: 6.5, zones: zLiv });
    light(10.7, y + 1.45, Z(15.5), '#ffd9a0', 0.5, 2.4, zLiv);
    // relógio
    const ck = G(9.12, y + 2.1, Z(11.0), P / 2);
    C(0.18, 0.18, 0.04, 0, 0, 0, M('#efe7d6'), { parent: ck, rx: P / 2 });
    B(0.015, 0.12, 0.01, 0, -0.02, 0.03, M('#222'), { parent: ck }); B(0.09, 0.015, 0.01, 0.04, 0, 0.03, M('#222'), { parent: ck });
    // ===== quarto =====
    for (const nx of [4.95, 7.65]) {
      B(0.5, 0.5, 0.42, nx, y, Z(15.65), wood('#6a4026'), { col: 1 });
      B(0.42, 0.02, 0.02, nx, y + 0.32, Z(15.43), M('#d8b45a'));
      tableLamp(nx, y + 0.5, Z(15.65), { shade: '#f6e3b6', zones: ['bed' + pal.zone] });
    }
    const dr = G(8.72, y, Z(11.0), -P / 2);
    B(1.3, 0.85, 0.5, 0, 0, 0, wood('#7a4a2c'), { parent: dr });
    for (let k = 0; k < 3; k++) { B(1.2, 0.22, 0.02, 0, 0.08 + k * 0.26, 0.255, wood('#8a5a36'), { parent: dr }); S(0.025, -0.3, 0.2 + k * 0.26, 0.27, M('#d8b45a'), { parent: dr }); S(0.025, 0.3, 0.2 + k * 0.26, 0.27, M('#d8b45a'), { parent: dr }); }
    B(0.7, 0.85, 0.04, 0, 1.0, -0.2, wood('#5a3a24'), { parent: dr });
    PL(0.6, 0.75, 0, 1.425, -0.17, M('#9fb4c4', { emi: 0.25 }), { parent: dr });
    C(0.05, 0.04, 0.16, 0.4, 0.85, 0, M('#e85d75'), { parent: dr });
    addCol(8.72, Z(11.0), 1.3, 0.5, P / 2, 1);
    rug(6.3, y, Z(12.4), 2.6, 1.6, mirror ? TX.rugC : TX.rugB);
    frame(6.3, y + 2.35, Z(15.88), R(P), 0.9, 0.6, TX.art[mirror ? 1 : 2]);
    plant(8.55, y, Z(9.5), 0.9);
    pendant(6.3, y + WH, Z(12.6), { drum: true, shade: '#f6e3b6', len: 0.35, i: 1.2, r: 6.5, zones: ['bed' + pal.zone] });
    // ===== banheiro =====
    const wc = G(2.9, y, Z(9.5), R(0));
    B(0.42, 0.38, 0.55, 0, 0, 0.12, M('#f4f4f0'), { parent: wc });
    B(0.46, 0.04, 0.5, 0, 0.38, 0.14, M('#f4f4f0'), { parent: wc });
    B(0.44, 0.45, 0.2, 0, 0.42, -0.18, M('#f4f4f0'), { parent: wc });
    addCol(2.9, Z(9.6), 0.45, 0.6, 0, 1);
    const sk = G(1.4, y, Z(15.7), R(P));
    C(0.08, 0.12, 0.75, 0, 0, 0.05, M('#f4f4f0'), { parent: sk });
    B(0.6, 0.14, 0.42, 0, 0.75, 0, M('#f4f4f0'), { parent: sk });
    PL(0.5, 0.7, 0, 1.55, -0.17, M('#a9c4d4', { emi: 0.3 }), { parent: sk });
    B(0.6, 0.06, 0.04, 0, 1.92, -0.18, M('#d8b45a'), { parent: sk });
    addCol(1.4, Z(15.7), 0.6, 0.45, 0, 1);
    B(0.04, 0.04, 0.6, 3.36, y + 1.25, Z(11.5), M('#c9c9c9'));
    B(0.03, 0.6, 0.5, 3.36, y + 0.68, Z(11.5), M(mirror ? '#f2c14e' : '#e07a5f'));
    rug(1.65, y, Z(12.5), 0.6, 1.0, mirror ? TX.rugB : TX.rugC);
    pendant(1.8, y + WH, Z(12.5), { drum: true, shade: '#ffffff', len: 0.25, i: 1.1, r: 5, color: '#ffe2b8', zones: ['bath' + pal.zone] });
    plant(2.7, y + 1.53, Z(15.8), 0.45);
  }
  apartment(false);
  apartment(true);
  // tetos rebaixados? não — teto único. Corredor:
  for (const x of [3, 7.5, 12, 18.5]) { sconce(x, FH + 2.0, 7.12, 0, { zones: ['corr'] }); sconce(x + 1.5, FH + 2.0, 8.88, P, { zones: ['corr'] }); }
  radiator(10, FH, 7.18, 0);
  B(1.0, 0.8, 0.34, 6, FH, 8.72, wood('#5a3a24'), { col: 1 });
  C(0.06, 0.08, 0.25, 6.2, FH + 0.8, 8.72, M('#3d6f8f')); S(0.12, 6.2, FH + 1.15, 8.72, M('#e85d75'), { ico: true });
  frame(6, FH + 1.85, 8.88, P, 0.7, 0.5, TX.art[4]); frame(13, FH + 1.85, 7.12, 0, 0.7, 0.5, TX.art[2]);
  frame(2, FH + 1.85, 8.88, P, 0.5, 0.65, TX.art[5]);
  for (const [nm, z, ry] of [['3A', 8.88, P], ['3B', 7.12, 0]]) {
    const t = tex((gg, w, h) => { gg.fillStyle = '#d8b45a'; gg.fillRect(0, 0, w, h); gg.strokeStyle = '#8a6a2a'; gg.lineWidth = 4; gg.strokeRect(3, 3, w - 6, h - 6); gg.fillStyle = '#3a2416'; gg.font = 'bold 40px Georgia, serif'; gg.textAlign = 'center'; gg.fillText(nm, w / 2, 46); }, 96, 64, { clamp: true });
    PL(0.24, 0.16, 14.55, FH + 1.6, z + (ry ? -0.01 : 0.01), M('#ffffff', { tex: t, emi: 0.3 }), { ry });
  }
  // patamar
  plant(27.5, FH, 15.5, 1.1, { tall: true });
  radiator(22.2, FH, 15.84, P, 7);
  sconce(20.12, FH + 2.0, 11.5, P / 2, { zones: ['land'] }); sconce(20.12, FH + 2.0, 4.5, P / 2, { zones: ['land'] });
  pendant(22.0, FH + WH, 8.0, { len: 0.6, shade: '#c9a050', i: 1.2, r: 7, zones: ['land'] });
  pendant(25.5, FH + WH, 14.0, { len: 0.6, shade: '#c9a050', i: 1.1, r: 6, zones: ['land'] });
  frame(27.88, FH + 1.8, 6, -P / 2, 0.8, 0.6, TX.art[1]);

  // =================================================================
  // CAFÉ
  // =================================================================
  // balcão
  B(8.4, 1.0, 0.7, 4.4, 0, 11.55, wood('#6b3b22'), { col: 0 });
  for (let x = 0.4; x < 8.6; x += 0.42) B(0.04, 0.85, 0.02, x, 0.06, 11.19, wood('#4a2a18'));
  B(8.6, 0.06, 0.86, 4.4, 1.0, 11.55, M('#2a1c14'));
  C(0.025, 0.025, 8.2, 4.4, 0.2, 11.05, M('#d8b45a'), { rz: P / 2, seg: 8 });
  // vitrine de doces
  B(1.5, 0.42, 0.55, 2.0, 1.06, 11.55, M('#cfe6f5', { alpha: 0.35 }));
  for (let k = 0; k < 5; k++) C(0.09, 0.11, 0.08, 1.45 + k * 0.28, 1.08, 11.5, M(['#e8b84a', '#b5523b', '#f2d5a0', '#7a4a2c', '#e85d75'][k]));
  for (let k = 0; k < 4; k++) S(0.05, 1.5 + k * 0.33, 1.27, 11.6, M(['#f2d5a0', '#c47a3a', '#f4efe6', '#e8b84a'][k]));
  // caixa registradora + pote de gorjeta
  B(0.45, 0.25, 0.38, 6.8, 1.06, 11.5, M('#b87333'));
  B(0.4, 0.12, 0.2, 6.8, 1.31, 11.42, M('#8a5428'), { rx: -0.4 });
  C(0.06, 0.06, 0.14, 7.5, 1.06, 11.4, M('#cfe6f5', { alpha: 0.5 }));
  for (let k = 0; k < 6; k++) cup(3.3 + k * 0.18, 1.06, 11.7);
  // banquetas
  for (let k = 0; k < 5; k++) stool(1.2 + k * 1.6, 0, 10.6);
  // bancada de trás + máquina de espresso
  B(8.8, 0.9, 0.6, 4.6, 0, 15.6, wood('#3a2416'), { col: 0 });
  B(8.9, 0.05, 0.65, 4.6, 0.9, 15.6, M('#2a1c14'));
  const em = G(3.2, 0.95, 15.55, P);
  B(0.95, 0.5, 0.5, 0, 0, 0, M('#b9b9b9'), { parent: em });
  B(0.95, 0.06, 0.52, 0, 0.5, 0, M('#d8b45a'), { parent: em });
  for (let k = 0; k < 2; k++) { C(0.04, 0.04, 0.08, -0.22 + k * 0.44, 0.15, 0.3, M('#222'), { parent: em }); cup(-0.22 + k * 0.44, 0.0, 0.32, '#f4efe6', em); }
  for (let k = 0; k < 6; k++) cup(-0.35 + k * 0.14, 0.56, 0, k % 2 ? '#b5523b' : '#f4efe6', em);
  C(0.1, 0.12, 0.35, 4.5, 0.95, 15.6, M('#2a2a2a')); C(0.12, 0.08, 0.15, 4.5, 1.3, 15.6, M('#cfe6f5', { alpha: 0.6 }));
  // prateleiras com potes e xícaras
  for (const yy of [1.55, 2.1]) {
    B(8, 0.05, 0.3, 4.6, yy, 15.75, wood('#5a3420'));
    for (let k = 0; k < 12; k++) {
      const x = 1.0 + k * 0.62;
      if (k % 3 === 0) C(0.08, 0.08, 0.22, x, yy + 0.05, 15.75, M(pick(['#cfe6f5', '#e9dfc8'])), { seg: 8 });
      else cup(x, yy + 0.05, 15.75, k % 2 ? '#f4efe6' : '#b5523b');
    }
  }
  // lousa de cardápio
  B(2.3, 1.55, 0.04, 14, 1.0, 15.9, wood('#5a3a24'));
  PL(1.95, 1.4, 14, 1.78, 15.87, M('#ffffff', { tex: TX.chalk, emi: 0.15 }), { ry: P });
  // luzes do balcão
  for (const x of [1.8, 4.4, 7.0]) pendant(x, FH - 0.2, 11.5, { len: 0.85, shade: '#2f5a46', i: 1.25, r: 6, zones: ['cafe'] });
  sconce(2.5, 2.05, 15.88, P, { zones: ['cafe'] }); sconce(7.5, 2.05, 15.88, P, { zones: ['cafe'] });
  // sala de estar do café (o sofazão é um esconderijo)
  rug(12, 0, 6.0, 5.0, 4.2, TX.rugA);
  coffeeTable(12, 0, 6.0, 1.3, 0.65);
  armchair(9.9, 0, 6.4, P / 2, '#c9963a');
  armchair(14.1, 0, 6.4, -P / 2, '#2f6f6a');
  floorLamp(10.3, 0, 4.3, { zones: ['cafe'] });
  floorLamp(13.75, 0, 4.3, { zones: ['cafe'] });
  // mesinhas na janela
  bistro(3, 1.7); bistro(7, 1.7); bistro(17.5, 1.8);
  for (const [x, z] of [[3, 1.7], [7, 1.7], [17.5, 1.8]]) pendant(x, FH - 0.2, z, { len: 0.75, shade: '#b5523b', i: 0.9, r: 4.5, zones: ['cafe'] });
  pendant(4.4, FH - 0.2, 6.4, { len: 0.7, shade: '#2f5a46', i: 1.2, r: 6, zones: ['cafe'] });
  pendant(17.0, FH - 0.2, 8.5, { len: 0.7, shade: '#2f5a46', i: 1.2, r: 6, zones: ['cafe'] });
  // cantinho do fundo
  const ls = G(13.3, 0, 15.3, P); sofaMesh(ls, '#8a3f5c', 1.6, { pillows: ['#e8b84a', '#e9dfc8'] }); addCol(13.3, 15.3, 1.6, 0.92, 0, 0);
  coffeeTable(13.3, 0, 14.15, 0.8, 0.5);
  floorLamp(14.65, 0, 15.45, { zones: ['cafe'], shade: '#e9c9a0' });
  bookshelf(0.3, 0, 8.0, P / 2, 1.8, 2.2);
  plant(0.6, 0, 0.6, 1.2, { tall: true }); plant(19.4, 0, 0.6, 1.1, { tall: true }); plant(0.6, 0, 10.35, 1); plant(9.9, 0, 15.45, 1.1);
  // jukebox
  const jb = G(19.5, 0, 12.4, -P / 2);
  B(0.85, 1.25, 0.6, 0, 0, 0, wood('#7a2a1e'), { parent: jb });
  C(0.425, 0.425, 0.6, 0, 1.25, 0, wood('#7a2a1e'), { parent: jb, rx: P / 2, ts: P / 2, tl: P });
  PL(0.7, 1.35, 0, 0.95, 0.305, M('#ffffff', { tex: TX.juke, unlit: true }), { parent: jb });
  addCol(19.5, 12.4, 0.85, 0.6, P / 2, 0);
  light(18.9, 1.0, 12.4, '#ff7aa0', 0.7, 3.2, ['cafe']);
  halo(19.1, 1.2, 12.4, true);
  // letreiro neon na vitrine
  PL(1.9, 0.48, 13.4, 2.05, 0.3, M('#ffffff', { tex: TX.neon, unlit: true, add: true }), {});
  light(13.4, 2.0, 0.8, '#ff8a3c', 0.8, 4, ['cafe']);
  fairyLights(1.0, 2.68, 0.3, 9.0, 2.68, 0.3, 20, 0.14); fairyLights(11.6, 2.68, 0.3, 19.4, 2.68, 0.3, 20, 0.14);
  // quadros nos tijolos
  frame(0.12, 2.0, 12.6, P / 2, 0.8, 0.6, TX.art[5]); frame(19.88, 2.0, 4.6, -P / 2, 1.0, 0.75, TX.art[0]);
  frame(19.88, 2.0, 15.0, -P / 2, 0.6, 0.45, TX.art[3]); frame(10.8, 2.15, 15.88, P, 0.9, 0.65, TX.art[1]);
  sconce(0.12, 2.1, 5.5, P / 2, { zones: ['cafe'] }); sconce(19.88, 2.1, 10.7, -P / 2, { zones: ['cafe'] });
  // ventilador de teto (gira)
  const fan = G(12, FH - 0.2, 6.0, 0);
  C(0.015, 0.015, 0.35, 0, -0.35, 0, M('#2a2420'), { parent: fan });
  C(0.1, 0.12, 0.14, 0, -0.48, 0, wood('#4a2e1c'), { parent: fan });
  const blades = G(0, -0.43, 0, 0, fan);
  for (let k = 0; k < 4; k++) B(0.75, 0.015, 0.16, Math.cos((k * P) / 2) * 0.45, 0, Math.sin((k * P) / 2) * 0.45, wood('#6a4026'), { parent: blades, ry: (-k * P) / 2 });
  fans.push(blades);
  // porta da rua (café) e luz do toldo
  const cd = G(10.3, 0, 0.13, 0);
  B(1.3, 2.3, 0.06, 0, 0, 0, wood('#3a2416'), { parent: cd });
  PL(0.9, 1.1, 0, 1.45, 0.035, glassMat, { parent: cd }).userData.glass = true;
  B(0.04, 0.04, 0.2, 0.5, 1.05, 0.12, M('#d8b45a'), { parent: cd });

  // =================================================================
  // HALL
  // =================================================================
  const hd = G(22.1, 0, 0.13, 0);
  B(1.4, 2.3, 0.06, 0, 0, 0, wood('#2f4a3a'), { parent: hd });
  PL(0.9, 1.1, 0, 1.45, 0.035, glassMat, { parent: hd }).userData.glass = true;
  B(0.04, 0.04, 0.2, 0.55, 1.05, 0.12, M('#d8b45a'), { parent: hd });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { B(0.3, 0.26, 0.05, 20.13, 1.0 + r * 0.29, 2.6 + c * 0.32, M('#b08a3a'), { ry: P / 2 }); }
  radiator(20.18, 0, 11.4, P / 2, 7);
  plant(20.6, 0, 0.6, 1.1); plant(27.4, 0, 15.4, 1.2, { tall: true });
  C(0.14, 0.12, 0.5, 23.3, 0, 0.45, M('#3a3a3a'), { col: 0 });
  C(0.012, 0.012, 0.75, 23.25, 0.55, 0.45, M('#b5523b'), { rz: 0.1 }); C(0.012, 0.012, 0.75, 23.35, 0.55, 0.45, M('#2c4a74'), { rz: -0.1 });
  rug(22.1, 0, 2.2, 1.6, 2.4, TX.rugC);
  pendant(22.2, FH - 0.2, 3.5, { len: 0.6, shade: '#c9a050', i: 1.2, r: 7, zones: ['hall'] });
  pendant(22.6, FH - 0.2, 13.0, { len: 0.6, shade: '#c9a050', i: 1.2, r: 7, zones: ['hall'] });
  sconce(27.88, 2.0, 12.6, -P / 2, { zones: ['hall'] });
  light(25.5, 2.2, 6, '#ffcf8a', 0.7, 6, ['hall']);
  frame(20.12, 1.9, 13.4, P / 2, 0.7, 0.5, TX.art[4]);

  // =================================================================
  // LADO DE FORA: céu, rua, chuva
  // =================================================================
  const outside = new THREE.Group(); scene.add(outside);
  const skyMat = new THREE.MeshBasicMaterial({ map: TX.sky, fog: false });
  TX.sky.wrapS = THREE.RepeatWrapping;
  for (const [x, z, ry, w] of [[14, -16, 0, 80], [14, 32, P, 80], [-16, 8, P / 2, 60], [44, 8, -P / 2, 60]]) {
    const g = new THREE.PlaneGeometry(w, 34); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (w / 40));
    const m = new THREE.Mesh(g, skyMat); m.position.set(x, 12, z); m.rotation.y = ry; outside.add(m);
  }
  TX.street.repeat.set(6, 3);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshBasicMaterial({ map: TX.street, color: '#9a9aa8' }));
  street.rotation.x = -P / 2; street.position.set(14, -0.08, 8); outside.add(street);
  const walkM = new THREE.MeshBasicMaterial({ color: '#2b2a2e' });
  for (const z of [-1.4, 17.4]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(60, 0.1, 2.8), walkM); sw.position.set(14, -0.06, z); outside.add(sw); }
  for (const [x, z] of [[4, -2.5], [16, -2.5], [27, -2.5], [8, 18.5], [22, 18.5]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), new THREE.MeshBasicMaterial({ color: '#1a1a1f' })); pole.position.set(x, 2.1, z); outside.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe0a0' })); head.position.set(x, 4.25, z); outside.add(head);
    halo(x, 4.25, z, true); halo(x, 4.25, z, true);
  }
  // chuva (linhas caindo do lado de fora)
  const RN = 420, rainPos = new Float32Array(RN * 6), rainV = new Float32Array(RN);
  for (let i = 0; i < RN; i++) {
    const front = i % 2 === 0;
    const x = -2 + rnd() * 32, z = front ? -0.5 - rnd() * 4 : 16.5 + rnd() * 4, y = -0.2 + rnd() * 7.5;
    rainPos.set([x, y, z, x - 0.03, y - 0.45, z], i * 6); rainV[i] = 9 + rnd() * 4;
  }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#9fb4dc', transparent: true, opacity: 0.35 }));
  rain.frustumCulled = false; outside.add(rain);

  // =================================================================
  // ESCONDERIJOS
  // =================================================================
  for (const s of SPOTS) buildSpot(s);

  function colLocal(s, lx, lz, w, d) {
    const c = Math.cos(s.r), sn = Math.sin(s.r);
    addCol(s.x + lx * c + lz * sn, s.z - lx * sn + lz * c, w, d, s.r, s.level);
  }
  function buildSpot(s) {
    const g = G(s.x, s.y, s.z, s.r);
    const fx = { s, kind: s.kind, g, parts: {}, dyn: [], mats: [], set: () => {} };
    const isA = s.id.startsWith('a_'), isB = s.id.startsWith('b_');
    switch (s.kind) {
      case 'wardrobe': {
        const wd = wood(isB ? '#7a5a3c' : '#6a4026'), dk = wood('#3a2416');
        B(1.4, 2.15, 0.62, 0, 0.08, -0.02, wd, { parent: g });
        B(1.52, 0.1, 0.72, 0, 2.23, -0.02, dk, { parent: g });
        B(1.46, 0.08, 0.66, 0, 0, -0.02, dk, { parent: g });
        const doors = [];
        for (const side of [-1, 1]) {
          const pv = G(side * 0.69, 0, 0.3, 0, g);
          const dm = wood(isB ? '#8a6a4a' : '#8a5a36');
          B(0.06, 2.0, 0.04, -side * 0.03, 0.12, 0.02, dm, { parent: pv });
          B(0.06, 2.0, 0.04, -side * 0.65, 0.12, 0.02, dm, { parent: pv });
          B(0.68, 0.08, 0.04, -side * 0.34, 0.12, 0.02, dm, { parent: pv });
          B(0.68, 0.08, 0.04, -side * 0.34, 2.04, 0.02, dm, { parent: pv });
          B(0.68, 0.06, 0.04, -side * 0.34, 1.1, 0.02, dm, { parent: pv });
          for (let k = 0; k < 14; k++) { const yy = 0.24 + k * 0.13 + (k > 6 ? 0.05 : 0); B(0.58, 0.035, 0.07, -side * 0.34, yy, 0.02, dm, { parent: pv, rx: 0.5 }); }
          C(0.012, 0.012, 0.2, -side * 0.1, 0.95, 0.07, M('#d8b45a'), { parent: pv, seg: 6 });
          doors.push({ pv, side });
          fx.dyn.push(pv);
        }
        S(0.2, 0.45, 2.45, 0, M('#b98a55'), { parent: g, sc: [1.2, 0.8, 1] }); // caixa em cima
        fx.set = (o) => { for (const d of doors) d.pv.rotation.y = d.side * o * 1.9; };
        colLocal(s, 0, 0, 1.45, 0.66);
        break;
      }
      case 'pantry':
      case 'closet': {
        const w = 1.0, d = 0.78, h = s.id === 'h_under' ? 2.05 : 2.1;
        const c = s.kind === 'pantry' ? (isB ? '#c96f4a' : '#4a8f8a') : s.id === 'h_under' ? '#2f4a3a' : '#efe7d6';
        const body = wood(mix(c, -0.1));
        B(w, h, d, 0, 0, 0, body, { parent: g });
        B(w + 0.1, 0.06, d + 0.06, 0, h, 0, wood(mix(c, -0.3)), { parent: g });
        const pv = G(-w / 2 + 0.02, 0, d / 2, 0, g);
        const dm = wood(c);
        B(w - 0.06, h - 0.1, 0.04, w / 2 - 0.02, 0.05, 0.02, dm, { parent: pv });
        for (const [py, ph] of [[0.2, 0.75], [1.1, h - 1.35]]) B(w - 0.3, ph, 0.03, w / 2 - 0.02, py, 0.05, wood(mix(c, 0.12)), { parent: pv });
        if (s.kind === 'pantry') for (let k = 0; k < 6; k++) B(w - 0.3, 0.02, 0.04, w / 2 - 0.02, 1.2 + k * 0.1, 0.07, wood(mix(c, -0.2)), { parent: pv });
        S(0.035, w - 0.14, 1.0, 0.08, M('#d8b45a'), { parent: pv });
        fx.dyn.push(pv);
        fx.set = (o) => { pv.rotation.y = -o * 1.75; };
        if (s.id !== 'h_under') colLocal(s, 0, 0, w, d); else colLocal(s, 0, 0, w, d);
        break;
      }
      case 'bed': {
        const fr = wood(isB ? '#7a5a3c' : '#5a3420');
        for (const [a, b] of [[-0.75, -0.98], [0.75, -0.98], [-0.75, 0.98], [0.75, 0.98]]) B(0.08, 0.4, 0.08, a, 0, b, fr, { parent: g });
        // cabeceira
        B(1.72, 1.15, 0.08, 0, 0, -1.08, fr, { parent: g });
        for (let k = 0; k < 4; k++) B(0.32, 0.5, 0.03, -0.6 + k * 0.4, 0.55, -1.03, wood(isB ? '#8a6a4a' : '#6a4026'), { parent: g });
        const top = G(0, 0.38, -1.0, 0, g);
        B(1.62, 0.14, 2.06, 0, 0, 1.0, fr, { parent: top });
        B(1.52, 0.22, 1.98, 0, 0.14, 1.0, fab('#f4efe2'), { parent: top });
        const duv = isB ? '#5f86b0' : isA ? '#b5523b' : '#7a8f5a';
        B(1.64, 0.1, 1.4, 0, 0.34, 1.32, fab(duv), { parent: top });
        B(1.64, 0.3, 0.03, 0, 0.12, 2.03, fab(duv), { parent: top });
        for (const sx of [-1, 1]) B(0.03, 0.34, 1.4, sx * 0.82, 0.1, 1.32, fab(duv), { parent: top });
        B(0.6, 0.14, 0.36, -0.38, 0.36, 0.28, fab('#ffffff'), { parent: top, rx: -0.1 });
        B(0.6, 0.14, 0.36, 0.38, 0.36, 0.28, fab('#ffffff'), { parent: top, rx: -0.1 });
        B(0.5, 0.03, 0.5, 0.2, 0.44, 1.6, fab('#e8b84a'), { parent: top, ry: 0.4 }); // mantinha dobrada
        // saia (esconde o vão embaixo)
        for (const sx of [-1, 1]) B(0.02, 0.3, 2.0, sx * 0.81, -0.28, 1.0, fab(mix(duv, 0.35)), { parent: top });
        fx.dyn.push(top);
        fx.set = (o) => { top.rotation.x = -o * 0.62; };
        colLocal(s, 0, 0, 1.62, 2.12);
        break;
      }
      case 'table': {
        const ct = s.id.startsWith('c_') ? TX.ginghamRed : isB ? TX.ginghamRed : TX.ginghamBlue;
        const cm = M('#ffffff', { tex: ct, side: THREE.DoubleSide });
        B(1.0, 0.05, 1.8, 0, 0.74, 0, wood('#5a3420'), { parent: g });
        PL(1.08, 1.88, 0, 0.8, 0, cm, { parent: g, rx: -P / 2 });
        for (const sx of [-1, 1]) PL(1.88, 0.72, sx * 0.54, 0.44, 0, cm, { parent: g, ry: (sx * P) / 2, sx: 4 });
        PL(1.08, 0.72, 0, 0.44, -0.94, cm, { parent: g, ry: P });
        const flap = G(0, 0.8, 0.94, 0, g);
        PL(1.08, 0.72, 0, -0.36, 0, cm, { parent: flap });
        fx.dyn.push(flap);
        // em cima: vaso, vela, pratinho
        C(0.05, 0.07, 0.2, 0.1, 0.8, -0.2, M('#7fb0c9'), { parent: g });
        S(0.09, 0.1, 1.07, -0.2, M('#e85d75'), { parent: g, ico: true }); S(0.07, 0.17, 1.02, -0.15, M('#f2c14e'), { parent: g, ico: true });
        C(0.025, 0.025, 0.14, -0.15, 0.8, 0.3, M('#f4efe6', { emi: 0.5 }), { parent: g, seg: 8 });
        C(0.14, 0.14, 0.015, -0.2, 0.8, -0.45, M('#f4efe6'), { parent: g, seg: 14 });
        S(0.045, -0.2, 0.86, -0.45, M('#c47a3a'), { parent: g });
        for (const [lx, lz, ry] of [[-0.82, 0.4, P / 2], [-0.82, -0.4, P / 2], [0.82, 0.4, -P / 2], [0.82, -0.4, -P / 2]]) chair(lx, 0, lz, ry, '#4a2e1c', g);
        fx.set = (o) => { flap.rotation.x = -o * 1.35; };
        colLocal(s, 0, 0, 1.1, 1.9);
        colLocal(s, -0.82, 0, 0.45, 1.25); colLocal(s, 0.82, 0, 0.45, 1.25);
        break;
      }
      case 'tub': {
        const enamel = M('#f4f4f0');
        B(1.7, 0.5, 0.78, 0, 0.12, 0, enamel, { parent: g });
        B(1.76, 0.06, 0.84, 0, 0.6, 0, enamel, { parent: g });
        B(1.5, 0.04, 0.58, 0, 0.58, 0, M('#a9d3e0'), { parent: g });
        for (const [a, b] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) S(0.07, a, 0.07, b, M('#d8b45a'), { parent: g });
        C(0.02, 0.02, 0.3, -0.8, 0.6, 0, M('#c9c9c9'), { parent: g });
        C(0.012, 0.012, 1.74, 0, 2.05, 0.42, M('#c9c9c9'), { parent: g, rz: P / 2, seg: 6 });
        const cur = G(-0.85, 0, 0.43, 0, g);
        const cg = new THREE.PlaneGeometry(1.72, 1.6, 12, 1);
        const pa = cg.attributes.position;
        for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 14) * 0.035);
        cg.translate(0.86, 1.25, 0);
        mk(cg, M('#ffffff', { tex: isB ? TX.curtainPink : TX.curtainBlue, side: THREE.DoubleSide }), cur);
        for (let k = 0; k < 9; k++) C(0.018, 0.018, 0.02, 0.05 + k * 0.205, 2.04, 0, M('#c9c9c9'), { parent: cur, rx: P / 2, seg: 6 });
        fx.dyn.push(cur);
        fx.set = (o) => { cur.scale.x = 1 - o * 0.78; };
        colLocal(s, 0, 0, 1.76, 0.84);
        break;
      }
      case 'sofa': {
        const sg = G(0, 0, 0.75, 0, g);
        const big = s.id === 'c_sofa';
        sofaMesh(sg, big ? '#c4622d' : isB ? '#c99a3a' : '#2f6a6e', big ? 2.6 : 2.3, { pillows: big ? ['#e8b84a', '#2f6f6a'] : isB ? ['#a8492f', '#e9dfc8'] : ['#e8b84a', '#e9c9f0'] });
        B(0.6, 0.03, 0.34, -0.5, 0.87, 0.4, fab('#e9dfc8'), { parent: g, ry: 0.15 }); // mantinha no encosto
        fx.dyn.push(sg);
        fx.set = (o) => { sg.position.x = Math.sin(o * 30) * 0.03 * o; };
        colLocal(s, 0, 0.75, big ? 2.6 : 2.3, 0.92);
        break;
      }
      case 'counter':
        fx.set = () => {};
        break;
      case 'curtain': {
        const vel = M(isB ? '#a8492f' : s.id === 'u_curtain' ? '#6e1f29' : '#6b3a7a', { tex: TX.folds, side: THREE.DoubleSide });
        C(0.02, 0.02, 2.5, 0, 2.72, 0.3, M('#c9a050'), { parent: g, rz: P / 2, seg: 6 });
        S(0.045, -1.25, 2.72, 0.3, M('#c9a050'), { parent: g }); S(0.045, 1.25, 2.72, 0.3, M('#c9a050'), { parent: g });
        const panels = [];
        for (const sd of [-1, 1]) {
          const pv = G(sd * 1.17, 0, 0.3, 0, g);
          const cg = new THREE.PlaneGeometry(1.18, 2.66, 10, 1);
          const pa = cg.attributes.position;
          for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 16) * 0.04);
          cg.translate(-sd * 0.59, 1.36, 0);
          mk(cg, vel, pv);
          panels.push({ pv, sd }); fx.dyn.push(pv);
        }
        fx.set = (o) => { for (const p of panels) p.pv.scale.x = 1 - o * 0.6; };
        break;
      }
      case 'chest': {
        const wd = wood('#7a4a2c'), band = M('#4a3a2a');
        B(1.2, 0.5, 0.62, 0, 0.04, 0, wd, { parent: g });
        for (const a of [-0.45, 0.45]) B(0.06, 0.52, 0.64, a, 0.04, 0, band, { parent: g });
        for (const [a, b] of [[-0.55, -0.26], [0.55, -0.26], [-0.55, 0.26], [0.55, 0.26]]) B(0.08, 0.05, 0.08, a, 0, b, wood('#3a2416'), { parent: g });
        const lid = G(0, 0.54, -0.31, 0, g);
        B(1.22, 0.14, 0.64, 0, 0, 0.31, wd, { parent: lid });
        for (const a of [-0.45, 0.45]) B(0.06, 0.15, 0.66, a, 0, 0.31, band, { parent: lid });
        B(0.1, 0.12, 0.03, 0, -0.06, 0.64, M('#d8b45a'), { parent: lid });
        fx.dyn.push(lid);
        fx.set = (o) => { lid.rotation.x = -o * 1.45; };
        colLocal(s, 0, 0, 1.24, 0.66);
        break;
      }
      case 'box': {
        const cb = M('#ffffff', { tex: TX.box });
        B(1.0, 0.96, 1.0, 0, 0, 0, cb, { parent: g });
        const flaps = [];
        const mkFlap = (hx_, hz, ax, sgn, w) => {
          const pv = G(hx_, 0.96, hz, 0, g);
          if (ax === 'x') B(w, 0.012, 0.5, 0, 0, -sgn * 0.25, cb, { parent: pv }); else B(0.5, 0.012, w, -sgn * 0.25, 0, 0, cb, { parent: pv });
          flaps.push({ pv, ax, sgn }); fx.dyn.push(pv);
        };
        mkFlap(0, 0.5, 'x', 1, 1.0); mkFlap(0, -0.5, 'x', -1, 1.0); mkFlap(0.5, 0, 'z', 1, 0.98); mkFlap(-0.5, 0, 'z', -1, 0.98);
        for (const f of flaps) if (f.ax === 'z') f.pv.position.y += 0.014;
        // caixinhas ao lado
        const sx = s.id === 'u_box' ? -0.85 : 0.85;
        B(0.55, 0.45, 0.55, sx, 0, -0.2, cb, { parent: g, ry: 0.2 });
        B(0.4, 0.35, 0.45, sx + 0.03, 0.45, -0.2, cb, { parent: g, ry: -0.1 });
        fx.set = (o) => { for (const f of flaps) { if (f.ax === 'x') f.pv.rotation.x = f.sgn * o * 2.1; else f.pv.rotation.z = -f.sgn * o * 2.1; } };
        colLocal(s, 0, 0, 1.0, 1.0); colLocal(s, sx, -0.2, 0.6, 0.6);
        break;
      }
      case 'coats': {
        B(1.3, 0.12, 0.05, 0, 1.75, -0.38, wood('#5a3420'), { parent: g });
        const coats = [];
        const cols = ['#5a4a3a', '#8a2c2c', '#2c3e5a', '#c9963a', '#3d5a3d'];
        for (let k = 0; k < 5; k++) {
          const lx = -0.5 + k * 0.25;
          C(0.012, 0.012, 0.1, lx, 1.72, -0.33, M('#d8b45a'), { parent: g, rx: P / 2, seg: 6 });
          const pv = G(lx, 1.72, -0.3, 0, g);
          C(0.11, 0.24, 1.0, 0, -1.05, 0.12 + (k % 2) * 0.06, fab(cols[k]), { parent: pv, seg: 8 });
          S(0.1, 0, -0.08, 0.1, fab(cols[k]), { parent: pv, sc: [1.3, 0.6, 1] });
          coats.push(pv); fx.dyn.push(pv);
        }
        S(0.16, 0.35, 1.95, -0.3, M('#3a2a1e'), { parent: g, sc: [1, 0.5, 1] });
        C(0.22, 0.22, 0.02, 0.35, 1.9, -0.3, M('#3a2a1e'), { parent: g });
        C(0.13, 0.11, 0.55, -0.6, 0, 0.2, M('#2f4a3a'), { parent: g });
        C(0.012, 0.012, 0.8, -0.62, 0.3, 0.2, M('#e85d75'), { parent: g, rz: 0.15 });
        fx.set = (o) => { coats.forEach((c, i) => { c.rotation.z = Math.sin(i * 1.7 + o * 6) * 0.25 * o; c.rotation.x = -o * 0.35; }); };
        colLocal(s, 0, -0.38, 1.3, 0.12);
        break;
      }
    }
    spotFx[s.id] = fx;
  }

  // =================================================================
  // ASSAR LUZ NOS VÉRTICES E FUNDIR GEOMETRIA
  // =================================================================
  const AMB = {
    cafe: [0.13, 0.085, 0.06], hall: [0.12, 0.095, 0.075], land: [0.11, 0.085, 0.07], corr: [0.11, 0.08, 0.06],
    livA: [0.12, 0.09, 0.12], kitA: [0.12, 0.09, 0.11], bedA: [0.12, 0.085, 0.08], bathA: [0.12, 0.13, 0.13],
    livB: [0.1, 0.11, 0.09], kitB: [0.11, 0.1, 0.08], bedB: [0.09, 0.1, 0.12], bathB: [0.13, 0.11, 0.11], out: [0.3, 0.3, 0.35],
  };
  function zoneAt(x, y, z) {
    if (x < -0.08 || x > 28.08 || z < -0.08 || z > 16.08) return 'out';
    const L = y >= FH - 0.15 ? 1 : 0;
    if (L === 0) return x < 20 ? 'cafe' : 'hall';
    if (x >= 20) return 'land';
    if (z >= 7 && z <= 9) return 'corr';
    const a = z > 9 ? 'A' : 'B';
    return (x < 3.5 ? 'bath' : x < 9 ? 'bed' : x < 13 ? 'kit' : 'liv') + a;
  }
  const zoneLights = {};
  for (const L of lights) {
    const zs = L.zones || [zoneAt(L.x, L.y, L.z)];
    for (const z of zs) (zoneLights[z] = zoneLights[z] || []).push(L);
  }
  const colByLvl = [colliders.filter((c) => c.level === 0), colliders.filter((c) => c.level === 1)];
  const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  function floorDist(x, z, L) {
    let best = 9;
    for (const c of colByLvl[L]) {
      const dx = Math.max(c.minX - x, 0, x - c.maxX), dz = Math.max(c.minZ - z, 0, z - c.maxZ);
      const d = Math.hypot(dx, dz);
      if (d < best) best = d;
    }
    return best;
  }
  const out3 = [0, 0, 0];
  function lightAt(px, py, pz, nx, ny, nz) {
    const zone = zoneAt(px + nx * 0.06, py + ny * 0.06, pz + nz * 0.06);
    const a = AMB[zone] || AMB.cafe;
    const k = (0.85 + 0.15 * ny) * (zone === 'out' ? 1 : 1.45);
    let r = a[0] * k, g = a[1] * k, b = a[2] * k;
    const ls = zoneLights[zone];
    if (ls) for (const L of ls) {
      const dx = L.x - px, dy = L.y - py, dz = L.z - pz, d = Math.hypot(dx, dy, dz);
      if (d > L.range || d < 1e-4) continue;
      const ndl = (nx * dx + ny * dy + nz * dz) / d;
      const w = (ndl + 0.3) / 1.3;
      if (w <= 0) continue;
      let f = 1 - d / L.range; f = f * f * L.i * w * 1.3;
      r += L.c.r * f; g += L.c.g * f; b += L.c.b * f;
    }
    // oclusão ambiente falsa
    if (zone !== 'out') {
      const Lv = py >= FH - 0.15 ? 1 : 0, h = py - Lv * FH;
      let ao = 1;
      if (Math.abs(ny) < 0.5) ao = (0.55 + 0.45 * smooth(0, 0.7, h)) * (0.8 + 0.2 * smooth(0, 0.5, WH - h));
      else if (ny > 0.5 && h < 0.05) ao = 0.5 + 0.5 * smooth(0, 0.65, floorDist(px, pz, Lv));
      else if (ny < -0.5 && h < 2) ao = 0.55 + 0.45 * smooth(0, 0.9, h);
      r *= ao; g *= ao; b *= ao;
    }
    out3[0] = r; out3[1] = g; out3[2] = b;
    return out3;
  }
  // luz aproximada num ponto (para os personagens)
  function sampleLight(x, y, z, target) {
    const zone = zoneAt(x, y + 0.5, z);
    const a = AMB[zone] || AMB.cafe;
    let r = a[0] * 1.45, g = a[1] * 1.45, b = a[2] * 1.45;
    for (const L of zoneLights[zone] || []) {
      const d = Math.hypot(L.x - x, L.y - y - 1, L.z - z);
      if (d > L.range) continue;
      let f = 1 - d / L.range; f = f * f * L.i * 0.85;
      r += L.c.r * f; g += L.c.g * f; b += L.c.b * f;
    }
    return target.setRGB(r, g, b);
  }

  const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3(), _rel = new THREE.Matrix4(), _inv = new THREE.Matrix4();
  function bake(meshes, target, matFor) {
    target.updateMatrixWorld(true);
    _inv.copy(target.matrixWorld).invert();
    const buckets = new Map();
    for (const mesh of meshes) {
      const d = mesh.userData.m;
      const bk = bucketKey(d);
      let b = buckets.get(bk);
      if (!b) buckets.set(bk, (b = { d, pos: [], uv: [], col: [], idx: [], n: 0 }));
      const geo = mesh.geometry;
      const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv;
      _nm.getNormalMatrix(mesh.matrixWorld);
      _rel.multiplyMatrices(_inv, mesh.matrixWorld);
      const base = b.n;
      for (let i = 0; i < pa.count; i++) {
        _v.fromBufferAttribute(pa, i).applyMatrix4(mesh.matrixWorld);
        if (d.unlit) b.col.push(d.color.r, d.color.g, d.color.b);
        else {
          _n.fromBufferAttribute(na, i).applyMatrix3(_nm).normalize();
          const L = lightAt(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z);
          b.col.push(d.color.r * (L[0] + d.emi), d.color.g * (L[1] + d.emi), d.color.b * (L[2] + d.emi));
        }
        _v.fromBufferAttribute(pa, i).applyMatrix4(_rel);
        b.pos.push(_v.x, _v.y, _v.z);
        if (ua) b.uv.push(ua.getX(i), ua.getY(i)); else b.uv.push(0, 0);
      }
      if (geo.index) for (let i = 0; i < geo.index.count; i++) b.idx.push(base + geo.index.getX(i));
      else for (let i = 0; i < pa.count; i++) b.idx.push(base + i);
      b.n += pa.count;
      mesh.parent.remove(mesh);
      geo.dispose();
    }
    const outM = [];
    for (const b of buckets.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      if (b.d.tex) geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setIndex(b.idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, matFor(b.d));
      if (b.d.alpha < 1 || b.d.add) mesh.renderOrder = 2;
      target.add(mesh); outM.push(mesh);
    }
    return outM;
  }
  const collect = (obj) => { const a = []; obj.traverse((o) => { if (o.isMesh && o.userData.m) a.push(o); }); return a; };
  const staticMats = new Map();
  const staticMatFor = (d) => { const k = bucketKey(d); if (!staticMats.has(k)) staticMats.set(k, finalMaterial(d)); return staticMats.get(k); };
  scene.updateMatrixWorld(true);
  // esconderijos: cada um com materiais próprios (para o destaque)
  for (const id in spotFx) {
    const fx = spotFx[id];
    const mats = new Map();
    const mf = (d) => { const k = bucketKey(d); if (!mats.has(k)) { const m = finalMaterial(d); mats.set(k, m); fx.mats.push(m); } return mats.get(k); };
    for (const part of fx.dyn) bake(collect(part), part, mf);
    bake(collect(fx.g), fx.g, mf);
    fx.g.removeFromParent(); scene.add(fx.g);
  }
  for (const blades of fans) { bake(collect(blades), blades, staticMatFor); }
  const fanObjs = fans.map((b) => { const parent = b.parent; return { b, parent }; });
  for (const f of fanObjs) { f.parent.removeFromParent(); scene.add(f.parent); }
  bake(collect(root), root, staticMatFor);
  for (const f of fanObjs) bake(collect(f.parent), f.parent, staticMatFor);
  // vidro com chuva: textura animada
  for (const m of staticMats.values()) if (m.transparent && !m.map && m.opacity < 0.3) { m.map = TX.rain; m.opacity = 0.9; m.vertexColors = false; m.color.set('#dfe9ff'); m.needsUpdate = true; m.depthWrite = false; glassMats.push(m); }

  // ---------- brilhos (halos), pisca-pisca e poeira ----------
  const mkPoints = (arr, size, color, opacity, texture = TX.glow) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const m = new THREE.PointsMaterial({ size, map: texture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const p = new THREE.Points(g, m); p.renderOrder = 3; scene.add(p); return p;
  };
  mkPoints(halosBig, 1.15, '#ffb870', 0.55);
  mkPoints(halosSmall, 0.6, '#ffc078', 0.6);
  const fairyPts = mkPoints(fairy, 0.16, '#ffe2a0', 1.0);
  // poeira dançando na luz
  const DN = 260, dust = new Float32Array(DN * 3), dustCol = new Float32Array(DN * 3), dustBase = [];
  const dustAreas = [[1, 19, 0.3, 15, 0], [13.5, 19.5, 9.5, 15.5, 1], [13.5, 19.5, 0.5, 6.5, 1], [9.5, 12.5, 9.5, 15.5, 1], [4, 8.5, 9.5, 15.5, 1], [4, 8.5, 0.5, 6.5, 1]];
  const tmpC = new THREE.Color();
  for (let i = 0; i < DN; i++) {
    const a = dustAreas[i < 110 ? 0 : 1 + (i % 5)];
    const x = a[0] + rnd() * (a[1] - a[0]), z = a[2] + rnd() * (a[3] - a[2]), y = a[4] * FH + 0.4 + rnd() * 2.3;
    dustBase.push([x, y, z, rnd() * 10]);
    sampleLight(x, y - 1, z, tmpC);
    const k = Math.min(1, Math.max(0, (tmpC.r - 0.25) * 1.2));
    dustCol.set([k, k * 0.85, k * 0.6], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
  const dustPts = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.05, map: TX.glow, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  dustPts.frustumCulled = false; dustPts.renderOrder = 3; scene.add(dustPts);

  // ---------- destaque do esconderijo próximo ----------
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: TX.ring, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -P / 2; ring.visible = false; ring.renderOrder = 4; scene.add(ring);
  const markTex = tex((g, s) => {
    g.fillStyle = 'rgba(255,190,90,.95)'; g.beginPath(); g.arc(s / 2, s * 0.42, s * 0.34, 0, 7); g.fill();
    g.beginPath(); g.moveTo(s * 0.36, s * 0.66); g.lineTo(s * 0.5, s * 0.92); g.lineTo(s * 0.64, s * 0.66); g.fill();
    g.fillStyle = '#3a1e08'; g.font = `bold ${s * 0.42}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', s / 2, s * 0.44);
  }, 64, 64, { clamp: true });
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, depthTest: false, transparent: true }));
  marker.scale.set(0.38, 0.38, 1); marker.visible = false; marker.renderOrder = 5; scene.add(marker);
  const MARK_H = { wardrobe: 2.75, pantry: 2.45, closet: 2.4, bed: 1.35, table: 1.35, tub: 2.35, sofa: 1.25, counter: 1.45, curtain: 3.0, chest: 1.05, box: 1.45, coats: 2.25 };
  let hlId = null;
  function setHighlight(id, t, mode) {
    if (hlId && hlId !== id) for (const m of spotFx[hlId].mats) m.color.setScalar(1);
    hlId = id;
    if (!id) { ring.visible = marker.visible = false; return; }
    const fx = spotFx[id], s = fx.s;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    for (const m of fx.mats) m.color.setScalar(1.12 + 0.28 * pulse);
    ring.visible = marker.visible = true;
    const cx = s.kind === 'sofa' || s.kind === 'counter' ? s.x : (s.x + s.ex) / 2, cz = s.kind === 'sofa' || s.kind === 'counter' ? s.z : (s.z + s.ez) / 2;
    const sz = 1.4 + s.rad * 1.4 + pulse * 0.15;
    ring.position.set(cx, s.y + 0.02, cz); ring.scale.set(sz, sz, 1);
    ring.material.color.set(mode === 'seek' ? '#6fd3e0' : '#ffc070');
    marker.material.color.set(mode === 'seek' ? '#a8f0ff' : '#ffffff');
    marker.position.set(s.x, s.y + MARK_H[s.kind] + Math.sin(t * 3) * 0.06, s.z);
  }

  // ---------- atualização por quadro ----------
  function update(dt, t, camPos) {
    TX.rain.offset.y = (TX.rain.offset.y + dt * 0.18) % 1;
    for (const f of fans) f.rotation.y += dt * 1.6;
    const rp = rainGeo.attributes.position.array;
    for (let i = 0; i < RN; i++) {
      const o = i * 6, v = rainV[i] * dt;
      rp[o + 1] -= v; rp[o + 4] -= v;
      if (rp[o + 4] < -0.3) { rp[o + 1] += 7.6; rp[o + 4] += 7.6; }
    }
    rainGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < DN; i++) {
      const b = dustBase[i];
      dust[i * 3] = b[0] + Math.sin(t * 0.15 + b[3]) * 0.4;
      dust[i * 3 + 1] = b[1] + Math.sin(t * 0.11 + b[3] * 2) * 0.3;
      dust[i * 3 + 2] = b[2] + Math.cos(t * 0.13 + b[3]) * 0.4;
    }
    dustGeo.attributes.position.needsUpdate = true;
    fairyPts.material.opacity = 0.85 + Math.sin(t * 2.2) * 0.15;
  }

  return { colliders, blockers, spotFx, update, setHighlight, sampleLight, zoneAt, shadowTex: TX.shadow, glowTex: TX.glow };

  function makeTextures() {
    const t = {};
    t.woodDark = texPlanks('#6a3f25', 7);
    t.woodHoney = texPlanks('#b7814c', 6);
    t.woodAsh = texPlanks('#a88b68', 6);
    t.woodCeil = texPlanks('#4a2e1e', 5);
    t.brick = texBrick(['#9a4a35', '#8c3f2d', '#a5543b', '#7f3a2a', '#b05f43'], '#c4b39c');
    t.brickDark = texBrick(['#4a2a22', '#3f241d', '#55302a'], '#2a2220');
    t.lilac = texPaper('#a58bc9', '#b9a2db', 'damask');
    t.sage = texPaper('#8fae8c', '#a4c09f', 'damask');
    t.roseFlower = texPaper('#ecd9c6', '#d68f8f', 'flower');
    t.blueStripe = texPaper('#9fb8cf', '#b8cde0', 'stripe');
    t.ochre = texPaper('#d9b45e', '#e6c77d', 'stripe');
    t.hallPaper = texPaper('#e9dcbc', '#d8c69a', 'dots');
    t.panelWood = texPanel('#5b3a24');
    t.panelGreen = texPanel('#2f5a48');
    t.tileMint = texTiles('#bfe3d6', '#9cc7b8', 8);
    t.tilePink = texTiles('#f0c9c4', '#d9aaa4', 8);
    t.checkBW = texChecker('#ece4d0', '#26272b', 4);
    t.checkMustard = texChecker('#efe2bf', '#c48a2a', 4);
    t.marble = texMarble();
    t.runner = texRunner();
    t.rugA = texRug('#8c2b2b', '#e0b768', '#24365e');
    t.rugB = texRug('#2c4a74', '#e9d6a8', '#9a3b2c');
    t.rugC = texRug('#6b3a5c', '#e8c27a', '#2d5a52');
    t.fabric = texFabric();
    t.grain = texGrain();
    t.folds = texFolds();
    t.ginghamRed = texGingham('#b8322a');
    t.ginghamBlue = texGingham('#2f5f9a');
    t.curtainBlue = texStripes('#dcebf5', '#a9cbe0');
    t.curtainPink = texStripes('#f6e0e4', '#e8b4c0');
    t.art = [0, 1, 2, 3, 4, 5].map(texArt);
    t.chalk = texChalk();
    t.neon = texNeon();
    t.sky = texSky();
    t.street = texStreet();
    t.rain = texRain();
    t.glow = texGlow();
    t.shadow = texShadow();
    t.ring = texRing();
    t.box = texCardboard();
    t.tvTex = texTV();
    t.juke = texJuke();
    return t;
  }
}
