// Effect builders: construct Three.js meshes + materials for each effect
import * as THREE from 'three';
import { meltVertexShader, meltFragmentShader } from './shaders/melt.js';
import { featherVertexShader, featherFragmentShader } from './shaders/feathers.js';
import { burstVertexShader, burstFragmentShader, dropVertexShader, dropFragmentShader } from './shaders/burst.js';
import { jellyVertexShader, jellyFragmentShader, containerVertexShader, containerFragmentShader } from './shaders/jelly.js';

// ─────────────────────────────────────────────────────────────
// EFFECT 1: MELT
// ─────────────────────────────────────────────────────────────
export function createMeltEffect(params) {
  const group = new THREE.Group();

  const finishes = { Lacquer: 0, Candy: 1, Mercury: 2, Wax: 3 };
  const finishVal = finishes[params.finish] ?? 1;

  const palettes = {
    Candy:   { c1: new THREE.Color('#e81c5b'), c2: new THREE.Color('#ff6eb4') },
    Lacquer: { c1: new THREE.Color('#c0392b'), c2: new THREE.Color('#e74c3c') },
    Mercury: { c1: new THREE.Color('#b0b8c8'), c2: new THREE.Color('#e0e8f0') },
    Wax:     { c1: new THREE.Color('#f5a623'), c2: new THREE.Color('#fff0a0') },
  };
  const pal = palettes[params.finish] ?? palettes.Candy;

  const uniforms = {
    uTime:       { value: 0 },
    uMeltAmount: { value: params.amount ?? 0.4 },
    uDripSpeed:  { value: params.viscosity ?? 0.5 },
    uDripLength: { value: params.dripLength ?? 0.5 },
    uColor1:     { value: pal.c1 },
    uColor2:     { value: pal.c2 },
    uLightDir:   { value: new THREE.Vector3(-0.5, 0.9, 0.55).normalize() },
    uFinish:     { value: finishVal },
    uSpecular:   { value: params.finish === 'Candy' ? 1.5 : params.finish === 'Mercury' ? 2.0 : 1.0 },
    uRoughness:  { value: params.finish === 'Wax' ? 0.6 : 0.08 },
  };

  const shapes = {
    Blob:    new THREE.IcosahedronGeometry(1, 4),
    Suzanne: new THREE.SphereGeometry(1, 32, 24), // approximation; real Suzanne needs OBJ loader
    Torus:   new THREE.TorusGeometry(0.7, 0.35, 32, 64),
    Cross:   buildCrossGeometry(),
  };

  const geo = shapes[params.shape] ?? shapes.Blob;
  const mat = new THREE.ShaderMaterial({
    vertexShader: meltVertexShader,
    fragmentShader: meltFragmentShader,
    uniforms,
  });

  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  // Simple drip drops below the shape
  const dropGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const dropMat = new THREE.MeshStandardMaterial({ color: pal.c1.clone(), roughness: 0.1, metalness: 0.0 });
  for (let i = 0; i < 8; i++) {
    const drop = new THREE.Mesh(dropGeo, dropMat);
    const angle = (i / 8) * Math.PI * 2;
    drop.position.set(Math.cos(angle) * 0.6, -1.2 - Math.random() * 0.5, Math.sin(angle) * 0.6);
    drop.scale.setScalar(0.4 + Math.random() * 0.6);
    drop.userData.angle = angle;
    group.add(drop);
  }

  return {
    group,
    update(t) {
      uniforms.uTime.value = t;
      // Animate drip drops
      group.children.slice(1).forEach((drop, i) => {
        const phase = i / 8 * Math.PI * 2;
        drop.position.y = -1.15 - Math.abs(Math.sin(t * uniforms.uDripSpeed.value * 0.5 + phase)) * 0.3;
        drop.scale.setScalar((0.4 + Math.abs(Math.sin(t * 0.7 + phase)) * 0.6) * uniforms.uMeltAmount.value);
      });
    },
    uniforms,
    setParam(key, val) {
      if (key === 'finish') {
        const fv = finishes[val] ?? 0;
        uniforms.uFinish.value = fv;
        const p = palettes[val] ?? palettes.Candy;
        uniforms.uColor1.value.copy(p.c1);
        uniforms.uColor2.value.copy(p.c2);
        uniforms.uSpecular.value = val === 'Candy' ? 1.5 : val === 'Mercury' ? 2.0 : 1.0;
        uniforms.uRoughness.value = val === 'Wax' ? 0.6 : 0.08;
        dropMat.color.copy(p.c1);
      }
      if (key === 'amount')    uniforms.uMeltAmount.value = val;
      if (key === 'viscosity') uniforms.uDripSpeed.value = val;
      if (key === 'dripLength') uniforms.uDripLength.value = val;
    },
  };
}

