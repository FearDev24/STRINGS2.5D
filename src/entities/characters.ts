// Personagens: jogador (movimento por grade com interpolação visual), aldeões, Arauto,
// criatura corrompida (IA com telegrafia, investida e dissipação) e fragmentos coletáveis.
import * as THREE from 'three';
import { Assets } from '../render/assets';
import { Billboard, blobShadow } from './billboard';
import { WorldGrid, PLAYER_START, HERALD, VILLAGERS, CREATURE_SPAWN, FRAGMENTS, Cell } from '../world/layout';
import { heightAt } from '../world/terrain';
import { Input, DIR_VECTORS, Dir } from '../core/input';
import { PLAYER_SPEED } from '../core/config';
import { FragmentId } from '../game/quest';
import { mulberry32, range } from '../core/rng';

// ------------------------------------------------------------------ jogador
export type PlayerEvent = { type: 'swing' } | { type: 'hit-window' } | { type: 'died' } | { type: 'step'; cell: Cell };

export class Player {
  readonly group = new THREE.Group();
  readonly sprite: Billboard;
  readonly shadow: THREE.Mesh;
  cell: Cell;
  readonly pos = new THREE.Vector3();
  facing: Dir = 'down';
  hp = 6;
  readonly maxHp = 6;
  private target: Cell | null = null;
  private moveTime = 0;
  private attackTime = 0;
  private attackHitDone = true;
  private cooldown = 0;
  private invuln = 0;
  private hurtTime = 0;
  private frames: Map<string, THREE.Texture>;

  constructor(private readonly assets: Assets, start: Cell) {
    this.cell = { ...start };
    this.frames = new Map();
    const meta = assets.sheet('player').meta;
    for (const key of Object.keys(meta.frames)) this.frames.set(key, assets.frame('player', key));
    this.sprite = new Billboard(this.frames.get('down_idle0')!, 1.7, 24 / 32);
    this.group.add(this.sprite.mesh);
    this.shadow = blobShadow(assets, 1.2);
    this.group.add(this.shadow);
    this.syncPosition(0);
  }

  get attacking(): boolean {
    return this.attackTime > 0;
  }

  /** Vetor de frente em mundo, usado para checar o alcance do golpe. */
  facingVector(): { x: number; z: number } {
    const v = DIR_VECTORS[this.facing];
    return { x: v.dx, z: v.dz };
  }

  tryAttack(): boolean {
    if (this.cooldown > 0 || this.attackTime > 0 || this.hp <= 0) return false;
    this.attackTime = 0.34;
    this.attackHitDone = false;
    this.cooldown = 0.42;
    return true;
  }

  takeHit(damage: number): boolean {
    if (this.invuln > 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.invuln = 0.9;
    this.hurtTime = 0.3;
    return true;
  }

  respawn(start: Cell): void {
    this.cell = { ...start };
    this.target = null;
    this.hp = this.maxHp;
    this.invuln = 0.8;
    this.syncPosition(0);
  }

  /** Movimento por célula: um passo por vez, com a posição visual deslizando até o centro da célula. */
  update(dt: number, input: Input, grid: WorldGrid, canControl: boolean): PlayerEvent[] {
    const events: PlayerEvent[] = [];
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtTime = Math.max(0, this.hurtTime - dt);

    if (this.attackTime > 0) {
      this.attackTime -= dt;
      if (!this.attackHitDone && this.attackTime <= 0.18) {
        this.attackHitDone = true;
        events.push({ type: 'hit-window' });
      }
    }

    if (this.target) {
      const tx = this.target.x, tz = this.target.z;
      const dx = tx - this.pos.x, dz = tz - this.pos.z;
      const dist = Math.hypot(dx, dz);
      const step = PLAYER_SPEED * dt;
      if (dist <= step) {
        this.pos.x = tx;
        this.pos.z = tz;
        this.cell = { ...this.target };
        this.target = null;
        events.push({ type: 'step', cell: this.cell });
      } else {
        this.pos.x += (dx / dist) * step;
        this.pos.z += (dz / dist) * step;
      }
      this.moveTime += dt;
    }

    if (!this.target && canControl && this.hp > 0 && this.attackTime <= 0) {
      const dir = input.direction();
      if (dir) {
        this.facing = dir;
        const v = DIR_VECTORS[dir];
        const nx = this.cell.x + v.dx, nz = this.cell.z + v.dz;
        if (!grid.isSolid(nx, nz)) this.target = { x: nx, z: nz };
      }
    }
    this.syncPosition(dt);
    return events;
  }

  private syncPosition(dt: number): void {
    const y = heightAt(this.pos.x, this.pos.z);
    this.group.position.set(this.pos.x, y, this.pos.z);
    this.shadow.position.set(0, 0.03, 0);
    this.updateFrame(dt);
  }

  private updateFrame(_dt: number): void {
    let pose: string;
    if (this.hp <= 0) pose = 'hurt';
    else if (this.attackTime > 0) pose = 'attack';
    else if (this.hurtTime > 0) pose = 'hurt';
    else if (this.target) pose = ['walkA', 'idle0', 'walkB', 'idle0'][Math.floor(this.moveTime * 8) % 4];
    else pose = Math.floor(performance.now() / 500) % 2 ? 'idle1' : 'idle0';
    const key = `${this.facing}_${pose}`;
    const tex = this.frames.get(key) ?? this.frames.get(`${this.facing}_idle0`)!;
    this.sprite.setFrame(tex);
    this.sprite.faceCamera(this.camX, this.camZ);
    if (this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0) this.sprite.setOpacity(0.35);
    else this.sprite.setOpacity(1);
  }

  camX = 0;
  camZ = 0;
  setCamera(x: number, z: number): void {
    this.camX = x;
    this.camZ = z;
  }
}

// ------------------------------------------------------------------ NPCs
export class Herald {
  readonly group = new THREE.Group();
  readonly sprite: Billboard;
  readonly cell: Cell = HERALD;
  private readonly frames: THREE.Texture[];
  private t = 0;
  readonly aura: THREE.Sprite;
  private readonly auraMat: THREE.SpriteMaterial;

