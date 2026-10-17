// Carregamento dos assets gerados por tools/generate-assets.mjs.
import * as THREE from 'three';

export interface FrameRect { x: number; y: number; w: number; h: number }
export interface SheetMeta {
  image: string;
  width: number;
  height: number;
  frames: Record<string, FrameRect>;
  animations: Record<string, string[]>;
  frameWidth?: number;
  frameHeight?: number;
  anchor?: [number, number];
}
export interface SheetAsset { meta: SheetMeta; texture: THREE.Texture; name: string }

export interface Assets {
  loadedCount: number;
  totalCount: number;
  texture(name: string): THREE.Texture;
  sheet(name: string): SheetAsset;
  /** Clone de textura apontando para um quadro (sem recarregar a imagem). */
  frame(sheetName: string, frame: string): THREE.Texture;
  /** Clone de textura com repetição própria (texturas compartilhadas não mudam de escala). */
  tiled(name: string, rx: number, ry: number): THREE.Texture;
}

const TEXTURES = [
  'grass_ground', 'dirt_path', 'stone_plaza', 'moss_stone', 'bark', 'corrupt_ground',
  'wood_wall', 'stone_wall', 'shingle_roof', 'door', 'window_lit', 'rock_moss',
  'light_shaft', 'glow_soft', 'blob_shadow',
];
const TILEABLE = new Set(['grass_ground', 'dirt_path', 'stone_plaza', 'moss_stone', 'bark', 'corrupt_ground', 'wood_wall', 'stone_wall', 'shingle_roof', 'rock_moss']);
const SHEETS: Array<{ name: string; dir: string }> = [
  { name: 'player', dir: 'sprites' },
  { name: 'villager_a', dir: 'sprites' },
  { name: 'villager_b', dir: 'sprites' },
  { name: 'herald', dir: 'sprites' },
  { name: 'creature', dir: 'sprites' },
  { name: 'fragment', dir: 'sprites' },
  { name: 'leaf_clusters', dir: 'vegetation' },
  { name: 'flowers', dir: 'vegetation' },
  { name: 'mushrooms', dir: 'vegetation' },
  { name: 'ferns', dir: 'vegetation' },
];

export async function loadAssets(onProgress?: (done: number, total: number, label: string) => void): Promise<Assets> {
  const loader = new THREE.TextureLoader();
  const base = import.meta.env.BASE_URL ?? '/';
  const total = TEXTURES.length + SHEETS.length * 2;
  let done = 0;
  const tick = (label: string) => {
    done++;
    onProgress?.(done, total, label);
  };
  const textures = new Map<string, THREE.Texture>();
  const sheets = new Map<string, SheetAsset>();

  const loadTex = async (path: string) => {
    const t = await loader.loadAsync(`${base}${path}`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  for (const name of TEXTURES) {
    const t = await loadTex(`assets/textures/${name}.png`);
    if (TILEABLE.has(name)) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
    }
    if (name === 'window_lit' || name === 'door' || name === 'blob_shadow') t.magFilter = THREE.NearestFilter;
    textures.set(name, t);
    tick(name);
  }

  for (const { name, dir } of SHEETS) {
    const meta = (await (await fetch(`${base}assets/${dir}/${name}.json`)).json()) as SheetMeta;
    const texture = await loadTex(`assets/${dir}/${meta.image}`);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    sheets.set(name, { meta, texture, name });
    tick(`${name}.json`);
    tick(name);
  }

  const tex = (name: string): THREE.Texture => {
    const t = textures.get(name);
    if (!t) throw new Error(`Textura não carregada: ${name}`);
    return t;
  };
  const sheet = (name: string): SheetAsset => {
    const s = sheets.get(name);
    if (!s) throw new Error(`Sheet não carregada: ${name}`);
    return s;
  };

  return {
    loadedCount: done,
    totalCount: total,
    texture: tex,
    sheet,
    frame(sheetName, frame) {
      const s = sheet(sheetName);
      const r = s.meta.frames[frame];
      if (!r) throw new Error(`Quadro inexistente: ${sheetName}/${frame}`);
      const t = s.texture.clone();
      t.repeat.set(r.w / s.meta.width, r.h / s.meta.height);
      t.offset.set(r.x / s.meta.width, 1 - (r.y + r.h) / s.meta.height);
      t.needsUpdate = true;
      return t;
    },
    tiled(name, rx, ry) {
      const t = tex(name).clone();
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
      return t;
    },
  };
}
