// Gera TODOS os recursos gráficos do experimento a partir de código.
// Saída: public/assets/** (PNG + JSON de metadados) e docs/ASSET_REGISTRY.md.
// Nenhum arquivo de terceiros é lido: tudo é desenhado pelas regras deste arquivo.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, hex, mulberry32, fbm } from './raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets');
const registry = [];
const OUTLINE = hex('#1c1420');

function save(relPath, raster, meta) {
  const full = join(OUT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, raster.toPNG());
  registry.push({ file: `public/assets/${relPath}`, width: raster.w, height: raster.h, ...meta });
}

function saveSheet(name, dir, raster, frames, animations, technique, extra = {}) {
  save(join(dir, `${name}.png`), raster, { technique, type: 'sprite-sheet' });
  const meta = { image: `${name}.png`, width: raster.w, height: raster.h, frames, animations, generator: 'tools/generate-assets.mjs', technique, ...extra };
  mkdirSync(join(OUT, dir), { recursive: true });
  writeFileSync(join(OUT, dir, `${name}.json`), JSON.stringify(meta, null, 2));
  registry.push({ file: `public/assets/${dir}/${name}.json`, width: raster.w, height: raster.h, technique: 'metadados de animação do sheet acima', type: 'metadata' });
}

const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 255];

function tileable(w, h, fn) {
  const r = new Raster(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) r.put(x, y, fn(x, y));
  return r;
}

// ---------------------------------------------------------------- texturas tileáveis
function genGround() {
  const A = hex('#3f7a2c'), B = hex('#6fa640'), C = hex('#2b5a22'), Y = hex('#c9c05a');
  const r = tileable(256, 256, (x, y) => {
    const n = fbm(x / 32, y / 32, 8, 3, 4);
    const m = fbm(x / 9, y / 9, 32, 9, 2);
    let c = lerpC(C, B, Math.min(1, Math.max(0, (n - 0.25) * 2.2)));
    c = lerpC(c, A, m * 0.6);
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    if (h % 97 === 0) c = Y;
    if (h % 61 === 1) c = lerpC(c, [20, 40, 18, 255], 0.7);
    return c;
  });
  save('textures/grass_ground.png', r, { technique: 'ruído fBm periódico + pontos de cor (tileável)', type: 'texture' });
}
function genDirt() {
  const r = tileable(128, 128, (x, y) => {
    const n = fbm(x / 16, y / 16, 8, 21, 4);
    let c = lerpC(hex('#6b4a2a'), hex('#a57a48'), n);
    if (((x * 31 + y * 17) % 53) === 0) c = hex('#8f8a7a');
    return c;
  });
  save('textures/dirt_path.png', r, { technique: 'ruído fBm periódico com seixos', type: 'texture' });
}
function genStonePlaza() {
  const r = tileable(128, 128, (x, y) => {
    const tx = Math.floor(x / 32), ty = Math.floor(y / 32);
    const lx = x % 32, ly = y % 32;
    const tone = 0.75 + 0.25 * fbm(x / 10, y / 10, 13, 40 + tx + ty * 4, 3);
    if (lx === 0 || ly === 0) return hex('#5d5b57');
    return lerpC(hex('#8c8a84'), hex('#b9b5aa'), tone);
  });
  save('textures/stone_plaza.png', r, { technique: 'ladrilhos 32px com ruído fBm (tileável)', type: 'texture' });
}
function genMossStone() {
  const r = tileable(128, 128, (x, y) => {
    const n = fbm(x / 14, y / 14, 9, 55, 4);
    const m = fbm(x / 7, y / 7, 18, 56, 3);
    let c = lerpC(hex('#6c6a66'), hex('#9a968c'), n);
    if (m > 0.52) c = lerpC(c, hex('#4e7a33'), Math.min(1, (m - 0.52) * 5));
    return c;
  });
  save('textures/moss_stone.png', r, { technique: 'pedra com musgo por ruído fBm (tileável)', type: 'texture' });
}
function genBark() {
  const r = tileable(128, 256, (x, y) => {
    const streak = fbm(x / 3, y / 40, 42, 61, 3);
    const grain = fbm(x / 9, y / 9, 28, 62, 2);
    return lerpC(hex('#2e1d12'), hex('#7a5232'), streak * 0.8 + grain * 0.3);
  });
  save('textures/bark.png', r, { technique: 'ruído anisotrópico periódico (casca)', type: 'texture' });
}
function genCorrupt() {
  const r = tileable(256, 256, (x, y) => {
    const n = fbm(x / 24, y / 24, 10, 77, 4);
    const v = 1 - Math.abs(fbm(x / 12, y / 12, 20, 78, 3) * 2 - 1);
    let c = lerpC(hex('#140a1f'), hex('#3a1b4f'), n);
    if (v > 0.82) c = lerpC(c, hex('#b44cff'), (v - 0.82) * 4);
    return c;
  });
  save('textures/corrupt_ground.png', r, { technique: 'ruído fBm + veios de ridged noise (tileável)', type: 'texture' });
}

