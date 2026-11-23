import * as THREE from 'three';
import { smooth } from './motion.mjs';
import { detailState } from './detail-motion.mjs';
import type { WorldInput } from './opening-world';

type Part = 'blade' | 'guard' | 'grip';
type DetailInput = WorldInput & { targets: Record<Part, THREE.Vector3> };

const vertex = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;
const grain = /* glsl */`
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
  }
`;
function surface(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader, uniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide });
}

function paperGeometry() {
  const geometry = new THREE.PlaneGeometry(1, 1, 36, 16);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    const fold = Math.abs(Math.sin((x + .5) * Math.PI * 3)) * .055;
    positions.setZ(i, fold + y * y * .12);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function paperMaterial(opacity: THREE.IUniform<number>, kind: number) {
  return surface(/* glsl */`
    varying vec2 vUv; uniform float uOpacity; uniform float uKind;
    ${grain}
    void main() {
      float fibre = noise(vUv * vec2(210., 330.));
      float crease = abs(sin(vUv.x * 9.424778));
      float edge = smoothstep(0., .012, min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y)));
      vec3 colour = vec3(.79, .775, .72) + (fibre - .5) * .04 - crease * .065;
      float ink = 0.;
      if (uKind < .5) {
        float contours = length((vUv - vec2(.64, .5)) * vec2(.8, 1.3));
        contours += sin(vUv.y * 13.) * .02 + noise(vUv * 9.) * .015;
        float stroke = abs(fract(contours * 28.) - .5);
        ink = (1. - smoothstep(.015, .055, stroke)) * .27;
        float spine = abs(vUv.x - .38 - pow(vUv.y, 2.) * .16);
        ink += (1. - smoothstep(.001, .005, spine)) * .4;
      } else {
        vec2 q = vUv - .5;
        float ring = abs(length(q * vec2(1., .8)) - .235);
        float inner = abs(length(q * vec2(.85, 1.)) - .16);
        float cross = min(abs(q.x), abs(q.y));
        ink = (1. - smoothstep(.0015, .004, min(ring, inner))) * .5;
        ink += (1. - smoothstep(.0008, .002, cross)) * .18;
        float marks = step(.75, fract(vUv.x * 22.)) * (1. - smoothstep(.001, .004, abs(vUv.y - .14)));
        ink += marks * .3;
      }
      colour *= 1. - min(ink, .65);
      gl_FragColor = vec4(colour, uOpacity * edge);
      #include <colorspace_fragment>
    }
  `, { uOpacity: opacity, uKind: { value: kind } });
}

function makePaper(parent: THREE.Group, material: THREE.ShaderMaterial, name: string) {
  const sheet = new THREE.Mesh(paperGeometry(), material);
  sheet.name = name; parent.add(sheet); return sheet;
}

function stoneGeometry(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const irregularity = 1 + .13 * Math.sin(x * 17 + y * 11 + z * 13 + seed);
    positions.setXYZ(i, x * irregularity, y * irregularity, z * irregularity);
  }
  geometry.computeVertexNormals(); return geometry;
}

