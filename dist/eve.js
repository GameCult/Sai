(function (global) {
  const surfaceSchema = "gamecult.eve.surface.v1";
  const commandSchema = "gamecult.eve.command.v1";
  const providerKind = "sai.visual_novel";

  function nowIso() {
    return new Date().toISOString();
  }

  function compact(value) {
    if (Array.isArray(value)) return value.map(compact).filter(Boolean);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined || child === null || child === "") continue;
      if (Array.isArray(child) && child.length === 0) continue;
      result[key] = compact(child);
    }
    return result;
  }

  function component(id, kind, props = {}, children = []) {
    return compact({
      id,
      kind,
      props,
      children,
    });
  }

  function action(command, label, payload = {}) {
    return compact({
      schema: commandSchema,
      command,
      label,
      payload,
    });
  }

  function styleTokens(input = {}) {
    return {
      themeId: input.themeId || "sai.vn.default",
      tokens: {
        colorBackground: input.colorBackground || "#05080d",
        colorPanel: input.colorPanel || "rgba(5, 8, 13, 0.92)",
        colorPanelAlt: input.colorPanelAlt || "rgba(9, 14, 22, 0.82)",
        colorText: input.colorText || "#f6f1e2",
        colorMuted: input.colorMuted || "#b7c7d9",
        colorAccent: input.colorAccent || "#ff8a2a",
        colorLink: input.colorLink || "#59b7ff",
        radiusPanel: input.radiusPanel || 8,
        fontBody: input.fontBody || "Ubuntu",
        fontTitle: input.fontTitle || "Montserrat",
        pixelArt: input.pixelArt ?? true,
        motion: input.motion || "subtle",
      },
      controls: [
        {
          id: "theme.accent",
          kind: "color",
          label: "Accent",
          token: "colorAccent",
          command: "style.patch",
        },
        {
          id: "theme.panel",
          kind: "color",
          label: "Panel",
          token: "colorPanel",
          command: "style.patch",
        },
        {
          id: "theme.motion",
          kind: "select",
          label: "Motion",
          token: "motion",
          options: ["none", "subtle", "expressive"],
          command: "style.patch",
        },
      ],
    };
  }

  function graphComponent(graph = {}) {
    if (!graph.nodes?.length) return null;
    const rawXs = graph.nodes.map((node) => node.viewX ?? node.x ?? 0);
    const rawYs = graph.nodes.map((node) => node.viewY ?? node.y ?? 0);
    const minX = Math.min(...rawXs);
    const maxX = Math.max(...rawXs);
    const minY = Math.min(...rawYs);
    const maxY = Math.max(...rawYs);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const normalizeX = (value) =>
      value >= 0 && value <= 1 ? value : (value - minX) / spanX;
    const normalizeY = (value) =>
      value >= 0 && value <= 1 ? value : (value - minY) / spanY;

    return component(
      "sai.graph",
      "graph",
      {
        label: graph.label || "Ink knot graph",
        layout: graph.layout || "norn.2d",
        nodes: graph.nodes.map((node) =>
          compact({
            id: node.id,
            label: node.label || node.id,
            target: node.target || node.knot || node.id,
            x: normalizeX(node.viewX ?? node.x ?? 0),
            y: normalizeY(node.viewY ?? node.y ?? 0),
            rank: node.rank,
            order: node.order,
            current: Boolean(node.current),
            visited: Boolean(node.visited),
            available: Boolean(node.available),
            weight: node.weight,
          }),
        ),
        edges: graph.edges || [],
      },
      [],
    );
  }

  function spriteComponents(sprites = []) {
    return sprites.map((sprite, index) =>
      component(`sai.sprite.${sprite.actorName || index}`, "image.sprite", {
        actor: sprite.actorName,
        expression: sprite.expression || "default",
        src: sprite.image || sprite.src,
        alt: sprite.alt,
        slot: sprite.position || "center",
        scale: sprite.scale || 1,
        offsetX: sprite.offsetX || 0,
        offsetY: sprite.offsetY || 0,
      }),
    );
  }

  function domCardComponents(cards = []) {
    return cards.map((card) =>
      component(`sai.card.${card.key}`, "card.external", {
        key: card.key,
        title: card.title || card.label,
        selector: card.selector,
        htmlRef: card.htmlRef,
        mode: "provider-owned-fragment",
      }),
    );
  }

  function choiceComponents(choices = []) {
    return choices.map((choice, index) =>
      component(`sai.choice.${choice.id || index}`, "control.button", {
        label: choice.text || choice.label,
        primary: index === 0,
        action: action("story.choose", choice.text || choice.label, {
          index,
          targetPath: choice.targetPath,
        }),
      }),
    );
  }

  function variableComponents(variables = []) {
    if (!variables.length) return null;
    return component(
      "sai.variables",
      "inspector.kv",
      {
        title: "Story Variables",
        items: variables.map((item) => ({
          key: item.name,
          value: item.value,
        })),
      },
      [],
    );
  }

  function createVisualNovelSurface(input = {}) {
    const metadata = input.metadata || {};
    const style = styleTokens(input.style || input.styleTokens || {});
    const scene = input.scene || {};
    const speaker = input.speaker || metadata.speaker || "Void";
    const line = input.line || "";
    const title = input.title || scene.label || "Sai Visual Novel";
    const graph = graphComponent(input.graph);
    const variables = variableComponents(input.variables || []);

    const stageChildren = [
      component("sai.background", "image.background", {
        src: input.background || scene.background,
        label: scene.label,
        fit: "cover",
        pixelArt: style.tokens.pixelArt,
      }),
      graph,
      component("sai.sprites", "layer.sprites", {}, spriteComponents(input.sprites)),
      component("sai.cards", "layer.cards", {}, domCardComponents(input.domCards)),
      component(
        "sai.dialogue",
        "panel.dialogue",
        {
          speaker,
          avatar: input.avatar,
          text: line,
          scene: scene.label || metadata.scene,
        },
        [
          component("sai.dialogue.avatar", "avatar", {
            src: input.avatar,
            label: speaker,
          }),
          component("sai.dialogue.text", "text.dialogue", {
            speaker,
            text: line,
          }),
        ],
      ),
      component("sai.choices", "rail.actions", {}, choiceComponents(input.choices)),
      variables,
    ].filter(Boolean);

    return compact({
      type: "surface-state",
      schema: surfaceSchema,
      providerKind,
      providerId: input.providerId || "sai.vn",
      title,
      version: input.version || 1,
      updatedAt: input.updatedAt || nowIso(),
      surface: {
        id: input.surfaceId || "sai.visual_novel.surface",
        root: component(
          "sai.root",
          "vn.stage",
          {
            mode: "visual-novel",
            storyId: input.storyId,
            currentPath: input.currentPath || metadata.knot || metadata.route,
            style: style.themeId,
          },
          stageChildren,
        ),
        styles: style,
      },
      selection: {
        currentPath: input.currentPath || metadata.knot || metadata.route,
        speaker,
      },
      commands: [
        action("story.continue", "Continue"),
        action("story.choose", "Choose", { index: 0 }),
        action("story.jump", "Jump to knot", { targetPath: "" }),
        action("style.patch", "Patch style", { token: "", value: "" }),
      ],
      assets: input.assets || [],
      detail: {
        source: "Sai Eve module",
        notes:
          "This document is a retained CultUI surface. Renderers project it to DOM, UIKit, Android views, Direct2D, or other native controls.",
      },
    });
  }

  function createCommand(command, payload = {}, options = {}) {
    return compact({
      type: "surface-command",
      schema: commandSchema,
      providerId: options.providerId || "sai.vn",
      surfaceId: options.surfaceId || "sai.visual_novel.surface",
      command,
      payload,
      issuedAt: options.issuedAt || nowIso(),
      clientId: options.clientId,
    });
  }

  function createStylePatch(token, value, options = {}) {
    return createCommand("style.patch", { token, value }, options);
  }

  const api = {
    version: "0.1.0",
    surfaceSchema,
    commandSchema,
    createVisualNovelSurface,
    createCommand,
    createStylePatch,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.SaiEve = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