// ---------------------------------------------------------------- arquitetura
function woodWall() {
  const r = new Raster(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const plank = Math.floor(y / 16);
    let c = lerpC(hex('#5e3b22'), hex('#9b6638'), fbm(x / 6, y / 3, 16, 90 + plank, 2));
    if (y % 16 === 0) c = hex('#2e1b10');
    if (((x + plank * 23) % 41) === 0) c = lerpC(c, hex('#2e1b10'), 0.5);
    r.put(x, y, c);
  }
  save('textures/wood_wall.png', r, { technique: 'tábuas horizontais com veio fBm', type: 'texture' });
}
function stoneWall() {
  const r = new Raster(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const row = Math.floor(y / 8);
    const mx = (x + (row % 2 ? 8 : 0)) % 16, my = y % 8;
    const n = fbm(x / 4, y / 4, 16, 120 + row, 2);
    r.put(x, y, (mx === 0 || my === 0) ? hex('#5a5751') : lerpC(hex('#7b7266'), hex('#a79a86'), n));
  }
  save('textures/stone_wall.png', r, { technique: 'alvenaria de pedra em fiadas', type: 'texture' });
}
function shingle() {
  const r = new Raster(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const row = Math.floor(y / 6);
    const sx = (x + (row % 2 ? 4 : 0)) % 8, sy = y % 6;
    const d = Math.hypot(sx - 4, (sy - 6) * 1.2);
    let c = lerpC(hex('#3b3f5c'), hex('#6d6a8a'), fbm(x / 5, y / 5, 13, 150, 2));
    if (d > 4.6 || sy === 0) c = hex('#1f2030');
    r.put(x, y, c);
  }
  save('textures/shingle_roof.png', r, { technique: 'telhas em escamas com sulco', type: 'texture' });
}
function doorAndWindow() {
  const d = new Raster(16, 32);
  d.rect(1, 1, 14, 31, hex('#4a2c17'));
  d.rect(2, 2, 12, 30, hex('#6b4224'));
  for (let y = 2; y < 31; y += 5) d.rect(2, y, 12, 1, hex('#3a2212'));
  d.rect(12, 17, 2, 2, hex('#f0c05a'));
  save('textures/door.png', d, { technique: 'porta de tábuas desenhada por código', type: 'texture' });
  const w = new Raster(16, 16);
  w.rect(0, 0, 16, 16, hex('#3a2a18'));
  w.rect(2, 2, 12, 12, hex('#ffd27a'));
  w.rect(2, 2, 12, 2, hex('#fff1bf'));
  w.rect(7, 2, 2, 12, hex('#3a2a18'));
  w.rect(2, 7, 12, 2, hex('#3a2a18'));
  save('textures/window_lit.png', w, { technique: 'janela iluminada (emissiva)', type: 'texture' });
}

