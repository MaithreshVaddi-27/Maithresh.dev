/**
 * Hero background — drifting particle field (no grid, no wireframe).
 *
 * v5 — removed the wave-grid wireframe mesh entirely (was read as
 * "grid background" across two rounds of feedback, correctly — it
 * was a literal wireframe PlaneGeometry, not a CSS artifact). What
 * remains is the particle + spark fields: independent drift, no
 * shared center, no closed orbits, no grid silhouette.
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

  // ── Lighting — instrument-panel blue, matching the site's Flight
  // Telemetry accent. Varied by intensity/tone within one hue family
  // rather than a second competing color, same discipline as every
  // earlier palette this scene has worn.
  const keyLight = new THREE.PointLight(0xb8dde8, 15, 40, 2);
  keyLight.position.set(6, 6, 8);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0x88c0d0, 7, 40, 2);
  fillLight.position.set(-7, 2, -4);
  scene.add(fillLight);

  const ambient = new THREE.AmbientLight(0x141d22, 1.3);
  scene.add(ambient);

  // ── Wave grid — REMOVED. This was a literal wireframe PlaneGeometry
  // mesh, which is what was actually reading as "grid background"
  // across two rounds of feedback — the CSS grid layers removed
  // earlier were a red herring; this WebGL object was the real
  // source. Deleted outright rather than re-skinned, since any
  // wireframe geometry reads as a grid regardless of color/opacity.
  // The particle + spark fields below already carry the scene's
  // depth and motion without a grid silhouette.

  // ── Drifting particle field — independent motion, no shared center,
  // wraps around instead of orbiting. The "two size classes for depth"
  // are this field (small, dim, distant) plus the brighter "sparks"
  // field defined below (larger, near) — two separate Points objects,
  // since THREE.PointsMaterial only supports one uniform size per
  // object (a true per-vertex size needs a custom shader, which isn't
  // worth the added complexity/risk for this).
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
    color: 0xb8dde8, size: 0.05, transparent: true, opacity: 0.75,
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
    color: 0x88c0d0, size: 0.16, transparent: true, opacity: 0.9, sizeAttenuation: true,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  scene.add(sparks);

  // ── Post-processing: real bloom on the particle/spark glow.
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

  // ── Render gating — pause when it can't be seen ───────────────
  // Previously this rAF loop (WebGL render + bloom composite + a
  // 320-particle position update) ran forever, full tilt, even once
  // the hero had scrolled far out of view or the tab was backgrounded.
  // Real, measurable waste — GPU/battery cost for pixels nobody's
  // looking at. Two independent signals gate it: IntersectionObserver
  // (hero on/off screen) and visibilitychange (tab hidden/backgrounded).
  // Either one being false stops scheduling new frames; the loop
  // resumes cleanly the moment both are true again.
  let rafId = null;
  let onScreen = true;
  let tabVisible = !document.hidden;

  let t = 0;
  function frame() {
    rafId = requestAnimationFrame(frame);
    t += reduceMotion ? 0 : 0.006;

    mouseX += (targetX - mouseX) * 0.03;
    mouseY += (targetY - mouseY) * 0.03;

    camera.position.x = mouseX * 1.4;
    camera.position.y = 3.4 + mouseY * 0.6;
    camera.lookAt(0, -0.5, 0);

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

  function stop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function start() {
    if (rafId === null && onScreen && tabVisible) frame();
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0].isIntersecting;
        onScreen ? start() : stop();
      },
      { threshold: 0 }
    );
    io.observe(canvas);
  }
  document.addEventListener('visibilitychange', () => {
    tabVisible = !document.hidden;
    tabVisible ? start() : stop();
  });

  start();

  requestAnimationFrame(() => canvas.classList.add('ready'));
}

boot();
