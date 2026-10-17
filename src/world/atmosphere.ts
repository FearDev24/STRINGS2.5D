// Atmosfera: céu em gradiente, sol quente com sombras, névoa, raios de luz volumétricos
// (aproximados por faixas aditivas), vaga-lumes, partículas de luz e folhas caindo.
import * as THREE from 'three';
import { Assets } from '../render/assets';
import { Preset, EffectToggles } from '../core/config';
import { mulberry32, range } from '../core/rng';
import { BOUNDS } from './layout';

export const SUN_DIR = new THREE.Vector3(-0.5, 0.78, -0.42).normalize();
// Paleta de "golden hour": névoa âmbar, céu quente e sol de contraluz.
export const FOG_COLOR = new THREE.Color('#d8a06a');

export type WeatherName = 'dourado' | 'crepusculo' | 'chuva' | 'neve';

// Cada clima troca névoa, céu, cor e intensidade do sol e da luz ambiente.
export const WEATHERS: Record<WeatherName, { label: string; fog: string; density: number; sun: string; sunI: number; top: string; horizon: string; hemi: number; rays: number }> = {
  dourado: { label: 'Hora dourada', fog: '#d8a06a', density: 0.009, sun: '#ffb860', sunI: 2.6, top: '#f0a862', horizon: '#ffd49a', hemi: 0.8, rays: 1 },
  crepusculo: { label: 'Crepúsculo', fog: '#8a5a8a', density: 0.026, sun: '#ff8a5a', sunI: 1.8, top: '#4a3a6a', horizon: '#d0708a', hemi: 0.7, rays: 0.4 },
  chuva: { label: 'Chuva', fog: '#7a7f8a', density: 0.03, sun: '#c8c8d8', sunI: 1.2, top: '#5a6070', horizon: '#9aa0aa', hemi: 0.8, rays: 0.05 },
  neve: { label: 'Neve', fog: '#c8d0e0', density: 0.028, sun: '#e0e8ff', sunI: 1.6, top: '#8a98b8', horizon: '#d8e0f0', hemi: 1.0, rays: 0.1 },
};

export interface Atmosphere {
  group: THREE.Group;
  setWeather(w: WeatherName): void;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fog: THREE.FogExp2;
  update(t: number, dt: number, focus: THREE.Vector3, camera: THREE.Camera): void;
  applyToggles(t: EffectToggles): void;
  dispose(): void;
}

function skyDome(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#f0a862') },
      horizon: { value: new THREE.Color('#ffd49a') },
      sunDir: { value: SUN_DIR.clone() },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.85, 0.5) * (pow(s, 24.0) * 0.6 + pow(s, 4.0) * 0.12);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 14), mat);
  dome.name = 'sky';
  dome.renderOrder = -10;
  return dome;
}

