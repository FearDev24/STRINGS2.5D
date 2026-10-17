import { describe, it, expect } from 'vitest';
import * as Q from '../src/game/quest';

describe('missão Ecos da Primeira Corda', () => {
  it('percorre o roteiro inteiro na ordem correta', () => {
    let s = Q.initialQuest();
    expect(s.stage).toBe('despertar');

    let r = Q.talkToHerald(s);
    expect(r.event).toEqual({ type: 'stage', stage: 'ecos' });
    s = r.state;

    for (const id of ['eco_1', 'eco_2', 'eco_3'] as const) {
      r = Q.collectFragment(s, id);
      s = r.state;
    }
    expect(s.stage).toBe('corrupcao');
    expect(s.fragments).toHaveLength(3);

    r = Q.defeatCreature(s);
    expect(r.event).toEqual({ type: 'stage', stage: 'retorno' });
    s = r.state;
    expect(s.creatureDefeated).toBe(true);

    r = Q.talkToHerald(s);
    expect(r.event).toEqual({ type: 'completed' });
    expect(Q.isCompleted(r.state)).toBe(true);
  });

  it('não aceita fragmentos antes de conversar com o Arauto', () => {
    const r = Q.collectFragment(Q.initialQuest(), 'eco_1');
    expect(r.event.type).toBe('none');
    expect(r.state.fragments).toHaveLength(0);
  });

  it('ignora o mesmo fragmento duas vezes', () => {
    let s = Q.talkToHerald(Q.initialQuest()).state;
    s = Q.collectFragment(s, 'eco_2').state;
    const again = Q.collectFragment(s, 'eco_2');
    expect(again.event.type).toBe('none');
    expect(again.state.fragments).toEqual(['eco_2']);
  });

  it('não permite derrotar a criatura antes da etapa da corrupção', () => {
    const s = Q.talkToHerald(Q.initialQuest()).state;
    expect(Q.defeatCreature(s).event.type).toBe('none');
  });

  it('o Arauto não conclui a missão antes da etapa de retorno', () => {
    const s = Q.talkToHerald(Q.initialQuest()).state;
    const r = Q.talkToHerald({ ...s, stage: 'corrupcao' });
    expect(r.event.type).toBe('none');
  });

  it('texto do objetivo acompanha o progresso dos fragmentos', () => {
    let s = Q.talkToHerald(Q.initialQuest()).state;
    expect(Q.objectiveText(s)).toContain('0/3');
    s = Q.collectFragment(s, 'eco_1').state;
    expect(Q.objectiveText(s)).toContain('1/3');
  });
});