  constructor(assets: Assets) {
    this.frames = Array.from({ length: 4 }, (_, i) => assets.frame('herald', `flap_${i}`));
    this.sprite = new Billboard(this.frames[0], 3.2, 1);
    this.group.add(this.sprite.mesh);
    this.auraMat = new THREE.SpriteMaterial({
      map: assets.texture('glow_soft'), color: '#9fe8ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.aura = new THREE.Sprite(this.auraMat);
    this.aura.scale.set(5, 5, 1);
    this.aura.position.y = 1.9;
    this.group.add(this.aura);
    this.group.position.set(this.cell.x, 0, this.cell.z);
  }

  update(dt: number, camX: number, camZ: number, t: number): void {
    this.t += dt;
    const frame = Math.floor(this.t / 0.13) % 4;
    this.sprite.setFrame(this.frames[frame]);
    this.sprite.mesh.position.y = 0.9 + Math.sin(t * 1.4) * 0.25;
    this.aura.position.y = this.sprite.mesh.position.y + 1.0;
    this.auraMat.opacity = 0.45 + 0.12 * Math.sin(t * 2.2);
    this.sprite.faceCamera(camX, camZ);
  }
}

export class Villager {
  readonly group = new THREE.Group();
  readonly sprite: Billboard;
  readonly id: 'villager_a' | 'villager_b';
  readonly home: Cell;
  private readonly frames: Map<string, THREE.Texture>;
  private readonly rng: () => number;
  private x: number;
  private z: number;
  private wanderT = 0;
  private wx = 0;
  private wz = 0;
  private dir: Dir = 'down';
  private t = 0;

  constructor(assets: Assets, id: 'villager_a' | 'villager_b', home: Cell) {
    this.id = id;
    this.home = home;
    this.rng = mulberry32(home.x * 97 + home.z * 13 + 5);
    this.frames = new Map(Object.keys(assets.sheet(id).meta.frames).map((k) => [k, assets.frame(id, k)]));
    this.sprite = new Billboard(this.frames.get('down_idle0')!, 1.7, 24 / 32);
    this.group.add(this.sprite.mesh);
    this.group.add(blobShadow(assets, 1.0));
    this.x = home.x;
    this.z = home.z;
  }

  update(dt: number, grid: WorldGrid, camX: number, camZ: number): void {
    this.t += dt;
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = range(this.rng, 2.5, 5);
      this.wx = this.home.x + range(this.rng, -1.2, 1.2);
      this.wz = this.home.z + range(this.rng, -1.2, 1.2);
    }
    const dx = this.wx - this.x, dz = this.wz - this.z;
    const d = Math.hypot(dx, dz);
    const moving = d > 0.05;
    if (moving) {
      const s = Math.min(d, 0.7 * dt);
      const nx = this.x + (dx / d) * s, nz = this.z + (dz / d) * s;
      if (!grid.isSolid(Math.round(nx), Math.round(nz))) {
        this.x = nx;
        this.z = nz;
      }
      this.dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up');
    }
    const pose = moving ? ['walkA', 'idle0', 'walkB', 'idle0'][Math.floor(this.t * 6) % 4] : (Math.floor(this.t * 2) % 2 ? 'idle1' : 'idle0');
    this.sprite.setFrame(this.frames.get(`${this.dir}_${pose}`) ?? this.frames.get('down_idle0')!);
    this.group.position.set(this.x, heightAt(this.x, this.z), this.z);
    this.sprite.faceCamera(camX, camZ);
  }
}

export function createVillagers(assets: Assets): Villager[] {
  return VILLAGERS.map((v) => new Villager(assets, v.id, v.cell));
}

// ------------------------------------------------------------------ fragmentos
export class Fragment {
  readonly group = new THREE.Group();
  readonly sprite: Billboard;
  readonly glow: THREE.Sprite;
  readonly cell: Cell;
  readonly id: FragmentId;
  collected = false;
  private readonly frames: THREE.Texture[];
  private readonly glowMat: THREE.SpriteMaterial;
  private readonly phase: number;

