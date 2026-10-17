// Missão "Ecos da Primeira Corda". Máquina de estados pura: não toca em renderização nem em storage.
export type Stage = 'despertar' | 'ecos' | 'corrupcao' | 'retorno' | 'concluida';
export type FragmentId = 'eco_1' | 'eco_2' | 'eco_3';

export interface QuestState {
  stage: Stage;
  fragments: FragmentId[];
  creatureDefeated: boolean;
}

export const FRAGMENT_TOTAL = 3;

export function initialQuest(): QuestState {
  return { stage: 'despertar', fragments: [], creatureDefeated: false };
}

export function objectiveText(s: QuestState): string {
  switch (s.stage) {
    case 'despertar': return 'Fale com o Arauto na praça.';
    case 'ecos': return `Encontre os Ecos no Bosque das Cordas (${s.fragments.length}/${FRAGMENT_TOTAL}).`;
    case 'corrupcao': return 'Derrote a criatura corrompida na zona roxa a leste.';
    case 'retorno': return 'Volte ao Arauto e entregue os Ecos.';
    case 'concluida': return 'Missão concluída: Ecos da Primeira Corda.';
  }
}

// Falas do Arauto por etapa. A primeira fala é o texto de abertura do roteiro.
export function heraldLines(s: QuestState): string[] {
  switch (s.stage) {
    case 'despertar':
      return [
        'Mais uma alma atravessou as Cordas... mas há algo diferente em você.',
        'Uma pequena corrupção está se espalhando pela floresta ao leste. Traga de volta três Ecos luminosos escondidos no Bosque das Cordas.',
      ];
    case 'ecos':
      return ['Os Ecos ainda estão dispersos. Procure os cristais dourados entre as árvores.'];
    case 'corrupcao':
      return ['A corrupção ainda vive. Ela se esconde na zona roxa a leste. Enfrente-a com cuidado.'];
    case 'retorno':
      return ['Você trouxe os Ecos... e a corrupção recuou. Obrigado, viajante.'];
    case 'concluida':
      return ['A Primeira Corda está firme. Continue explorando o que há além da vila.'];
  }
}

export const VILLAGER_LINES: Record<'villager_a' | 'villager_b', string[]> = {
  villager_a: ['Dizem que o portal da praça acorda quando alguém atravessa as Cordas.'],
  villager_b: ['Cuidado no bosque. Desde que a névoa roxa chegou, os animais ficaram estranhos.'],
};

export type QuestEvent =
  | { type: 'none' }
  | { type: 'stage'; stage: Stage }
  | { type: 'fragment'; id: FragmentId; total: number }
  | { type: 'completed' };

export function talkToHerald(s: QuestState): { state: QuestState; event: QuestEvent } {
  if (s.stage === 'despertar') return { state: { ...s, stage: 'ecos' }, event: { type: 'stage', stage: 'ecos' } };
  if (s.stage === 'retorno') return { state: { ...s, stage: 'concluida' }, event: { type: 'completed' } };
  return { state: s, event: { type: 'none' } };
}

export function collectFragment(s: QuestState, id: FragmentId): { state: QuestState; event: QuestEvent } {
  if (s.stage !== 'ecos' || s.fragments.includes(id)) return { state: s, event: { type: 'none' } };
  const fragments = [...s.fragments, id];
  if (fragments.length >= FRAGMENT_TOTAL) {
    return { state: { ...s, fragments, stage: 'corrupcao' }, event: { type: 'stage', stage: 'corrupcao' } };
  }
  return { state: { ...s, fragments }, event: { type: 'fragment', id, total: fragments.length } };
}

export function defeatCreature(s: QuestState): { state: QuestState; event: QuestEvent } {
  if (s.stage !== 'corrupcao' || s.creatureDefeated) return { state: s, event: { type: 'none' } };
  return { state: { ...s, creatureDefeated: true, stage: 'retorno' }, event: { type: 'stage', stage: 'retorno' } };
}

export function isCompleted(s: QuestState): boolean {
  return s.stage === 'concluida';
}