function makeRibbon(parent: THREE.Group, name: string, colour: string, segments = 100) {
  const geometry = new THREE.PlaneGeometry(1, 1, segments, 5);
  (geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  const material = new THREE.MeshStandardMaterial({ color: colour, roughness: .7, metalness: .025,
    side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.name = name; ribbon.frustumCulled = false; parent.add(ribbon); return ribbon;
}

export function createDetailWorld() {
  const root = new THREE.Group(); root.name = 'detail-worlds';
  const groups = { archive: new THREE.Group(), steel: new THREE.Group(), weave: new THREE.Group(), assembly: new THREE.Group() };
  const weights = { archive: { value: 0 }, steel: { value: 0 }, weave: { value: 0 }, assembly: { value: 0 } };
  for (const [name, group] of Object.entries(groups)) { group.name = `${name}-world`; root.add(group); }
  const clock = { value: 0 }, aspect = { value: 1 }, pointer = { value: new THREE.Vector2() };

  // The opening's paper becomes three architectural folds, with drawn contours
  // on their surfaces. They have no text or invented historical inscriptions.
  const archiveMaterial = paperMaterial(weights.archive, 0);
  const archiveSheets = Array.from({ length: 3 }, (_, i) => makePaper(groups.archive, archiveMaterial, `archive-fold-${i}`));
  const archiveThread = makeRibbon(groups.archive, 'continuous-red-thread', '#ba2519', 100);

  const chamberMaterial = surface(/* glsl */`
    varying vec2 vUv; uniform float uOpacity; uniform float uAspect; uniform float uTime; uniform vec2 uPointer;
    ${grain}
    void main() {
      vec2 p = (vUv - .5) * vec2(uAspect * 1.2, 1.25);
      float haze = noise(p * 3. + vec2(uTime * .012, 0.));
      float glow = exp(-length((p - vec2(-uAspect * .21, .02) - uPointer * .03) * vec2(2., 1.)) * 3.);
      vec3 colour = vec3(.008, .012, .011) + vec3(.025, .032, .026) * glow + haze * .004;
      vec2 moon = p - vec2(uAspect * .26, .18);
      float outer = 1. - smoothstep(.145, .15, length(moon));
      float cutout = smoothstep(.143, .147, length(moon - vec2(.048, .012)));
      colour += outer * cutout * vec3(.065, .069, .055);
      colour += (hash(gl_FragCoord.xy) - .5) * .002;
      gl_FragColor = vec4(max(colour, vec3(0.)), uOpacity * .97);
      #include <colorspace_fragment>
    }
  `, { uOpacity: weights.steel, uTime: clock, uAspect: aspect, uPointer: pointer });
  const chamber = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.25), chamberMaterial);
  chamber.name = 'dark-chamber'; chamber.position.z = -21; groups.steel.add(chamber);
  const basaltMaterial = new THREE.MeshStandardMaterial({ color: '#252b28', roughness: .95, flatShading: true, transparent: true, depthWrite: false });
  const basalt = Array.from({ length: 4 }, (_, i) => {
    const rock = new THREE.Mesh(stoneGeometry(i * 17), basaltMaterial);
    rock.name = `basalt-${i}`; groups.steel.add(rock); return rock;
  });
  const beamMaterial = surface(/* glsl */`
    varying vec2 vUv; uniform float uOpacity;
    void main() {
      float shaft = exp(-pow((vUv.x - .5) * 6., 2.));
      float falloff = pow(max(sin(vUv.y * 3.141593), 0.), 2.);
      gl_FragColor = vec4(vec3(.70, .73, .64), shaft * falloff * uOpacity * .07);
      #include <colorspace_fragment>
    }
  `, { uOpacity: weights.steel });
  const beams = Array.from({ length: 3 }, (_, i) => {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(.11 + i * .03, 1.7), beamMaterial);
    beam.name = `light-shaft-${i}`; beam.position.z = -5 - i; groups.steel.add(beam); return beam;
  });

  const dustPositions: number[] = [], dustSeeds: number[] = [];
  for (let i = 0; i < 70; i++) {
    const rand = (n: number) => Math.sin(i * 79.31 + n * 47.29) * 43758.5453 % 1;
    dustPositions.push(rand(1), rand(2) * .55, -3 - Math.abs(rand(3)) * 8);
    dustSeeds.push(Math.abs(rand(4)));
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('seed', new THREE.Float32BufferAttribute(dustSeeds, 1));
  const dustMaterial = surface(/* glsl */`
    varying float vSeed; uniform float uOpacity;
    void main() {
      float distanceToCentre = length(gl_PointCoord - .5);
      gl_FragColor = vec4(vec3(.59, .58, .48), (1. - smoothstep(.1, .5, distanceToCentre)) * uOpacity * (.12 + vSeed * .25));
      #include <colorspace_fragment>
    }
  `, { uTime: clock, uOpacity: weights.steel, uAspect: aspect, uPointer: pointer });
  dustMaterial.vertexShader = /* glsl */`
    attribute float seed; varying float vSeed;
    uniform float uTime; uniform float uAspect; uniform vec2 uPointer;
    void main() {
      vSeed = seed; vec3 p = position;
      p.x = p.x * uAspect * .55 + sin(uTime * .12 + seed * 17.) * .025 + uPointer.x * seed * .025;
      p.y += sin(uTime * .17 + seed * 21.) * .035 - uPointer.y * seed * .02;
      gl_PointSize = 1.1 + seed * 1.8;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }
  `;
  const dust = new THREE.Points(dustGeometry, dustMaterial); dust.name = 'lit-dust'; dust.frustumCulled = false; groups.steel.add(dust);

  // The textile around the grip echoes the red cloth from the water scene.
  const textiles = [makeRibbon(groups.weave, 'red-silk-ribbon', '#bc211a', 120), makeRibbon(groups.weave, 'ivory-woven-ribbon', '#c6bfae', 120)];
  const cords = Array.from({ length: 3 }, (_, i) => makeRibbon(groups.weave, `loose-fibre-${i}`, '#ddd3bb', 90));
  const textileMaterial = surface(/* glsl */`
    varying vec2 vUv; uniform float uOpacity;
    ${grain}
    void main() {
      float warp = sin(vUv.x * 320.), weft = sin(vUv.y * 250. + sin(vUv.x * 320.) * .7);
      float mask = exp(-length((vUv - .5) * vec2(2., 1.2)) * 2.);
      vec3 colour = vec3(.031, .027, .021) + (warp * weft + 1.) * .008;
      gl_FragColor = vec4(colour, uOpacity * mask * .8);
      #include <colorspace_fragment>
    }
  `, { uOpacity: weights.weave });
  const textileScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.15), textileMaterial);
  textileScreen.name = 'woven-ground'; textileScreen.position.z = -12; groups.weave.add(textileScreen);

  const assemblyMaterial = paperMaterial(weights.assembly, 1);
  const assemblySheets = Array.from({ length: 3 }, (_, i) => makePaper(groups.assembly, assemblyMaterial, `assembly-sheet-${i}`));
  const rings = (['grip', 'guard', 'blade'] as Part[]).map(part => {
    const group = new THREE.Group(); group.name = `${part}-orbit`; groups.assembly.add(group);
    const points = Array.from({ length: 100 }, (_, i) => {
      const angle = i / 99 * Math.PI * 1.7;
      return new THREE.Vector3(Math.cos(angle) * .095, Math.sin(angle) * .095, 0);
    });
    const material = new THREE.LineBasicMaterial({ color: '#261d17', transparent: true, depthWrite: false });
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material); group.add(ring);
    const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-.12, 0, 0), new THREE.Vector3(-.105, 0, 0),
      new THREE.Vector3(.105, 0, 0), new THREE.Vector3(.12, 0, 0),
      new THREE.Vector3(0, -.12, 0), new THREE.Vector3(0, -.105, 0),
      new THREE.Vector3(0, .105, 0), new THREE.Vector3(0, .12, 0),
    ]), material); group.add(ticks);
    return { group, material, part };
  });
  const point = new THREE.Vector3();

  function update(input: DetailInput) {
    const { viewport, progress, reduced } = input;
    const state = detailState(progress), a = viewport.aspect, portrait = a < .85;
    for (const name of ['archive', 'steel', 'weave', 'assembly'] as const) state[name] *= input.presence ?? 1;
    const t = reduced ? 0 : input.time;
    const px = reduced ? 0 : input.pointerX, py = reduced ? 0 : input.pointerY;
    clock.value = t; aspect.value = a; pointer.value.set(px, py);
    root.position.set(viewport.x, viewport.y, 0); root.scale.set(viewport.height, viewport.height, 1);
    for (const name of Object.keys(groups) as (keyof typeof groups)[]) {
      weights[name].value = state[name]; groups[name].visible = state[name] > .001;
    }

    if (groups.archive.visible) {
      const arrive = smooth(.17, .26, progress), depart = smooth(.30, .38, progress);
      archiveSheets.forEach((sheet, i) => {
        const x = [-.77, .85, -.14][i] * a / 2;
        const y = [-.17, .04, -.40][i];
        sheet.position.set(x + px * (.018 + i * .01), y - (1 - arrive) * .18 + depart * (i % 2 ? .4 : -.3) + Math.sin(t * .2 + i) * .006, -8 - i);
        sheet.scale.set([.57, .44, 1.1][i] * (portrait ? a * 1.3 : 1), [.74, 1., .25][i], 1);
        sheet.rotation.set(.12 + py * .02, i * .12 - .1, [-.15, .14, -.12][i] + px * .025);
      });
      const positions = archiveThread.geometry.getAttribute('position'), uv = archiveThread.geometry.getAttribute('uv');
      for (let i = 0; i < positions.count; i++) {
        const u = uv.getX(i), v = uv.getY(i) - .5;
        positions.setXYZ(i, (u * 2.5 - 1.25) * a / 2, -.19 + Math.sin(u * 5.5 + .5) * .16 + Math.sin(t * .5 + u * 10) * .007 + v * .008, -2.5 + Math.sin(u * 7) * .8);
      }
      positions.needsUpdate = true; archiveThread.geometry.computeVertexNormals(); archiveThread.material.opacity = state.archive;
    }

    if (groups.steel.visible) {
      chamber.scale.x = a / 2; basaltMaterial.opacity = state.steel;
      basalt.forEach((rock, i) => {
        const x = [-.98, 1.06, -.71, .76][i];
        rock.position.set(x * a / 2 + px * (.02 + i * .007), [-.12, .09, -.46, .49][i] - py * .012, -6 - i * .65);
        rock.scale.set([.18, .22, .24, .13][i] * (portrait ? .65 : 1), [.62, .65, .16, .2][i], .8);
        rock.rotation.set(.12, .2 + i * .7, [-.18, -.2, .1, .4][i] + Math.sin(t * .13 + i) * .008);
      });
      beams.forEach((beam, i) => {
        beam.position.x = (-.65 + i * .35) * a / 2 + px * .1 + Math.sin(t * .17 + i) * .02;
        beam.position.y = .07 + py * .02; beam.rotation.z = -.25 - i * .025;
      });
    }

    if (groups.weave.visible) {
      textileScreen.position.x = portrait ? 0 : a * .22;
      textileScreen.rotation.z = -.22 + px * .03;
      textiles.forEach((ribbon, index) => {
        const positions = ribbon.geometry.getAttribute('position'), uv = ribbon.geometry.getAttribute('uv');
        for (let i = 0; i < positions.count; i++) {
          const u = uv.getX(i), v = uv.getY(i) - .5;
          const angle = u * 5.4 - 1.9 + index * .35 + smooth(.49, .65, progress) * .45;
          const rx = (portrait ? a * .40 : a * .28) + index * .05;
          const centre = portrait ? 0 : a * .17;
          const width = (index ? .024 : .068) * Math.sin(u * Math.PI) + .002;
          const flutter = Math.sin(u * 19 - t * .9 + index) * .015;
          positions.setXYZ(i, centre + Math.cos(angle) * rx + px * .035 * u,
            Math.sin(angle) * .34 - .035 + flutter + v * width + py * .02,
            -1.4 + Math.sin(angle + .5) * 3.5 + v * Math.sin(u * 9 - t * .3) * .4);
        }
        positions.needsUpdate = true; ribbon.geometry.computeVertexNormals(); ribbon.material.opacity = state.weave * (index ? .8 : 1);
      });
      cords.forEach((cord, index) => {
        const positions = cord.geometry.getAttribute('position'), uv = cord.geometry.getAttribute('uv');
        for (let i = 0; i < positions.count; i++) {
          const u = uv.getX(i), v = uv.getY(i) - .5;
          const bend = .14 * Math.sin(u * 5 + index * .25);
          positions.setXYZ(i, (u * 1.7 - .6) * a / 2 + px * .012, -.35 + bend + index * .018 + Math.sin(t * .7 + u * 12 + index) * .006 + v * .002, -1.5 - index * .3);
        }
        positions.needsUpdate = true; cord.geometry.computeVertexNormals(); cord.material.opacity = state.weave * .7;
      });
    }

    if (groups.assembly.visible) {
      assemblySheets.forEach((sheet, i) => {
        const emerge = smooth(.63, .74, progress);
        sheet.position.set([-.74, .74, .38][i] * a / 2 + px * (.025 + i * .01), [-.15, .22, -.33][i] - (1 - emerge) * .1 + Math.sin(t * .24 + i * 2) * .009, -8 - i);
        sheet.scale.set([.42, .52, .33][i] * (portrait ? a * 1.3 : 1), [.62, .45, .31][i], 1);
        sheet.rotation.set(py * .06, [-.16, .22, -.3][i] + px * .07, [.2, -.24, .1][i] + Math.sin(t * .18 + i) * .012);
      });
      for (const [i, orbit] of rings.entries()) {
        point.copy(input.targets[orbit.part]);
        const x = (point.x - viewport.x) / viewport.height, y = (point.y - viewport.y) / viewport.height;
        orbit.group.position.set(x, y, -2);
        // The overlaid + controls own hover/click; these are quiet drawing marks.
        orbit.group.rotation.z = i * .7 + t * .06;
        orbit.group.scale.setScalar(portrait ? .7 : 1);
        orbit.material.opacity = state.assembly * .28;
      }
    }
    root.updateMatrixWorld(true);
  }
  return { root, update };
}
