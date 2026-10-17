import { describe, it, expect } from 'vitest';
import { ProgressStore, validateSave, loadSettings, saveSettings, KeyValueStorage } from '../src/game/storage';
import { SAVE_KEY, SETTINGS_KEY } from '../src/core/config';
import * as Q from '../src/game/quest';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

class BrokenStorage implements KeyValueStorage {
  getItem(): string | null { throw new Error('bloqueado'); }
  setItem(): void { throw new Error('bloqueado'); }
  removeItem(): void { throw new Error('bloqueado'); }
}

describe('progresso local', () => {
  it('salva e restaura missão e posição', () => {
    const mem = new MemoryStorage();
    const store = new ProgressStore(mem);
    const quest: Q.QuestState = { stage: 'ecos', fragments: ['eco_1'], creatureDefeated: false };
    expect(store.save(quest, { x: 19, z: -4 })).toBe(true);
    const back = new ProgressStore(mem).load({ x: 0, z: 3 });
    expect(back.restored).toBe(true);
    expect(back.quest).toEqual(quest);
    expect(back.player).toEqual({ x: 19, z: -4 });
  });

  it('save corrompido volta ao início sem lançar erro', () => {
    const mem = new MemoryStorage();
    mem.setItem(SAVE_KEY, '{ isto não é json');
    const r = new ProgressStore(mem).load({ x: 0, z: 3 });
    expect(r.restored).toBe(false);
    expect(r.quest.stage).toBe('despertar');
  });

  it('rejeita save com etapa ou fragmento desconhecidos', () => {
    const bad = { version: 1, quest: { stage: 'hackeado', fragments: [], creatureDefeated: false }, player: { x: 0, z: 0 } };
    expect(validateSave(bad)).toBeNull();
    const badFrag = { version: 1, quest: { stage: 'ecos', fragments: ['eco_9'], creatureDefeated: false }, player: { x: 0, z: 0 } };
    expect(validateSave(badFrag)).toBeNull();
    expect(validateSave({ version: 2 })).toBeNull();
  });

  it('remove fragmentos duplicados ao validar', () => {
    const s = validateSave({ version: 1, quest: { stage: 'ecos', fragments: ['eco_1', 'eco_1'], creatureDefeated: false }, player: { x: 1, z: 1 } });
    expect(s?.quest.fragments).toEqual(['eco_1']);
  });

  it('armazenamento bloqueado não derruba o jogo', () => {
    const store = new ProgressStore(new BrokenStorage());
    expect(store.save(Q.initialQuest(), { x: 0, z: 0 })).toBe(false);
    expect(store.load({ x: 0, z: 3 }).restored).toBe(false);
    expect(() => store.reset()).not.toThrow();
    expect(() => saveSettings(new BrokenStorage(), { preset: 'alto', overrides: {}, showMetrics: false })).not.toThrow();
    expect(loadSettings(new BrokenStorage()).preset).toBe('alto');
  });

  it('configurações são lidas com fallback seguro', () => {
    const mem = new MemoryStorage();
    mem.setItem(SETTINGS_KEY, JSON.stringify({ preset: 'inexistente', overrides: { bloom: false } }));
    const s = loadSettings(mem);
    expect(s.preset).toBe('alto');
    expect(s.overrides).toEqual({ bloom: false });
  });
});
