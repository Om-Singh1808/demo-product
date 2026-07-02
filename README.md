# REVERIE® — a scroll from dawn to midnight

> **Second demo in this repo:** [`lumen/`](lumen/) — **LUMEN°**, a fictional product
> launch built in the same design language. Its centerpiece is a scroll-driven WebGL
> scene where a sunrise lamp assembles itself out of stardust, **explodes into its
> labeled internal parts**, reassembles, and powers on as the room dims. Run a local
> server (`python -m http.server`) and open `/lumen/`. Same deep-link hooks
> (`?p=`, `?instant`, `?bare`); the 3D runs on a locally vendored three.js — no CDN
> needed at pitch time. Genesis-section highlights sit around `?p=0.3–0.55`.

A demo website built to show what "capability" looks like: one continuous scroll
travels through an entire day. The sky re-colors itself, the sun sets, the moon and
stars rise, and a dream-clock ticks in the corner — while the content moves through
pinned scenes, horizontal galleries and canvas effects.

**Zero libraries. Zero templates. ~2,600 lines of hand-written HTML/CSS/JS.**

---

## Run it

Just open `index.html` in Chrome or Edge (double-click works — no build step, no server).
Internet is only needed for the Google Fonts; everything else is self-contained.

Best shown: **desktop Chrome/Edge, fullscreen (F11), with a mouse.**

## Demo script (the "wow" moments, in scroll order)

1. **Preloader** — counter + dreamy status lines, then the curtain lifts.
2. **Hero** — move the mouse: clouds and orbs drift at different depths.
   Hover the buttons (they're magnetic). Click anywhere: star burst. ✦
3. **Scroll slowly** — the whole site is one day. Watch the **clock (bottom-left)**
   and the sky: dawn → morning → noon → golden hour → dusk → midnight.
4. **Manifesto** — the section pins and the words materialize as you scroll.
5. **Craft** — hover the service rows: a preview card chases the cursor.
6. **Selected dreams** — vertical scroll becomes **horizontal**; each card is a
   hand-built CSS scene (no images) with its own inner parallax; hover for 3D tilt.
7. **By now it's night** — stars twinkle, an aurora breathes, shooting stars fly.
   Move the cursor near stars: it draws **constellations**.
8. **Stats** — playful counters (watch "curiosity" resolve to ∞).
9. **Contact** — giant type; hover the letters; the email button copies to clipboard.
10. Bonus: switch browser tabs and read the tab title. Open the console. 😴

## Deep links (handy while presenting)

| URL | What it does |
|---|---|
| `index.html#dreams` | jump straight to a section (`#manifesto`, `#craft`, `#night`, `#contact`) |
| `index.html?p=0.72` | open at any point of the journey, `0`–`1` (0.72 = dusk gallery) |
| `index.html?instant` | skip the preloader |
| `index.html?debug&p=0.6` | live engine numbers overlay (for development) |

## What's under the hood (talking points)

- **Custom smooth-scroll engine** — the page is a fixed, GPU-transformed layer eased
  toward the native scroll position (the same technique used by award-winning studio
  sites, written from scratch here).
- **Scroll-driven theming** — sky gradient, text ink, sun/moon position and the clock
  are all interpolated from keyframes by scroll progress.
- **Two canvas layers** — starfield (twinkle, parallax, constellations, shooting
  stars, daytime motes) behind the content; sparkle bursts and cursor stardust above it.
- **Scene pinning** — manifesto word-reveal and the horizontal gallery are pinned
  sections driven by the same scroll value, with velocity skew on the track.
- **Micro-interactions** — magnetic buttons, 3D tilt cards with glare, custom cursor
  with contextual labels, hover-chasing preview card, toasts, marquees, counters.
- **Craft details** — split-text reveals that still wrap correctly, `prefers-reduced-motion`
  support, keyboard/scrollbar friendly, self-healing layout cache on resize/zoom,
  graceful no-JS fallback, works on touch (effects degrade gracefully).

## Make it yours

- **Colors** — everything lives in CSS custom properties (`:root` in `css/style.css`)
  plus the `SKY` keyframes at the top of `js/main.js`.
- **Copy & sections** — plain semantic HTML in `index.html`.
- **Brand** — search for "reverie" and the contact email to rebrand.
