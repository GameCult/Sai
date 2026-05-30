# Visual Manifest

Sai's visual manifest is optional JSON that tells the player how Ink tags map
to images, avatars, scenes, slides, and references.

The manifest accepts snake_case or camelCase for the common base paths where the
older GameCult files already used both.

## Visual Novel Shape

```json
{
  "asset_base": "/static/stories/agora/",
  "default_scene": "agora",
  "scenes": {
    "agora": {
      "label": "The Aquarium Agora",
      "background": "agora-swarm.png"
    }
  },
  "speakers": {
    "Void": {
      "name": "Void",
      "avatar": "void.png",
      "default_sprite": "idle",
      "sprites": {
        "idle": "sprites/void-idle.png",
        "welcome": {
          "image": "sprites/void-welcome.png",
          "position": "left",
          "scale": 1.08
        }
      }
    },
    "Aqua": {
      "name": "Aqua",
      "avatar": "aqua.png",
      "sprites": {
        "idle": "sprites/aqua-idle.png",
        "listen": "sprites/aqua-listen.png"
      }
    }
  },
  "dom_cards": {
    "roadmap": {
      "title": "Roadmap",
      "selector": "#public-roadmap"
    },
    "receipts": {
      "title": "Receipts",
      "selector": "[data-sai-dom-source='receipts']"
    }
  }
}
```

Useful Ink tags:

```ink
# scene: agora
# speaker: Void
# avatar: void
# sprite: welcome@left
# sprites: Void.welcome@left, Aqua.listen@right
# dom: roadmap, receipts
```

Sai resolves assets relative to `asset_base` unless the asset is already an
absolute URL or root-relative path.

Sprite tags are optional. If no sprite tag is present, Sai tries to show the
current speaker's `default_sprite`, then `idle`, then `default`. Use
`# sprite: none` to hide sprites for a line. Use `# sprite:` for the current
speaker and `# sprites:` for a comma-separated stage composition. Sprite
references accept `expression@position`, `Actor.expression@position`, or
`Actor.expression:position`. Common positions are `farleft`, `left`,
`midleft`, `center`, `midright`, `right`, and `farright`.

The optional `dom_cards` map lets a visual-novel line stage existing page DOM
inside the scene. Each card points at a selector in the rendered document; Sai
clones that element into the stage, strips duplicate `id` attributes from the
clone, and leaves the original Quartz/HTML element in place as the canonical
fallback.

## Cinematic Shape

```json
{
  "image_base": "/static/stories/deck/",
  "default_caption": "The Room",
  "slides": [
    {
      "image": "slide-01.webp",
      "caption": "The Room",
      "references": [
        {
          "label": "Source note",
          "url": "https://example.com"
        }
      ]
    }
  ],
  "references_by_caption": {
    "The Room": [
      {
        "label": "Background reading",
        "url": "https://example.com"
      }
    ]
  }
}
```

Useful Ink tags:

```ink
# slide: 0
The first slide speaks.
```

References attached directly to a slide win. If a slide has no `references`,
Sai checks `references_by_caption` using the slide caption, then the manifest
default caption.

## Stability

This manifest is intentionally small. Sprite staging extends the scene/speaker
model; it is not a separate VN engine loop.
