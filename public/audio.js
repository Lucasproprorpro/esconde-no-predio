// Sons sintetizados (sem arquivos): efeitos + ambiente aconchegante
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let actx = null, master = null, noiseBuf = null, pinkBuf = null;
let muted = false;
try { muted = localStorage.getItem('mute') === '1'; } catch (_) {}
const amb = { started: false, rain: null, cafe: null, music: null, nextChord: 0, nextClink: 0, chord: 0 };

export function ac() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    actx = new AC();
    master = actx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(actx.destination);
    const n = actx.sampleRate * 2;
    noiseBuf = actx.createBuffer(1, n, actx.sampleRate);
    pinkBuf = actx.createBuffer(1, n, actx.sampleRate);
    const d = noiseBuf.getChannelData(0), p = pinkBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1; d[i] = w;
      b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
      p[i] = (b0 + b1 + b2) * 0.9;
    }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
export function setMuted(m) {
  muted = m; try { localStorage.setItem('mute', m ? '1' : '0'); } catch (_) {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, actx.currentTime, 0.05);
}
export const isMuted = () => muted;

function out(vol, pan) {
  const a = ac(); if (!a) return null;
  const g = a.createGain(); g.gain.value = vol;
  if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = clamp(pan || 0, -1, 1); g.connect(p); p.connect(master); }
  else g.connect(master);
  return g;
}
export function sStep(vol = 0.15, pan = 0) {
  const a = ac(); if (!a || vol < 0.005) return; const o = out(vol, pan);
  const src = a.createBufferSource(); src.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380 + Math.random() * 250;
  const e = a.createGain(); const t = a.currentTime;
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.01); e.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(f); f.connect(e); e.connect(o); src.start(t, Math.random() * 1.5); src.stop(t + 0.15);
}
export function tone(freqs, dur, type = 'square', vol = 0.15, pan = 0, gap = 0) {
  const a = ac(); if (!a) return; const o = out(vol, pan); let t = a.currentTime;
  for (const fr of freqs) {
    const osc = a.createOscillator(); osc.type = type; const e = a.createGain();
    if (Array.isArray(fr)) { osc.frequency.setValueAtTime(fr[0], t); osc.frequency.exponentialRampToValueAtTime(fr[1], t + dur); }
    else osc.frequency.value = fr;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.02); e.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(e); e.connect(o); osc.start(t); osc.stop(t + dur + 0.02); t += dur + gap;
  }
}
function noiseHit(vol, pan, freq, q, dur, type = 'bandpass') {
  const a = ac(); if (!a) return; const o = out(vol, pan);
  const src = a.createBufferSource(); src.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const e = a.createGain(); const t = a.currentTime;
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.03); e.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(e); e.connect(o); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
export const sTaunt = (vol, pan) => { tone([[900, 1500], [1500, 700]], 0.22, 'triangle', vol, pan, 0.05); setTimeout(() => tone([[500, 380], [520, 360], [540, 340]], 0.1, 'square', vol * 0.5, pan, 0.03), 520); };
export const sCreak = (vol = 0.2, pan = 0) => { tone([[150, 95]], 0.45, 'sawtooth', vol * 0.35, pan); tone([[210, 160]], 0.3, 'triangle', vol * 0.25, pan); };
export const sSwish = (vol = 0.2, pan = 0) => noiseHit(vol, pan, 2400, 0.7, 0.35);
export const sThump = (vol = 0.2, pan = 0) => { tone([[120, 60]], 0.18, 'sine', vol, pan); noiseHit(vol * 0.5, pan, 300, 1, 0.12, 'lowpass'); };
export const sRustle = (vol = 0.2, pan = 0) => { noiseHit(vol * 0.7, pan, 900, 0.6, 0.4); setTimeout(() => noiseHit(vol * 0.5, pan, 1300, 0.6, 0.3), 180); };
export const sWin = () => tone([523, 659, 784, 1046], 0.13, 'triangle', 0.22);
export const sLose = () => tone([392, 330, 262], 0.2, 'triangle', 0.2);
export const sTick = () => tone([1200], 0.05, 'square', 0.06);
export const sGo = () => tone([660, 990], 0.15, 'triangle', 0.2);
export const sPop = () => tone([[600, 900]], 0.08, 'sine', 0.12);
// som de mexer no esconderijo, por tipo
export function sSpot(kind, vol = 0.25, pan = 0) {
  if (kind === 'wardrobe' || kind === 'pantry' || kind === 'closet' || kind === 'chest') sCreak(vol, pan);
  else if (kind === 'tub' || kind === 'curtain') sSwish(vol, pan);
  else if (kind === 'box') sRustle(vol * 1.2, pan);
  else sRustle(vol, pan);
}