// ---------------------------------------------------------------- vegetação
function leafClusters() {
  const atlas = new Raster(256, 256);
  const frames = {};
  // Duas famílias de cor: verdes saturados e copas de outono (laranja e vermelho), como na referência.
  const palettes = [
    ['#2f7a2c', '#58a83a', '#9ad65a'],
    ['#4a7a22', '#86a83a', '#d4c24a'],
    ['#b8461e', '#e0762a', '#ffb04a'],
    ['#8a2a1a', '#c4502a', '#f08a3a'],
  ];
  for (let k = 0; k < 4; k++) {
    const rng = mulberry32(900 + k * 13);
    const ox = (k % 2) * 128, oy = Math.floor(k / 2) * 128;
    const [dark, mid, light] = palettes[k].map((h) => hex(h));
    const cluster = new Raster(128, 128);
    for (let i = 0; i < 170; i++) {
      const ang = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * 52;
      const cx = 64 + Math.cos(ang) * rr;
      const cy = 60 + Math.sin(ang) * rr * 0.72;
      const len = 4 + rng() * 5;
      const rot = rng() * Math.PI * 2;
      const shade = (cy - 20) / 90;
      const c = shade < 0.35 ? light : shade < 0.7 ? mid : dark;
      const pts = [];
      for (let t = 0; t < 8; t++) {
        const a = (t / 8) * Math.PI * 2;
        const ex = Math.cos(a) * len, ey = Math.sin(a) * len * 0.45;
        pts.push([cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)]);
      }
      cluster.poly(pts, c);
      if (rng() < 0.25) cluster.line(cx, cy, cx + Math.cos(rot) * len * 0.9, cy + Math.sin(rot) * len * 0.9, lerpC(c, [0, 0, 0, 255], 0.35));
    }
    // Sombra de borda: folhas encostadas no vazio ficam um pouco mais escuras.
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      if (cluster.get(x, y)[3] === 0) continue;
      let edge = false;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx > 127 || ny > 127 || cluster.get(nx, ny)[3] === 0) edge = true;
      }
      if (edge) cluster.put(x, y, lerpC(cluster.get(x, y), [10, 25, 10, 255], 0.25));
    }
    atlas.blit(cluster, ox, oy);
    frames[`cluster_${k}`] = { x: ox, y: oy, w: 128, h: 128 };
  }
  saveSheet('leaf_clusters', 'vegetation', atlas, frames, {}, 'folhagem: 170 folhas elípticas por agrupamento, sombreadas por altura');
}

