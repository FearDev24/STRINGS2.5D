// Personagens em pixel art são planos que sempre olham para a câmera (billboards), iluminados
// pela cena. Também há sombra de contato e um sistema de partículas por pontos.
import * as THREE from 'three';
import { Assets } from '../render/assets';

export class Billboard {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshStandardMaterial;
  readonly width: number;
  readonly height: number;

  constructor(initial: THREE.Texture, worldHeight: number, aspect: number) {
    this.height = worldHeight;
    this.width = worldHeight * aspect;
    const geo = new THREE.PlaneGeometry(this.width, this.height);
    geo.translate(0, this.height / 2, 0); // base no ponto de origem
    // Emissão com a própria textura: um preenchimento suave que impede a silhueta escura
    // quando o sol vem de trás (contraluz), sem alterar a iluminação do cenário.
    this.mat = new THREE.MeshStandardMaterial({
      map: initial, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, metalness: 0,
      emissive: '#ffffff', emissiveMap: initial, emissiveIntensity: 0.45,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }

  /** Desenha por cima da vegetação (sem teste de profundidade), para o herói nunca sumir atrás de copas. */
  setAlwaysVisible(on: boolean): void {
    this.mat.depthTest = !on;
    this.mesh.renderOrder = on ? 10 : 0;
    this.mat.needsUpdate = true;
  }

  setFrame(tex: THREE.Texture): void {
    if (this.mat.map !== tex) {
      this.mat.map = tex;
      this.mat.emissiveMap = tex;
    }
  }

  setTint(color: THREE.ColorRepresentation): void {
    this.mat.color.set(color);
  }

  setOpacity(alpha: number): void {
    this.mat.transparent = alpha < 1;
    this.mat.opacity = alpha;
    this.mat.depthWrite = alpha >= 1;
  }

  /** Todos os billboards usam o mesmo yaw, o da câmera. Assim nenhum sprite gira ao andar. */
  static cameraYaw = 0;

  faceCamera(_camX: number, _camZ: number): void {
    this.mesh.rotation.y = Billboard.cameraYaw;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

export function blobShadow(assets: Assets, size: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size * 0.5);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: assets.texture('blob_shadow'), transparent: true, opacity: 0.75, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  return m;
}

export interface BurstOptions {
  count: number;
  color: THREE.ColorRepresentation;
  speed: number;
  life: number;
  gravity: number;
  size: number;
}

/** Pool fixo de partículas. Cada emissão reaproveita slots livres, sem alocar memória por quadro. */
export class ParticlePool {
  readonly points: THREE.Points;
  private readonly capacity: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly base: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly grav: Float32Array;
  private cursor = 0;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.PointsMaterial;
  rate = 1;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.base = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.14, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, o: BurstOptions): void {
    const n = Math.max(1, Math.round(o.count * this.rate));
    const c = new THREE.Color(o.color);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.2;
      const s = o.speed * (0.4 + Math.random() * 0.8);
      this.pos.set([x, y, z], i * 3);
      this.vel.set([Math.cos(a) * s, up * s, Math.sin(a) * s], i * 3);
      this.base.set([c.r, c.g, c.b], i * 3);
      this.col.set([c.r, c.g, c.b], i * 3);
      this.life[i] = o.life * (0.7 + Math.random() * 0.5);
      this.maxLife[i] = this.life[i];
      this.grav[i] = o.gravity;
    }
    this.mat.size = o.size;
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999; // escondida fora da cena
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
      } else {
        const fade = this.life[i] / this.maxLife[i];
        this.col[i * 3] = this.base[i * 3] * fade;
        this.col[i * 3 + 1] = this.base[i * 3 + 1] * fade;
        this.col[i * 3 + 2] = this.base[i * 3 + 2] * fade;
      }
    }
    if (any) {
      (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
