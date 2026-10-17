// Câmera elevada e fixa em ângulo, que segue o jogador com suavização exponencial.
import * as THREE from 'three';

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly offset = new THREE.Vector3(0, 11, 12.2);
  // Olha um pouco acima do jogador: as copas das árvores entram no enquadramento, como na referência.
  private readonly lookOffset = new THREE.Vector3(0, 2.6, 0);
  private readonly desired = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 320);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // Ponto que a câmera segue. Só se move quando o jogador sai da zona de estabilidade,
  // o que evita microtremores em passos curtos.
  private readonly anchor = new THREE.Vector3();
  private readonly deadZone = 0.45;

  follow(target: THREE.Vector3, dt: number): void {
    if (!this.initialized) {
      this.anchor.copy(target);
      this.initialized = true;
    } else {
      const dx = target.x - this.anchor.x, dz = target.z - this.anchor.z;
      const d = Math.hypot(dx, dz);
      if (d > this.deadZone) {
        const k = 1 - Math.exp(-5.5 * dt);
        const move = (d - this.deadZone) * k;
        this.anchor.x += (dx / d) * move;
        this.anchor.z += (dz / d) * move;
      }
    }
    this.desired.copy(this.anchor).add(this.offset);
    this.camera.position.copy(this.desired);
    this.look.copy(this.anchor).add(this.lookOffset);
    this.camera.lookAt(this.look);
  }

  /** Distância até o foco, usada pelo desfoque de profundidade de campo. */
  focusDistance(target: THREE.Vector3): number {
    return this.camera.position.distanceTo(target);
  }
}
