// Presets gráficos e constantes globais do experimento.
export type PresetName = 'baixo' | 'medio' | 'alto';

export interface EffectToggles {
  shadows: boolean;
  ao: boolean;
  bloom: boolean;
  dof: boolean;
  godRays: boolean;
  fog: boolean;
  fireflies: boolean;
  falling: boolean;
}

export interface Preset {
  label: string;
  renderScale: number; // resolução interna relativa à janela
  shadowMapSize: number;
  grassBlades: number;
  treeCount: number;
  flowerCount: number;
  particleRate: number; // multiplicador de partículas
  fireflies: number;
  toggles: EffectToggles;
}

export const PRESETS: Record<PresetName, Preset> = {
  baixo: {
    label: 'Baixo',
    renderScale: 0.75,
    shadowMapSize: 512,
    grassBlades: 9000,
    treeCount: 55,
    flowerCount: 420,
    particleRate: 0.35,
    fireflies: 40,
    toggles: { shadows: false, ao: false, bloom: false, dof: false, godRays: false, fog: true, fireflies: true, falling: false },
  },
  medio: {
    label: 'Médio',
    renderScale: 0.9,
    shadowMapSize: 1024,
    grassBlades: 22000,
    treeCount: 90,
    flowerCount: 1000,
    particleRate: 0.7,
    fireflies: 110,
    toggles: { shadows: true, ao: false, bloom: true, dof: true, godRays: true, fog: true, fireflies: true, falling: true },
  },
  alto: {
    label: 'Alto',
    renderScale: 1,
    shadowMapSize: 2048,
    grassBlades: 42000,
    treeCount: 130,
    flowerCount: 1800,
    particleRate: 1,
    fireflies: 220,
    // GTAO fica desligado por padrão: nesta cena ele escurece a floresta inteira (ver RELATORIO_TECNICO.md).
    toggles: { shadows: true, ao: false, bloom: true, dof: true, godRays: true, fog: true, fireflies: true, falling: true },
  },
};

export const CELL = 1; // uma célula de grade = uma unidade de mundo
export const PLAYER_SPEED = 4.2; // células por segundo
export const SAVE_KEY = 'strings25d.save.v1';
export const SETTINGS_KEY = 'strings25d.settings.v1';