function flowers() {
  const colors = ['#ff6fa8', '#ffd84a', '#ffffff', '#7fb2ff', '#c77dff', '#ff8a3d', '#ff4d4d', '#fff0c0'];
  const r = new Raster(128, 16);
  const frames = {};
  colors.forEach((col, i) => {
    const ox = i * 16;
    const c = hex(col);
    r.rect(ox + 7, 9, 2, 7, hex('#2f7a2c'));
    r.put(ox + 6, 12, hex('#3f9a3a')); r.put(ox + 9, 11, hex('#3f9a3a'));
    for (const [px, py] of [[8, 4], [5, 6], [11, 6], [6, 9], [10, 9]]) r.ellipse(ox + px, py, 2.1, 2.1, c);
    r.put(ox + 8, 6, hex('#f2b530'));
    frames[`flower_${i}`] = { x: ox, y: 0, w: 16, h: 16 };
  });
  r.outline(hex('#1b3a18', 200));
  saveSheet('flowers', 'vegetation', r, frames, {}, 'flores de 5 pétalas em pixel art, 8 variantes');
}
function mushrooms() {
  const r = new Raster(32, 16);
  const frames = {};
  for (let i = 0; i < 2; i++) {
    const ox = i * 16;
    r.rect(ox + 7, 9, 3, 6, hex('#eee2c8'));
    r.ellipse(ox + 8.5, 8, 6, 4.2, i ? hex('#c94c3a') : hex('#d8b26a'));
    for (const [x, y] of [[ox + 5, 7], [ox + 10, 6], [ox + 8, 9]]) r.put(x, y, hex('#fff6e0'));
    frames[`mushroom_${i}`] = { x: ox, y: 0, w: 16, h: 16 };
  }
  r.outline(hex('#2a1a12'));
  saveSheet('mushrooms', 'vegetation', r, frames, {}, 'cogumelos de duas cores');
}
function ferns() {
  const r = new Raster(64, 32);
  const frames = {};
  for (let i = 0; i < 2; i++) {
    const ox = i * 32;
    const g = i ? hex('#2e7d4a') : hex('#3c8f3a');
    for (let f = 0; f < 7; f++) {
      const a = -1.2 + f * 0.4 + (i ? 0.2 : 0);
      const len = 14 - Math.abs(f - 3) * 1.6;
      const bx = ox + 16, by = 30;
      const tx = bx + Math.cos(a - Math.PI / 2) * len, ty = by + Math.sin(a - Math.PI / 2) * len;
      r.line(bx, by, tx, ty, g);
      for (let s = 2; s < len; s += 2) {
        const sx = bx + (tx - bx) * (s / len), sy = by + (ty - by) * (s / len);
        r.line(sx, sy, sx - 3, sy - 1, lerpC(g, [0, 0, 0, 255], 0.2));
        r.line(sx, sy, sx + 3, sy - 1, lerpC(g, [0, 0, 0, 255], 0.2));
      }
    }
    frames[`fern_${i}`] = { x: ox, y: 0, w: 32, h: 32 };
  }
  saveSheet('ferns', 'vegetation', r, frames, {}, 'samambaias: frondes com folíolos desenhados por linha');
}
function rockMoss() {
  const r = new Raster(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const d = Math.hypot((x - 32) / 28, (y - 36) / 22);
    if (d > 1 + (fbm(x / 8, y / 8, 8, 444, 2) - 0.5) * 0.4) continue;
    let c = lerpC(hex('#5a5852'), hex('#9b978c'), fbm(x / 6, y / 6, 12, 445, 3));
    const moss = fbm(x / 5, y / 5, 10, 446, 3) + (y / 64) * 0.4;
    if (moss > 0.82) c = lerpC(c, hex('#4f7d2e'), 0.9);
    r.put(x, y, c);
  }
  save('textures/rock_moss.png', r, { technique: 'pedra com musgo por ruído (silhueta elíptica)', type: 'texture' });
}
function lightShaft() {
  const r = new Raster(32, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 32; x++) {
    const hx = Math.abs(x - 16) / 16;
    const a = Math.max(0, 1 - hx * hx) * Math.pow(1 - y / 256, 1.6) * 255;
    r.put(x, y, [255, 230, 160, Math.round(a)]);
  }
  save('textures/light_shaft.png', r, { technique: 'gradiente gaussiano vertical (raio de sol)', type: 'texture' });
}
function glow() {
  const r = new Raster(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const d = Math.hypot(x - 31.5, y - 31.5) / 31.5;
    const a = Math.max(0, 1 - d);
    r.put(x, y, [255, 255, 255, Math.round(a * a * 255)]);
  }
  save('textures/glow_soft.png', r, { technique: 'halo radial (aura aditiva)', type: 'texture' });
  const s = new Raster(32, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) {
    const d = Math.hypot((x - 15.5) / 15.5, (y - 7.5) / 7.5);
    s.put(x, y, [0, 0, 0, Math.round(Math.max(0, 1 - d) * 170)]);
  }
  save('textures/blob_shadow.png', s, { technique: 'sombra elíptica suave', type: 'texture' });
}

