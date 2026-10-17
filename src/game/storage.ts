// Persistência local com validação. Qualquer falha de storage (modo privado, dados bloqueados)
// faz o jogo continuar sem salvar, em vez de quebrar.
import { SAVE_KEY, SETTINGS_KEY, PresetName } from '../core/config';
import { QuestState, FragmentId, initialQuest, Stage } from './quest';
import { Cell } from '../world/layout';
import type { WeatherName } from '../world/atmosphere';

export interface SaveData {
  version: 1;
  quest: QuestState;
  player: Cell;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STAGES: Stage[] = ['despertar', 'ecos', 'corrupcao', 'retorno', 'concluida'];
const FRAGMENT_IDS: FragmentId[] = ['eco_1', 'eco_2', 'eco_3'];

export function defaultStorage(): KeyValueStorage | null {
  try {
    const s = window.localStorage;
    const probe = '__probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function validateSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return null;
  const q = r.quest as Record<string, unknown> | undefined;
  const p = r.player as Record<string, unknown> | undefined;
  if (!q || !p) return null;
  if (!STAGES.includes(q.stage as Stage)) return null;
  if (!Array.isArray(q.fragments) || !q.fragments.every((f) => FRAGMENT_IDS.includes(f as FragmentId))) return null;
  if (typeof q.creatureDefeated !== 'boolean') return null;
  if (typeof p.x !== 'number' || typeof p.z !== 'number') return null;
  return {
    version: 1,
    quest: {
      stage: q.stage as Stage,
      fragments: [...new Set(q.fragments as FragmentId[])],
      creatureDefeated: q.creatureDefeated,
    },
    player: { x: Math.round(p.x), z: Math.round(p.z) },
  };
}

export class ProgressStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  load(fallbackPlayer: Cell): { quest: QuestState; player: Cell; restored: boolean } {
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      if (raw) {
        const data = validateSave(JSON.parse(raw));
        if (data) return { quest: data.quest, player: data.player, restored: true };
      }
    } catch {
      // Save corrompido: começa do zero sem apagar nada além do que o jogo sobrescrever.
    }
    return { quest: initialQuest(), player: fallbackPlayer, restored: false };
  }

  save(quest: QuestState, player: Cell): boolean {
    const data: SaveData = { version: 1, quest, player };
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(data));
      return this.storage !== null;
    } catch {
      return false;
    }
  }

  reset(): void {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      // ignorado de propósito
    }
  }
}

export interface StoredSettings {
  preset: PresetName;
  overrides: Partial<Record<string, boolean>>;
  showMetrics: boolean;
  weather: WeatherName;
  dofStrength: number;
}

const WEATHER_NAMES: WeatherName[] = ['dourado', 'crepusculo', 'chuva', 'neve'];

export function loadSettings(storage: KeyValueStorage | null): StoredSettings {
  const fallback: StoredSettings = { preset: 'alto', overrides: {}, showMetrics: false, weather: 'dourado', dofStrength: 0.75 };
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw) as Partial<StoredSettings>;
    const preset: PresetName = data.preset === 'baixo' || data.preset === 'medio' || data.preset === 'alto' ? data.preset : 'alto';
    const weather: WeatherName = WEATHER_NAMES.includes(data.weather as WeatherName) ? (data.weather as WeatherName) : 'dourado';
    return {
      preset,
      overrides: data.overrides && typeof data.overrides === 'object' ? data.overrides : {},
      showMetrics: Boolean(data.showMetrics),
      weather,
      dofStrength: typeof data.dofStrength === 'number' ? Math.min(1, Math.max(0, data.dofStrength)) : 0.75,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(storage: KeyValueStorage | null, settings: StoredSettings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // sem persistência de configurações neste navegador
  }
}
