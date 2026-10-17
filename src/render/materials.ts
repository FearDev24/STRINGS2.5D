// Materiais compartilhados: vento por vértice (com suporte a instancing) e helpers de cor.
import * as THREE from 'three';

export interface WindUniforms {
  uTime: { value: number };
  uWind: { value: number };
}

export function createWindUniforms(): WindUniforms {
  return { uTime: { value: 0 }, uWind: { value: 1 } };
}

/**
 * Injeta deslocamento de vento no vértice. `amp` controla a flexibilidade do objeto:
 * grama e folhas usam valores maiores; troncos usam valores quase nulos.
 * Usa instanceMatrix quando disponível, para que cada instância balance em fase diferente.
 */
export function withWind<T extends THREE.MeshStandardMaterial | THREE.MeshBasicMaterial>(
  material: T,
  uniforms: WindUniforms,
  amp: number,
): T {
  const id = `wind_${amp}`;
  material.customProgramCacheKey = () => id;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = `uniform float uTime;\nuniform float uWind;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ipos = vec3(instanceMatrix[3].x, 0.0, instanceMatrix[3].z);
      #else
        vec3 ipos = vec3(0.0);
      #endif
      float hh = clamp(position.y + 0.5, 0.0, 6.0);
      float gust = sin(uTime * 1.3 + ipos.x * 0.45 + ipos.z * 0.31) * 0.6
                 + sin(uTime * 2.9 + ipos.z * 0.9 + ipos.x * 0.2) * 0.25;
      transformed.x += gust * uWind * hh * ${amp.toFixed(4)};
      transformed.z += gust * 0.5 * uWind * hh * ${amp.toFixed(4)};`,
    );
  };
  return material;
}

/** Cor com variação de tom determinística por índice (sem rng em runtime). */
export function tint(base: THREE.Color, k: number): THREE.Color {
  const v = 0.85 + ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.3;
  return base.clone().multiplyScalar(v);
}