// ---------------------------------------------------------------- personagens
function humanoid(c, o) {
  // Figura 24x32, pés na linha 30. Coordenadas absolutas dentro do quadro.
  const dy = o.pose === 'idle1' ? 1 : 0;
  const stepL = o.pose === 'walkA' ? -1 : o.pose === 'walkB' ? 1 : 0;
  const stepR = -stepL;
  const side = o.dir === 'left' || o.dir === 'right';
  const back = o.dir === 'up';
  const k = o.dir === 'left' ? -1 : 1;
  const skin = hex(o.skin), tunic = hex(o.tunic), tunicD = hex(o.tunicShade);
  const hair = hex(o.hair), dark = hex('#1a1210');
  if (o.cape) {
    const cape = hex(o.cape);
    if (back) c.rect(7, 14 + dy, 10, 13, cape);
    else { c.rect(7, 15 + dy, 2, 10, cape); c.rect(15, 15 + dy, 2, 10, cape); }
  }
  if (!side) {
    c.rect(9 + stepL, 22 + dy, 3, 6, hex(o.pants));
    c.rect(12 + stepR, 22 + dy, 3, 6, hex(o.pants));
    c.rect(9 + stepL, 27, 3, 3, hex(o.boots));
    c.rect(12 + stepR, 27, 3, 3, hex(o.boots));
  } else {
    c.rect(11 + stepL * k, 22 + dy, 3, 6, hex(o.pants));
    c.rect(12 - stepL * k, 22 + dy, 3, 6, hex(o.pants));
    c.rect(10 + stepL * k, 27, 4, 3, hex(o.boots));
    c.rect(12 - stepL * k, 27, 4, 3, hex(o.boots));
  }
  if (!side) {
    c.rect(8, 14 + dy, 8, 8, tunic);
    c.rect(12, 14 + dy, 4, 8, tunicD);
    c.rect(8, 20 + dy, 8, 2, hex('#6b4321'));
  } else {
    c.rect(9, 14 + dy, 6, 8, tunic);
    c.rect(12, 14 + dy, 3, 8, tunicD);
    c.rect(9, 20 + dy, 6, 2, hex('#6b4321'));
  }
  const swing = o.pose === 'walkA' ? 1 : o.pose === 'walkB' ? -1 : 0;
  if (!side) {
    c.rect(6, 15 + dy + swing, 2, 7, tunicD);
    c.rect(16, 15 + dy - swing, 2, 7, tunicD);
    c.rect(6, 21 + dy + swing, 2, 2, skin);
    c.rect(16, 21 + dy - swing, 2, 2, skin);
  } else {
    c.rect(10, 15 + dy + swing, 2, 6, tunicD);
    c.rect(13, 15 + dy - swing, 2, 6, tunic);
    c.rect(13, 21 + dy - swing, 2, 2, skin);
  }
  const hy = (o.pose === 'hurt' ? 1 : 0) + dy;
  c.ellipse(12, 9 + hy, 4.5, 4.5, skin);
  c.ellipse(12, 6 + hy, 5, 3.5, hair);
  if (back) c.ellipse(12, 9 + hy, 4.5, 4.5, hair);
  else {
    c.rect(7, 8 + hy, 2, 3, hair);
    c.rect(15, 8 + hy, 2, 3, hair);
    if (o.dir === 'down') { c.rect(10, 9 + hy, 1, 2, dark); c.rect(14, 9 + hy, 1, 2, dark); }
    if (o.dir === 'left') c.rect(9, 9 + hy, 1, 2, dark);
    if (o.dir === 'right') c.rect(14, 9 + hy, 1, 2, dark);
  }
  if (o.hat) {
    c.rect(4, 3 + hy, 16, 2, hex(o.hat));
    c.rect(7, 0 + hy, 10, 4, hex(o.hat));
  }
  if (o.pose === 'hurt') c.rect(8, 14, 8, 8, hex('#e0503a'));
  if (o.golden) {
    c.line(9, 15 + dy, 14, 20 + dy, hex('#ffd45c'));
    c.put(14, 20 + dy, hex('#fff3b0'));
  }
  if (o.sword) {
    const metal = hex('#d8e2ee'), guard = hex('#d9a441');
    const attack = o.pose === 'attack';
    const hand = o.dir === 'left' ? [6, 20] : o.dir === 'up' ? [7, 20] : [17, 20];
    let tip;
    if (o.dir === 'left') tip = attack ? [0, 12] : [4, 25];
    else if (o.dir === 'up') tip = attack ? [4, 4] : [5, 24];
    else if (o.dir === 'down') tip = attack ? [19, 26] : [20, 28];
    else tip = attack ? [23, 12] : [20, 28];
    c.line(hand[0], hand[1], tip[0], tip[1], metal);
    c.line(hand[0] + 1, hand[1], tip[0] + 1, tip[1], hex('#ffffff'));
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

function heroSheet(cfg, dirs, poses, anims) {
  const FW = 24, FH = 32;
  const sheet = new Raster(poses.length * FW, dirs.length * FH);
  const frames = {};
  const animations = {};
  dirs.forEach((dir, row) => {
    poses.forEach((pose, col) => {
      const f = new Raster(FW, FH);
      humanoid(f, { ...cfg, dir, pose });
      f.outline(OUTLINE);
      sheet.blit(f, col * FW, row * FH);
      frames[`${dir}_${pose}`] = { x: col * FW, y: row * FH, w: FW, h: FH };
    });
    for (const [anim, list] of Object.entries(anims)) {
      animations[`${anim}_${dir}`] = list.map((p) => `${dir}_${p}`);
    }
  });
  return { sheet, frames, animations };
}

const HERO_CFG = {
  skin: '#f0c39a', skinShade: '#d9a078', hair: '#5a3418', tunic: '#2f7f6e', tunicShade: '#22594d',
  pants: '#2e3a52', boots: '#3b2a1e', cape: '#2c4f9e', sword: true, golden: true,
};
function genPlayer() {
  const dirs = ['down', 'up', 'left', 'right'];
  const poses = ['idle0', 'idle1', 'walkA', 'walkB', 'attack', 'hurt'];
  const { sheet, frames, animations } = heroSheet(HERO_CFG, dirs, poses, {
    idle: ['idle0', 'idle1'], walk: ['walkA', 'idle0', 'walkB', 'idle0'], attack: ['attack'], hurt: ['hurt'],
  });
  saveSheet('player', 'sprites', sheet, frames, animations,
    'herói 24x32 desenhado por primitivas (elipses, retângulos, linhas) + contorno automático',
    { directions: dirs, poses, frameWidth: 24, frameHeight: 32, anchor: [12, 31] });
}
const VILLAGERS = {
  villager_a: { skin: '#e8b48c', skinShade: '#c99470', hair: '#d9b26a', tunic: '#9b6b3d', tunicShade: '#74502b', pants: '#4a3a2a', boots: '#2c2118' },
  villager_b: { skin: '#d9a57e', skinShade: '#b98260', hair: '#3a2a22', tunic: '#6d8a4a', tunicShade: '#4e6633', pants: '#5b4a35', boots: '#2c2118', hat: '#d8b860' },
};
function genVillagers() {
  for (const [name, cfg] of Object.entries(VILLAGERS)) {
    const dirs = ['down', 'up', 'left', 'right'];
    const poses = ['idle0', 'idle1', 'walkA', 'walkB'];
    const { sheet, frames, animations } = heroSheet(cfg, dirs, poses, {
      idle: ['idle0', 'idle1'], walk: ['walkA', 'idle0', 'walkB', 'idle0'],
    });
    saveSheet(name, 'sprites', sheet, frames, animations,
      'aldeão 24x32 desenhado por primitivas, sem arma, com variação de cores',
      { directions: dirs, poses, frameWidth: 24, frameHeight: 32, anchor: [12, 31] });
  }
}

function herald() {
  const FW = 64, FH = 64;
  const flaps = [-0.55, -0.15, 0.25, 0.6];
  const sheet = new Raster(FW * flaps.length, FH);
  const frames = {};
  const animations = { flap: [] };
  flaps.forEach((f, i) => {
    const r = new Raster(FW, FH);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const d = Math.hypot(x - 32, y - 34) / 30;
      if (d < 1) r.put(x, y, [120, 210, 255, Math.round((1 - d) * (1 - d) * 70)]);
    }
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        // Lado esquerdo aponta para a esquerda e para cima (ângulo perto de π); o direito, espelhado.
        const spread = 0.2 + k * 0.28;
        const base = side < 0 ? Math.PI + spread - f * 0.3 * (1 + k * 0.2) : -spread + f * 0.3 * (1 + k * 0.2);
        const len = 24 - k * 2.5;
        const rx = 32 + side * 4, ry = 30 + k * 1.5;
        const tx = rx + Math.cos(base) * len;
        const ty = ry + Math.sin(base) * len;
        const pw = 2.5 + k * 0.4;
        const nx = -Math.sin(base) * pw, ny = Math.cos(base) * pw;
        const featherCol = k === 0 ? [255, 236, 170, 230] : [205, 240, 255, 215];
        r.poly([[rx + nx, ry + ny], [tx, ty], [rx - nx, ry - ny]], featherCol);
        r.line(rx, ry, tx, ty, [255, 214, 90, 255]);
      }
    }
    r.ellipse(32, 42, 11, 14, hex('#2a3f8f', 245));
    r.ellipse(32, 40, 8, 11, hex('#3b58b8', 245));
    r.ellipse(32, 38, 3.5, 6, hex('#9ff3ff', 230));
    r.poly([[24, 50], [40, 50], [35, 60], [32, 62], [29, 60]], hex('#1f2f70', 240));
    r.ellipse(32, 22, 6, 6.5, hex('#e7f4ff'));
    r.put(30, 22, hex('#ffd34d')); r.put(34, 22, hex('#ffd34d'));
    r.put(31, 21, hex('#fff6b0')); r.put(33, 21, hex('#fff6b0'));
    r.line(23, 40, 17, 50, hex('#8ff0ff', 220));
    r.line(41, 40, 47, 50, hex('#8ff0ff', 220));
    sheet.blit(r, i * FW, 0);
    frames[`flap_${i}`] = { x: i * FW, y: 0, w: FW, h: FH };
    animations.flap.push(`flap_${i}`);
  });
  saveSheet('herald', 'sprites', sheet, frames, animations,
    'arauto 64x64 com seis asas de penas desenhadas por polígonos, batimento em 4 quadros',
    { frameWidth: FW, frameHeight: FH, anchor: [32, 40] });
}