/** Pontos luminosos animados por código (vaga-lumes e poeira iluminada). */
function glowPoints(count: number, color: string, area: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }, size: number, seed: number) {
  const rng = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const aSeed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = range(rng, area.x0, area.x1);
    pos[i * 3 + 1] = range(rng, area.y0, area.y1);
    pos[i * 3 + 2] = range(rng, area.z0, area.z1);
    aSeed[i] = rng() * 10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSize: { value: size }, uColor: { value: new THREE.Color(color) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform float uSize; attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime*0.6 + aSeed*6.0)*0.6, sin(uTime*0.9 + aSeed*3.0)*0.45, cos(uTime*0.5 + aSeed*5.0)*0.6);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = 0.5 + 0.5 * sin(uTime * 1.5 + aSeed * 12.0);
        gl_PointSize = uSize * (0.8 + 0.4 * vA) * (30.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        // Disco suave com halo: lê-se como bokeh, como os vaga-lumes desfocados da referência.
        float disc = smoothstep(0.5, 0.25, d);
        float halo = smoothstep(0.5, 0.0, d) * 0.35;
        float a = disc + halo;
        gl_FragColor = vec4(uColor * a * (0.6 + vA), a * (0.4 + 0.5 * vA));
      }`,
  });
  return new THREE.Points(geo, mat);
}

export function buildAtmosphere(assets: Assets, preset: Preset): Atmosphere {
  const group = new THREE.Group();
  group.name = 'atmosphere';
  const sky = skyDome();
  group.add(sky);

  const hemi = new THREE.HemisphereLight('#ffd6a0', '#4e3a24', 0.8);
  group.add(hemi);

  const sun = new THREE.DirectionalLight('#ffb860', 3.2);
  sun.castShadow = preset.toggles.shadows;
  sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  group.add(sun, sun.target);

  const fog = new THREE.FogExp2(FOG_COLOR, 0.022);

  // Raios de sol: faixas gaussianas aditivas, inclinadas na direção do sol.
  const rayGeo = new THREE.PlaneGeometry(2.4, 15);
  rayGeo.translate(0, -7.5, 0);
  const rayTex = assets.texture('light_shaft');
  const rays: THREE.Mesh[] = [];
  const rayDirection = SUN_DIR.clone().negate();
  const rayQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), rayDirection);
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: rayTex, color: '#ffe2a0', transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const m = new THREE.Mesh(rayGeo, mat);
    m.quaternion.copy(rayQuat);
    m.renderOrder = 5;
    group.add(m);
    rays.push(m);
  }

  const fireflies = glowPoints(preset.fireflies, '#d8ff6a', {
    x0: BOUNDS.minX, x1: BOUNDS.maxX, z0: BOUNDS.minZ, z1: BOUNDS.maxZ, y0: 0.5, y1: 2.6,
  }, 34, 11);
  group.add(fireflies);

  const motesCount = Math.round(420 * preset.particleRate);
  const motes = glowPoints(motesCount, '#fff1c0', {
    x0: 12, x1: BOUNDS.maxX, z0: BOUNDS.minZ, z1: BOUNDS.maxZ, y0: 0.4, y1: 7,
  }, 9, 23);
  group.add(motes);

  // Folhas caindo: quadrados pequenos com cor por instância, com queda e balanço.
  const leafCount = Math.round(70 * preset.particleRate);
  const leafGeo = new THREE.PlaneGeometry(0.18, 0.11);
  const leafMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: true });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  const leafRng = mulberry32(55);
  const leafState = Array.from({ length: leafCount }, () => ({
    x: range(leafRng, 12, BOUNDS.maxX), y: range(leafRng, 0.5, 6), z: range(leafRng, BOUNDS.minZ, BOUNDS.maxZ), s: range(leafRng, 0.6, 1.4), r: leafRng() * 6,
  }));
  const colors = ['#e0a33a', '#c4642a', '#8fbf4a', '#d9c25a'].map((c) => new THREE.Color(c));
  leafState.forEach((_, i) => leaves.setColorAt(i, colors[i % colors.length]));
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  leaves.count = leafCount;
  group.add(leaves);

  const dummy = new THREE.Object3D();

  // Chuva: linhas finas caindo em volta do jogador. Neve: flocos que balançam.
  const RAIN = 700;
  const rainPos = new Float32Array(RAIN * 6);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#cfe4ff', transparent: true, opacity: 0.32, depthWrite: false }));
  rain.visible = false;
  rain.frustumCulled = false;
  group.add(rain);
  const SNOW = 520;
  const snowPos = new Float32Array(SNOW * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.14, transparent: true, opacity: 0.9, depthWrite: false }));
  snow.visible = false;
  snow.frustumCulled = false;
  group.add(snow);
  const pRng = mulberry32(91);
  const drops = Array.from({ length: RAIN }, () => ({ x: 0, y: 0, z: 0 }));
  const flakes = Array.from({ length: SNOW }, () => ({ x: 0, y: 0, z: 0, p: 0 }));
  const scatter = (o: { x: number; y: number; z: number }, cx: number, cz: number) => {
    o.x = cx + range(pRng, -18, 18);
    o.z = cz + range(pRng, -18, 18);
    o.y = range(pRng, 0, 14);
  };
  drops.forEach((d) => scatter(d, 0, 0));
  flakes.forEach((f) => { scatter(f, 0, 0); f.p = pRng() * 6; });
  let rayScale = 1;

  return {
    group,
    sun,
    hemi,
    fog,
    setWeather(w) {
      const c = WEATHERS[w];
      fog.color.set(c.fog);
      fog.density = c.density;
      sun.color.set(c.sun);
      sun.intensity = c.sunI;
      hemi.intensity = c.hemi;
      const u = (sky.material as THREE.ShaderMaterial).uniforms;
      (u.top.value as THREE.Color).set(c.top);
      (u.horizon.value as THREE.Color).set(c.horizon);
      rayScale = c.rays;
      rain.visible = w === 'chuva';
      snow.visible = w === 'neve';
    },
    applyToggles(t) {
      fireflies.visible = t.fireflies;
      leaves.visible = t.falling;
      rays.forEach((m) => { m.visible = t.godRays; });
      sun.castShadow = t.shadows;
    },
    update(t, dt, focus, camera) {
      sky.position.copy(camera.position);
      sun.position.copy(focus).addScaledVector(SUN_DIR, 45);
      sun.target.position.copy(focus);
      (fireflies.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (motes.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      rays.forEach((m, i) => {
        const a = (i / rays.length) * Math.PI * 2 + 0.7;
        const r = 4 + (i % 3) * 3;
        m.position.set(focus.x + Math.cos(a) * r + 2, 13, focus.z + Math.sin(a) * r);
        (m.material as THREE.MeshBasicMaterial).opacity = (0.3 + 0.12 * Math.sin(t * 0.7 + i * 1.3)) * rayScale;
      });
      for (let i = 0; i < leafState.length; i++) {
        const l = leafState[i];
        l.y -= dt * 0.45 * l.s;
        l.x += Math.sin(t * 1.1 + i) * dt * 0.5;
        l.z += Math.cos(t * 0.8 + i) * dt * 0.3;
        l.r += dt * 2 * l.s;
        if (l.y < 0.05 || Math.hypot(l.x - focus.x, l.z - focus.z) > 22) {
          const a = leafRng() * Math.PI * 2, rr = range(leafRng, 4, 20);
          l.x = focus.x + Math.cos(a) * rr;
          l.z = focus.z + Math.sin(a) * rr;
          l.y = range(leafRng, 4, 7);
        }
        dummy.position.set(l.x, l.y, l.z);
        dummy.rotation.set(l.r * 0.7, l.r, l.r * 0.4);
        dummy.updateMatrix();
        leaves.setMatrixAt(i, dummy.matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;

      if (rain.visible) {
        const dropSpeed = 16;
        drops.forEach((d, i) => {
          d.y -= dt * dropSpeed;
          if (d.y < 0 || Math.hypot(d.x - focus.x, d.z - focus.z) > 20) scatter(d, focus.x, focus.z);
          const o = i * 6;
          rainPos[o] = d.x; rainPos[o + 1] = d.y; rainPos[o + 2] = d.z;
          rainPos[o + 3] = d.x - 0.08; rainPos[o + 4] = d.y + 0.7; rainPos[o + 5] = d.z;
        });
        rainGeo.attributes.position.needsUpdate = true;
      }
      if (snow.visible) {
        flakes.forEach((f, i) => {
          f.y -= dt * 0.9;
          f.x += Math.sin(t * 1.3 + f.p) * dt * 0.5;
          if (f.y < 0 || Math.hypot(f.x - focus.x, f.z - focus.z) > 20) scatter(f, focus.x, focus.z);
          snowPos[i * 3] = f.x; snowPos[i * 3 + 1] = f.y; snowPos[i * 3 + 2] = f.z;
        });
        snowGeo.attributes.position.needsUpdate = true;
      }
    },
    dispose() {
      leafGeo.dispose();
      leafMat.dispose();
      leaves.dispose();
    },
  };
}
