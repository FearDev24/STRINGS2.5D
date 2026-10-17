import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'public', 'assets');

function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function listPngs(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listPngs(p) : f.endsWith('.png') ? [p] : [];
  });
}

describe('assets gerados por código', () => {
  it('o manifesto existe e registra a técnica de cada recurso', () => {
    const manifest = JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'));
    expect(manifest.generatedBy).toBe('tools/generate-assets.mjs');
    const images = manifest.assets.filter((a: { type: string }) => a.type !== 'metadata');
    expect(images.length).toBeGreaterThanOrEqual(20);
    for (const a of images) expect(a.technique, a.file).toBeTruthy();
  });

  it('todos os PNGs são válidos e as dimensões batem com o manifesto', () => {
    const manifest = JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'));
    for (const a of manifest.assets.filter((x: { type: string }) => x.type !== 'metadata')) {
      const size = pngSize(join(ROOT, a.file));
      expect(size.w, a.file).toBe(a.width);
      expect(size.h, a.file).toBe(a.height);
    }
    expect(listPngs(ASSETS).length).toBeGreaterThan(20);
  });

  it('cada sheet tem quadros dentro dos limites e animações que apontam para quadros existentes', () => {
    for (const dir of ['sprites', 'vegetation']) {
      for (const f of readdirSync(join(ASSETS, dir)).filter((n) => n.endsWith('.json'))) {
        const meta = JSON.parse(readFileSync(join(ASSETS, dir, f), 'utf8'));
        const size = pngSize(join(ASSETS, dir, meta.image));
        expect(size.w).toBe(meta.width);
        expect(size.h).toBe(meta.height);
        for (const [name, r] of Object.entries<{ x: number; y: number; w: number; h: number }>(meta.frames)) {
          expect(r.x + r.w, `${f}:${name}`).toBeLessThanOrEqual(meta.width);
          expect(r.y + r.h, `${f}:${name}`).toBeLessThanOrEqual(meta.height);
        }
        for (const [anim, list] of Object.entries<string[]>(meta.animations)) {
          for (const frame of list) expect(meta.frames[frame], `${f}:${anim}->${frame}`).toBeDefined();
        }
      }
    }
  });

  it('o registro em docs/ASSET_REGISTRY.md existe', () => {
    expect(existsSync(join(ROOT, 'docs', 'ASSET_REGISTRY.md'))).toBe(true);
  });
});
