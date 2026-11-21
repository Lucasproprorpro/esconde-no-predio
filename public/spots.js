// Esconderijos — compartilhado entre servidor (require) e cliente (<script>)
(function (root) {
  const P = Math.PI;
  const FH = 3.2;
  // exit: distância do centro até o ponto de entrada (na frente do móvel)
  // rad: "raio" do móvel para medir o alcance; maxLz: o jogador precisa estar deste lado (atrás do sofá/balcão)
  const KIND = {
    wardrobe: { exit: 1.0, rad: 0.75 },
    pantry: { exit: 0.95, rad: 0.5 },
    closet: { exit: 0.95, rad: 0.5 },
    bed: { exit: 1.55, rad: 1.0 },
    table: { exit: 1.45, rad: 0.85 },
    tub: { exit: 0.95, rad: 0.85 },
    sofa: { exit: 0, rad: 0, maxLz: 0.35 },
    counter: { exit: 0, rad: 0, maxLz: 0.75 },
    curtain: { exit: 0.85, rad: 0.95 },
    chest: { exit: 0.95, rad: 0.6 },
    box: { exit: 0.95, rad: 0.5 },
    coats: { exit: 0.9, rad: 0.65 },
  };
  // Apartamento 3A (lado z 9..16). O 3B é espelhado em z.
  const base = [
    { id: 'sofa', kind: 'sofa', name: 'Atrás do sofá', x: 16.4, z: 11.25, r: 0 },
    { id: 'pantry', kind: 'pantry', name: 'Despensa da cozinha', x: 10.0, z: 9.5, r: 0 },
    { id: 'table', kind: 'table', name: 'Debaixo da mesa', x: 11.0, z: 12.3, r: P / 2 },
    { id: 'bed', kind: 'bed', name: 'Debaixo da cama', x: 6.3, z: 14.75, r: P },
    { id: 'wardrobe', kind: 'wardrobe', name: 'Guarda-roupa', x: 3.95, z: 11.0, r: P / 2 },
    { id: 'tub', kind: 'tub', name: 'Banheira com cortina', x: 0.6, z: 12.5, r: P / 2 },
    { id: 'curtain', kind: 'curtain', name: 'Atrás da cortina da sala', x: 18.4, z: 15.5, r: P },
    { id: 'chest', kind: 'chest', name: 'Baú de cobertores', x: 6.3, z: 9.45, r: 0 },
  ];
  const spots = [];
  for (const b of base) {
    spots.push({ ...b, id: 'a_' + b.id, name: b.name + ' (3A)', level: 1 });
    spots.push({ ...b, id: 'b_' + b.id, name: b.name + ' (3B)', level: 1, z: 16 - b.z, r: P - b.r });
  }
  spots.push(
    { id: 'c_counter', kind: 'counter', name: 'Atrás do balcão do café', x: 4.6, z: 12.7, r: P, level: 0 },
    { id: 'c_table1', kind: 'table', name: 'Mesa comprida do café', x: 4.4, z: 6.4, r: P / 2, level: 0 },
    { id: 'c_table2', kind: 'table', name: 'Mesa com toalha do café', x: 17.0, z: 8.5, r: 0, level: 0 },
    { id: 'c_sofa', kind: 'sofa', name: 'Atrás do sofazão laranja', x: 12.0, z: 3.8, r: 0, level: 0 },
    { id: 'c_coats', kind: 'coats', name: 'Atrás dos casacos', x: 19.45, z: 3.0, r: -P / 2, level: 0 },
    { id: 'c_box', kind: 'box', name: 'Caixa de entregas do café', x: 19.0, z: 15.0, r: P, level: 0 },
    { id: 'h_under', kind: 'closet', name: 'Debaixo da escada', x: 24.3, z: 10.0, r: -P / 2, level: 0 },
    { id: 'l_closet', kind: 'closet', name: 'Armário de vassouras', x: 27.45, z: 14.0, r: -P / 2, level: 0 },
    { id: 'h_box', kind: 'box', name: 'Caixa de mudança do hall', x: 21.0, z: 14.8, r: P / 2, level: 0 },
    { id: 'u_closet', kind: 'closet', name: 'Armário de roupa de cama', x: 0.5, z: 8.0, r: P / 2, level: 1 },
    { id: 'u_curtain', kind: 'curtain', name: 'Cortina do patamar', x: 22.2, z: 15.5, r: P, level: 1 },
    { id: 'u_box', kind: 'box', name: 'Caixas no patamar', x: 21.0, z: 1.0, r: P / 2, level: 1 }
  );
  for (const s of spots) {
    const k = KIND[s.kind];
    s.y = s.level ? FH : 0;
    s.ex = s.x + Math.sin(s.r) * k.exit;
    s.ez = s.z + Math.cos(s.r) * k.exit;
    s.rad = k.rad;
  }
  // alcance: quão longe o jogador está de poder usar o esconderijo (0 = encostado)
  function reach(s, x, z, y) {
    if (y !== undefined && Math.abs((y || 0) - s.y) > 1.2) return 99;
    const k = KIND[s.kind];
    if (k.maxLz !== undefined) {
      const lz = (x - s.x) * Math.sin(s.r) + (z - s.z) * Math.cos(s.r);
      if (lz > k.maxLz) return 99;
    }
    const de = Math.hypot(x - s.ex, z - s.ez);
    const dc = Math.hypot(x - s.x, z - s.z) - s.rad;
    return Math.max(0, Math.min(de, dc));
  }
  spots.reach = reach;
  spots.KIND = KIND;
  spots.REACH = 1.6; // cliente
  spots.REACH_SERVER = 2.6; // servidor (folga para atraso de rede)
  if (typeof module !== 'undefined' && module.exports) module.exports = spots;
  else root.SPOTS = spots;
})(typeof self !== 'undefined' ? self : this);
