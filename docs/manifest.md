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
      "avatar": "void.png"
    },
    "Aqua": {
      "name": "Aqua",
      "avatar": "aqua.png"
    }
  }
}
```

Useful Ink tags:

```ink
# scene: agora
# speaker: Void
# avatar: void
```

Sai resolves assets relative to `asset_base` unless the asset is already an
absolute URL or root-relative path.

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

This manifest is intentionally small. Sprite staging is the obvious next organ,
but it should extend the scene/speaker model instead of becoming a separate
runtime.
