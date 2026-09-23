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

void main() {
  vec2 uv = vUv;
  float t = uTime * (0.6 + uActivity * 2.4);
  vec3 bg = mix(vec3(0.03, 0.04, 0.12), uColor * 0.18, 0.5);
  vec3 col = bg;

  if (uMode < 0.5) {
    // bar chart
    float cols = 7.0;
    float id = floor(uv.x * cols);
    float h = 0.25 + 0.6 * (0.5 + 0.5 * sin(t * (0.8 + hash(id) * 1.6) + id * 1.7));
    float bar = step(uv.y, h * 0.8 + 0.08) * step(0.12, fract(uv.x * cols)) * step(fract(uv.x * cols), 0.82) * step(0.08, uv.y);
    col = mix(col, uColor * 1.3, bar);
  } else if (uMode < 1.5) {
    // scrolling text lines
    float row = floor((uv.y + t * 0.08) * 9.0);
    float len = 0.3 + 0.6 * hash(row + floor(t * 0.3));
    float line = step(0.35, fract((uv.y + t * 0.08) * 9.0)) * step(fract((uv.y + t * 0.08) * 9.0), 0.7) * step(uv.x, len) * step(0.08, uv.x);
    col = mix(col, uColor * 1.15, line * 0.9);
  } else {
    // waveform / line graph
    float y = 0.5 + 0.28 * sin(uv.x * 12.0 + t * 2.0) * sin(uv.x * 3.0 - t * 0.7);
    float d = abs(uv.y - y);
    col += uColor * smoothstep(0.05, 0.0, d) * 1.4;
    col += uColor * 0.25 * step(fract(uv.x * 10.0), 0.03);
  }

  // scanline + frame glow
  col *= 0.88 + 0.12 * sin(uv.y * 160.0 + uTime * 4.0);
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  col += uColor * smoothstep(0.05, 0.0, edge) * 0.9;
  col *= 0.75 + uActivity * 0.7;
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
