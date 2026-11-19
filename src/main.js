import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { createMeltEffect, createFeatherEffect, createBurstEffect, createJellyEffect } from './effects.js';

// ─────────────────────────────────────────────────────────────
// RENDERER + SCENE + CAMERA
// ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 4.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 1.5;
controls.maxDistance = 12;
controls.target.set(0, 0, 0);
controls.autoRotate = false;

// ─────────────────────────────────────────────────────────────
// BACKGROUND / ENVIRONMENT
// ─────────────────────────────────────────────────────────────
const BG_COLORS = {
  Melt:     0xd8d5cf,
  Feathers: 0xf3f2ef,
  Burst:    0xffffff,
  Jelly:    0xcdc8c3,
};

// ─────────────────────────────────────────────────────────────
// EFFECT STATE
// ─────────────────────────────────────────────────────────────
const EFFECTS = ['Melt', 'Feathers', 'Burst', 'Jelly'];

const state = {
  activeEffect: 'Melt',

  // Melt params
  melt: {
    shape:      'Blob',
    finish:     'Candy',
    amount:     0.4,
    viscosity:  0.5,
    dripLength: 0.5,
  },

  // Feathers params
  feathers: {
    shape:          'knot',
    look:           'light',
    palette:        'white',
    pattern:        'mixed',
    patternAmount:  0.56,
    featherLength:  1.4,
    featherWidth:   1.3,
    curl:           1.5,
    ruffle:         0.0,
    spin:           0.25,
    internalShadow: 0.56,
    seeThrough:     1.0,
  },

  // Burst params
  burst: {
    shape:     'sphere',
    subject:   'citrus',
    explosion: 0.0,
    spray:     0.7,
  },

  // Jelly params
  jelly: {
    shape:      'cube',
    look:       'ruby',
    light:      'warm',
    count:      7,
    haze:       0.8,
    frost:      0.1,
    walls:      0.02,
    softness:   0.6,
    refraction: 0.25,
    tumble:     0.35,
  },
};

// ─────────────────────────────────────────────────────────────
// ACTIVE EFFECT MANAGEMENT
// ─────────────────────────────────────────────────────────────
let currentEffect = null;
let burstPlaying = false;
let burstT = 0;

