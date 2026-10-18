// Desenho do protagonista (e dos aldeões) com sombreado em duas faces, realces e detalhes de rosto.
// Quadro 24x32, pés na linha 30. Cada parte recebe uma cor-base e uma sombra/realce derivados dela.
import { hex } from './raster.mjs';

// Mistura de cores em texto hexadecimal (#rrggbb), para que hex() continue funcionando.
const mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  const out = [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
};
export const light = (c) => mix(c, '#ffffff', 0.35);
export const dark = (c) => mix(c, '#000000', 0.3);

export function drawHero(c, o) {
  const dy = o.pose === 'idle1' ? 1 : 0; // respiração
  const stepL = o.pose === 'walkA' ? -1 : o.pose === 'walkB' ? 1 : 0;
  const stepR = -stepL;
  const side = o.dir === 'left' || o.dir === 'right';
  const back = o.dir === 'up';
  const k = o.dir === 'left' ? -1 : 1;

  const skin = hex(o.skin), skinD = hex(o.skinShade ?? dark(o.skin)), skinL = light(o.skin);
  const tunic = hex(o.tunic), tunicD = hex(o.tunicShade ?? dark(o.tunic)), tunicL = hex(o.tunicLight ?? light(o.tunic));
  const hair = hex(o.hair), hairL = hex(o.hairLight ?? light(o.hair)), hairD = hex(o.hairDark ?? dark(o.hair));
  const pants = hex(o.pants), pantsD = hex(o.pantsShade ?? dark(o.pants));
  const boot = hex(o.boots), bootL = hex(o.bootsLight ?? light(o.boots));
  const ink = hex('#1a1210');
  const mouth = hex('#b8483a');

  // ---- capa (fica atrás)
  if (o.cape) {
    const cape = hex(o.cape), capeD = hex(o.capeShade ?? dark(o.cape)), capeL = hex(o.capeLight ?? light(o.cape));
    if (back) {
      c.rect(7, 14 + dy, 10, 14, cape);
      c.rect(7, 14 + dy, 1, 14, capeD);
      c.rect(16, 14 + dy, 1, 14, capeD);
      c.rect(9, 16 + dy, 2, 10, capeL);
    } else {
      c.rect(7, 15 + dy, 2, 11, cape);
      c.rect(15, 15 + dy, 2, 11, cape);
      c.rect(7, 15 + dy, 1, 11, capeD);
      c.rect(16, 15 + dy, 1, 11, capeD);
    }
  }

  // ---- pernas e botas (com sombra no lado direito de cada perna)
  if (!side) {
    c.rect(9 + stepL, 22 + dy, 3, 6, pants);
    c.rect(11 + stepL, 22 + dy, 1, 6, pantsD);
    c.rect(12 + stepR, 22 + dy, 3, 6, pants);
    c.rect(14 + stepR, 22 + dy, 1, 6, pantsD);
    c.rect(9 + stepL, 27, 3, 3, boot);
    c.rect(9 + stepL, 27, 3, 1, bootL);
    c.rect(12 + stepR, 27, 3, 3, boot);
    c.rect(12 + stepR, 27, 3, 1, bootL);
  } else {
    c.rect(11 + stepL * k, 22 + dy, 3, 6, pants);
    c.rect(12 - stepL * k, 22 + dy, 3, 6, pants);
    c.rect(13 - stepL * k, 22 + dy, 2, 6, pantsD);
    c.rect(10 + stepL * k, 27, 4, 3, boot);
    c.rect(12 - stepL * k, 27, 4, 3, boot);
    c.rect(10 + stepL * k, 27, 4, 1, bootL);
  }

  // ---- tronco: luz à esquerda, sombra à direita, gola em V e cinto com fivela
  if (!side) {
    c.rect(8, 14 + dy, 8, 8, tunic);
    c.rect(8, 14 + dy, 2, 8, tunicL);
    c.rect(14, 14 + dy, 2, 8, tunicD);
    if (o.dir === 'down') {
      c.rect(11, 14 + dy, 2, 1, skin);
      c.put(12, 15 + dy, skin);
    }
    c.rect(8, 20 + dy, 8, 2, hex('#5e3a1c'));
    c.rect(11, 20 + dy, 2, 2, hex('#e0b050'));
  } else {
    c.rect(9, 14 + dy, 6, 8, tunic);
    c.rect(9, 14 + dy, 2, 8, tunicL);
    c.rect(13, 14 + dy, 2, 8, tunicD);
    c.rect(9, 20 + dy, 6, 2, hex('#5e3a1c'));
    c.rect(11, 20 + dy, 2, 2, hex('#e0b050'));
  }

  // ---- braços: mangas com sombra e mãos
  const swing = o.pose === 'walkA' ? 1 : o.pose === 'walkB' ? -1 : 0;
  if (!side) {
    c.rect(6, 15 + dy + swing, 2, 7, tunicL);
    c.rect(16, 15 + dy - swing, 2, 7, tunicD);
    c.rect(6, 21 + dy + swing, 2, 2, skin);
    c.rect(16, 21 + dy - swing, 2, 2, skinD);
  } else {
    c.rect(10, 15 + dy + swing, 2, 6, tunicD);
    c.rect(13, 15 + dy - swing, 2, 6, tunic);
    c.rect(13, 21 + dy - swing, 2, 2, skin);
  }

  // ---- cabeça: pele com sombra, cabelo com realce e franja
  const hy = (o.pose === 'hurt' ? 1 : 0) + dy;
  c.ellipse(12, 9 + hy, 4.5, 4.5, skin);
  c.ellipse(12, 6 + hy, 5.2, 3.8, hair);
  c.ellipse(10, 4 + hy, 2.5, 1.2, hairL);
  if (back) {
    c.ellipse(12, 9 + hy, 4.5, 4.5, hair);
    c.rect(9, 11 + hy, 6, 2, hairD);
  } else {
    // franja: linha de cabelo sobre a testa
    // franja curta: só a linha superior da testa, com mechas laterais finas
    c.rect(7, 6 + hy, 10, 1, hair);
    c.rect(7, 7 + hy, 2, 2, hair);
    c.rect(15, 7 + hy, 2, 2, hair);
    c.put(10, 7 + hy, hairL); c.put(11, 7 + hy, hairL);
    c.rect(16, 10 + hy, 1, 2, skinD);
    const mouthD = hex('#8a3a2e');
    if (o.dir === 'down') {
      // olhos com brilho, sobrancelhas e boca de dois pixels
      c.rect(9, 9 + hy, 2, 2, ink); c.put(9, 9 + hy, hex('#ffffff'));
      c.rect(14, 9 + hy, 2, 2, ink); c.put(14, 9 + hy, hex('#ffffff'));
      c.rect(9, 8 + hy, 2, 1, hairD); c.rect(14, 8 + hy, 2, 1, hairD);
      c.rect(11, 13 + hy, 2, 1, mouthD);
    }
    if (o.dir === 'left') {
      c.rect(8, 9 + hy, 2, 2, ink); c.put(8, 9 + hy, hex('#ffffff'));
      c.rect(9, 13 + hy, 2, 1, mouthD);
    }
    if (o.dir === 'right') {
      c.rect(14, 9 + hy, 2, 2, ink); c.put(15, 9 + hy, hex('#ffffff'));
      c.rect(13, 13 + hy, 2, 1, mouthD);
    }
  }
  if (o.hat) {
    const hatC = hex(o.hat), hatD = hex(o.hatShade ?? dark(o.hat));
    c.rect(4, 3 + hy, 16, 2, hatC);
    c.rect(4, 4 + hy, 16, 1, hatD);
    c.rect(7, 0 + hy, 10, 4, hatC);
    c.rect(7, 3 + hy, 10, 1, hatD);
  }
  if (o.pose === 'hurt') c.rect(8, 14, 8, 8, hex('#e0503a'));

  // ---- fio dourado (símbolo das Cordas) no peito
  if (o.golden) {
    c.line(9, 15 + dy, 14, 20 + dy, hex('#ffd45c'));
    c.put(14, 20 + dy, hex('#fff3b0'));
  }

  // ---- arma
  if (o.sword) {
    const metal = hex('#d8e2ee'), metalD = hex('#8d9aa8'), guard = hex('#d9a441');
    const attack = o.pose === 'attack';
    const hand = o.dir === 'left' ? [6, 20] : o.dir === 'up' ? [7, 20] : [17, 20];
    let tip;
    if (o.dir === 'left') tip = attack ? [0, 12] : [4, 25];
    else if (o.dir === 'up') tip = attack ? [4, 4] : [5, 24];
    else if (o.dir === 'down') tip = attack ? [19, 26] : [20, 28];
    else tip = attack ? [23, 12] : [20, 28];
    c.line(hand[0], hand[1], tip[0], tip[1], metal);
    c.line(hand[0] + 1, hand[1], tip[0] + 1, tip[1], metalD);
    c.line(hand[0], hand[1], tip[0], tip[1] - 0, metal);
    c.put(tip[0], tip[1], hex('#ffffff'));
    c.put(hand[0], hand[1] + 1, guard); c.put(hand[0] - 1, hand[1] + 1, guard);
    if (attack) {
      const sw = hex('#fff7c2', 150);
      for (let t = -0.8; t <= 0.8; t += 0.12) {
        const sx = o.dir === 'left' ? -1 : 1;
        c.put(12 + sx * 9 * Math.cos(t), 17 + Math.sin(t) * 9, sw);
      }
    }
  }
}
