// Jogador de teste (só para depuração local): node test/bot.js <codigo> [url] [nome]
const { io } = require('socket.io-client');
const SPOTS = require('../public/spots.js');
const code = process.argv[2];
const name = process.argv[4] || 'Teste';
const s = io(process.argv[3] || 'http://localhost:3210', { transports: ['websocket'] });
const pid = 'tst' + Date.now();
let role = null, phase = null, pos = { x: 9, y: 0, z: 7.5, ry: 0 }, start = false;
s.on('connect', () => s.emit('join', { pid, code, name, color: '#5b9b4a' }, (r) => console.log('join', r)));
s.on('state', (st) => { role = st.role; phase = st.phase; if (st.host && !start && st.players.length >= 2 && process.argv.includes('--start')) { start = true; s.emit('start'); } });
s.on('roundStart', (d) => {
  role = d.role; pos = { ...d.spawn };
  console.log('rodada', d.round, role);
  if (role === 'hider') {
    const sp = SPOTS.find((x) => x.id === 'c_table1');
    setTimeout(() => { pos = { x: sp.ex, y: sp.y, z: sp.ez, ry: 0 }; s.emit('pos', pos); setTimeout(() => s.emit('hide', { spotId: sp.id }), 300); }, 3000);
  }
});
s.on('roundEnd', (d) => console.log('fim', d.reason, d.winner));
setInterval(() => {
  if (role === 'seeker' && phase === 'seeking') { pos.x = 9 + Math.sin(Date.now() / 1500) * 3; pos.z = 7.5 + Math.cos(Date.now() / 1500) * 2; }
  s.emit('pos', { ...pos, m: role === 'seeker' && phase === 'seeking' ? 1 : 0 });
}, 100);
