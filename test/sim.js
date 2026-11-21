// Simula vários jogadores e testa o fluxo completo. Rode com o servidor em tempos curtos:
// HIDE_TIME=2 SEEK_TIME=6 BREAK_TIME=1 TAUNT_CD=3 node server.js
const { io } = require('socket.io-client');
const SPOTS = require('../public/spots.js');
const SPOT = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
const URL = process.env.URL || 'http://localhost:3000';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) fails++; };

function client(name) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  const c = { s, name, pid: name + Math.random().toString(36).slice(2), state: null, events: [] };
  for (const ev of ['state', 'roundStart', 'roundEnd', 'checked', 'taunt', 'p', 'hint', 'phase', 'toast', 'placed', 'found', 'hideFail', 'left']) {
    s.on(ev, (d) => { if (ev === 'state') c.state = d; c.events.push({ ev, d }); });
  }
  c.emit = (ev, d) => new Promise((r) => s.emit(ev, d, r));
  c.waitFor = async (ev, pred = () => true, ms = 12000) => {
    const start = c.events.length; const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const e = c.events.slice(start).find((x) => x.ev === ev && pred(x.d));
      if (e) return e.d;
      await wait(30);
    }
    throw new Error(name + ' timeout esperando ' + ev);
  };
  c.at = (spotId) => { const p = SPOT[spotId]; s.emit('pos', { x: p.ex, y: p.y, z: p.ez, ry: 0 }); };
  c.me = () => c.state.players.find((p) => p.id === c.state.me);
  return c;
}