  constructor(assets: Assets, id: FragmentId, cell: Cell, collected: boolean) {
    this.id = id;
    this.cell = cell;
    this.collected = collected;
    this.frames = Array.from({ length: 4 }, (_, i) => assets.frame('fragment', `pulse_${i}`));
    this.sprite = new Billboard(this.frames[0], 0.7, 1);
    this.group.add(this.sprite.mesh);
    this.glowMat = new THREE.SpriteMaterial({
      map: assets.texture('glow_soft'), color: '#ffd46b', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.scale.set(1.8, 1.8, 1);
    this.group.add(this.glow);
    this.group.position.set(cell.x, heightAt(cell.x, cell.z), cell.z);
    this.group.visible = !collected;
    this.phase = cell.x * 0.7 + cell.z * 0.3;
  }

  collect(): void {
    this.collected = true;
    this.group.visible = false;
  }

  update(t: number, camX: number, camZ: number): void {
    if (this.collected) return;
    this.sprite.setFrame(this.frames[Math.floor(t * 6) % 4]);
    this.sprite.mesh.position.y = 0.9 + Math.sin(t * 2 + this.phase) * 0.18;
    this.glow.position.y = this.sprite.mesh.position.y + 0.3;
    this.glowMat.opacity = 0.55 + 0.2 * Math.sin(t * 3 + this.phase);
    this.sprite.faceCamera(camX, camZ);
  }
}

export function createFragments(assets: Assets, collected: Set<string>): Fragment[] {
  return FRAGMENTS.map((f) => new Fragment(assets, f.id, f.cell, collected.has(f.id)));
}

// ------------------------------------------------------------------ criatura corrompida
export type CreatureState = 'idle' | 'chase' | 'telegraph' | 'lunge' | 'recover' | 'dying' | 'dead';
export type CreatureEvent = { type: 'bite' } | { type: 'died' } | { type: 'telegraph' };

export class Creature {
  readonly group = new THREE.Group();
  readonly sprite: Billboard;
  readonly hpBack: THREE.Mesh;
  readonly hpFill: THREE.Mesh;
  readonly maxHp = 4;
  hp = 4;
  state: CreatureState = 'idle';
  x = CREATURE_SPAWN.x;
  z = CREATURE_SPAWN.z;
  private readonly home = { x: CREATURE_SPAWN.x, z: CREATURE_SPAWN.z };
  private timer = 0;
  private walkT = 0;
  private flashT = 0;
  private wanderT = 1;
  private lungeDir = { x: 0, z: 0 };
  private lungeTo = { x: 0, z: 0 };
  private bitten = false;
  private readonly frames: Map<string, THREE.Texture>;
  private readonly rng = mulberry32(31337);

  constructor(assets: Assets, dead: boolean) {
    this.frames = new Map(Object.keys(assets.sheet('creature').meta.frames).map((k) => [k, assets.frame('creature', k)]));
    this.sprite = new Billboard(this.frames.get('walkA')!, 1.2, 32 / 24);
    this.group.add(this.sprite.mesh);
    const bgGeo = new THREE.PlaneGeometry(1.1, 0.14);
    bgGeo.translate(0, 0, 0);
    this.hpBack = new THREE.Mesh(bgGeo, new THREE.MeshBasicMaterial({ color: '#1a1020', depthWrite: false }));
    this.hpFill = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.1), new THREE.MeshBasicMaterial({ color: '#ff5fd2', depthWrite: false }));
    this.hpBack.position.y = 1.55;
    this.hpFill.position.y = 1.55;
    this.hpFill.position.z = 0.002;
    this.group.add(this.hpBack, this.hpFill);
    this.group.add(blobShadow(assets, 1.6));
    if (dead) {
      this.state = 'dead';
      this.hp = 0;
      this.group.visible = false;
    }
    this.group.position.set(this.x, 0, this.z);
  }

  get alive(): boolean {
    return this.state !== 'dead' && this.state !== 'dying';
  }