function creature() {
  // Espinhal Corrompido: quadrúpede 32x24. Quadros: andar A/B, ataque, dano, dissipação x4.
  const FW = 32, FH = 24;
  const body = hex('#3a1d4f'), spike = hex('#7d3fbf'), belly = hex('#1a0d24'), eye = hex('#ff5fd2');
  const hurtBody = hex('#7a2c6e');
  const draw = (r, step, attack, hurt) => {
    const bodyC = hurt ? hurtBody : body;
    r.ellipse(15, 12, 9, 5, bodyC);
    r.ellipse(15, 9, 7, 3, spike);
    r.ellipse(15, 15, 8, 2, belly);
    for (let x = 8; x <= 22; x += 3) r.poly([[x, 8], [x + 1.5, 4], [x + 3, 8]], spike);
    const hx = attack ? 26 : 25;
    r.ellipse(hx, 11, 4, 3.5, bodyC);
    r.put(hx + 1, 10, eye); r.put(hx + 2, 10, eye);
    if (attack) {
      r.poly([[hx + 3, 11], [hx + 8, 9], [hx + 3, 13]], hex('#f5efe0'));
    } else {
      r.put(hx + 3, 12, hex('#f5efe0'));
    }
    const legs = step === 0 ? [[9, 0], [13, 0], [18, 0], [22, 0]] : [[9, 1], [13, -1], [18, 1], [22, -1]];
    for (const [lx, o] of legs) r.line(lx, 16, lx + o, 22, body);
    r.line(5, 11, 1, 6, body);
    r.put(0, 5, spike); r.put(1, 6, spike);
  };
  const variants = [
    ['walkA', (r) => draw(r, 0, false, false)],
    ['walkB', (r) => draw(r, 1, false, false)],
    ['attack', (r) => draw(r, 0, true, false)],
    ['hurt', (r) => draw(r, 0, false, true)],
  ];
  const sheet = new Raster(FW * 8, FH);
  const frames = {};
  const built = variants.map(([name, fn]) => {
    const r = new Raster(FW, FH);
    fn(r);
    r.outline(hex('#0d0614'));
    return [name, r];
  });
  built.forEach(([name, r], i) => {
    sheet.blit(r, i * FW, 0);
    frames[name] = { x: i * FW, y: 0, w: FW, h: FH };
  });
  const rng = mulberry32(2024);
  for (let k = 0; k < 4; k++) {
    const r = new Raster(FW, FH);
    const keep = 1 - (k + 1) / 5;
    const src = built[0][1];
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const p = src.get(x, y);
      if (p[3] === 0) continue;
      if (rng() < keep) r.put(x, y, p);
      else if (rng() < 0.5) r.put(x, y, [200, 120, 255, 170]);
    }
    sheet.blit(r, (4 + k) * FW, 0);
    frames[`dissolve_${k}`] = { x: (4 + k) * FW, y: 0, w: FW, h: FH };
  }
  saveSheet('creature', 'sprites', sheet, frames, {
    walk: ['walkA', 'walkB'], attack: ['attack'], hurt: ['hurt'],
    dissolve: ['dissolve_0', 'dissolve_1', 'dissolve_2', 'dissolve_3'],
  }, 'criatura corrompida 32x24 desenhada por primitivas, dissipação por remoção de pixels', { frameWidth: FW, frameHeight: FH, anchor: [16, 22] });
}