// ─────────────────────────────────────────────────────────────
// EFFECT 2: FEATHERS
// ─────────────────────────────────────────────────────────────
export function createFeatherEffect(params) {
  const group = new THREE.Group();

  const palettes = {
    white:    ['#ffffff', '#ffffff', '#dcdad6', '#ffffff'],
    pheasant: ['#efe4d2', '#c98a3e', '#2a1d14', '#e8b35a'],
    owl:      ['#efe8dc', '#b9a083', '#3c2e24', '#f1e5cf'],
    dove:     ['#eeece9', '#a8a5a2', '#3e3c3b', '#dad7d3'],
    jay:      ['#e9eef3', '#a8a29c', '#1e2b3f', '#5584bd'],
    flamingo: ['#ffe9e2', '#f2a094', '#5a2e2a', '#f8c8bc'],
    golden:   ['#fff4d9', '#dca553', '#6c4220', '#f2d59e'],
    ink:      ['#f6f6f4', '#c8c8c6', '#121212', '#f6f6f4'],
  };
  const patterns = { plain: 0, gradient: 1, barred: 2, streaked: 3, mottled: 4, mixed: 2.5 };
  const pal = palettes[params.palette] ?? palettes.white;
  const patVal = patterns[params.pattern] ?? 0;
  const lookVal = params.look === 'dark' ? 1.0 : 0.0;

  const uniforms = {
    uTime:            { value: 0 },
    uFeatherLength:   { value: params.featherLength ?? 1.4 },
    uFeatherWidth:    { value: params.featherWidth ?? 1.3 },
    uCurl:            { value: params.curl ?? 1.5 },
    uRuffle:          { value: params.ruffle ?? 0 },
    uSpin:            { value: params.spin ?? 0.25 },
    uDensity:         { value: params.density ?? 350 },
    uColorDown:       { value: new THREE.Color(pal[0]) },
    uColorBody:       { value: new THREE.Color(pal[1]) },
    uColorMark:       { value: new THREE.Color(pal[2]) },
    uColorAccent:     { value: new THREE.Color(pal[3]) },
    uPattern:         { value: patVal },
    uPatternAmt:      { value: params.patternAmount ?? 0.56 },
    uLightDir:        { value: new THREE.Vector3(0.65, 0.6, 0.45).normalize() },
    uSeeThrough:      { value: params.seeThrough ?? 1 },
    uInternalShadow:  { value: params.internalShadow ?? 0.56 },
    uLook:            { value: lookVal },
  };

  // Build a feather-covered shape using instanced billboard geometry
  const baseShapes = {
    knot:  new THREE.TorusKnotGeometry(0.7, 0.2, 128, 16, 2, 3),
    torus: new THREE.TorusGeometry(0.7, 0.3, 32, 64),
    ring:  new THREE.TorusGeometry(0.9, 0.12, 16, 64),
    sphere: new THREE.SphereGeometry(1, 32, 24),
    blob:  new THREE.IcosahedronGeometry(0.9, 3),
    cross: buildCrossGeometry(),
  };
  const baseGeo = baseShapes[params.shape?.toLowerCase()] ?? baseShapes.knot;

  // Build feather instance geometry: a flat quad billboard per feather
  const COUNT = Math.min(params.density ?? 350, 600);
  const featherGeo = buildFeatherInstances(baseGeo, COUNT, uniforms);

  const mat = new THREE.ShaderMaterial({
    vertexShader: featherVertexShader,
    fragmentShader: featherFragmentShader,
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(featherGeo, mat);
  group.add(mesh);

  return {
    group,
    update(t) {
      uniforms.uTime.value = t;
      mesh.rotation.y = t * uniforms.uSpin.value * 0.3;
    },
    uniforms,
    setParam(key, val) {
      if (key === 'palette') {
        const p = palettes[val] ?? palettes.white;
        uniforms.uColorDown.value.set(p[0]);
        uniforms.uColorBody.value.set(p[1]);
        uniforms.uColorMark.value.set(p[2]);
        uniforms.uColorAccent.value.set(p[3]);
      }
      if (key === 'pattern')    uniforms.uPattern.value = patterns[val] ?? 0;
      if (key === 'patternAmount') uniforms.uPatternAmt.value = val;
      if (key === 'featherLength') uniforms.uFeatherLength.value = val;
      if (key === 'featherWidth') uniforms.uFeatherWidth.value = val;
      if (key === 'curl')       uniforms.uCurl.value = val;
      if (key === 'ruffle')     uniforms.uRuffle.value = val;
      if (key === 'spin')       uniforms.uSpin.value = val;
      if (key === 'internalShadow') uniforms.uInternalShadow.value = val;
      if (key === 'seeThrough') uniforms.uSeeThrough.value = val;
      if (key === 'look') uniforms.uLook.value = val === 'dark' ? 1.0 : 0.0;
    },
  };
}

function buildFeatherInstances(baseGeo, count, uniforms) {
  // Sample points on the base geometry surface
  const positions = baseGeo.attributes.position;
  const normals = baseGeo.attributes.normal;
  const totalVerts = positions.count;

  // Each feather is a 9-vertex (3x3 grid) flat mesh in local space
  const SEGS_Y = 8, SEGS_X = 2;
  const vertsPerFeather = (SEGS_X + 1) * (SEGS_Y + 1);
  const trisPerFeather = SEGS_X * SEGS_Y * 2;

  const posArr = new Float32Array(count * vertsPerFeather * 3);
  const normalArr = new Float32Array(count * vertsPerFeather * 3);
  const dirArr = new Float32Array(count * vertsPerFeather * 3);
  const nrmArr = new Float32Array(count * vertsPerFeather * 3);
  const phaseArr = new Float32Array(count * vertsPerFeather);
  const scaleArr = new Float32Array(count * vertsPerFeather);
  const indexArr = [];

  for (let f = 0; f < count; f++) {
    // Pick a random vertex on the base mesh
    const vi = Math.floor(Math.random() * totalVerts);
    const px = positions.getX(vi), py = positions.getY(vi), pz = positions.getZ(vi);
    const nx = normals.getX(vi), ny = normals.getY(vi), nz = normals.getZ(vi);

    // Feather direction: along the surface, biased upward
    const up = new THREE.Vector3(0, 1, 0);
    const nrm = new THREE.Vector3(nx, ny, nz).normalize();
    const dir = new THREE.Vector3().crossVectors(nrm, up.clone().cross(nrm)).normalize();
    if (dir.lengthSq() < 0.001) dir.set(1, 0, 0);
    dir.normalize();

    const phase = Math.random();
    const sc = 0.5 + Math.random() * 0.9;
    const base = f * vertsPerFeather;

    for (let iy = 0; iy <= SEGS_Y; iy++) {
      for (let ix = 0; ix <= SEGS_X; ix++) {
        const vi2 = base + iy * (SEGS_X + 1) + ix;
        const t = iy / SEGS_Y;
        const x = (ix / SEGS_X) * 2 - 1; // -1..1

        posArr[vi2 * 3]     = px;
        posArr[vi2 * 3 + 1] = py;
        posArr[vi2 * 3 + 2] = pz;
        normalArr[vi2 * 3]     = nx;
        normalArr[vi2 * 3 + 1] = ny;
        normalArr[vi2 * 3 + 2] = nz;
        dirArr[vi2 * 3]     = dir.x;
        dirArr[vi2 * 3 + 1] = dir.y;
        dirArr[vi2 * 3 + 2] = dir.z;
        nrmArr[vi2 * 3]     = nx;
        nrmArr[vi2 * 3 + 1] = ny;
        nrmArr[vi2 * 3 + 2] = nz;
        phaseArr[vi2] = phase;
        scaleArr[vi2] = sc;

        // Store t in position.y, x in position.x (the shader interprets these as feather coords)
        posArr[vi2 * 3]     = x;
        posArr[vi2 * 3 + 1] = t;
        posArr[vi2 * 3 + 2] = 0;
      }
    }

    // Indices
    for (let iy = 0; iy < SEGS_Y; iy++) {
      for (let ix = 0; ix < SEGS_X; ix++) {
        const a = base + iy * (SEGS_X + 1) + ix;
        const b = a + 1;
        const c = a + (SEGS_X + 1);
        const d = c + 1;
        indexArr.push(a, c, b, b, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('aFeatherDir', new THREE.BufferAttribute(dirArr, 3));
  geo.setAttribute('aNormal', new THREE.BufferAttribute(nrmArr, 3));
  geo.setAttribute('aFeatherPhase', new THREE.BufferAttribute(phaseArr, 1));
  geo.setAttribute('aFeatherScale', new THREE.BufferAttribute(scaleArr, 1));
  geo.setIndex(indexArr);
  geo.computeVertexNormals();
  return geo;
}

// ─────────────────────────────────────────────────────────────
// EFFECT 3: BURST
// ─────────────────────────────────────────────────────────────
export function createBurstEffect(params) {
  const group = new THREE.Group();

  const subjects = { chocolate: 0, watermelon: 1, citrus: 2, geode: 3 };
  const subjectVal = subjects[params.subject?.toLowerCase()] ?? 2;

  const shapeGeos = {
    sphere: new THREE.IcosahedronGeometry(1, 3),
    suzanne: new THREE.SphereGeometry(1, 32, 24),
    torus: new THREE.TorusGeometry(0.7, 0.35, 24, 48),
    blob:  new THREE.IcosahedronGeometry(0.9, 2),
    cross: buildCrossGeometry(),
  };
  const baseGeo = shapeGeos[params.shape?.toLowerCase()] ?? shapeGeos.sphere;

  const uniforms = {
    uTime:       { value: 0 },
    uExplosion:  { value: params.explosion ?? 0 },
    uSpray:      { value: params.spray ?? 0.7 },
    uShellColor: { value: new THREE.Color('#c8830a') },
    uFillColor:  { value: new THREE.Color('#f04050') },
    uLightDir:   { value: new THREE.Vector3(-0.55, 0.8, 0.5).normalize() },
    uSubject:    { value: subjectVal },
    uRoughness:  { value: 0.6 },
    uSpecular:   { value: 1.0 },
  };

  // Build shattered shell pieces
  const pieces = buildShellPieces(baseGeo, 16, uniforms);
  pieces.forEach(m => group.add(m));

  // Spray particles
  const sprayMesh = buildSprayParticles(1500, uniforms);
  group.add(sprayMesh);

  return {
    group,
    update(t) {
      uniforms.uTime.value = t;
    },
    uniforms,
    setParam(key, val) {
      if (key === 'explosion') uniforms.uExplosion.value = val;
      if (key === 'spray')     uniforms.uSpray.value = val;
      if (key === 'subject') {
        const sv = subjects[val?.toLowerCase()] ?? 0;
        uniforms.uSubject.value = sv;
      }
    },
  };
}

function buildShellPieces(baseGeo, pieceCount, uniforms) {
  const positions = baseGeo.attributes.position;
  const normals   = baseGeo.attributes.normal;
  const totalVerts = positions.count;
  const meshes = [];
  const vertsPerPiece = Math.floor(totalVerts / pieceCount);

  for (let p = 0; p < pieceCount; p++) {
    const start = p * vertsPerPiece;
    const end   = p === pieceCount - 1 ? totalVerts : start + vertsPerPiece;
    const count = end - start;
    if (count < 3) continue;

    // Centre of this piece
    let cx = 0, cy = 0, cz = 0;
    for (let i = start; i < end; i++) {
      cx += positions.getX(i); cy += positions.getY(i); cz += positions.getZ(i);
    }
    cx /= count; cy /= count; cz /= count;

    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(count * 3);
    const norArr = new Float32Array(count * 3);
    const ctrArr = new Float32Array(count * 3);
    const velArr = new Float32Array(count * 3);
    const axArr  = new Float32Array(count * 3);
    const spnArr = new Float32Array(count);

    const vel = new THREE.Vector3(cx, cy, cz).normalize().multiplyScalar(2 + Math.random() * 2);
    const axis = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
    const spin = 2 + Math.random() * 7;

    for (let i = 0; i < count; i++) {
      const si = start + i;
      posArr[i*3]   = positions.getX(si);
      posArr[i*3+1] = positions.getY(si);
      posArr[i*3+2] = positions.getZ(si);
      norArr[i*3]   = normals.getX(si);
      norArr[i*3+1] = normals.getY(si);
      norArr[i*3+2] = normals.getZ(si);
      ctrArr[i*3]   = cx; ctrArr[i*3+1] = cy; ctrArr[i*3+2] = cz;
      velArr[i*3]   = vel.x; velArr[i*3+1] = vel.y; velArr[i*3+2] = vel.z;
      axArr[i*3]    = axis.x; axArr[i*3+1] = axis.y; axArr[i*3+2] = axis.z;
      spnArr[i]     = spin;
    }

    geo.setAttribute('position',       new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('normal',         new THREE.BufferAttribute(norArr, 3));
    geo.setAttribute('aPieceCenter',   new THREE.BufferAttribute(ctrArr, 3));
    geo.setAttribute('aPieceVelocity', new THREE.BufferAttribute(velArr, 3));
    geo.setAttribute('aPieceAxis',     new THREE.BufferAttribute(axArr,  3));
    geo.setAttribute('aPieceSpin',     new THREE.BufferAttribute(spnArr, 1));

    // Build triangle indices for this piece
    const triCount = Math.floor(count / 3) * 3;
    const idxArr = new Uint32Array(triCount);
    for (let i = 0; i < triCount; i++) idxArr[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idxArr, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: burstVertexShader,
      fragmentShader: burstFragmentShader,
      uniforms,
      side: THREE.DoubleSide,
    });
    meshes.push(new THREE.Mesh(geo, mat));
  }
  return meshes;
}

function buildSprayParticles(count, uniforms) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.9 + Math.random() * 0.2;
    positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i*3+2] = r * Math.cos(phi);

    const speed = 1 + Math.random() ** 2.2 * 6.5;
    velocities[i*3]   = positions[i*3] / r * speed;
    velocities[i*3+1] = positions[i*3+1] / r * speed;
    velocities[i*3+2] = positions[i*3+2] / r * speed;

    sizes[i]  = 0.01 + Math.random() ** 3 * 0.04;
    phases[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',  new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
  geo.setAttribute('aSize',     new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase',    new THREE.BufferAttribute(phases, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: dropVertexShader,
    fragmentShader: dropFragmentShader,
    uniforms: {
      ...uniforms,
      uDropColor: { value: new THREE.Color('#f8a070') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const pts = new THREE.Points(geo, mat);
  return pts;
}

// ─────────────────────────────────────────────────────────────
// EFFECT 4: JELLY
// ─────────────────────────────────────────────────────────────
export function createJellyEffect(params) {
  const group = new THREE.Group();

  const looks = {
    ruby:  { color: '#9e1020', density: 4,   milk: 1.4, frost: 0.08, rough: 0.12, glow: 0.35 },
    blush: { color: '#c43c7c', density: 1.6, milk: 1.6, frost: 0.10, rough: 0.20, glow: 0.50 },
    mint:  { color: '#3fae8e', density: 2.4, milk: 1.4, frost: 0.08, rough: 0.18, glow: 0.50 },
    lilac: { color: '#9a78d8', density: 2.2, milk: 1.5, frost: 0.09, rough: 0.20, glow: 0.50 },
    tide:  { color: '#4d6f9e', density: 3.6, milk: 1.0, frost: 0.08, rough: 0.20, glow: 0.45 },
    peach: { color: '#f29a3a', density: 1.5, milk: 1.5, frost: 0.08, rough: 0.25, glow: 0.60 },
  };
  const lights = {
    warm:    { key: '#ffd2a0', fill: '#c6d8ff' },
    rose:    { key: '#ffbccd', fill: '#e6ccff' },
    teal:    { key: '#a6f2e2', fill: '#bfeee6' },
    golden:  { key: '#ffc07a', fill: '#ffe0c4' },
    neutral: { key: '#ffffff', fill: '#ffffff' },
  };

  const lk = looks[params.look] ?? looks.ruby;
  const lt = lights[params.light] ?? lights.warm;

  const jellyColors = {
    ruby:  ['#9e1020','#c8243a','#d63a4e','#7a0c22'],
    blush: ['#c43c7c','#f27a6c','#8a46b0','#f5a3b8'],
    mint:  ['#3fae8e','#7dd3b4','#1f8a7a','#a8e6c8'],
    lilac: ['#9a78d8','#c3a8ee','#6e4ab8','#e0c8f4'],
    tide:  ['#4d6f9e','#7f9bc2','#2f4c74','#a8bdd6'],
    peach: ['#f29a3a','#e8606a','#b45a8c','#ffc06a'],
  };
  const colorPalette = jellyColors[params.look] ?? jellyColors.ruby;

  const lightDir = new THREE.Vector3(-0.45, 1, 0.5).normalize();
  const lightColor = new THREE.Color(lt.key);

  // Container shape
  const containerShapes = {
    cube:   new THREE.BoxGeometry(2.4, 2.4, 2.4, 2, 2, 2),
    sphere: new THREE.SphereGeometry(1.3, 48, 32),
    torus:  new THREE.TorusGeometry(0.9, 0.5, 24, 48),
    blob:   new THREE.IcosahedronGeometry(1.2, 3),
    cross:  buildCrossGeometry(1.3),
  };
  const containerGeo = containerShapes[params.shape?.toLowerCase()] ?? containerShapes.cube;

  const containerUniforms = {
    uTime:           { value: 0 },
    uContainerColor: { value: new THREE.Color(lk.color).multiplyScalar(0.5).addScalar(0.5) },
    uContainerHaze:  { value: params.haze ?? 0.8 },
    uWallThickness:  { value: params.walls ?? 0.02 },
    uFrost:          { value: params.frost ?? 0.1 },
    uLightDir:       { value: lightDir },
    uDispersion:     { value: 0.012 },
  };

  const containerMat = new THREE.ShaderMaterial({
    vertexShader: containerVertexShader,
    fragmentShader: containerFragmentShader,
    uniforms: containerUniforms,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const containerMesh = new THREE.Mesh(containerGeo.clone(), containerMat);
  group.add(containerMesh);

  // Jelly bodies inside
  const bodyShapes = [
    new THREE.SphereGeometry(1, 24, 18),
    new THREE.SphereGeometry(1, 24, 18),
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.SphereGeometry(1, 20, 16),
    new THREE.CapsuleGeometry(0.5, 0.8, 8, 16),
    new THREE.SphereGeometry(1, 16, 12),
  ];

  const bodyCount = params.count ?? 7;
  const bodies = [];
  for (let i = 0; i < Math.min(bodyCount, 10); i++) {
    const color = new THREE.Color(colorPalette[i % colorPalette.length]);
    const lkData = looks[params.look] ?? looks.ruby;

    const bodyUniforms = {
      uTime:       { value: 0 },
      uSoftness:   { value: params.softness ?? 0.6 },
      uWobble:     { value: 1.0 },
      uJellyColor: { value: color },
      uDensity:    { value: lkData.density },
      uMilk:       { value: lkData.milk },
      uFrost:      { value: lkData.frost },
      uRefraction: { value: params.refraction ?? 0.25 },
      uLightDir:   { value: lightDir },
      uLightColor: { value: lightColor.clone() },
      uRoughness:  { value: lkData.rough },
      uGlow:       { value: lkData.glow },
    };

    const geo = bodyShapes[i % bodyShapes.length];
    const mat = new THREE.ShaderMaterial({
      vertexShader: jellyVertexShader,
      fragmentShader: jellyFragmentShader,
      uniforms: bodyUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const scale = 0.25 + Math.random() * 0.3;
    const mesh = new THREE.Mesh(geo.clone(), mat);
    mesh.scale.setScalar(scale);

    // Position inside container
    const angle = (i / bodyCount) * Math.PI * 2;
    const radius = 0.3 + Math.random() * 0.5;
    mesh.position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * 1.0,
      Math.sin(angle) * radius
    );
    mesh.userData.basePos = mesh.position.clone();
    mesh.userData.phaseOffset = Math.random() * Math.PI * 2;
    mesh.userData.uniforms = bodyUniforms;

    group.add(mesh);
    bodies.push(mesh);
  }

  // Spin the whole container group
  let spin = 0;
  const tumbleSpeed = params.tumble ?? 0.35;

  return {
    group,
    update(t) {
      containerUniforms.uTime.value = t;
      spin += 0.003 * tumbleSpeed;
      group.rotation.y = spin;
      group.rotation.x = Math.sin(t * 0.3) * 0.1;

      // Jiggle each body
      bodies.forEach((mesh, i) => {
        const bp = mesh.userData.basePos;
        const ph = mesh.userData.phaseOffset;
        mesh.position.x = bp.x + Math.sin(t * 1.2 + ph) * 0.03;
        mesh.position.y = bp.y + Math.sin(t * 0.9 + ph + 1) * 0.04;
        mesh.position.z = bp.z + Math.cos(t * 1.1 + ph + 2) * 0.03;
        mesh.userData.uniforms.uTime.value = t;
      });
    },
    uniforms: containerUniforms,
    setParam(key, val) {
      if (key === 'look') {
        const lkd = looks[val] ?? looks.ruby;
        const pal = jellyColors[val] ?? jellyColors.ruby;
        bodies.forEach((m, i) => {
          m.userData.uniforms.uJellyColor.value.set(pal[i % pal.length]);
          m.userData.uniforms.uDensity.value = lkd.density;
          m.userData.uniforms.uMilk.value = lkd.milk;
          m.userData.uniforms.uFrost.value = lkd.frost;
          m.userData.uniforms.uRoughness.value = lkd.rough;
          m.userData.uniforms.uGlow.value = lkd.glow;
        });
        containerUniforms.uContainerColor.value.set(lkd.color).multiplyScalar(0.5).addScalar(0.5);
      }
      if (key === 'light') {
        const lt2 = lights[val] ?? lights.warm;
        lightColor.set(lt2.key);
        bodies.forEach(m => m.userData.uniforms.uLightColor.value.set(lt2.key));
      }
      if (key === 'haze')       containerUniforms.uContainerHaze.value = val;
      if (key === 'frost')      containerUniforms.uFrost.value = val;
      if (key === 'walls')      containerUniforms.uWallThickness.value = val;
      if (key === 'softness')   bodies.forEach(m => m.userData.uniforms.uWobble.value = val);
    },
  };
}

// ─────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────
export function buildCrossGeometry(size = 1) {
  const merge = (geometries) => {
    const geo = new THREE.BufferGeometry();
    const positions = [], normals = [], uvs = [], indices = [];
    let offset = 0;
    for (const g of geometries) {
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
        if (u) uvs.push(u.getX(i), u.getY(i));
      }
      const idx = g.index;
      if (idx) for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset);
      offset += p.count;
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    if (uvs.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  };

  const arm = (rot) => {
    const g = new THREE.BoxGeometry(size * 0.4, size * 1.2, size * 0.4);
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot));
    g.applyMatrix4(m);
    return g;
  };
  return merge([
    arm([0, 0, 0]),
    arm([0, 0, Math.PI / 2]),
    arm([Math.PI / 2, 0, 0]),
  ]);
}
