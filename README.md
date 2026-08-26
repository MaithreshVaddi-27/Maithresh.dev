# Maithresh.dev — Portfolio

Personal portfolio for **Maithresh Vaddi** — Agentic AI / GenAI / Automation Engineer.

Live 3D hero (Three.js), scroll-driven motion (GSAP ScrollTrigger + Lenis), and content
pulled directly from real, verified projects — no filler.

## Stack

- Vanilla HTML/CSS/JS — no build step, no bundler
- [Three.js](https://threejs.org/) (ES modules via import map) — hero background scene, real bloom post-processing
- [GSAP](https://gsap.com/) + ScrollTrigger — scroll-linked animation
- [Lenis](https://lenis.darkroom.engineering/) — smooth scroll

## Run locally

No build step required — just open `index.html` in a browser, or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
├── index.html
├── css/
│   └── style.css
└── js/
    ├── scene.js   # 3D hero scene (ES module)
    └── main.js    # scroll reveals, cursor, hover interactions
```

## Deploy (GitHub Pages)

1. Push this repo to GitHub (see below).
2. Repo → Settings → Pages → Source: **Deploy from a branch** → Branch: `main` → `/ (root)`.
3. Site publishes at `https://maithreshvaddi-27.github.io/Maithresh.dev/`.

## License

Personal portfolio — content and code © Vaddi Maithresh.
