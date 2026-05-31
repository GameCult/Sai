# Sai Eve Surface Module

`eve.js` is Sai's portable surface projection. It does not render the browser
DOM. It emits an Eve/CultMesh surface document whose `surface.root` is a
CultUI-shaped retained component tree.

Sai still owns Ink playback and visual-manifest interpretation. Eve owns the
portable control surface contract. Web DOM, UIKit, Android views, Direct2D, and
future renderers are projections of that contract.

## Module

```html
<script src="/static/sai/eve.js"></script>
```

```js
const surface = window.SaiEve.createVisualNovelSurface({
  providerId: "gamecult.home.vn",
  storyId: "gamecult-compound",
  title: "GameCult Compound",
  scene: {
    label: "Front Gate",
    background: "/static/interactive/cotsc-praxis/backgrounds/compound.png",
  },
  metadata: {
    knot: "hub",
    speaker: "Void",
  },
  speaker: "Void",
  line: "Pick a door. The map will keep accusing us of being real.",
  avatar: "/static/interactive/cotsc-praxis/avatars/void.png",
  sprites: [],
  domCards: [
    {
      key: "projects",
      title: "Project Atlas",
      selector: "#gamecult-vn-projects",
    },
  ],
  graph: {
    label: "GameCult Ink Knot Graph",
    layout: "norn.2d",
    solver_wasm: "/static/interactive/norn/norn-rs.wasm",
    placement: {
      space: "scene",
      anchor: "whiteboard",
      mode: "keystone",
      quad: [[0.16, 0.18], [0.58, 0.13], [0.62, 0.50], [0.14, 0.56]]
    },
    nodes: [
      { id: "hub", label: "Hub", target: "hub", x: 0, y: 0, current: true },
      { id: "eve", label: "Eve", target: "eve", x: 1, y: 0 },
    ],
    edges: [{ source: "hub", target: "eve" }],
  },
  tex: [
    {
      id: "bifrost-log-power",
      label: "Bifrost voting weight",
      source: "\\\\mathrm{votes}(p)=1+\\\\lfloor\\\\log_b(1+p)\\\\rfloor",
      placement: {
        space: "scene",
        anchor: "whiteboard",
        mode: "keystone"
      }
    }
  ],
  choices: [
    { text: "What is Eve trying to turn the web into?", targetPath: "eve" },
  ],
  style: {
    themeId: "gamecult.vn",
    colorAccent: "#ff8a2a",
    colorLink: "#59b7ff",
    pixelArt: true,
  },
});
```

The returned document uses `gamecult.eve.surface.v1`. Controls publish
`gamecult.eve.command.v1` command envelopes. Sai currently defines these command
names:

- `story.continue`
- `story.choose`
- `story.jump`
- `style.patch`

`style.patch` exists so native and web renderers can synchronize appearance
without each renderer inventing its own theme protocol. A renderer may expose
native color pickers, segmented controls, or accessibility settings, but the
accepted style state belongs to the provider and comes back as surface tokens.

## Embedded Scene Surfaces

The point of the Eve module is not to flatten Sai into a dashboard. A VN scene
can contain portable interactive surfaces that are diegetically placed inside
the scene. The graph map is one of those surfaces.

`embed.norn` declares that a renderer must embed a Norn graph runtime, not draw
a decorative graph lookalike. Web can use Norn WASM and `@gamecult/norn-viewer`;
native targets can use `norn-rs` directly or through a platform adapter.

`embed.tex` declares TeX/LaTeX content as a portable rich math/layout surface.
Web renderers may use KaTeX or another TeX path; native renderers should lower
the same source into their local text/vector stack.

Both kinds accept `placement`:

```json
{
  "space": "scene",
  "anchor": "whiteboard",
  "mode": "keystone",
  "quad": [[0.16, 0.18], [0.58, 0.13], [0.62, 0.50], [0.14, 0.56]],
  "chromaKey": { "color": "#00ff00", "tolerance": 0.12 },
  "occlusion": "sprite-mask:whiteboard-hand"
}
```

That is the hook for character-pointing-at-whiteboard shots, chromakey panels in
sprite assets, and perspective/skew/keystone fitting onto scene props.

## Component Kinds

The first VN surface uses:

- `vn.stage`
- `image.background`
- `embed.norn`
- `embed.tex`
- `layer.embedded-surfaces`
- `layer.sprites`
- `image.sprite`
- `layer.cards`
- `card.external`
- `panel.dialogue`
- `avatar`
- `text.dialogue`
- `rail.actions`
- `control.button`
- `inspector.kv`

Native renderers should preserve semantics first and choose platform-native
controls second. A Direct2D renderer does not need to imitate CSS boxes, but it
must preserve the same tree, commands, selection, and style tokens.
