/**
 * Hero background — animated wave-grid + drifting particle field.
 *
 * v4 — full redesign, replacing the earlier orbiting-nodes-around-a-
 * ringed-center layout, which read as a solar system (a bright central
 * "sun" node with a ring, smaller nodes on elliptical paths, camera
 * orbiting around it). Nothing here shares a center or moves in a
 * closed orbit: the grid undulates independently per-vertex, and
 * particles drift and wrap rather than circle a point.
 *
 * Kept from the previous build (still correct, not the part that had
 * to change): ES modules via import map, real EffectComposer +
 * UnrealBloomPass, ACESFilmicToneMapping + sRGB output, the
 * constrained-device performance tier, and the "hide canvas on any
 * failure" fallback.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('hero-canvas');

function boot() {
  if (!canvas) return;
  try {
    run();
  } catch (err) {
    console.warn('Hero 3D scene failed to initialize:', err);
    canvas.style.display = 'none';
  }
}

function run() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isConstrained =
    window.innerWidth < 760 ||
    window.matchMedia('(pointer: coarse)').matches ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 3.4, 13);
  camera.lookAt(0, -0.5, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isConstrained, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isConstrained ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ── Lighting — single hue family (blue), varied by intensity/tone
  // rather than a second competing color.
  const keyLight = new THREE.PointLight(0x3d8bff, 16, 40, 2);
  keyLight.position.set(6, 6, 8);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0x8ecbff, 8, 40, 2);
  fillLight.position.set(-7, 2, -4);
  scene.add(fillLight);

  const ambient = new THREE.AmbientLight(0x0f1a2e, 1.3);
  scene.add(ambient);

  // ── Wave grid — a tilted plane whose vertices undulate independently.
  // This is the actual replacement for the node graph: one continuous
  // surface with no central focal object, nothing orbiting anything.
  const gridSize = 34;
  const gridSegments = isConstrained ? 44 : 72;
  const gridGeo = new THREE.PlaneGeometry(gridSize, gridSize, gridSegments, gridSegments);
  gridGeo.rotateX(-Math.PI / 2.35);
  const basePositions = gridGeo.attributes.position.array.slice(); // original x,y,z per vertex

  const gridMat = new THREE.MeshStandardMaterial({
    color: 0x1c4f96,
    emissive: 0x2f6fd6,
    emissiveIntensity: 0.35,
    roughness: 0.5,
    metalness: 0.15,
    wireframe: true,
    transparent: true,
    opacity: 0.4,
  });
  const grid = new THREE.Mesh(gridGeo, gridMat);
  grid.position.y = -2.4;
  scene.add(grid);

  // ── Drifting particle field — independent motion, no shared center,
  // wraps around instead of orbiting. Two size classes for depth.
  const isSmall = (i) => i % 5 !== 0;
  const particleCount = isConstrained ? 140 : 320;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = new Float32Array(particleCount * 3);
  const particleSpeed = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    particlePos[i * 3] = (Math.random() - 0.5) * 26;
    particlePos[i * 3 + 1] = (Math.random() - 0.5) * 14 + 1;
    particlePos[i * 3 + 2] = (Math.random() - 0.5) * 22 - 4;
    particleSpeed[i] = 0.15 + Math.random() * 0.35;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x8ecbff, size: 0.05, transparent: true, opacity: 0.75,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // A handful of larger, brighter "sparks" — still just drifting, not
  // orbiting; scattered with independent phases so none of them share
  // a visible center or path.
  const sparkGeo = new THREE.BufferGeometry();
  const sparkCount = isConstrained ? 10 : 22;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkPhase = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i++) {
    sparkPos[i * 3] = (Math.random() - 0.5) * 22;
    sparkPos[i * 3 + 1] = (Math.random() - 0.5) * 10 + 1;
    sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2;
    sparkPhase[i] = Math.random() * Math.PI * 2;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0x3d8bff, size: 0.16, transparent: true, opacity: 0.9, sizeAttenuation: true,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  scene.add(sparks);

  // ── Post-processing: real bloom on the grid's emissive lines + sparks.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let bloomPass = null;
  if (!isConstrained) {
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.65,  // strength
      0.5,   // radius
      0.25   // threshold
    );
    composer.addPass(bloomPass);
  }
  composer.addPass(new OutputPass());

  // ── Pointer parallax (eased) — subtle camera drift, not orbit.
  let targetX = 0, targetY = 0, mouseX = 0, mouseY = 0;
  window.addEventListener('pointermove', (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass?.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  const posAttr = grid.geometry.attributes.position;

  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += reduceMotion ? 0 : 0.006;

    mouseX += (targetX - mouseX) * 0.03;
    mouseY += (targetY - mouseY) * 0.03;

    camera.position.x = mouseX * 1.4;
    camera.position.y = 3.4 + mouseY * 0.6;
    camera.lookAt(0, -0.5, 0);

    // Undulate the grid — layered sine waves per vertex, no shared
    // center or rotation, just a continuously moving surface.
    if (!reduceMotion) {
      for (let i = 0; i < posAttr.count; i++) {
        const ix = i * 3;
        const bx = basePositions[ix];
        const bz = basePositions[ix + 2];
        const wave =
          Math.sin(bx * 0.18 + t) * 0.55 +
          Math.cos(bz * 0.22 + t * 0.8) * 0.4;
        posAttr.array[ix + 1] = basePositions[ix + 1] + wave;
      }
      posAttr.needsUpdate = true;
    }

    // Particles drift steadily along one axis and wrap — never circle
    // a center point.
    const pPos = particles.geometry.attributes.position;
    for (let i = 0; i < particleCount; i++) {
      const iy = i * 3 + 1;
      if (!reduceMotion) {
        pPos.array[iy] += particleSpeed[i] * 0.01;
        if (pPos.array[iy] > 8) pPos.array[iy] = -8;
      }
    }
    pPos.needsUpdate = true;

    // Sparks pulse gently in place (independent phases) — no motion
    // path at all, just a slow brightness/scale breathe.
    sparks.material.opacity = reduceMotion ? 0.9 : 0.7 + Math.sin(t * 1.3) * 0.2;

    const scrollProgress = window.__heroScrollProgress || 0;

    if (canvas.classList.contains('ready')) {
      const targetOpacity = 1 - Math.min(scrollProgress * 0.65, 0.62);
      canvas.style.opacity = String(targetOpacity);
    }

    composer.render();
  }
  animate();

  requestAnimationFrame(() => canvas.classList.add('ready'));
}

boot();
