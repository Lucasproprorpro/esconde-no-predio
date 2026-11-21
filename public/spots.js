// Esconderijos — compartilhado entre servidor (require) e cliente (<script>)
(function (root) {
  const P = Math.PI;
  // Apartamento 3A (lado z 9..16). O 3B é espelhado em z.
  const base = [
    { id: 'sofa', kind: 'sofa', name: 'Atrás do sofá', x: 16.5, z: 11.3, r: 0 },
    { id: 'pantry', kind: 'pantry', name: 'Despensa', x: 12.35, z: 15.45, r: P },
    { id: 'table', kind: 'table', name: 'Mesa com toalha', x: 10.8, z: 11.6, r: P / 2 },
    { id: 'bed', kind: 'bed', name: 'Embaixo da cama', x: 6.3, z: 14.75, r: P },
    { id: 'wardrobe', kind: 'wardrobe', name: 'Guarda-roupa', x: 3.95, z: 11.0, r: P / 2 },
    { id: 'tub', kind: 'tub', name: 'Banheira com cortina', x: 0.6, z: 12.5, r: P / 2 },
  ];
  const spots = [];
  for (const b of base) {
    spots.push({ ...b, id: 'a_' + b.id, name: b.name + ' (3A)', level: 1 });
    spots.push({ ...b, id: 'b_' + b.id, name: b.name + ' (3B)', level: 1, z: 16 - b.z, r: P - b.r });
  }
  spots.push(
    { id: 'c_counter', kind: 'counter', name: 'Atrás do balcão do café', x: 5, z: 12.5, r: P, level: 0 },
    { id: 'c_table1', kind: 'table', name: 'Mesa com toalha do café', x: 6, z: 5, r: 0, level: 0 },
    { id: 'c_table2', kind: 'table', name: 'Mesa redonda do café', x: 12.5, z: 8.5, r: -P / 2, level: 0 },
    { id: 'c_sofa', kind: 'sofa', name: 'Atrás do sofá do café', x: 15, z: 5.2, r: P, level: 0 },
    { id: 'l_closet', kind: 'closet', name: 'Armário de vassouras', x: 27.45, z: 14, r: -P / 2, level: 0 },
    { id: 'h_closet', kind: 'closet', name: 'Armário do corredor', x: 0.5, z: 8, r: P / 2, level: 1 }
  );
  const EXIT = { wardrobe: 1.0, pantry: 0.95, closet: 0.95, bed: 1.5, table: 1.15, tub: 0.95, sofa: 0, counter: 0 };
  for (const s of spots) {
    s.y = s.level ? 3.2 : 0;
    const e = EXIT[s.kind];
    s.ex = s.x + Math.sin(s.r) * e;
    s.ez = s.z + Math.cos(s.r) * e;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = spots;
  else root.SPOTS = spots;
})(typeof self !== 'undefined' ? self : this);
