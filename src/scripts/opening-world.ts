import * as THREE from 'three';
import { mix, smooth } from './motion.mjs';
import { openingState, hasAmbientMotion } from './opening-motion.mjs';

type Viewport = { x: number; y: number; height: number; aspect: number };
export type WorldInput = {
  progress: number; time: number; reduced: boolean; pointerX: number; pointerY: number;
  viewport: Viewport; swordMatrix: THREE.Matrix4; presence?: number; compact?: boolean;
  cultureArea?: {left:number;right:number;top:number;bottom:number};
};

// All scenery is independent of the sword's measured camera bounds. Coordinates
// are in viewport heights; depth remains in world units so the cloth can pass
// in front of and behind the sword without another renderer or a video layer.
const common = /* glsl */`
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
      mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
  }
`;
const flatVertex = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;

function shader(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    vertexShader: flatVertex, fragmentShader, uniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

function random(seed: number) {
  let value = seed;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

function mountainGeometry(layer: number) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const columns = 180, rows = 5;
  for (let x = 0; x <= columns; x++) {
    const u = x / columns, s = u * 2 - 1;
    const left = Math.exp(-Math.pow((s + .73 - layer * .06) / .22, 2));
    const right = Math.exp(-Math.pow((s - .68 - layer * .03) / .3, 2));
    const ridge = .06 + left * (.29 - layer * .025) + right * (.33 - layer * .025)
      + .024 * Math.sin(s * 27 + layer * 4) + .012 * Math.sin(s * 63 + layer)
      + .006 * Math.sin(s * 143 + layer * 5);
    for (let y = 0; y <= rows; y++) {
      const v = y / rows;
      positions.push(s * 1.25, mix(-.07, ridge, v), .18 * Math.sin(s * 19 + layer) * v);
      uvs.push(u, v);
      if (x < columns && y < rows) {
        const a = x * (rows + 1) + y, b = a + rows + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function createOpeningWorld() {
  const root = new THREE.Group(); root.name = 'opening-world';
  const landscape = new THREE.Group(); landscape.name = 'ink-landscape'; root.add(landscape);
  const paperGroup = new THREE.Group(); paperGroup.name = 'opening-paper'; root.add(paperGroup);
  const opacity = { value: 1 }, time = { value: 0 };
  const mountains: THREE.Mesh[] = [];

  for (let layer = 0; layer < 4; layer++) {
    const material = shader(/* glsl */`
      varying vec2 vUv;
      uniform vec3 uInk; uniform float uOpacity; uniform float uLayer;
      ${common}
      void main() {
        float wash = noise(vUv * vec2(32., 5.) + uLayer * 9.);
        float ridge = noise(vUv * vec2(100., 9.));
        float grain = hash(gl_FragCoord.xy);
        vec3 colour = uInk + (wash - .5) * .075 + (ridge - .5) * .035 + (grain - .5) * .026;
        float haze = smoothstep(.02, .65, vUv.y);
        gl_FragColor = vec4(max(colour, vec3(0.)), uOpacity * haze);
        #include <colorspace_fragment>
      }
    `, { uInk: { value: new THREE.Color(['#bfc2ba', '#929e96', '#66746e', '#394c48'][layer]) }, uOpacity: opacity, uLayer: { value: layer } });
    const mountain = new THREE.Mesh(mountainGeometry(layer), material);
    mountain.position.z = -19 + layer * 2;
    mountain.renderOrder = -20 + layer;
    mountains.push(mountain); landscape.add(mountain);
  }

  const mistMaterial = shader(/* glsl */`
    varying vec2 vUv; uniform float uTime; uniform float uOpacity;
    ${common}
    void main() {
      float cloud = noise(vec2(vUv.x * 4. + uTime * .025, vUv.y * 4.));
      float veil = exp(-pow((vUv.y - .5 + (cloud - .5) * .2) * 4.6, 2.));
      gl_FragColor = vec4(vec3(.79, .81, .76), veil * uOpacity * .45);
      #include <colorspace_fragment>
    }
  `, { uTime: time, uOpacity: opacity });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(2.7, .38), mistMaterial);
  mist.position.set(0, .015, -10); mist.renderOrder = -12; landscape.add(mist);

  // Six bounded wave impulses, overwritten in order. Hover and tap need neither
  // a click-to-start gate nor a pointer capture that would interfere with scroll.
  const ripples = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -100, 0));
  let rippleIndex = 0, lastRipple = -100;
  const shadowA = new THREE.Vector2(), shadowB = new THREE.Vector2();
  const waterMaterial = shader(/* glsl */`
    varying vec2 vUv;
    uniform float uTime; uniform float uOpacity; uniform float uAspect; uniform float uLift;
    uniform vec4 uRipples[6]; uniform vec2 uShadowA; uniform vec2 uShadowB;
    ${common}
    float capsule(vec2 p, vec2 a, vec2 b) {
      vec2 ab = b - a;
      return length(p - a - ab * clamp(dot(p - a, ab) / max(dot(ab, ab), .00001), 0., 1.));
    }
    void main() {
      vec2 screen = vec2((vUv.x - .5) * 2.6, mix(-.76, .075, vUv.y));
      vec2 p = vec2(screen.x * uAspect * .5, screen.y);
      float depth = 1. - vUv.y;
      float reflection = noise(vec2(vUv.x * 11., vUv.y * 3.));
      float wave = sin(vUv.y * 230. + sin(vUv.x * 22. + uTime * .34) * 2.3 + uTime * .55);
      float lines = pow(max(0., wave), 14.) * (.2 + noise(vec2(vUv.x * 19., vUv.y * 55.)) * .8);
      vec3 colour = mix(vec3(.15, .205, .19), vec3(.032, .065, .061), smoothstep(0., 1., depth));
      colour += (reflection - .5) * .07 + lines * mix(.009, .027, depth);
      float mirror = exp(-pow((vUv.x - .54 + sin(vUv.y * 60. + uTime * .35) * .008) * 5., 2.));
      colour += vec3(.08, .085, .067) * mirror * pow(vUv.y, 3.);
      vec2 a = vec2(uShadowA.x * uAspect * .5, uShadowA.y);
      vec2 b = vec2(uShadowB.x * uAspect * .5, uShadowB.y);
      float shade = exp(-capsule(p, a, b) * mix(105., 30., uLift));
      colour *= 1. - shade * mix(.7, .05, uLift);
      float rings = 0.;
      for (int i = 0; i < 6; i++) {
        vec4 ripple = uRipples[i]; float rawAge = uTime - ripple.z;
        float age = clamp(rawAge, 0., 8.);
        vec2 delta = p - vec2(ripple.x * uAspect * .5, ripple.y);
        delta.y *= 2.5;
        float radius = length(delta);
        float front = radius - age * .12;
        float envelope = exp(-front * front * 700.) * exp(-age * 1.1);
        rings += sin(front * 150.) * envelope * ripple.w * step(0., rawAge) * step(rawAge, 8.);
      }
      colour += rings * .026 + (hash(gl_FragCoord.xy) - .5) * .008;
      float horizon = 1. - smoothstep(.965, 1., vUv.y);
      gl_FragColor = vec4(max(colour, vec3(0.)), uOpacity * horizon);
      #include <colorspace_fragment>
    }
  `, { uTime: time, uOpacity: opacity, uAspect: { value: 1 }, uLift: { value: 0 }, uRipples: { value: ripples }, uShadowA: { value: shadowA }, uShadowB: { value: shadowB } });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .835), waterMaterial);
  water.name = 'water'; water.position.set(0, -.3425, -8); water.renderOrder = -10; landscape.add(water);

  const randomValue = random(831);
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#313d37', roughness: .96, flatShading: true, transparent: true });
  const stones = new THREE.Group(); stones.name = 'shore-rocks'; landscape.add(stones);
  for (const [x, y, size] of [[-.93, -.43, .17], [-.73, -.46, .09], [.98, -.4, .13], [.82, -.43, .055], [-.85, -.33, .04]]) {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const positions = geometry.getAttribute('position');
    // Equal positions receive equal displacement, keeping the faceted rock closed.
    for (let i = 0; i < positions.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(positions, i);
      const variation = 1 + .15 * Math.sin(v.x * 11 + v.y * 17 + v.z * 23);
      positions.setXYZ(i, v.x * variation, v.y * variation * .64, v.z * variation * .7);
    }
    geometry.computeVertexNormals();
    const stone = new THREE.Mesh(geometry, stoneMaterial);
    stone.position.set(x, y, 1.9); stone.scale.setScalar(size); stone.rotation.z = randomValue() * .5;
    stone.userData = { x, y, size }; stones.add(stone);
  }

  const grassPositions: number[] = [], grassUvs: number[] = [], grassIndices: number[] = [];
  for (let i = 0; i < 90; i++) {
    const side = i < 55 ? -1 : 1;
    const x = side * (.80 + randomValue() * .27), y = -.48 + randomValue() * .08;
    const height = .04 + randomValue() * .15, lean = (randomValue() - .6) * .08;
    for (let j = 0; j <= 5; j++) {
      const t = j / 5, half = (1 - t) * .0012;
      for (const sign of [-1, 1]) {
        grassPositions.push(x + lean * t * t + sign * half, y + height * t, 2.6);
        grassUvs.push(t, i / 90);
      }
      if (j < 5) { const a = i * 12 + j * 2; grassIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
  }
  const grassGeometry = new THREE.BufferGeometry();
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grassPositions, 3));
  grassGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(grassUvs, 2)); grassGeometry.setIndex(grassIndices);
  const grassMaterial = shader(/* glsl */`
    varying vec2 vUv; uniform float uOpacity;
    void main() {
      gl_FragColor = vec4(mix(vec3(.027, .055, .044), vec3(.18, .20, .13), vUv.x), uOpacity);
      #include <colorspace_fragment>
    }
  `, { uOpacity: opacity, uTime: time });
  grassMaterial.vertexShader = /* glsl */`
    varying vec2 vUv; uniform float uTime;
    void main() {
      vUv = uv; vec3 p = position;
      p.x += sin(uTime * .65 + uv.y * 17.) * .006 * uv.x * uv.x;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }
  `;
  const grass = new THREE.Mesh(grassGeometry, grassMaterial); grass.frustumCulled = false; landscape.add(grass);

  const clothGeometry = new THREE.PlaneGeometry(1, 1, 110, 6);
  (clothGeometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  const clothMaterial = new THREE.MeshStandardMaterial({ color: '#bd2118', roughness: .58, metalness: .06, side: THREE.DoubleSide, transparent: true });
  const cloth = new THREE.Mesh(clothGeometry, clothMaterial); cloth.name = 'vermilion-cloth'; cloth.frustumCulled = false; landscape.add(cloth);

  const paperOpacity = { value: 0 };
  const papers: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];
  for (const side of [-1, 1]) {
    const material = shader(/* glsl */`
      varying vec2 vUv; uniform float uOpacity;
      ${common}
      void main() {
        float fibre = noise(vUv * vec2(150., 500.));
        float wash = noise(vUv * vec2(3., 9.));
        float edge = exp(-vUv.y * 35.);
        vec3 paper = vec3(.805, .808, .775) + (fibre - .5) * .038 + (wash - .5) * .018;
        paper -= edge * .055 + pow(1. - vUv.y, 4.) * .035;
        gl_FragColor = vec4(paper, uOpacity * (.94 + .06 * fibre));
        #include <colorspace_fragment>
      }
    `, { uOpacity: paperOpacity });
    const geometry = new THREE.PlaneGeometry(1, 1, 56, 8);
    (geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    const paper = new THREE.Mesh(geometry, material); paper.userData.side = side;
    paper.name = side < 0 ? 'lower-paper' : 'upper-paper'; paper.frustumCulled = false;
    papers.push(paper); paperGroup.add(paper);
  }

  const grip = new THREE.Vector3(), tip = new THREE.Vector3();
  function update(input: WorldInput) {
    const { progress, viewport, pointerX, pointerY, swordMatrix } = input;
    const state = openingState(progress), aspect = viewport.aspect;
    state.landscape *= input.presence ?? 1; state.paper *= input.presence ?? 1;
    const windTime = input.reduced ? 0 : input.time;
    time.value = windTime; opacity.value = state.landscape;
    landscape.visible = state.landscape > .001;
    paperGroup.visible = state.paper > .001;
    root.position.set(viewport.x, viewport.y, 0);
    root.scale.set(viewport.height, viewport.height, 1);

    if (landscape.visible) {
      landscape.position.y = -state.lift * .13;
      for (const [i, mountain] of mountains.entries()) {
        mountain.scale.x = aspect / 2;
        mountain.scale.y = aspect < .85 ? .58 : 1;
        mountain.position.x = pointerX * .012 * (i + 1);
        mountain.position.y = .025 - i * .026 + pointerY * .006 * i;
      }
      mist.scale.x = aspect / 2; water.scale.x = aspect / 2; grass.scale.x = aspect / 2;
      stones.children.forEach(stone => {
        const { x, y, size } = stone.userData;
        stone.position.x = x * aspect / 2 + pointerX * .035;
        stone.position.y = y + pointerY * .012;
        stone.scale.set(size * Math.min(1, aspect * 1.3), size, size);
      });
      stoneMaterial.opacity = state.landscape;
      waterMaterial.uniforms.uAspect.value = aspect; waterMaterial.uniforms.uLift.value = state.lift;
      grip.set(-2.35, 0, 0).applyMatrix4(swordMatrix); tip.set(6.8, .37, 0).applyMatrix4(swordMatrix);
      const shadowY = -.15 - state.lift * .13;
      shadowA.set((grip.x - viewport.x) / (viewport.height * aspect / 2), shadowY - .06);
      shadowB.set((tip.x - viewport.x) / (viewport.height * aspect / 2), shadowY + .025);
      const positions = clothGeometry.getAttribute('position'), uv = clothGeometry.getAttribute('uv');
      for (let i = 0; i < positions.count; i++) {
        const u = uv.getX(i), v = uv.getY(i) - .5;
        const flutter = Math.sin(u * 15 - windTime * 1.15);
        const width = (.048 + .038 * Math.sin(u * Math.PI)) * (1 - smooth(.88, 1, u) * .92);
        const twist = Math.sin(u * 8 - windTime * .6) * .8;
        const x = (-1.13 + u * 2.22) * aspect / 2;
        const y = -.24 - .13 * Math.sin(u * Math.PI * 1.55) + .31 * u * u
          + flutter * .018 * u + v * width * Math.cos(twist) + state.lift * .045;
        const z = Math.sin(u * Math.PI * 2 + .4) * 2.5 - .2 + v * width * Math.sin(twist) * viewport.height;
        positions.setXYZ(i, x, y, z);
      }
      positions.needsUpdate = true; clothGeometry.computeVertexNormals(); clothMaterial.opacity = state.landscape;
    }

    if (paperGroup.visible) {
      paperOpacity.value = state.paper;
      // The seam follows the projected blade, rather than a fixed desktop angle.
      grip.set(-2.35, 0, 0).applyMatrix4(swordMatrix); tip.set(6.8, .37, 0).applyMatrix4(swordMatrix);
      const theta = Math.atan2(tip.y - grip.y, tip.x - grip.x);
      const axisX = Math.cos(theta), axisY = Math.sin(theta);
      const centreX = ((tip.x + grip.x) * .5 - viewport.x) / viewport.height;
      const centreY = ((tip.y + grip.y) * .5 - viewport.y) / viewport.height;
      const diagonal = Math.hypot(aspect, 1);
      const gap = .025 + state.opening * diagonal * .6;
      for (const paper of papers) {
        const positions = paper.geometry.getAttribute('position'), uv = paper.geometry.getAttribute('uv');
        const side = paper.userData.side as number;
        for (let i = 0; i < positions.count; i++) {
          const u = uv.getX(i), v = uv.getY(i), along = (u - .5) * diagonal * 2.4;
          const edge = Math.sin(u * 29.) * .0015 + Math.sin(u * 87.) * .0007;
          const across = side * (gap + v * diagonal + edge);
          const curl = Math.sin(v * Math.PI) * (.16 + state.opening * .3);
          positions.setXYZ(i, centreX + axisX * along - axisY * across, centreY + axisY * along + axisX * across, -4 + curl * 4);
        }
        positions.needsUpdate = true;
      }
    }
    root.updateMatrixWorld(true);
  }

  function ripple(x: number, y: number, now: number, progress: number, reduced: boolean) {
    if (reduced || !hasAmbientMotion(progress, false) || now - lastRipple < .13) return false;
    const localY = .5 - y + openingState(progress).lift * .13;
    if (localY >= .055) return false;
    ripples[rippleIndex].set(x * 2 - 1, localY, now, 1);
    rippleIndex = (rippleIndex + 1) % ripples.length; lastRipple = now;
    return true;
  }

  return { root, update, ripple };
}
