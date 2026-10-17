// Ponto de entrada: carrega os assets gerados, monta o mundo, roda o loop e liga sistemas.
import * as THREE from 'three';
import { PRESETS, PresetName, EffectToggles, Preset } from './core/config';
import { WEATHERS, WeatherName } from './world/atmosphere';
import { Input } from './core/input';
import { loadAssets, Assets } from './render/assets';
import { WindUniforms, createWindUniforms } from './render/materials';
import { FollowCamera } from './render/camera';
import { PostFX } from './render/postfx';
import { createGrid, PLAYER_START, HERALD, WorldGrid, PORTAL } from './world/layout';
import { buildTerrain, buildPlazaAndPath } from './world/terrain';
import { buildVegetation, buildCorruption, Vegetation } from './world/vegetation';
import { buildVillage, Village } from './world/village';
import { buildAtmosphere, Atmosphere } from './world/atmosphere';
import { Player, Herald, Villager, Fragment, Creature, createVillagers, createFragments, createCreature } from './entities/characters';
import { ParticlePool, Billboard } from './entities/billboard';
import { ProgressStore, defaultStorage, loadSettings, saveSettings, StoredSettings } from './game/storage';
import * as Q from './game/quest';
import { Hud, setLoader, hideLoader } from './ui/hud';

interface Dynamic {
  grid: WorldGrid;
  vegetation: Vegetation;
  corruption: { group: THREE.Group; update(t: number, dt: number): void };
  atmosphere: Atmosphere;
}

const VILLAGER_NAMES: Record<'villager_a' | 'villager_b', string> = { villager_a: 'Aldeão', villager_b: 'Aldeã' };
const HERALD_NAME = 'Arauto';

