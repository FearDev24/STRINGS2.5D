// Pós-processamento: oclusão ambiental (GTAO), profundidade de campo (Bokeh), bloom seletivo
// e tonemapping (ACES via OutputPass). Cada passe pode ser ligado e desligado em tempo real.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { EffectToggles } from '../core/config';

export class PostFX {
  readonly composer: EffectComposer;
  private readonly ao: GTAOPass;
  private readonly bokeh: BokehPass;
  private readonly bloom: UnrealBloomPass;
  private readonly output: OutputPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, width: number, height: number) {
    const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.ao = new GTAOPass(scene, camera, width, height);
    this.ao.blendIntensity = 0.9;
    this.composer.addPass(this.ao);
    this.bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.00035, maxblur: 0.006 });
    this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.32, 0.55, 0.88);
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
  }

  apply(t: EffectToggles, dofOn: boolean): void {
    this.ao.enabled = t.ao;
    this.bloom.enabled = t.bloom;
    this.bokeh.enabled = t.dof && dofOn;
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.ao.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  setFocus(distance: number): void {
    (this.bokeh.uniforms as Record<string, { value: number }>).focus.value = distance;
  }

  render(dt: number): void {
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