  /** Recebe golpe. Retorna true se o golpe foi aceito. */
  takeHit(dx: number, dz: number): boolean {
    if (!this.alive) return false;
    this.hp -= 1;
    this.flashT = 0.18;
    this.x += dx * 0.35;
    this.z += dz * 0.35;
    if (this.hp <= 0) {
      this.state = 'dying';
      this.timer = 1.2;
    }
    return true;
  }

  update(dt: number, t: number, playerX: number, playerZ: number, grid: WorldGrid, camX: number, camZ: number): CreatureEvent[] {
    const events: CreatureEvent[] = [];
    this.timer -= dt;
    this.flashT = Math.max(0, this.flashT - dt);
    const dxp = playerX - this.x, dzp = playerZ - this.z;
    const dp = Math.hypot(dxp, dzp);
    const moveTo = (tx: number, tz: number, speed: number) => {
      const dx = tx - this.x, dz = tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-3) return;
      const s = Math.min(d, speed * dt);
      const nx = this.x + (dx / d) * s, nz = this.z + (dz / d) * s;
      if (!grid.isSolid(Math.round(nx), Math.round(nz))) {
        this.x = nx;
        this.z = nz;
      }
    };

    switch (this.state) {
      case 'idle': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = range(this.rng, 2, 4);
          this.lungeDir = { x: this.home.x + range(this.rng, -2.5, 2.5), z: this.home.z + range(this.rng, -2.5, 2.5) };
        }
        moveTo(this.lungeDir.x, this.lungeDir.z, 0.8);
        if (dp < 7) this.state = 'chase';
        break;
      }
      case 'chase': {
        if (dp > 12) {
          this.state = 'idle';
          break;
        }
        if (dp < 1.6) {
          this.state = 'telegraph';
          this.timer = 0.5;
          events.push({ type: 'telegraph' });
          break;
        }
        moveTo(playerX, playerZ, 1.9);
        break;
      }
      case 'telegraph': {
        if (this.timer <= 0) {
          this.state = 'lunge';
          this.timer = 0.35;
          this.bitten = false;
          this.lungeTo = { x: playerX, z: playerZ };
        }
        break;
      }
      case 'lunge': {
        // A investida mira o ponto onde o herói estava ao começar, e para ao chegar perto dele.
        moveTo(this.lungeTo.x, this.lungeTo.z, 5.2);
        if (!this.bitten && dp < 1.1) {
          this.bitten = true;
          events.push({ type: 'bite' });
        }
        if (this.timer <= 0 || dp < 0.6) {
          this.state = 'recover';
          this.timer = 0.8;
        }
        break;
      }
      case 'recover': {
        if (this.timer <= 0) this.state = 'chase';
        break;
      }
      case 'dying': {
        if (this.timer <= 0) {
          this.state = 'dead';
          events.push({ type: 'died' });
        }
        break;
      }
      case 'dead':
        break;
    }

    this.walkT += dt;
    this.group.position.set(this.x, heightAt(this.x, this.z), this.z);
    let key: string;
    if (this.state === 'dying') {
      const p = 1 - Math.max(0, this.timer) / 1.2;
      key = `dissolve_${Math.min(3, Math.floor(p * 4))}`;
      this.sprite.setOpacity(Math.max(0.2, 1 - p * 0.7));
    } else if (this.state === 'lunge') {
      key = 'attack';
      this.sprite.setOpacity(1);
    } else if (this.flashT > 0) {
      key = 'hurt';
    } else {
      key = Math.floor(this.walkT * 5) % 2 ? 'walkB' : 'walkA';
      this.sprite.setOpacity(1);
    }
    if (this.state === 'telegraph') this.sprite.setTint(Math.floor(t * 16) % 2 ? '#ff8a8a' : '#ffffff');
    else this.sprite.setTint('#ffffff');
    this.sprite.setFrame(this.frames.get(key) ?? this.frames.get('walkA')!);
    this.sprite.faceCamera(camX, camZ);
    const frac = Math.max(0, this.hp) / this.maxHp;
    this.hpFill.scale.x = frac;
    this.hpFill.position.x = -(1 - frac) * 0.5;
    this.hpBack.visible = this.hp > 0 && this.alive;
    this.hpFill.visible = this.hpBack.visible;
    this.hpBack.lookAt(camX, 1.55 + this.group.position.y, camZ);
    this.hpFill.lookAt(camX, 1.55 + this.group.position.y, camZ);
    return events;
  }

  hide(): void {
    this.group.visible = false;
  }
}

export function createCreature(assets: Assets, dead: boolean): Creature {
  return new Creature(assets, dead);
}

export const PLAYER_SPAWN = PLAYER_START;