function buildEffect(name) {
  if (currentEffect) {
    scene.remove(currentEffect.group);
    // Dispose geometries/materials
    currentEffect.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  scene.background = new THREE.Color(BG_COLORS[name] ?? 0xd8d5cf);

  let effect;
  if (name === 'Melt')     effect = createMeltEffect(state.melt);
  if (name === 'Feathers') effect = createFeatherEffect(state.feathers);
  if (name === 'Burst')    effect = createBurstEffect(state.burst);
  if (name === 'Jelly')    effect = createJellyEffect(state.jelly);

  scene.add(effect.group);
  currentEffect = effect;

  // Reset burst
  if (name === 'Burst') {
    state.burst.explosion = 0;
    effect.uniforms.uExplosion.value = 0;
    burstPlaying = false;
    burstT = 0;
  }
}

buildEffect('Melt');

// ─────────────────────────────────────────────────────────────
// GUI
// ─────────────────────────────────────────────────────────────
const gui = new GUI({ title: 'SpellShader · 4 Effects' });
gui.domElement.style.maxHeight = '100vh';
gui.domElement.style.overflowY = 'auto';

// Effect selector
const effectFolder = gui.addFolder('Effect');
effectFolder.open();

const effectActions = {};
EFFECTS.forEach(name => {
  effectActions[name] = () => {
    state.activeEffect = name;
    rebuildGUI();
    buildEffect(name);
  };
});

let effectController = effectFolder.add(state, 'activeEffect', EFFECTS).name('Active').onChange(val => {
  buildEffect(val);
  rebuildGUI();
});

// Per-effect folder (rebuilt on switch)
let paramFolder = null;

function rebuildGUI() {
  if (paramFolder) {
    paramFolder.destroy();
    paramFolder = null;
  }
  buildParamFolder(state.activeEffect);
}

function buildParamFolder(effectName) {
  if (effectName === 'Melt') {
    paramFolder = gui.addFolder('Melt — Liquid Coating');
    paramFolder.add(state.melt, 'shape', ['Blob', 'Torus', 'Suzanne', 'Cross'])
      .name('Shape').onChange(() => buildEffect('Melt'));
    paramFolder.add(state.melt, 'finish', ['Candy', 'Lacquer', 'Mercury', 'Wax'])
      .name('Finish').onChange(val => { state.melt.finish = val; buildEffect('Melt'); });
    paramFolder.add(state.melt, 'amount', 0, 1, 0.01).name('Melt Amount')
      .onChange(val => currentEffect?.setParam('amount', val));
    paramFolder.add(state.melt, 'viscosity', 0.1, 2, 0.01).name('Viscosity / Speed')
      .onChange(val => currentEffect?.setParam('viscosity', val));
    paramFolder.add(state.melt, 'dripLength', 0.1, 2, 0.01).name('Drip Length')
      .onChange(val => currentEffect?.setParam('dripLength', val));
    paramFolder.open();
  }

  else if (effectName === 'Feathers') {
    paramFolder = gui.addFolder('Feathers — Plumage');
    paramFolder.add(state.feathers, 'shape', ['knot', 'torus', 'ring', 'sphere', 'blob', 'cross'])
      .name('Shape').onChange(() => buildEffect('Feathers'));
    paramFolder.add(state.feathers, 'look', ['light', 'dark'])
      .name('Look').onChange(val => { state.feathers.look = val; currentEffect?.setParam('look', val); buildEffect('Feathers'); });
    paramFolder.add(state.feathers, 'palette', ['white', 'pheasant', 'owl', 'dove', 'jay', 'flamingo', 'golden', 'ink'])
      .name('Palette').onChange(val => { state.feathers.palette = val; buildEffect('Feathers'); });
    paramFolder.add(state.feathers, 'pattern', ['plain', 'gradient', 'barred', 'streaked', 'mottled', 'mixed'])
      .name('Pattern').onChange(val => currentEffect?.setParam('pattern', val));
    paramFolder.add(state.feathers, 'patternAmount', 0, 1, 0.01).name('Pattern Amount')
      .onChange(val => currentEffect?.setParam('patternAmount', val));
    paramFolder.add(state.feathers, 'featherLength', 0.3, 3, 0.01).name('Feather Length')
      .onChange(val => currentEffect?.setParam('featherLength', val));
    paramFolder.add(state.feathers, 'featherWidth', 0.3, 3, 0.01).name('Feather Width')
      .onChange(val => currentEffect?.setParam('featherWidth', val));
    paramFolder.add(state.feathers, 'curl', 0, 4, 0.01).name('Curl')
      .onChange(val => currentEffect?.setParam('curl', val));
    paramFolder.add(state.feathers, 'ruffle', 0, 1, 0.01).name('Ruffle')
      .onChange(val => currentEffect?.setParam('ruffle', val));
    paramFolder.add(state.feathers, 'spin', 0, 2, 0.01).name('Spin Speed')
      .onChange(val => currentEffect?.setParam('spin', val));
    paramFolder.add(state.feathers, 'internalShadow', 0, 1, 0.01).name('Internal Shadow')
      .onChange(val => currentEffect?.setParam('internalShadow', val));
    paramFolder.open();
  }

  else if (effectName === 'Burst') {
    paramFolder = gui.addFolder('Burst — Explosion');
    paramFolder.add(state.burst, 'shape', ['sphere', 'torus', 'blob', 'cross'])
      .name('Shape').onChange(() => buildEffect('Burst'));
    paramFolder.add(state.burst, 'subject', ['chocolate', 'watermelon', 'citrus', 'geode'])
      .name('Subject').onChange(val => { state.burst.subject = val; buildEffect('Burst'); });
    paramFolder.add(state.burst, 'explosion', 0, 1, 0.01).name('Explosion')
      .onChange(val => { currentEffect?.setParam('explosion', val); burstPlaying = false; });
    paramFolder.add(state.burst, 'spray', 0, 1, 0.01).name('Spray')
      .onChange(val => currentEffect?.setParam('spray', val));
    // Play button
    const burstActions = {
      'Play Burst 🎆': () => {
        state.burst.explosion = 0;
        currentEffect?.setParam('explosion', 0);
        burstPlaying = true;
        burstT = 0;
      },
      'Reset': () => {
        state.burst.explosion = 0;
        currentEffect?.setParam('explosion', 0);
        burstPlaying = false;
        burstT = 0;
      }
    };
    paramFolder.add(burstActions, 'Play Burst 🎆');
    paramFolder.add(burstActions, 'Reset');
    paramFolder.open();
  }

  else if (effectName === 'Jelly') {
    paramFolder = gui.addFolder('Jelly — Gummy Bodies');
    paramFolder.add(state.jelly, 'shape', ['cube', 'sphere', 'torus', 'blob', 'cross'])
      .name('Container Shape').onChange(() => buildEffect('Jelly'));
    paramFolder.add(state.jelly, 'look', ['ruby', 'blush', 'mint', 'lilac', 'tide', 'peach'])
      .name('Look / Color').onChange(val => { state.jelly.look = val; buildEffect('Jelly'); });
    paramFolder.add(state.jelly, 'light', ['warm', 'rose', 'teal', 'golden', 'neutral'])
      .name('Light Color').onChange(val => currentEffect?.setParam('light', val));
    paramFolder.add(state.jelly, 'count', 3, 12, 1).name('Body Count')
      .onChange(() => buildEffect('Jelly'));
    paramFolder.add(state.jelly, 'haze', 0, 1.5, 0.01).name('Container Haze')
      .onChange(val => currentEffect?.setParam('haze', val));
    paramFolder.add(state.jelly, 'frost', 0, 0.6, 0.01).name('Container Frost')
      .onChange(val => currentEffect?.setParam('frost', val));
    paramFolder.add(state.jelly, 'walls', 0, 0.2, 0.01).name('Wall Thickness')
      .onChange(val => currentEffect?.setParam('walls', val));
    paramFolder.add(state.jelly, 'softness', 0, 1, 0.01).name('Softness')
      .onChange(val => currentEffect?.setParam('softness', val));
    paramFolder.add(state.jelly, 'tumble', 0, 1, 0.01).name('Tumble Speed')
      .onChange(val => { state.jelly.tumble = val; buildEffect('Jelly'); });
    paramFolder.open();
  }
}

buildParamFolder('Melt');

// ─────────────────────────────────────────────────────────────
// RESIZE
// ─────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ─────────────────────────────────────────────────────────────
// ANIMATE
// ─────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const dt = clock.getDelta ? 0.016 : 0.016;

  // Auto-animate burst
  if (state.activeEffect === 'Burst' && burstPlaying) {
    burstT = Math.min(burstT + 0.016, 1.0);
    state.burst.explosion = burstT;
    currentEffect?.setParam('explosion', burstT);
    if (burstT >= 1.0) burstPlaying = false;
  }

  if (currentEffect) currentEffect.update(t);

  controls.update();
  renderer.render(scene, camera);
}

animate();