class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly cam: FollowCamera;
  readonly input = new Input();
  readonly hud = new Hud();
  readonly storage = defaultStorage();
  readonly progress = new ProgressStore(this.storage);
  settings: StoredSettings;
  quest: Q.QuestState = Q.initialQuest();
  paused = false;
  graphicsOpen = false;
  metricsOpen = false;
  completeOpen = false;
  t = 0;
  private last = performance.now();
  private respawnTimer = 0;
  private autosaveTimer = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;
  private frameMs = 0;
  private uniforms: WindUniforms = createWindUniforms();
  private dyn!: Dynamic;
  private postfx!: PostFX;
  private player!: Player;
  private herald!: Herald;
  private villagers!: Villager[];
  private fragments!: Fragment[];
  private creature!: Creature;
  private village!: Village;
  private terrainGroup!: THREE.Group;
  private particles = new ParticlePool(900);
  private assets!: Assets;
  private canvas: HTMLCanvasElement;

  constructor() {
    this.canvas = document.getElementById('scene') as HTMLCanvasElement;
    // ?capture=1 mantém o buffer do canvas para as capturas de tela de desenvolvimento.
    const capture = new URLSearchParams(location.search).has('capture');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: capture });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.settings = loadSettings(this.storage);
    this.cam = new FollowCamera(window.innerWidth / window.innerHeight);
  }

  get preset(): Preset {
    return PRESETS[this.settings.preset];
  }

  effectiveToggles(): EffectToggles {
    return { ...this.preset.toggles, ...(this.settings.overrides as Partial<EffectToggles>) };
  }

  async start(): Promise<void> {
    this.assets = await loadAssets((done, total, label) => setLoader(done, total, label));
    this.buildScene();
    this.hud.bindPause({
      resume: () => this.setPaused(false),
      graphics: () => this.openGraphics(),
      metrics: () => this.toggleMetrics(),
      reset: () => this.resetProgress(),
    });
    this.hud.bindGraphics({
      preset: (p) => this.setPreset(p),
      toggle: (key, value) => this.setToggle(key, value),
      weather: (w) => this.setWeather(w),
      dof: (v) => this.setDof(v),
      back: () => this.closeGraphics(),
    });
    this.hud.bindComplete(() => {
      this.completeOpen = false;
      this.hud.showComplete(false);
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('beforeunload', () => this.persist());
    hideLoader();
    this.hud.showHud(true);
    this.hud.setHp(this.player.hp, this.player.maxHp);
    this.hud.setObjective(Q.objectiveText(this.quest));
    if (this.progress && this.quest.stage !== 'despertar') this.hud.toast('Progresso restaurado.', 2200);
    this.exposeDebugHooks();
    requestAnimationFrame((now) => this.frame(now));
  }

  private buildScene(): void {
    const { assets } = this;
    const restore = this.progress.load(PLAYER_START);
    this.quest = restore.quest;
    this.scene.add(buildTerrain(assets));
    this.terrainGroup = buildPlazaAndPath(assets);
    this.scene.add(this.terrainGroup);
    this.village = buildVillage(assets, this.uniforms);
    this.scene.add(this.village.group);
    this.scene.add(this.particles.points);

    this.dyn = this.buildDynamic();
    this.scene.add(this.dyn.vegetation.group, this.dyn.corruption.group, this.dyn.atmosphere.group);

    this.player = new Player(assets, restore.player);
    this.player.pos.set(restore.player.x, 0, restore.player.z);
    this.scene.add(this.player.group);
    this.herald = new Herald(assets);
    this.scene.add(this.herald.group);
    this.villagers = createVillagers(assets);
    this.villagers.forEach((v) => this.scene.add(v.group));
    const collected = new Set(this.quest.fragments);
    this.fragments = createFragments(assets, collected);
    this.fragments.forEach((f) => this.scene.add(f.group));
    this.creature = createCreature(assets, this.quest.creatureDefeated);
    this.scene.add(this.creature.group);
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.12));
    this.applyToggles();
  }

  private buildDynamic(): Dynamic {
    const preset = this.preset;
    const grid = createGrid(preset.treeCount);
    const vegetation = buildVegetation({ assets: this.assets, preset, grid, wind: this.uniforms });
    const corruption = buildCorruption(this.assets, preset.particleRate);
    const atmosphere = buildAtmosphere(this.assets, preset);
    atmosphere.setWeather(this.settings.weather);
    return { grid, vegetation, corruption, atmosphere };
  }

  private rebuildDynamic(): void {
    this.scene.remove(this.dyn.vegetation.group, this.dyn.corruption.group, this.dyn.atmosphere.group);
    this.dyn.vegetation.dispose();
    this.dyn.atmosphere.dispose();
    this.dyn = this.buildDynamic();
    this.scene.add(this.dyn.vegetation.group, this.dyn.corruption.group, this.dyn.atmosphere.group);
    this.applyToggles();
  }

  private applyToggles(): void {
    const t = this.effectiveToggles();
    const pr = Math.min(window.devicePixelRatio, 2) * this.preset.renderScale;
    this.renderer.setPixelRatio(pr);
    this.postfx?.apply(t, true);
    this.postfx?.setSize(window.innerWidth, window.innerHeight, pr);
    this.dyn.atmosphere.applyToggles(t);
    this.dyn.atmosphere.sun.castShadow = t.shadows;
    this.scene.fog = t.fog ? this.dyn.atmosphere.fog : null;
    if (!this.postfx) {
      this.postfx = new PostFX(this.renderer, this.scene, this.cam.camera, window.innerWidth, window.innerHeight);
      this.postfx.setDofStrength(this.settings.dofStrength);
      this.postfx.apply(t, true);
      this.postfx.setSize(window.innerWidth, window.innerHeight, pr);
    }
  }

  private resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, 2) * this.preset.renderScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.cam.setAspect(w / h);
    this.postfx?.setSize(w, h, pr);
  }

  // ------------------------------------------------------------ configurações
  private openGraphics(): void {
    this.graphicsOpen = true;
    this.hud.showPause(false);
    this.hud.showGraphics(true);
    this.hud.syncGraphics(this.settings.preset, this.effectiveToggles(), this.settings.weather);
  }

  private closeGraphics(): void {
    this.graphicsOpen = false;
    this.hud.showGraphics(false);
    this.hud.showPause(true);
  }

  private setPreset(p: PresetName): void {
    this.settings.preset = p;
    this.settings.overrides = {};
    saveSettings(this.storage, this.settings);
    this.rebuildDynamic();
    this.hud.syncGraphics(p, this.effectiveToggles(), this.settings.weather);
    this.hud.toast(`Preset ${PRESETS[p].label} aplicado.`, 1800);
  }

  private setToggle(key: keyof EffectToggles, value: boolean): void {
    this.settings.overrides = { ...this.settings.overrides, [key]: value };
    saveSettings(this.storage, this.settings);
    this.applyToggles();
    this.hud.syncGraphics(this.settings.preset, this.effectiveToggles(), this.settings.weather);
  }

  private setDof(v: number): void {
    this.settings.dofStrength = v;
    saveSettings(this.storage, this.settings);
    this.postfx?.setDofStrength(v);
  }

  private setWeather(w: WeatherName): void {
    this.settings.weather = w;
    saveSettings(this.storage, this.settings);
    this.dyn.atmosphere.setWeather(w);
    this.clockKey = '';
    this.hud.syncGraphics(this.settings.preset, this.effectiveToggles(), w);
    this.hud.toast(`Clima: ${WEATHERS[w].label}.`, 1800);
  }

  /** Relógio de jogo: avança 2 minutos por segundo a partir das 18:12. */
  private updateClock(): void {
    const minutes = (18 * 60 + 12 + Math.floor(this.t * 2)) % 1440;
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const label = WEATHERS[this.settings.weather].label;
    const key = `${time}|${label}`;
    if (key === this.clockKey) return;
    this.clockKey = key;
    this.hud.setClock(time, label);
  }
  private clockKey = '';

  private toggleMetrics(): void {
    this.metricsOpen = !this.metricsOpen;
    this.hud.showMetrics(this.metricsOpen);
    this.settings.showMetrics = this.metricsOpen;
    saveSettings(this.storage, this.settings);
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.hud.showPause(p);
  }

  // ------------------------------------------------------------ missão e persistência
  private persist(): void {
    this.progress.save(this.quest, this.player.cell);
  }

  private applyQuest(state: Q.QuestState, event: Q.QuestEvent): void {
    this.quest = state;
    this.hud.setObjective(Q.objectiveText(state));
    this.persist();
    if (event.type === 'stage') {
      if (event.stage === 'ecos') this.hud.toast('Os Ecos estão escondidos no Bosque das Cordas, a leste.');
      if (event.stage === 'corrupcao') this.hud.toast('Os três Ecos foram reunidos. A corrupção ronda a zona roxa a leste.', 4200);
      if (event.stage === 'retorno') this.hud.toast('A criatura se dissipou. Volte ao Arauto.', 3600);
    } else if (event.type === 'fragment') {
      this.hud.toast(`Eco ${event.total}/${Q.FRAGMENT_TOTAL} recuperado.`);
    } else if (event.type === 'completed') {
      this.celebrate();
    }
  }

  private celebrate(): void {
    this.village.pulse(1);
    for (let i = 0; i < 6; i++) {
      this.particles.emit(PORTAL.x, 2.2, PORTAL.z, { count: 50, color: '#8ff7ff', speed: 4, life: 1.6, gravity: 2, size: 0.18 });
    }
    window.setTimeout(() => {
      this.completeOpen = true;
      this.hud.showComplete(true);
    }, 1800);
  }

  private resetProgress(): void {
    this.progress.reset();
    this.quest = Q.initialQuest();
    this.player.respawn(PLAYER_START);
    this.scene.remove(this.creature.group);
    this.creature = createCreature(this.assets, false);
    this.scene.add(this.creature.group);
    this.fragments.forEach((f) => {
      f.collected = false;
      f.group.visible = true;
    });
    this.hud.setObjective(Q.objectiveText(this.quest));
    this.hud.toast('Progresso reiniciado.', 2200);
    this.setPaused(false);
    this.persist();
  }

  private nearestInteractable(): { label: string; run: () => void } | null {
    const p = this.player.pos;
    const near: Array<{ d: number; label: string; run: () => void }> = [];
    const dh = Math.hypot(p.x - HERALD.x, p.z - HERALD.z);
    if (dh < 2.4) near.push({ d: dh, label: 'conversar com o Arauto', run: () => this.talkHerald() });
    for (const v of this.villagers) {
      const d = Math.hypot(p.x - v.group.position.x, p.z - v.group.position.z);
      if (d < 2) near.push({ d, label: 'conversar', run: () => this.hud.openDialog(VILLAGER_NAMES[v.id], Q.VILLAGER_LINES[v.id]) });
    }
    near.sort((a, b) => a.d - b.d);
    return near[0] ?? null;
  }

  private talkHerald(): void {
    const lines = Q.heraldLines(this.quest);
    const { state, event } = Q.talkToHerald(this.quest);
    this.quest = state;
    this.hud.openDialog(HERALD_NAME, lines, () => this.applyQuest(state, event));
  }

  // ------------------------------------------------------------ combate
  private onHitWindow(): void {
    const c = this.creature;
    if (!c.alive) return;
    const dx = c.x - this.player.pos.x, dz = c.z - this.player.pos.z;
    const dist = Math.hypot(dx, dz);
    const f = this.player.facingVector();
    const dot = dist > 1e-3 ? (dx * f.x + dz * f.z) / dist : 0;
    // Golpe em arco: aceita inimigos à frente, e também os muito encostados no herói.
    const inArc = dot > 0.2 || dist < 0.9;
    if (dist <= 1.8 && inArc && c.takeHit(f.x, f.z)) {
      this.particles.emit(c.x, 0.9, c.z, { count: 26, color: '#ffd36b', speed: 3.2, life: 0.5, gravity: 4, size: 0.16 });
      this.particles.emit(c.x, 0.9, c.z, { count: 12, color: '#ff5fd2', speed: 2, life: 0.6, gravity: 3, size: 0.12 });
    }
  }

  /** Ao atacar, o herói se vira para a criatura se ela estiver perto (mira automática em 4 direções). */
  private faceNearestEnemy(): void {
    const c = this.creature;
    if (!c.alive) return;
    const dx = c.x - this.player.pos.x, dz = c.z - this.player.pos.z;
    if (Math.hypot(dx, dz) > 2.6) return;
    if (Math.abs(dx) > Math.abs(dz)) this.player.facing = dx > 0 ? 'right' : 'left';
    else this.player.facing = dz > 0 ? 'down' : 'up';
  }

  private onCreatureDied(): void {
    this.particles.emit(this.creature.x, 0.6, this.creature.z, { count: 70, color: '#c77dff', speed: 2.5, life: 1.4, gravity: 0.6, size: 0.18 });
    const { state, event } = Q.defeatCreature(this.quest);
    this.applyQuest(state, event);
  }

  // ------------------------------------------------------------ loop
  private frame = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.frameMs = this.frameMs * 0.9 + (now - this.last) * 0.1;
    this.last = now;
    this.t += dt;
    this.uniforms.uTime.value = this.t;
    this.renderer.info.reset();
    this.update(dt);
    this.postfx.setFocus(this.cam.focusDistance(this.player.pos));
    // Yaw da câmera em torno do eixo vertical; todos os billboards herdam esse valor.
    Billboard.cameraYaw = Math.atan2(this.cam.camera.position.x - this.player.pos.x, this.cam.camera.position.z - this.player.pos.z);
    this.postfx.render(dt);
    this.input.endFrame();
    this.updateMetrics(dt);
    requestAnimationFrame((n) => this.frame(n));
  };

  private update(dt: number): void {
    const { input } = this;
    if (input.consume('escape') && !this.hud.dialogOpen && !this.completeOpen) {
      if (this.graphicsOpen) this.closeGraphics();
      else this.setPaused(!this.paused);
    }
    if (input.consume('f3')) this.toggleMetrics();

    if (this.hud.dialogOpen) {
      if (input.consume('e') || input.consume('enter') || input.consume('space')) this.hud.advanceDialog();
    } else if (!this.paused && !this.completeOpen && !this.graphicsOpen) {
      if (input.consume('e')) {
        const it = this.nearestInteractable();
        if (it) it.run();
      }
      if (input.consume('j') || input.consume('space')) {
        this.faceNearestEnemy();
        this.player.tryAttack();
      }
    }
    this.hud.updateDialog(dt);
    this.updateClock();

    const cam = this.cam.camera.position;
    this.player.setCamera(cam.x, cam.z);
    const canControl = !this.paused && !this.hud.dialogOpen && !this.completeOpen && !this.graphicsOpen && this.player.hp > 0;
    const events = this.player.update(dt, input, this.dyn.grid, canControl);
    for (const ev of events) if (ev.type === 'hit-window') this.onHitWindow();

    if (this.player.hp <= 0 && this.respawnTimer <= 0) {
      this.respawnTimer = 1.6;
      this.hud.toast('Você caiu. Voltando à praça...', 1600);
    }
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.player.respawn(PLAYER_START);
    }

    // criatura
    const cx = cam.x, cz = cam.z;
    if (this.creature.state !== 'dead') {
      const cEvents = this.creature.update(dt, this.t, this.player.pos.x, this.player.pos.z, this.dyn.grid, cx, cz);
      for (const ev of cEvents) {
        if (ev.type === 'bite' && this.player.takeHit(1)) {
          this.particles.emit(this.player.pos.x, 1, this.player.pos.z, { count: 20, color: '#ff6a6a', speed: 2.4, life: 0.5, gravity: 3, size: 0.14 });
          this.hud.toast('A criatura mordeu você!', 1200);
        }
        if (ev.type === 'died') this.onCreatureDied();
      }
    } else {
      this.creature.update(dt, this.t, this.player.pos.x, this.player.pos.z, this.dyn.grid, cx, cz);
    }
    this.hud.setHp(this.player.hp, this.player.maxHp);

    // fragmentos
    for (const f of this.fragments) {
      f.update(this.t, cx, cz);
      if (!f.collected && this.quest.stage === 'ecos' && Math.hypot(this.player.pos.x - f.cell.x, this.player.pos.z - f.cell.z) < 0.7) {
        f.collect();
        this.particles.emit(f.cell.x, 1, f.cell.z, { count: 60, color: '#ffe38a', speed: 3.4, life: 1.1, gravity: 1, size: 0.18 });
        const { state, event } = Q.collectFragment(this.quest, f.id);
        this.applyQuest(state, event);
      }
    }

    this.herald.update(dt, cx, cz, this.t);
    this.villagers.forEach((v) => v.update(dt, this.dyn.grid, cx, cz));

    // dica de interação
    if (!this.paused && !this.hud.dialogOpen && !this.completeOpen && !this.graphicsOpen) {
      const it = this.nearestInteractable();
      this.hud.setPrompt(it ? `<kbd>E</kbd>${it.label}` : null);
    } else {
      this.hud.setPrompt(null);
    }

    this.particles.update(dt);
    this.dyn.corruption.update(this.t, dt);
    this.village.update(this.t, dt, this.cam.camera);
    this.dyn.atmosphere.update(this.t, dt, this.player.pos, this.cam.camera);
    this.hiddenCanopies = this.dyn.vegetation.updateOcclusion(this.cam.camera.position, this.occlusionTarget.set(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z));
    this.cam.follow(this.player.pos, dt);

    this.autosaveTimer += dt;
    if (this.autosaveTimer > 4) {
      this.autosaveTimer = 0;
      this.persist();
    }
  }

  private updateMetrics(dt: number): void {
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    if (!this.metricsOpen) return;
    const info = this.renderer.info;
    const pr = this.renderer.getPixelRatio();
    const t = this.effectiveToggles();
    const on = (Object.keys(t) as Array<keyof EffectToggles>).filter((k) => t[k]).join(', ');
    const v = this.dyn.vegetation.stats;
    this.hud.setMetrics([
      `FPS ${this.fps.toFixed(0)} · ${this.frameMs.toFixed(1)} ms`,
      `Preset ${this.preset.label} · resolução ${(window.innerWidth * pr).toFixed(0)}x${(window.innerHeight * pr).toFixed(0)}`,
      `Draw calls ${info.render.calls} · triângulos ${info.render.triangles.toLocaleString('pt-BR')}`,
      `Geometrias ${info.memory.geometries} · texturas ${info.memory.textures}`,
      `Grama ${v.grass.toLocaleString('pt-BR')} · flores ${v.flowers} · árvores ${v.trees} · copas ${v.treeCanopies}`,
      `Copas ocultas: ${this.hiddenCanopies}`,
      `Efeitos ativos: ${on || 'nenhum'}`,
    ]);
  }

  private hiddenCanopies = 0;
  private readonly occlusionTarget = new THREE.Vector3();

  private exposeDebugHooks(): void {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__strings25d = {
      scene: this.scene,
      camera: this.cam.camera,
      state: () => ({
        quest: this.quest,
        player: { cell: this.player.cell, hp: this.player.hp, facing: this.player.facing, attacking: this.player.attacking, pos: { x: this.player.pos.x, z: this.player.pos.z } },
        creature: { state: this.creature.state, hp: this.creature.hp, x: this.creature.x, z: this.creature.z },
        settings: this.settings,
        fps: this.fps,
        draws: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        grass: this.dyn.vegetation.stats.grass,
        fragments: this.fragments.map((f) => ({ id: f.id, collected: f.collected })),
      }),
      reset: () => this.resetProgress(),
      teleport: (x: number, z: number) => {
        this.player.cell = { x, z };
        this.player.pos.set(x, 0, z);
      },
      setStage: (stage: Q.Stage) => {
        this.quest = { ...this.quest, stage };
        this.hud.setObjective(Q.objectiveText(this.quest));
      },
      addFragment: (id: Q.FragmentId) => {
        const r = Q.collectFragment({ ...this.quest, stage: 'ecos' }, id);
        this.applyQuest(r.state, r.event);
      },
      talkHerald: () => this.talkHerald(),
      setPreset: (p: PresetName) => this.setPreset(p),
      setWeather: (w: WeatherName) => this.setWeather(w),
    };
  }
}

const game = new Game();
game.start().catch((err) => {
  console.error(err);
  const label = document.getElementById('loader-label');
  if (label) label.textContent = `Falha ao iniciar: ${(err as Error).message}`;
});
