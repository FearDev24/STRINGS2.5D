// Entrada do teclado: direções seguradas (WASD/setas) e ações de um toque (E, J/Espaço, Esc, F3).
export type Dir = 'up' | 'down' | 'left' | 'right';

const DIR_KEYS: Record<string, Dir> = {
  w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
};

export class Input {
  private readonly held: Dir[] = [];
  private readonly pressedThisFrame = new Set<string>();
  private readonly listeners: Array<() => void> = [];

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      const dir = DIR_KEYS[k];
      if (dir) {
        if (!this.held.includes(dir)) this.held.push(dir);
        e.preventDefault();
      }
      if (!e.repeat) this.pressedThisFrame.add(k === ' ' ? 'space' : k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => {
      const dir = DIR_KEYS[e.key.toLowerCase()];
      if (dir) {
        const i = this.held.indexOf(dir);
        if (i >= 0) this.held.splice(i, 1);
      }
    });
    target.addEventListener('blur', () => this.held.splice(0));
  }

  /** Última direção pressionada que ainda está segurada (a última tem prioridade). */
  direction(): Dir | null {
    return this.held.length ? this.held[this.held.length - 1] : null;
  }

  /** Consome uma tecla pressionada neste quadro. Retorna true só uma vez por pressionamento. */
  consume(key: string): boolean {
    if (this.pressedThisFrame.has(key)) {
      this.pressedThisFrame.delete(key);
      return true;
    }
    return false;
  }

  /** Limpa as teclas de um toque no fim do quadro, para não acumular entre quadros. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    for (const l of this.listeners) l();
  }
}

export const DIR_VECTORS: Record<Dir, { dx: number; dz: number }> = {
  up: { dx: 0, dz: -1 },
  down: { dx: 0, dz: 1 },
  left: { dx: -1, dz: 0 },
  right: { dx: 1, dz: 0 },
};