function fragment() {
  const FW = 16, FH = 16;
  const sheet = new Raster(FW * 4, FH);
  const frames = {};
  const animations = { pulse: [] };
  for (let i = 0; i < 4; i++) {
    const r = new Raster(FW, FH);
    const s = 1 + (i === 1 || i === 3 ? 0.1 : 0) + (i === 2 ? -0.05 : 0);
    const cx = 7.5, cy = 7.5;
    r.poly([[cx, cy - 6 * s], [cx + 4 * s, cy], [cx, cy + 6 * s], [cx - 4 * s, cy]], hex('#ffd36b'));
    r.poly([[cx, cy - 4 * s], [cx + 2 * s, cy], [cx, cy + 4 * s], [cx - 2 * s, cy]], hex('#fff6c8'));
    r.put(7, 7, hex('#ffffff')); r.put(8, 7, hex('#ffffff'));
    r.outline(hex('#6b4a10'));
    sheet.blit(r, i * FW, 0);
    frames[`pulse_${i}`] = { x: i * FW, y: 0, w: FW, h: FH };
    animations.pulse.push(`pulse_${i}`);
  }
  saveSheet('fragment', 'sprites', sheet, frames, animations, 'fragmento de cristal 16x16, 4 quadros de pulsação', { frameWidth: FW, frameHeight: FH, anchor: [8, 14] });
}

