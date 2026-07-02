# LUMEN° — a lamp that dreams it's the sun

A product-launch demo site for a fictional sunrise lamp. One continuous scroll
travels from dawn to midnight while the product itself is born in 3D: the lamp
**assembles out of stardust, explodes into its labeled internal parts,
reassembles, and powers on** as the room dims around it.

Hand-written HTML/CSS/JS. The only dependency is a locally vendored copy of
three.js — no CDNs, no build step.

## Run it

Any static server from the repo root, e.g.:

```
python -m http.server 8000
```

then open `http://localhost:8000/`. (Opening `index.html` directly also works.)
Best experienced on **desktop Chrome/Edge, fullscreen, with a mouse.**

## The scroll journey

1. **Preloader** → hero: magnetic buttons, depth-parallax orbs, click sparkles.
2. **Story** — pinned section; the manifesto words materialize as you scroll.
3. **Genesis (the 3D act)** — scroll-scrubbed WebGL in five phases:
   stardust → assembly → **exploded view with labeled internals**
   (opal globe, photon core, LED halo, cooling fins, speaker, logic board,
   brass dial & base) → reassembly → power-on while the room dims.
4. **Features** — hover the rows; a preview card chases your cursor.
5. **Moments** — vertical scroll becomes horizontal; five CSS-built lamp moods.
6. **Night** — stats, testimonial, and a midnight "WAKE UP brighter" preorder
   finale under stars, aurora and constellations that follow your cursor.

Throughout: the sky, text colors, sun/moon and the dream-clock (bottom-left)
are all driven by scroll position — the page is one full day.

## Handy URLs while presenting

| URL | What it does |
|---|---|
| `?p=0.30` | jump anywhere in the journey (`0`–`1`); `0.3–0.55` covers the 3D genesis |
| `?instant` | skip the preloader |
| `#genesis` / `#moments` / `#preorder` | deep-link a section |

Falls back gracefully: no WebGL → CSS product illustration; no JS → readable
static page; `prefers-reduced-motion` respected.
