# Sai

**Ink stories that wake up inside static sites.**

Sai is a small browser embedder for compiled Ink stories. It is not an Ink
engine; it uses `inkjs` for that. Sai owns the article-shaped part: loading a
story into an existing page, reading a visual manifest, rendering transcript,
visual-novel, or cinematic layouts, and staying pleasant to drop into Quartz,
Eleventy, Astro, Hugo, plain HTML, or whatever shrine of markup you dragged
home at midnight.

The name is the pitch: ink that becomes a living scene.

## Why Sai Exists

Most Ink web players answer: "Can I play this story in a browser?"

Sai answers: "Can this story become part of a page?"

It is for interactive essays, lore posts, documentation rituals, cheap visual
novels, pitch decks, character sermons, branching articles, and other story
objects that want to live inside a site instead of becoming a separate web app.

## Quick Start

Copy the built files from `dist/` into your site's static assets:

```text
sai.js
sai.css
ink.js
```

Add the assets to a page:

```html
<link rel="stylesheet" href="/static/sai/sai.css" />
<script defer src="/static/sai/sai.js"></script>
```

Embed a story:

```html
<div
  class="sai-player"
  data-ink-format="visual-novel"
  data-ink-story="/stories/agora/story.ink.json"
  data-visual-manifest="/stories/agora/visual-manifest.json"
  data-scene-label="The Aquarium Agora"
></div>
```

Sai auto-initialises every `.sai-player` when the document loads. It also
listens for Quartz-style `nav` events after client-side page swaps.

## Formats

### Raven

```html
<div class="sai-player" data-ink-story="/story.ink.json"></div>
```

The default format is a compact interactive-fiction transcript. It is the
simplest Raven Collective-style shape: text, choices, variables when useful,
and no stage machinery.

### Visual Novel

```html
<div
  class="sai-player"
  data-ink-format="visual-novel"
  data-ink-story="/story.ink.json"
  data-visual-manifest="/visual-manifest.json"
></div>
```

Visual-novel mode renders one scene image, a fixed dialogue bar, speaker avatar,
speaker name, line text, optional DOM cards, and a right-side option rail. Ink
tags drive the speaker, scene, and staged page elements:

```ink
# speaker: Void
# scene: agora
# avatar: void
# dom: roadmap, receipts
The world is full of systems that say one thing and reward another.
```

The `dom` tag reads card definitions from the visual manifest and clones
matching page DOM into the scene stage. This is for static-site tours where the
story frames canonical Quartz/HTML content without making the story file a
second source of truth.

### Cinematic

```html
<div
  class="sai-player"
  data-ink-format="cinematic"
  data-ink-story="/deck.ink.json"
  data-visual-manifest="/deck.visual-manifest.json"
></div>
```

Cinematic mode is for slide/deck-like fragments: background plates, captions,
references, and short blocks of text.

## Data Attributes

- `data-ink-story`: required URL for compiled Ink JSON.
- `data-ink-format`: `raven`, `visual-novel`, or `cinematic`.
- `data-visual-manifest`: optional visual manifest URL.
- `data-scene-label`: optional fallback scene label for visual-novel mode.
- `data-ink-title`: optional player title/status text.
- `data-ink-runtime`: optional URL for `ink.js`.
- `data-sai-runtime`: alias for `data-ink-runtime`.
- `data-show-variables="true"`: show Ink variables in visual modes.

Legacy `.aetheria-ink-player` containers are still initialised so existing
GameCult pages can migrate without ritual screaming. New work should use
`.sai-player`.

## JavaScript API

```js
window.Sai.init(document.querySelector(".sai-player"));
window.Sai.initAll();
console.log(window.Sai.version);
```

By default, `sai.js` loads `ink.js` from the same directory as itself. Override
that with `data-ink-runtime`, `data-sai-runtime`, or `window.Sai.runtimeSrc`.

## Visual Manifest

See [docs/manifest.md](docs/manifest.md).

## Development

```powershell
npm install
npm run build
npm run check
```

Compile the example story after dependencies are installed:

```powershell
npm run compile:example
```

Open `examples/static-site/index.html` through a local static server. Browsers
are right to dislike `fetch()` from `file://`; do not take it personally.

## Boundary

Sai owns:

- browser-side Ink loading through `inkjs`
- player DOM and mode rendering
- visual manifest interpretation
- default CSS and theme variables
- static-site auto-init

Sai does not own:

- authoring Ink
- compiling `.ink` to `.ink.json`
- Quartz page chrome
- GameCult-specific assets, lore, or characters
- a full VN/game engine loop

The brush is sharp. The painting is yours.
