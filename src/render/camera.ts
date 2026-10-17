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

  follow(target: THREE.Vector3, dt: number): void {
    this.desired.copy(target).add(this.offset);
    if (!this.initialized) {
      this.camera.position.copy(this.desired);
      this.initialized = true;
    } else {
      const k = 1 - Math.exp(-5.5 * dt);
      this.camera.position.lerp(this.desired, k);
    }
    this.look.copy(target).add(this.lookOffset);
    this.camera.lookAt(this.look);
  }

  /** Distância até o foco, usada pelo desfoque de profundidade de campo. */
  focusDistance(target: THREE.Vector3): number {
    return this.camera.position.distanceTo(target);
  }
}