(async () => {
  const A = client('Ana'), B = client('Beto'), C = client('Caio');
  await wait(400);

  console.log('1) Sala com 3 pessoas; o anfitrião começa');
  const cr = await A.emit('create', { pid: A.pid, name: 'Ana', color: '#e8862a' });
  ok(cr.ok && /^\d{4}$/.test(cr.code), 'sala criada com código ' + cr.code);
  const bad = await B.emit('join', { pid: B.pid, code: cr.code === '0000' ? '9999' : '0000' });
  ok(!bad.ok, 'código errado é recusado: ' + bad.error);
  ok((await B.emit('join', { pid: B.pid, code: cr.code, name: 'Beto' })).ok, 'Beto entrou');
  ok((await C.emit('join', { pid: C.pid, code: cr.code, name: 'Caio' })).ok, 'Caio entrou');
  await wait(150);
  ok(A.state.players.length === 3 && A.state.host && !B.state.host, '3 jogadores na sala, Ana é a anfitriã');
  ok(A.state.players.map((p) => p.name).join(',') === 'Ana,Beto,Caio', 'nomes chegam para todos');
  B.s.emit('start'); await wait(1800);
  ok(A.state.phase === 'lobby', 'só a anfitriã pode começar');
  const rs1 = A.waitFor('roundStart');
  A.s.emit('start');
  const r1 = await rs1; await wait(100);

  console.log('2) Rodada 1 — Ana procura, Beto e Caio se escondem');
  ok(r1.role === 'seeker' && B.state.role === 'hider' && C.state.role === 'hider', 'Ana procura; Beto e Caio escondem');
  ok(A.state.phase === 'hiding', 'fase de esconder (tela preta pra Ana)');
  A.events.length = 0;
  B.at('a_wardrobe'); C.at('a_wardrobe'); await wait(150);
  ok(!A.events.some((e) => e.ev === 'p'), 'Ana não recebe posições durante a contagem');
  ok(C.events.some((e) => e.ev === 'p' && e.d.id === B.state.me), 'quem se esconde vê os outros que se escondem');
  B.s.emit('hide', { spotId: 'a_wardrobe' }); await wait(150);
  ok(B.state.mySpot === 'a_wardrobe', 'Beto entrou no guarda-roupa');
  C.s.emit('hide', { spotId: 'a_wardrobe' });
  const hf = await C.waitFor('hideFail');
  ok(/alguém/.test(hf.text), 'esconderijo ocupado é recusado: ' + hf.text);
  C.at('c_counter'); await wait(100);
  C.s.emit('hide', { spotId: 'c_counter' }); await wait(150);
  ok(C.state.mySpot === 'c_counter', 'Caio atrás do balcão do café');
  B.s.emit('taunt'); await wait(100);
  ok(B.me().score === 0, 'provocar não vale antes da busca começar');
  await A.waitFor('phase', (d) => d.phase === 'seeking');
  ok(A.state.hidersLeft === 2, 'busca começou com 2 escondidos');
  B.s.emit('taunt'); await A.waitFor('taunt');
  await wait(100);
  ok(B.me().score === 0.5, 'Beto ganhou ½ ponto provocando');
  B.s.emit('taunt'); await wait(150);
  ok(B.me().score === 0.5, 'provocação tem tempo de recarga');
  A.at('a_tub'); await wait(450); const hp = A.waitFor('hint'); A.at('a_wardrobe'); const h = await hp;
  ok(h.d < 3, 'Ana ouve passinhos perto de alguém (d=' + h.d.toFixed(2) + ')');
  A.at('a_bed'); await wait(100);
  A.s.emit('check', { spotId: 'a_bed' });
  const c1 = await A.waitFor('checked');
  ok(c1.spotId === 'a_bed' && !c1.found, 'debaixo da cama: vazio');
  await wait(1250);
  A.at('a_wardrobe'); await wait(100);
  const fb = B.waitFor('found');
  A.s.emit('check', { spotId: 'a_wardrobe' });
  const f1 = await fb; await wait(120);
  ok(f1.id === B.state.me && B.state.found, 'Ana achou Beto (ele passa a assistir)');
  ok(A.state.phase === 'seeking' && A.state.hidersLeft === 1, 'rodada continua: falta 1');
  await wait(1250);
  A.at('c_counter'); await wait(100);
  const re1 = A.waitFor('roundEnd');
  A.s.emit('check', { spotId: 'c_counter' });
  const e1 = await re1;
  ok(e1.winner === 'seeker' && e1.youWon, 'Ana achou todo mundo e venceu');
  await wait(100);
  ok(A.me().score === 1 && B.me().score === 0.5, 'placar: Ana 1, Beto ½, Caio 0');

  console.log('3) Rodada 2 — Beto procura; tempo acaba (4 min no jogo real)');
  const r2 = await B.waitFor('roundStart');
  ok(r2.role === 'seeker' && A.state.role === 'hider' && C.state.role === 'hider', 'papéis giraram: agora Beto procura');
  A.at('c_sofa'); await wait(100);
  A.s.emit('hide', { spotId: 'c_sofa' }); await wait(150);
  ok(A.state.mySpot === 'c_sofa', 'Ana atrás do sofazão');
  await B.waitFor('phase', (d) => d.phase === 'seeking');
  C.s.emit('pos', { x: 10, y: 0, z: 7, ry: 0 }); await wait(120);
  ok(B.events.some((e) => e.ev === 'p' && e.d.id === C.state.me && Math.abs(e.d.x - 10) < 0.01), 'Beto vê Caio andando fora do esconderijo');
  B.s.emit('pos', { x: 10.5, y: 0, z: 7.4, ry: 0 }); await wait(100);
  const fc = C.waitFor('found');
  B.s.emit('catch', {});
  const f2 = await fc;
  ok(f2.reason === 'caught', 'Beto pegou Caio no flagra');
  const e2 = await A.waitFor('roundEnd', () => true, 15000);
  ok(e2.winner === 'hiders' && e2.youWon && e2.reason === 'timeout', 'tempo acabou: Ana não foi achada e ganha');
  await wait(100);
  ok(A.me().score === 2 && B.me().score === 0.5 && C.me().score === 0, 'placar: Ana 2, Beto ½, Caio 0 (Beto não ganha nada)');

  console.log('4) Até 7 pessoas');
  const extra = ['Duda', 'Edu', 'Fabi', 'Gabi'].map(client); await wait(400);
  const rs = [];
  for (const x of extra) rs.push(await x.emit('join', { pid: x.pid, code: cr.code, name: x.name }));
  ok(rs.every((r) => r.ok), '7 jogadores na sala');
  await wait(150);
  ok(extra[0].state.role === 'wait', 'quem entra no meio da rodada espera a próxima');
  const H = client('Hugo'); await wait(300);
  const full = await H.emit('join', { pid: H.pid, code: cr.code });
  ok(!full.ok && /cheia/.test(full.error), 'oitavo jogador recusado: ' + full.error);
  H.s.close();
  const r3 = await extra[0].waitFor('roundStart', () => true, 15000); await wait(100);
  const roles = A.state.players.map((p) => p.role);
  ok(roles.filter((r) => r === 'seeker').length === 1 && roles.filter((r) => r === 'hider').length === 6, 'rodada com 1 procurando e 6 escondendo (' + r3.role + ')');

  console.log('5) Reconexão (celular troca de app) e saída');
  const before = A.me().score;
  A.s.disconnect(); await wait(300);
  ok(B.state.players.find((p) => p.name === 'Ana').connected === false, 'os outros veem que Ana caiu');
  const A2 = client('Ana2'); A2.pid = A.pid; await wait(300);
  const rj = await A2.emit('rejoin', { pid: A.pid, code: cr.code });
  ok(rj.ok, 'Ana voltou para a mesma sala');
  await wait(150);
  ok(A2.me().score >= before && before >= 2, 'placar mantido: Ana ' + A2.me().score);
  for (const x of extra) x.s.emit('leave');
  await wait(300);
  ok(B.state.players.length === 3, 'quem sai some da lista (' + B.state.players.length + ' jogadores)');

  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK ✅');
  for (const x of [A2, B, C, ...extra]) x.s.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
