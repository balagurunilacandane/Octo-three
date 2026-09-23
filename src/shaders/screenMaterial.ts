import * as THREE from 'three'

// Animated "screen" shader used by every monitor and dashboard.
// One material instance per department: its `uActivity` uniform makes all of
// that department's screens update faster and brighter when the team is busy.

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragment = /* glsl */ `
uniform float uTime;
uniform float uActivity;
uniform vec3 uColor;
uniform float uMode;
varying vec2 vUv;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

// Quiet, paper-white monitors: dark-grey content with a touch of the team colour.
void main() {
  vec2 uv = vUv;
  float t = uTime * (0.4 + uActivity * 1.6);
  vec3 bg = vec3(0.80, 0.81, 0.82);
  vec3 ink = vec3(0.30, 0.31, 0.34);
  vec3 accent = mix(ink, uColor, 0.55);
  vec3 col = bg;

  if (uMode < 0.5) {
    float cols = 6.0;
    float id = floor(uv.x * cols);
    float h = 0.25 + 0.5 * (0.5 + 0.5 * sin(t * (0.6 + hash(id) * 1.2) + id * 1.7));
    float bar = step(uv.y, h * 0.8 + 0.1) * step(0.18, fract(uv.x * cols)) * step(fract(uv.x * cols), 0.78) * step(0.1, uv.y);
    col = mix(col, id < 1.0 ? accent : ink, bar * 0.85);
  } else if (uMode < 1.5) {
    float y = uv.y + t * 0.05;
    float row = floor(y * 8.0);
    float len = 0.3 + 0.55 * hash(row + floor(t * 0.25));
    float line = step(0.4, fract(y * 8.0)) * step(fract(y * 8.0), 0.68) * step(uv.x, len) * step(0.1, uv.x);
    col = mix(col, hash(row) > 0.8 ? accent : ink, line * 0.7);
  } else {
    float y = 0.5 + 0.25 * sin(uv.x * 10.0 + t * 1.6) * sin(uv.x * 3.0 - t * 0.5);
    col = mix(col, accent, smoothstep(0.045, 0.0, abs(uv.y - y)) * 0.9);
  }

  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  col = mix(vec3(0.55), col, smoothstep(0.0, 0.04, edge));
  col *= 0.86 + uActivity * 0.16;
  gl_FragColor = vec4(col, 1.0);
}
`

export type ScreenMaterial = THREE.ShaderMaterial & {
  uniforms: { uTime: { value: number }; uActivity: { value: number }; uColor: { value: THREE.Color }; uMode: { value: number } }
}

export function createScreenMaterial(color: string, mode = 0): ScreenMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uTime: { value: 0 },
      uActivity: { value: 0.2 },
      uColor: { value: new THREE.Color(color) },
      uMode: { value: mode },
    },
    toneMapped: false,
  }) as ScreenMaterial
}