// ---------------- ambiente ----------------
function loop(buf, filterType, freq, q, vol) {
  const a = actx;
  const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = a.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(master); src.start(0, Math.random() * 1.5);
  return { src, f, g, vol };
}
function startAmbient() {
  if (amb.started || !ac()) return;
  amb.started = true;
  amb.rain = loop(pinkBuf, 'lowpass', 1600, 0.4, 0);
  amb.rainHi = loop(noiseBuf, 'highpass', 5000, 0.3, 0);
  amb.cafe = loop(pinkBuf, 'bandpass', 420, 0.9, 0);
  amb.music = actx.createGain(); amb.music.gain.value = 0;
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
  amb.music.connect(lp); lp.connect(master);
}
const CHORDS = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [293.7, 349.2, 440, 523.3], [196, 246.9, 293.7, 349.2]];
function playChord(t0) {
  const a = actx, ch = CHORDS[amb.chord++ % CHORDS.length];
  ch.forEach((f, i) => {
    const o = a.createOscillator(); o.type = i === 0 ? 'triangle' : 'sine'; o.frequency.value = i === 0 ? f / 2 : f;
    const e = a.createGain(); const t = t0 + i * 0.04;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(i === 0 ? 0.22 : 0.09, t + 0.08); e.gain.exponentialRampToValueAtTime(0.001, t + 2.3);
    o.connect(e); e.connect(amb.music); o.start(t); o.stop(t + 2.4);
  });
  if (Math.random() < 0.7) { // notinha de melodia
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = ch[1 + Math.floor(Math.random() * 3)] * 2;
    const e = a.createGain(); const t = t0 + 0.6 + Math.random() * 0.8;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.06, t + 0.03); e.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(e); e.connect(amb.music); o.start(t); o.stop(t + 1);
  }
}
// zone: zona onde o jogador está; dJuke: distância até a jukebox (térreo); tense: jogo valendo
export function updateAmbient(zone, dJuke, tense) {
  if (!actx || actx.state !== 'running') return;
  startAmbient();
  const t = actx.currentTime;
  const k = tense ? 0.6 : 1;
  const inCafe = zone === 'cafe', ground = zone === 'cafe' || zone === 'hall';
  amb.rain.g.gain.setTargetAtTime((ground ? 0.05 : 0.075) * k, t, 0.6);
  amb.rainHi.g.gain.setTargetAtTime((ground ? 0.006 : 0.01) * k, t, 0.6);
  amb.cafe.g.gain.setTargetAtTime((inCafe ? 0.035 + Math.sin(t * 0.7) * 0.01 : zone === 'hall' ? 0.012 : 0.003) * k, t, 0.5);
  const mv = ground ? clamp(1 - dJuke / 16, 0.08, 1) * 0.55 : 0.05;
  amb.music.gain.setTargetAtTime(mv * k, t, 0.6);
  if (t > amb.nextChord) { playChord(t + 0.05); amb.nextChord = t + 2.4; }
  if (inCafe && t > amb.nextClink) {
    amb.nextClink = t + 1.5 + Math.random() * 4;
    tone([2600 + Math.random() * 900], 0.12, 'sine', 0.02 * k, (Math.random() - 0.5) * 1.4);
  }
}
