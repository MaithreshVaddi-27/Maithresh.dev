// ── Live GitHub activity graph — rendered client-side from raw data ──
// Earlier version embedded ghchart.rshah.org's pre-rendered image.
// Confirmed stale in practice (missing weeks of real activity, cache
// TTL not under our control or even documented). Fixed properly: fetch
// the raw contribution data ourselves from jogruber's API (no token
// needed, browser-fetchable — the same data source libraries like
// react-github-calendar use directly) and draw the heatmap as SVG in
// our own Nord colors. No third-party rendering cache in the loop at
// all, so it's exactly as fresh as GitHub's own data, on every load.
(function () {
  const container = document.getElementById('contribGraph');
  if (!container) return;

  const LEVEL_COLOR = ['#2e3440', '#4c566a', '#5e81ac', '#81a1c1', '#88c0d0'];
  const CELL = 11, GAP = 3, LEFT_PAD = 28, TOP_PAD = 18;

  fetch('https://github-contributions-api.jogruber.de/v4/MaithreshVaddi-27?y=last')
    .then((res) => { if (!res.ok) throw new Error('bad response'); return res.json(); })
    .then((data) => {
      const days = data && data.contributions;
      if (!days || !days.length) throw new Error('no contribution data');

      const firstDow = new Date(days[0].date + 'T00:00:00Z').getUTCDay();
      const padded = new Array(firstDow).fill(null).concat(days);
      const weeks = [];
      for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

      const width = LEFT_PAD + weeks.length * (CELL + GAP);
      const height = TOP_PAD + 7 * (CELL + GAP);

      let monthLabels = '';
      let lastMonth = -1;
      weeks.forEach((week, wi) => {
        const firstReal = week.find((d) => d);
        if (!firstReal) return;
        const d = new Date(firstReal.date + 'T00:00:00Z');
        const m = d.getUTCMonth();
        if (m === lastMonth) return;
        lastMonth = m;
        const x = LEFT_PAD + wi * (CELL + GAP);
        const label = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        monthLabels += `<text x="${x}" y="10" font-size="10" fill="#8b95a1" font-family="'JetBrains Mono',monospace">${label}</text>`;
      });

      const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
      const dayLabelSvg = dayLabels.map((l, i) => l
        ? `<text x="0" y="${TOP_PAD + i * (CELL + GAP) + 9}" font-size="10" fill="#8b95a1" font-family="'JetBrains Mono',monospace">${l}</text>`
        : '').join('');

      let rects = '';
      weeks.forEach((week, wi) => {
        week.forEach((d, di) => {
          if (!d) return;
          const x = LEFT_PAD + wi * (CELL + GAP);
          const y = TOP_PAD + di * (CELL + GAP);
          const color = LEVEL_COLOR[d.level] || LEVEL_COLOR[0];
          const label = `${d.count} contribution${d.count === 1 ? '' : 's'} on ${d.date}`;
          rects += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${color}"><title>${label}</title></rect>`;
        });
      });

      container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="GitHub contribution graph, last 12 months">${monthLabels}${dayLabelSvg}${rects}</svg>`;
    })
    .catch(() => {
      const card = container.closest('.activity-card');
      if (card) {
        card.innerHTML = '<p class="activity-fallback">Live GitHub activity — <a href="https://github.com/MaithreshVaddi-27" target="_blank" rel="noopener">view on GitHub →</a></p>';
      }
    });
})();

// ── Mobile nav toggle ──────────────────────────────────────────
(function () {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
  });

  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ── Shared motion-preference flag ─────────────────────────────
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

// ── Preloader ────────────────────────────────────────────────
(function () {
  const preloader = document.getElementById('preloader');
  const fill = document.getElementById('preloaderFill');
  const pct = document.getElementById('preloaderPct');
  if (!preloader) return;

  if (reduceMotion) {
    preloader.classList.add('done');
    return;
  }

  let progress = 0;
  const tick = setInterval(() => {
    progress += (90 - progress) * 0.08 + 0.4;
    if (progress > 90) progress = 90;
    fill.style.width = progress + '%';
    pct.textContent = String(Math.floor(progress)).padStart(2, '0') + '%';
  }, 90);

  window.addEventListener('load', () => {
    clearInterval(tick);
    fill.style.width = '100%';
    pct.textContent = '100%';
    setTimeout(() => preloader.classList.add('done'), 320);
  });

  setTimeout(() => preloader.classList.add('done'), 3500);
})();

// ── Lenis smooth scroll, synced to GSAP's ticker ──────────────
// This is the standard darkroom.engineering/GSAP pairing: Lenis owns
// the actual scroll physics, GSAP's ticker drives Lenis's rAF loop so
// everything (Lenis easing + ScrollTrigger-driven tweens) stays on the
// same clock instead of fighting each other across two rAF loops.
let lenis = null;
if (!reduceMotion && typeof window.Lenis !== 'undefined' && hasGSAP) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ── Custom cursor ────────────────────────────────────────────
(function () {
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  const cursorLabel = document.getElementById('cursorLabel');
  if (!dot || !ring || window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  // Only hide the OS cursor once we're actually about to render a
  // replacement for it — see the html.custom-cursor scoping in
  // css/style.css. Prevents an invisible cursor if this script had
  // errored out before reaching this point.
  document.documentElement.classList.add('custom-cursor');

  let dotX = 0, dotY = 0, ringX = 0, ringY = 0, targetX = 0, targetY = 0;
  window.addEventListener('pointermove', (e) => {
    targetX = e.clientX; targetY = e.clientY;
  });

  function loop() {
    dotX = targetX; dotY = targetY;
    ringX += (targetX - ringX) * 0.18;
    ringY += (targetY - ringY) * 0.18;
    dot.style.transform = `translate(${dotX}px, ${dotY}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%,-50%)`;
    if (cursorLabel) {
      cursorLabel.style.setProperty('--cx', `${ringX}px`);
      cursorLabel.style.setProperty('--cy', `${ringY}px`);
    }
    requestAnimationFrame(loop);
  }
  loop();

  document.querySelectorAll('a, button, .group-card, .proj-row').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      ring.classList.add('hover');
      if (el.dataset.cursorLabel && cursorLabel) {
        // Text lives in the SVG textPath now (see index.html), not set
        // dynamically — this just reveals the existing orbit badge.
        // Hide the plain ring underneath so the two don't overlap.
        cursorLabel.classList.add('show');
        ring.classList.add('label-active');
      }
    });
    el.addEventListener('mouseleave', () => {
      ring.classList.remove('hover');
      ring.classList.remove('label-active');
      if (cursorLabel) cursorLabel.classList.remove('show');
    });
  });

  // Respond on pointer-down, not on click/release (Apple: "Response" —
  // feedback that waits for release reads as dead). Compresses the ring
  // the instant a press starts, uncompresses the instant it ends —
  // never gated on whether the press turned into a completed click.
  window.addEventListener('pointerdown', () => ring.classList.add('press'));
  window.addEventListener('pointerup', () => ring.classList.remove('press'));
})();

// ── Hero background parallax — depth via layered mouse response ──
// Event-driven rather than rAF-looped since it only needs to settle
// once per pointer move, not track continuously — the CSS transition
// on the aurora layer (see style.css) supplies the easing.
(function () {
  if (reduceMotion) return;
  const hero = document.querySelector('.hero');
  const aurora = document.querySelector('.bg-aurora');
  if (!hero || !aurora) return;
  hero.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5);
    const y = (e.clientY / window.innerHeight - 0.5);
    aurora.style.transform = `translate(${x * -24}px, ${y * -18}px)`;
  });
  hero.addEventListener('mouseleave', () => {
    aurora.style.transform = '';
  });
})();

// ── Magnetic buttons ─────────────────────────────────────────
(function () {
  if (reduceMotion) return;
  document.querySelectorAll('.btn-primary, .nav-cta').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      // Subtle magnetism — a hint of pull, not a bouncy toy.
      el.style.transform = `translate(${x * 0.15}px, ${y * 0.2}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
})();

// ── 3D tilt on project / group cards / hero portrait ─────────
(function () {
  if (reduceMotion) return;
  document.querySelectorAll('.group-card, .ascii-card--hero, .stack-card, .terminal').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      // Subtle tilt — enough to read as "3D object", not a gimmick.
      card.style.transform =
        `perspective(900px) rotateY(${px * 4}deg) rotateX(${-py * 4}deg) translateY(-4px) translateZ(0)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
})();

// ── Project row hover refinements ────────────────────────────
// Two things, both hover-triggered rather than scroll-triggered:
// 1. Letter-split title with a quick ripple on mouseenter (GSAP-driven).
// 2. A magnetic arrow that pulls toward the cursor while hovering,
//    replacing the old CSS-only rotate — richer motion, and it also
//    frees up the `transform` property so this and the CSS color
//    transition don't fight over it (see css/style.css comment).
(function () {
  document.querySelectorAll('.proj-row-title').forEach((titleEl) => {
    const text = titleEl.textContent;
    titleEl.setAttribute('aria-label', text);
    titleEl.innerHTML = '';
    // Split into words first, letters second — each word gets its own
    // non-wrapping span so the browser can only break *between* words,
    // never mid-word. The previous version replaced every space with a
    // non-breaking space, which removed every valid break point and
    // forced ugly mid-word wraps ("Wo|rkbench") at narrow widths.
    text.split(' ').forEach((word, wi, arr) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'proj-row-title-word';
      word.split('').forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'proj-row-title-letter';
        span.textContent = ch;
        span.setAttribute('aria-hidden', 'true');
        wordSpan.appendChild(span);
      });
      titleEl.appendChild(wordSpan);
      if (wi < arr.length - 1) titleEl.appendChild(document.createTextNode(' '));
    });
  });

  // ── Sticky detail stage (desktop only, see css/style.css) ──────
  // Populates from each row's own .proj-row-detail — single source of
  // truth, so mobile (which shows that block inline) and desktop (which
  // shows it in the stage) never drift out of sync with each other.
  const stage = document.getElementById('projStage');
  const stageInner = document.getElementById('projStageInner');
  const rows = document.querySelectorAll('.proj-row');

  // ── Pipeline diagram draw-in ────────────────────────────────
  // The connector lines/arrows in the TrustRAG schematic trace
  // themselves in (stroke-dashoffset 0 → length), rather than
  // appearing with the rest of the diagram — reads as "data moving
  // through the pipeline", the one animation on this page tied
  // directly to what the project actually does. Boxes and the
  // decision diamond stay static; only flow connectors (line/path)
  // draw. getTotalLength() is measured fresh each call since the
  // stage clones fresh nodes on every hover swap.
  function animateDiagram(root) {
    if (reduceMotion) return;
    const svg = root.querySelector('.proj-diagram svg');
    if (!svg) return;
    // getTotalLength() throws on a non-rendered element — happens when
    // this runs against the desktop stage panel while the viewport is
    // actually mobile (.proj-stage is display:none under 900px, but
    // fillStage() still populates it on init regardless of viewport).
    // getClientRects().length is the cheap way to ask "is this actually
    // laid out right now" without try/catch around every measurement.
    if (svg.getClientRects().length === 0) return;
    const connectors = Array.from(svg.querySelectorAll('line, path')).filter(
      (el) => typeof el.getTotalLength === 'function'
    );
    if (!connectors.length) return;
    connectors.forEach((el) => {
      const len = el.getTotalLength();
      el.style.transition = 'none';
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        connectors.forEach((el, i) => {
          el.style.transition = `stroke-dashoffset 0.65s cubic-bezier(.16,1,.3,1) ${i * 0.06}s`;
          el.style.strokeDashoffset = '0';
        });
      });
    });
  }

  function fillStage(row) {
    const detail = row.querySelector('.proj-row-detail');
    if (!stageInner || !detail) return;
    // Generation token guards against a rapid hover across multiple
    // rows resolving out of order — without this, quickly moving the
    // mouse row1 → row2 → row3 could let row1's delayed swap land last,
    // showing the wrong project's details while hovering row3.
    const myToken = ++fillStage.token;
    const swap = () => { stageInner.innerHTML = detail.innerHTML; animateDiagram(stageInner); };
    if (reduceMotion || !stageInner.childNodes.length) {
      swap();
      return;
    }
    stageInner.classList.add('swapping');
    setTimeout(() => {
      if (myToken !== fillStage.token) return; // a newer hover has already superseded this one
      swap();
      stageInner.classList.remove('swapping');
    }, 180);
  }
  fillStage.token = 0;

  if (stage && stageInner && rows.length) {
    fillStage(rows[0]); // default to the first project so the panel isn't empty on load
    rows.forEach((row) => {
      row.addEventListener('mouseenter', () => fillStage(row));
      row.addEventListener('focus', () => fillStage(row));
    });
  }

  if (reduceMotion) return;

  // Mobile/narrow layout shows .proj-diagram inline (static, not
  // cloned into a stage — see the max-width:899px rule in
  // css/style.css), so it needs its own visibility trigger instead of
  // riding along with fillStage's swap.
  if (window.matchMedia('(max-width: 899px)').matches && 'IntersectionObserver' in window) {
    const mobileDiagrams = document.querySelectorAll('.proj-row-detail .proj-diagram');
    const dObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateDiagram(entry.target.closest('.proj-row-detail'));
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.4 }
    );
    mobileDiagrams.forEach((el) => dObserver.observe(el));
  }

  rows.forEach((row) => {
    const letters = row.querySelectorAll('.proj-row-title-letter');
    const arrow = row.querySelector('.proj-row-arrow');
    let hovering = false;

    row.addEventListener('mouseenter', () => {
      hovering = true;
      if (hasGSAP && letters.length) {
        gsap.fromTo(
          letters,
          { y: 0 },
          { y: -6, duration: 0.22, ease: 'power2.out', stagger: 0.014, yoyo: true, repeat: 1 }
        );
      }
    });

    row.addEventListener('mousemove', (e) => {
      if (!hovering || !arrow) return;
      const rect = row.getBoundingClientRect();
      // Pull is measured from the arrow's resting position (right edge
      // of the row), so it visibly "reaches" toward the cursor rather
      // than tracking it 1:1.
      const mx = ((e.clientX - rect.right + 30) * 0.18).toFixed(1);
      const my = ((e.clientY - rect.top - rect.height / 2) * 0.18).toFixed(1);
      arrow.style.transform = `translate(${mx}px, ${my}px) rotate(45deg) scale(1.3)`;
    });

    row.addEventListener('mouseleave', () => {
      hovering = false;
      if (arrow) arrow.style.transform = '';
    });
  });
})();

// ── Scroll-driven motion (GSAP ScrollTrigger) ─────────────────
// Replaces the old manual `scroll` listener + IntersectionObserver
// pair with the actual standard: precise trigger points, scrubbed
// values tied directly to scroll position, and one shared clock with
// Lenis instead of a second independent rAF loop.
if (hasGSAP) {
  // Hero content: scrub-fades and drifts up as the hero scrolls past —
  // tied to scroll position (scrub) rather than a fixed-duration tween.
  if (!reduceMotion) {
    gsap.to('.hero-inner', {
      y: 140,
      opacity: 0,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });

    // Expose hero scroll progress (0 → 1) for the 3D scene to react to —
    // the pipeline graph recedes/dollies as you scroll from hero into About.
    ScrollTrigger.create({
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      onUpdate: (self) => { window.__heroScrollProgress = self.progress; },
    });
  }

  // Section reveals: fade + rise + un-blur, staggered per grid, each
  // firing once as it enters the viewport. Grid cards (proj/group/stack/
  // cert) are excluded here — they get the index-staggered pass below
  // instead, so they aren't animated twice.
  const revealTargets = gsap.utils.toArray(
    '.reveal:not(.proj-row):not(.group-card):not(.stack-card):not(.cert-card)'
  );
  revealTargets.forEach((el) => {
    if (reduceMotion) { gsap.set(el, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }); return; }
    gsap.fromTo(
      el,
      { opacity: 0, y: 50, scale: 0.92, filter: 'blur(6px)' },
      {
        opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
        duration: 1.0, ease: 'back.out(1.4)',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      }
    );
  });

  // Stagger cards within each grid — index-based delay per grid so
  // siblings don't all pop in at once.
  ['.proj-list', '.group-grid', '.stack-groups', '.cert-grid'].forEach((sel) => {
    const grid = document.querySelector(sel);
    if (!grid) return;
    Array.from(grid.children).forEach((child, i) => {
      if (!child.classList.contains('reveal') || reduceMotion) return;
      gsap.fromTo(
        child,
        { opacity: 0, y: 50, scale: 0.92, filter: 'blur(6px)' },
        {
          opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
          duration: 1.0, ease: 'back.out(1.4)', delay: i * 0.08,
          scrollTrigger: { trigger: child, start: 'top 90%', toggleActions: 'play none none none' },
          overwrite: true,
        }
      );
    });
  });

  // Terminal "boot sequence" — lines step in as the block scrolls into
  // view, instead of appearing all at once with the rest of the section.
  const terminalLines = gsap.utils.toArray('.terminal .t-line');
  if (terminalLines.length) {
    if (reduceMotion) {
      gsap.set(terminalLines, { opacity: 1, x: 0 });
    } else {
      gsap.set(terminalLines, { opacity: 0, x: -8 });
      ScrollTrigger.create({
        trigger: '.terminal',
        start: 'top 82%',
        once: true,
        onEnter: () => {
          gsap.to(terminalLines, { opacity: 1, x: 0, duration: 0.4, stagger: 0.12, ease: 'power2.out' });
        },
      });
    }
  }
} else {
  // GSAP failed to load (CDN blocked) — fall back to instantly visible
  // content rather than a page permanently stuck at opacity:0.
  document.querySelectorAll('.reveal').forEach((el) => {
    el.style.opacity = '1'; el.style.transform = 'none'; el.style.filter = 'none';
  });
}

// ── Scroll progress ──────────────────────────────────────────
// A thin instrument-panel readout of position in the document, driven
// 1:1 off scroll (via GSAP+ScrollTrigger when available, a plain
// scroll listener otherwise). This is exempt from reduced-motion: it's
// a direct status correlate of where the user already is, the same
// category as a native progress bar, not an independent animation.
(function () {
  const fill = document.getElementById('scrollProgressFill');
  if (!fill) return;
  if (hasGSAP) {
    gsap.set(fill, { width: '0%' });
    gsap.to(fill, {
      width: '100%', ease: 'none',
      scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
    });
  } else {
    const update = () => {
      const h = document.documentElement;
      const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100;
      fill.style.width = pct + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }
})();

// ── Hero stat count-up ───────────────────────────────────────
// The three telemetry numbers count up from zero once on load rather
// than appearing static — timed to land just after their own fadeUp
// (see .hero-stats animation-delay in style.css) so the number itself
// feels like it's still arriving when it becomes readable.
(function () {
  if (reduceMotion || !hasGSAP) return;
  document.querySelectorAll('.hero-stat-n').forEach((el) => {
    const target = parseInt(el.textContent, 10);
    if (Number.isNaN(target)) return;
    const digits = el.textContent.trim().length;
    const proxy = { val: 0 };
    gsap.to(proxy, {
      val: target, duration: 1.3, delay: 1.15, ease: 'power2.out',
      onUpdate: () => { el.textContent = String(Math.round(proxy.val)).padStart(digits, '0'); },
    });
  });
})();

// ── Nav scrollspy ─────────────────────────────────────────────
// Highlights the nav link for whichever section currently occupies
// the reading band (a horizontal slice near the top of the viewport,
// not the full viewport — matching a section "as it becomes primary"
// rather than "as soon as its top pixel is visible"). Plain
// IntersectionObserver, no scroll listener, so it costs nothing on
// the main thread between crossings.
(function () {
  const navLinks = Array.from(document.querySelectorAll('.navlinks a[href^="#"]'));
  if (!navLinks.length) return;
  const map = new Map();
  navLinks.forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    const section = document.getElementById(id);
    if (section) map.set(section, a);
  });
  if (!map.size) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = map.get(entry.target);
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach((a) => a.classList.remove('active'));
          link.classList.add('active');
        }
      });
    },
    { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
  );
  map.forEach((_, section) => observer.observe(section));
})();

// ── "More projects" toggle ──────────────────────────────────
const moreToggle = document.getElementById('moreToggle');
const moreBody = document.getElementById('moreBody');
const moreArrow = document.getElementById('moreArrow');

if (moreToggle && moreBody && moreArrow) {
  moreToggle.addEventListener('click', () => {
    const open = moreBody.classList.toggle('open');
    moreToggle.setAttribute('aria-expanded', open);
    moreArrow.textContent = open ? '− hide' : '+ show 5 more';
    if (hasGSAP) ScrollTrigger.refresh(); // layout height changed
  });
}