// ---------------------------------------------------------------- execução
genGround(); genDirt(); genStonePlaza(); genMossStone(); genBark(); genCorrupt();
woodWall(); stoneWall(); shingle(); doorAndWindow();
leafClusters(); flowers(); mushrooms(); ferns(); rockMoss(); lightShaft(); glow();
genPlayer(); genVillagers(); herald(); creature(); fragment();

const images = registry.filter((a) => a.type !== 'metadata');
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
  generatedBy: 'tools/generate-assets.mjs',
  note: 'Todos os recursos são gerados por código deste projeto. Nenhum arquivo de terceiros é usado.',
  assets: registry,
}, null, 2));

const md = [
  '# Registro de assets', '',
  'Gerado por `tools/generate-assets.mjs`. Todos os recursos são desenhados por código (primitivas, ruído procedural, contorno automático).', '',
  '| Arquivo | Dimensões | Técnica |', '|---|---|---|',
  ...images.map((a) => `| \`${a.file}\` | ${a.width}x${a.height} | ${a.technique} |`),
  '',
  'Cada sheet em `public/assets/sprites/` e `public/assets/vegetation/` tem um `.json` de metadados (quadros e animações).', '',
].join('\n');
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs', 'ASSET_REGISTRY.md'), md);
console.log(`Assets gerados: ${images.length} imagens, ${registry.length - images.length} metadados.`);
