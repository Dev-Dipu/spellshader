import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js'; // Updated to addons

// --- CONFIG & STATE ---
const params = {
    color: 0x5083c9,
    radius: 10,
    rotate: true,
    shadows: true
};

// --- STATS ---
const stats = new Stats();
document.body.appendChild(stats.dom);

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000);

// --- CAMERA ---
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(100, 200, 300);

// --- RENDERER ---
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Smoother shadows

// --- LIGHTING ---
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 5);
dirLight.position.set(0, 200, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024; 
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.top = 180;
dirLight.shadow.camera.bottom = -100;
dirLight.shadow.camera.left = -120;
dirLight.shadow.camera.right = 120;
scene.add(dirLight);

// --- FLOOR & GRID ---

const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000), 
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.y = -0.5; 
floorMesh.receiveShadow = true;
scene.add(floorMesh);

const grid = new THREE.GridHelper(2000, 50, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);

// --- ROUNDED BOX OBJECT ---
const geometry = new THREE.BoxGeometry(50,50,50);
const material = new THREE.MeshStandardMaterial({ color: params.color });
const cube = new THREE.Mesh(geometry, material);
cube.position.y = 50;
cube.castShadow = true;
scene.add(cube);

// --- CONTROLS ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 25, 0);
controls.enableDamping = true; // Smoother movement
controls.update();

// --- GUI SETUP ---
const gui = new GUI();

// Cube Folder
const cubeFolder = gui.addFolder('Cube');
cubeFolder.addColor(params, 'color').onChange((val) => material.color.set(val));
cubeFolder.add(cube.position, 'y', 25, 100).name('Height');
cubeFolder.add(params, 'rotate').name('Auto Rotate');

// Lights Folder (Adding back as requested in previous prompt)
const lightFolder = gui.addFolder('Lights');
lightFolder.add(dirLight, 'intensity', 0, 10).name('Dir Intensity');
lightFolder.add(hemiLight, 'intensity', 0, 10).name('Hemi Intensity');

// close gui folder for smaller screens
if (window.innerWidth < 600) {
    cubeFolder.close();
    lightFolder.close();
}

// --- ANIMATION ---
function animate() {
    requestAnimationFrame(animate);

    if (params.rotate) {
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
    }

    controls.update();
    renderer.render(scene, camera);
    stats.update();
}

// --- RESIZE HANDLER ---
window.addEventListener('resize', () => {
    // 1. Update Camera
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // 2. Update Renderer Size
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

animate();