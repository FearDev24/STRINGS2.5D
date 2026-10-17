// HUD em DOM: vida, missão, diálogo com digitação, menus, métricas e tela de conclusão.
import { EffectToggles, PresetName, PRESETS } from '../core/config';
import type { WeatherName } from '../world/atmosphere';

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento de interface ausente: #${id}`);
  return el as T;
};

export const TOGGLE_LABELS: Record<keyof EffectToggles, string> = {
  shadows: 'Sombras dinâmicas',
  ao: 'Oclusão ambiental (GTAO)',
  bloom: 'Bloom seletivo',
  dof: 'Profundidade de campo',
  godRays: 'Raios de sol',
  fog: 'Névoa atmosférica',
  fireflies: 'Vaga-lumes',
  falling: 'Folhas caindo',
};

export class Hud {
  private readonly hpEl = $('hp');
  private readonly objectiveEl = $('objective');
  private readonly promptEl = $('prompt');
  private readonly toastEl = $('toast');
  private readonly dialogEl = $('dialog');
  private readonly speakerEl = $('dialog-speaker');
  private readonly textEl = $('dialog-text');
  private readonly metricsEl = $('metrics');
  private readonly pauseEl = $('pause');
  private readonly graphicsEl = $('graphics');
  private readonly completeEl = $('complete');
  private readonly hudEl = $('hud');
  private toastTimer = 0;
  private dialogLines: string[] = [];
  private dialogIndex = 0;
  private typed = 0;
  private dialogDone: (() => void) | null = null;
  dialogOpen = false;

  constructor() {
    this.hpEl.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const h = document.createElement('div');
      h.className = 'heart';
      this.hpEl.appendChild(h);
    }
  }

  showHud(show: boolean): void {
    this.hudEl.classList.toggle('hidden', !show);
  }

  setHp(hp: number, max: number): void {
    Array.from(this.hpEl.children).forEach((c, i) => {
      c.classList.toggle('on', i < hp);
      (c as HTMLElement).style.display = i < max ? '' : 'none';
    });
  }

  setObjective(text: string): void {
    this.objectiveEl.textContent = text;
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.promptEl.classList.add('hidden');
      return;
    }
    this.promptEl.innerHTML = text;
    this.promptEl.classList.remove('hidden');
  }

  toast(text: string, ms = 3200): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  /** Abre a caixa de diálogo. `onDone` roda ao terminar a última fala. */
  openDialog(speaker: string, lines: string[], onDone?: () => void): void {
    this.dialogLines = lines;
    this.dialogIndex = 0;
    this.dialogDone = onDone ?? null;
    this.dialogOpen = true;
    this.speakerEl.textContent = speaker;
    this.dialogEl.classList.remove('hidden');
    this.startLine();
  }

  private startLine(): void {
    this.typed = 0;
    this.textEl.textContent = '';
  }

  /** Avança o texto digitado ou a próxima fala. Retorna false se o diálogo já estiver fechado. */
  advanceDialog(): boolean {
    if (!this.dialogOpen) return false;
    const line = this.dialogLines[this.dialogIndex] ?? '';
    if (this.typed < line.length) {
      this.typed = line.length;
      this.textEl.textContent = line;
      return true;
    }
    this.dialogIndex++;
    if (this.dialogIndex >= this.dialogLines.length) {
      this.closeDialog();
      return true;
    }
    this.startLine();
    return true;
  }

  closeDialog(): void {
    this.dialogOpen = false;
    this.dialogEl.classList.add('hidden');
    const done = this.dialogDone;
    this.dialogDone = null;
    done?.();
  }

  updateDialog(dt: number): void {
    if (!this.dialogOpen) return;
    const line = this.dialogLines[this.dialogIndex] ?? '';
    if (this.typed < line.length) {
      this.typed = Math.min(line.length, this.typed + dt * 42);
      this.textEl.textContent = line.slice(0, Math.floor(this.typed));
    }
  }

  setMetrics(lines: string[]): void {
    this.metricsEl.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
  }

  showMetrics(show: boolean): void {
    this.metricsEl.classList.toggle('hidden', !show);
  }

  showPause(show: boolean): void {
    this.pauseEl.classList.toggle('hidden', !show);
  }

  showGraphics(show: boolean): void {
    this.graphicsEl.classList.toggle('hidden', !show);
  }

  showComplete(show: boolean): void {
    this.completeEl.classList.toggle('hidden', !show);
  }

  bindPause(handlers: { resume(): void; graphics(): void; metrics(): void; reset(): void }): void {
    $('btn-resume').onclick = handlers.resume;
    $('btn-graphics').onclick = handlers.graphics;
    $('btn-metrics').onclick = handlers.metrics;
    $('btn-reset').onclick = handlers.reset;
  }

  bindGraphics(handlers: {
    preset(p: PresetName): void;
    toggle(key: keyof EffectToggles, value: boolean): void;
    weather(w: WeatherName): void;
    dof(v: number): void;
    back(): void;
  }): void {
    $('btn-graphics-back').onclick = handlers.back;
    const range = $('dof-range') as HTMLInputElement;
    range.oninput = () => handlers.dof(Number(range.value) / 100);
    const presetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.btn.preset'));
    presetButtons.forEach((b) => {
      b.onclick = () => handlers.preset(b.dataset.preset as PresetName);
    });
    document.querySelectorAll<HTMLButtonElement>('.btn.weather').forEach((b) => {
      b.onclick = () => handlers.weather(b.dataset.weather as WeatherName);
    });
    const box = $('toggles');
    box.innerHTML = '';
    (Object.keys(TOGGLE_LABELS) as Array<keyof EffectToggles>).forEach((key) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.key = key;
      input.onchange = () => handlers.toggle(key, input.checked);
      label.append(input, TOGGLE_LABELS[key]);
      box.appendChild(label);
    });
  }

  setClock(time: string, label: string): void {
    $('clock-time').textContent = time;
    $('clock-label').textContent = label;
  }

  syncGraphics(preset: PresetName, toggles: EffectToggles, weather: WeatherName): void {
    document.querySelectorAll<HTMLButtonElement>('.btn.preset').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.preset === preset));
      b.classList.toggle('primary', b.dataset.preset === preset);
    });
    document.querySelectorAll<HTMLButtonElement>('.btn.weather').forEach((b) => {
      b.classList.toggle('primary', b.dataset.weather === weather);
    });
    document.querySelectorAll<HTMLInputElement>('#toggles input').forEach((input) => {
      input.checked = toggles[input.dataset.key as keyof EffectToggles];
    });
    void PRESETS;
  }

  bindComplete(onContinue: () => void): void {
    $('btn-complete').onclick = onContinue;
  }
}

export function setLoader(done: number, total: number, label: string): void {
  $('loader-fill').style.width = `${Math.round((done / total) * 100)}%`;
  $('loader-label').textContent = `Carregando ${label}`;
}

export function hideLoader(): void {
  $('loader').classList.add('hidden');
}
