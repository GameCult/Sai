(function () {
  const version = "0.1.0";
  const defaultRuntimeSrc = new URL(
    "ink.js",
    document.currentScript?.src || document.baseURI,
  ).href;
  let inkRuntimePromise = null;

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function resolveInkMode(container) {
    const rawMode = (
      container.dataset.inkFormat ||
      container.dataset.inkMode ||
      "raven"
    )
      .trim()
      .toLowerCase();

    if (
      [
        "visual-novel",
        "visual_novel",
        "vn",
        "speaker",
        "speaker-panel",
      ].includes(rawMode)
    ) {
      return "speaker-panel";
    }

    if (["cinematic", "deck", "slides", "slide"].includes(rawMode)) {
      return "cinematic";
    }

    return "raven";
  }

  function resolveDefaultRuntimeSrc() {
    return defaultRuntimeSrc;
  }

  function resolveRuntimeSrc(container) {
    return (
      container.dataset.inkRuntime ||
      container.dataset.saiRuntime ||
      window.Sai?.runtimeSrc ||
      resolveDefaultRuntimeSrc()
    );
  }

  function ensureInkRuntime(container) {
    if (window.inkjs && window.inkjs.Story) return Promise.resolve();
    if (inkRuntimePromise) return inkRuntimePromise;

    inkRuntimePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-sai-runtime="true"]',
      );
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("inkjs runtime failed to load")),
          {
            once: true,
          },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = resolveRuntimeSrc(container);
      script.defer = true;
      script.dataset.saiRuntime = "true";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("inkjs runtime failed to load")),
        {
          once: true,
        },
      );
      document.head.appendChild(script);
    });

    return inkRuntimePromise;
  }

  function formatVariableValue(value) {
    if (value === true) return "true";
    if (value === false) return "false";
    if (value === null || value === undefined) return "unset";
    return String(value);
  }

  function collectVariables(story) {
    const state = story.variablesState || {};
    return Object.keys(state)
      .filter(
        (name) =>
          !name.startsWith("_") &&
          name !== "$" &&
          typeof state[name] !== "function",
      )
      .sort()
      .map((name) => ({
        name,
        value: state[name],
      }));
  }

  function renderVariables(story, target) {
    const variables = collectVariables(story);
    target.replaceChildren();
    if (variables.length === 0) return;

    for (const variable of variables) {
      const chip = createElement("span", "sai-variable");
      chip.append(createElement("span", "sai-variable-name", variable.name));
      chip.append(
        createElement(
          "span",
          "sai-variable-value",
          formatVariableValue(variable.value),
        ),
      );
      target.append(chip);
    }
  }

  async function loadVisualManifest(container) {
    const manifestSrc = container.dataset.visualManifest;
    if (!manifestSrc) return null;

    const response = await fetch(manifestSrc);
    if (!response.ok) {
      throw new Error(`could not fetch ${manifestSrc}: ${response.status}`);
    }

    return response.json();
  }

  function resolveSlideUrl(manifest, slide) {
    if (!manifest || !slide) return "";
    const base = manifest.image_base || "";
    return `${base}${slide.image || ""}`;
  }

  function createCinematicStage() {
    const stage = createElement("div", "sai-cinematic-stage");
    const visual = createElement("div", "sai-visual");
    const plateA = createElement("div", "sai-visual-plate is-active");
    const plateB = createElement("div", "sai-visual-plate");
    const scrim = createElement("div", "sai-visual-scrim");
    const caption = createElement("p", "sai-visual-caption");
    const references = createElement("aside", "sai-slide-references");
    const section = createElement("div", "sai-section");
    const sectionText = createElement("div", "sai-section-text");

    visual.append(plateA, plateB, scrim, caption, references);
    section.append(sectionText);
    stage.append(visual, section);

    return {
      stage,
      plateA,
      plateB,
      caption,
      references,
      sectionText,
      activePlate: plateA,
      inactivePlate: plateB,
      slideIndex: -1,
    };
  }

  function resolveSlideReferences(manifest, slide) {
    if (!manifest || !slide) return [];
    if (Array.isArray(slide.references)) return slide.references;
    const referenceSets =
      manifest.references_by_caption || manifest.referencesByCaption || {};
    const byCaption =
      referenceSets[slide.caption || manifest.default_caption || ""];
    return Array.isArray(byCaption) ? byCaption : [];
  }

  function renderSlideReferences(target, references) {
    target.replaceChildren();
    if (!references || references.length === 0) {
      target.hidden = true;
      return;
    }

    target.hidden = false;
    target.append(
      createElement("p", "sai-slide-references-title", "References"),
    );

    const list = createElement("ul", "sai-slide-references-list");
    for (const reference of references) {
      const item = createElement("li");
      const label =
        reference.label || reference.title || reference.url || "Reference";
      if (reference.url) {
        const link = createElement("a", "", label);
        link.href = reference.url;
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        item.append(link);
      } else {
        item.textContent = label;
      }
      list.append(item);
    }
    target.append(list);
  }

  function setCinematicSlide(stageState, manifest, index) {
    if (
      !stageState ||
      !manifest ||
      !Array.isArray(manifest.slides) ||
      manifest.slides.length === 0
    ) {
      return;
    }

    const clamped = Math.min(Math.max(index, 0), manifest.slides.length - 1);
    if (stageState.slideIndex === clamped) return;

    const slide = manifest.slides[clamped];
    const nextPlate = stageState.inactivePlate;
    nextPlate.style.backgroundImage = `url("${resolveSlideUrl(manifest, slide)}")`;
    nextPlate.classList.add("is-active");
    stageState.activePlate.classList.remove("is-active");

    const previous = stageState.activePlate;
    stageState.activePlate = nextPlate;
    stageState.inactivePlate = previous;
    stageState.slideIndex = clamped;
    stageState.caption.textContent =
      slide.caption || manifest.default_caption || "";
    renderSlideReferences(
      stageState.references,
      resolveSlideReferences(manifest, slide),
    );
  }

  function renderCinematicText(stageState, text) {
    stageState.sectionText.replaceChildren();
    const paragraph = createElement("p", "sai-line", text);
    stageState.sectionText.append(paragraph);

    stageState.sectionText.classList.remove("is-entering");
    // Force a reflow so repeated sections replay the transition.
    void stageState.sectionText.offsetWidth;
    stageState.sectionText.classList.add("is-entering");
  }

  function resolveManifestAsset(manifest, asset) {
    if (!asset) return "";
    if (/^(https?:)?\/\//.test(asset) || asset.startsWith("/")) return asset;
    const base = manifest?.asset_base || manifest?.image_base || "";
    return `${base}${asset}`;
  }

  function parseTags(tags) {
    const parsed = {};
    for (const tag of tags || []) {
      const separator = tag.indexOf(":");
      if (separator === -1) continue;
      const key = tag.slice(0, separator).trim().toLowerCase();
      const value = tag.slice(separator + 1).trim();
      if (key && value) parsed[key] = value;
    }
    return parsed;
  }

  function createSpeakerStage() {
    const stage = createElement("div", "sai-speaker-stage");
    const background = createElement("div", "sai-speaker-background");
    const scrim = createElement("div", "sai-speaker-scrim");
    const sceneLabel = createElement("p", "sai-speaker-scene");
    const graphLayer = createElement("div", "sai-graph-layer");
    const spriteLayer = createElement("div", "sai-sprite-layer");
    const domLayer = createElement("div", "sai-dom-layer");
    const card = createElement("div", "sai-speaker-card");
    const avatarShell = createElement("div", "sai-speaker-avatar-shell");
    const avatar = document.createElement("img");
    const body = createElement("div", "sai-speaker-body");
    const name = createElement("p", "sai-speaker-name");
    const line = createElement("p", "sai-speaker-line");
    const controls = createElement("div", "sai-speaker-controls");

    avatar.className = "sai-speaker-avatar";
    avatar.loading = "lazy";
    avatar.decoding = "async";

    avatarShell.append(avatar);
    body.append(name, line);
    card.append(avatarShell, body);
    graphLayer.hidden = true;
    spriteLayer.hidden = true;
    domLayer.hidden = true;
    stage.append(
      background,
      scrim,
      graphLayer,
      spriteLayer,
      sceneLabel,
      domLayer,
      controls,
      card,
    );

    return {
      stage,
      background,
      sceneLabel,
      graphLayer,
      spriteLayer,
      domLayer,
      card,
      avatar,
      name,
      line,
      controls,
      backgroundSet: false,
      backgroundKey: "",
      graphLayoutPromise: null,
      graphLayout: null,
      lastMetadata: {},
    };
  }

  function resolveActor(manifest, actorName) {
    if (!actorName) return null;
    return (
      manifest?.actors?.[actorName] ||
      manifest?.actors?.[actorName.toLowerCase?.()] ||
      manifest?.speakers?.[actorName] ||
      manifest?.speakers?.[actorName.toLowerCase?.()] ||
      null
    );
  }

  function resolveActorKey(manifest, actorName) {
    if (!actorName) return "";
    const actorMaps = [manifest?.actors || {}, manifest?.speakers || {}];
    for (const actors of actorMaps) {
      const key = Object.keys(actors).find(
        (candidate) => candidate.toLowerCase() === actorName.toLowerCase(),
      );
      if (key) return key;
    }
    return actorName;
  }

  function parseSpriteReference(manifest, rawReference, fallbackSpeaker) {
    const raw = (rawReference || "").trim();
    if (!raw) return null;

    const withoutHash = raw.startsWith("#") ? raw.slice(1).trim() : raw;
    if (["none", "clear", "off", "hide"].includes(withoutHash.toLowerCase())) {
      return { hidden: true };
    }

    const [identityPart, positionPart] = withoutHash.split("@", 2);
    const [subjectPart, colonPosition] = identityPart.split(":", 2);
    const position = (positionPart || colonPosition || "").trim();
    const actorNames = Object.keys({
      ...(manifest?.actors || {}),
      ...(manifest?.speakers || {}),
    }).sort((a, b) => b.length - a.length);
    const actorPrefix = actorNames.find((name) =>
      subjectPart.toLowerCase().startsWith(`${name.toLowerCase()}.`),
    );

    let actor = fallbackSpeaker;
    let expression = subjectPart.trim();
    if (actorPrefix) {
      actor = actorPrefix;
      expression = subjectPart.slice(actorPrefix.length + 1).trim();
    } else {
      const separator = subjectPart.indexOf(".");
      if (separator !== -1) {
        actor = subjectPart.slice(0, separator).trim();
        expression = subjectPart.slice(separator + 1).trim();
      }
    }

    return {
      actor: resolveActorKey(manifest, actor || fallbackSpeaker),
      expression: expression || "default",
      position: position || "",
    };
  }

  function resolveSpriteEntry(actor, expression) {
    if (!actor) return null;
    const sprites = actor.sprites || {};
    const key = expression || actor.default_sprite || actor.defaultSprite || "idle";
    return (
      sprites[key] ||
      sprites[key?.toLowerCase?.()] ||
      sprites.default ||
      sprites.idle ||
      actor.sprite ||
      actor.default_sprite ||
      actor.defaultSprite ||
      null
    );
  }

  function normaliseSpriteEntry(entry) {
    if (!entry) return null;
    if (typeof entry === "string") {
      return { image: entry };
    }
    if (entry.image || entry.src) {
      return { ...entry, image: entry.image || entry.src };
    }
    return null;
  }

  function resolveSpriteRequests(manifest, metadata) {
    const speaker = metadata.speaker || "Void";
    const rawSprites = metadata.sprites || metadata.characters || "";
    const rawSprite = metadata.sprite || "";
    const explicit = rawSprites || rawSprite;

    const parsed = explicit
      ? explicit
          .split(",")
          .map((token) => parseSpriteReference(manifest, token, speaker))
          .filter(Boolean)
      : [parseSpriteReference(manifest, "default", speaker)];

    if (parsed.some((request) => request.hidden)) return [];

    return parsed
      .map((request, index) => {
        const actorName = request.actor || speaker;
        const actor = resolveActor(manifest, actorName);
        const entry = normaliseSpriteEntry(
          resolveSpriteEntry(actor, request.expression),
        );
        if (!entry?.image) return null;

        return {
          actorName,
          expression: request.expression,
          image: resolveManifestAsset(manifest, entry.image),
          alt:
            entry.alt ||
            `${actor?.name || actorName} ${request.expression || "sprite"}`,
          position:
            request.position ||
            entry.position ||
            actor?.position ||
            (parsed.length === 1 ? "center" : index === 0 ? "left" : "right"),
          scale: entry.scale || actor?.sprite_scale || actor?.spriteScale || 1,
          offsetX: entry.offset_x || entry.offsetX || 0,
          offsetY: entry.offset_y || entry.offsetY || 0,
        };
      })
      .filter(Boolean);
  }

  function renderSpeakerSprites(stageState, manifest, metadata) {
    if (!stageState.spriteLayer) return;

    const sprites = resolveSpriteRequests(manifest, metadata);
    stageState.spriteLayer.replaceChildren();
    stageState.spriteLayer.hidden = sprites.length === 0;
    stageState.stage.classList.toggle("has-sprites", sprites.length > 0);

    for (const sprite of sprites) {
      const figure = createElement("figure", "sai-sprite");
      const image = document.createElement("img");
      const position = sprite.position.toLowerCase().replace(/[^a-z0-9_-]/g, "");

      figure.dataset.saiActor = sprite.actorName;
      figure.dataset.saiExpression = sprite.expression || "default";
      figure.dataset.saiPosition = position || "center";
      figure.style.setProperty("--sai-sprite-scale", String(sprite.scale));
      figure.style.setProperty("--sai-sprite-offset-x", `${sprite.offsetX}px`);
      figure.style.setProperty("--sai-sprite-offset-y", `${sprite.offsetY}px`);

      image.className = "sai-sprite-image";
      image.src = sprite.image;
      image.alt = sprite.alt;
      image.loading = "lazy";
      image.decoding = "async";
      figure.append(image);
      stageState.spriteLayer.append(figure);
    }

    stageState.spriteLayer.classList.remove("is-entering");
    void stageState.spriteLayer.offsetWidth;
    stageState.spriteLayer.classList.add("is-entering");
  }

  function setSpeakerBackground(stageState, manifest, container, metadata) {
    const background = manifest?.background || {};
    const sceneKey =
      metadata?.scene ||
      container.dataset.scene ||
      manifest?.default_scene ||
      "";
    const scene =
      (sceneKey &&
        (manifest?.scenes?.[sceneKey] ||
          manifest?.scenes?.[sceneKey.toLowerCase?.()])) ||
      {};
    const image =
      container.dataset.backgroundImage ||
      scene.background ||
      scene.image ||
      background.image ||
      manifest?.background_image ||
      manifest?.backgroundImage ||
      "";
    const label =
      container.dataset.sceneLabel ||
      scene.label ||
      scene.caption ||
      background.caption ||
      manifest?.default_caption ||
      "";
    const backgroundKey = `${image}|${label}`;
    if (stageState.backgroundSet && stageState.backgroundKey === backgroundKey)
      return;

    if (image) {
      stageState.background.style.backgroundImage = `url("${resolveManifestAsset(manifest, image)}")`;
    }

    stageState.sceneLabel.textContent = label;
    stageState.sceneLabel.hidden =
      stageState.sceneLabel.textContent.length === 0;
    stageState.backgroundSet = true;
    stageState.backgroundKey = backgroundKey;
  }

  function resolveSpeakerAvatar(manifest, speaker, taggedAvatar) {
    const actor =
      manifest?.actors?.[speaker] ||
      manifest?.actors?.[speaker?.toLowerCase?.()] ||
      manifest?.speakers?.[speaker] ||
      manifest?.speakers?.[speaker?.toLowerCase?.()];
    if (actor?.avatar) return resolveManifestAsset(manifest, actor.avatar);
    if (taggedAvatar && manifest?.avatars?.[taggedAvatar]) {
      return resolveManifestAsset(manifest, manifest.avatars[taggedAvatar]);
    }
    if (
      taggedAvatar &&
      (taggedAvatar.startsWith("/") || /^(https?:)?\/\//.test(taggedAvatar))
    ) {
      return taggedAvatar;
    }
    return "";
  }

  function normaliseDomKey(value) {
    return (value || "").trim().toLowerCase();
  }

  function resolveDomCards(manifest, metadata) {
    const cards = manifest?.dom_cards || manifest?.domCards || {};
    const rawKeys = metadata.dom || metadata.card || metadata.cards || "";
    const keys = rawKeys
      .split(",")
      .map(normaliseDomKey)
      .filter(Boolean);

    return keys
      .map((key) => {
        const card = cards[key];
        if (!card || !card.selector) return null;
        return {
          key,
          selector: card.selector,
          title: card.title || card.label || "",
        };
      })
      .filter(Boolean);
  }

  function stripDuplicateIds(element) {
    element.removeAttribute?.("id");
    element
      .querySelectorAll?.("[id]")
      .forEach((child) => child.removeAttribute("id"));
  }

  function renderDomCards(stageState, manifest, metadata) {
    if (!stageState.domLayer) return;

    const cards = resolveDomCards(manifest, metadata);
    stageState.domLayer.replaceChildren();
    stageState.domLayer.hidden = cards.length === 0;
    stageState.stage.classList.toggle("has-dom-cards", cards.length > 0);

    for (const card of cards) {
      const source = document.querySelector(card.selector);
      if (!source) continue;

      const shell = createElement("section", "sai-dom-card");
      shell.dataset.saiDomKey = card.key;
      if (card.title) {
        shell.append(createElement("p", "sai-dom-card-title", card.title));
      }

      const body = createElement("div", "sai-dom-card-body");
      const clone = source.cloneNode(true);
      stripDuplicateIds(clone);
      clone.removeAttribute?.("data-sai-dom-source");
      body.append(clone);
      shell.append(body);
      stageState.domLayer.append(shell);
    }

    stageState.domLayer.classList.remove("is-entering");
    void stageState.domLayer.offsetWidth;
    stageState.domLayer.classList.add("is-entering");
  }

  function resolveAdventureGraph(manifest) {
    return manifest?.adventure_graph || manifest?.adventureGraph || null;
  }

  function graphNodeKey(node) {
    return (node?.id || node?.knot || node?.target || node?.label || "")
      .trim()
      .toLowerCase();
  }

  function currentStoryKnot(metadata) {
    return (metadata.knot || metadata.route || metadata.scene || "")
      .trim()
      .toLowerCase();
  }

  function choiceTargetPath(choice) {
    const target = choice?.targetPath;
    if (!target) return "";
    if (typeof target.componentsString === "string") return target.componentsString;
    if (typeof target.toString === "function") return target.toString();
    return String(target);
  }

  function availableTargets(story) {
    return new Set(
      story.currentChoices
        .map((choice) => {
          const target = choiceTargetPath(choice);
          return typeof target === "string" ? target.toLowerCase() : "";
        })
        .filter(Boolean),
    );
  }

  function decodeBase64Bytes(value) {
    const maybeBuffer = globalThis.Buffer;
    const binary =
      typeof atob === "function"
        ? atob(value)
        : maybeBuffer?.from(value, "base64").toString("binary");
    if (!binary) {
      throw new Error("No base64 decoder is available for Norn graph solver.");
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  async function loadNornSolver(manifest, graph) {
    if (!graph?.solver_wasm && !graph?.solverWasm && !graph?.solver_wasm_base64) {
      throw new Error("Adventure graph is missing solver_wasm.");
    }

    const source = graph.solver_wasm || graph.solverWasm;
    const bytes = graph.solver_wasm_base64
      ? decodeBase64Bytes(graph.solver_wasm_base64)
      : await fetch(resolveManifestAsset(manifest, source)).then((response) => {
          if (!response.ok) {
            throw new Error(`could not fetch Norn solver: ${response.status}`);
          }
          return response.arrayBuffer();
        });

    const result = await WebAssembly.instantiate(bytes, {});
    const exports = result.instance.exports;
    const required = [
      "memory",
      "norn_graph_alloc_f32",
      "norn_graph_dealloc_f32",
      "norn_graph_alloc_u32",
      "norn_graph_dealloc_u32",
      "norn_graph_layout_2d",
    ];
    for (const name of required) {
      if (!exports[name]) {
        throw new Error(`Norn solver wasm is missing ${name}.`);
      }
    }
    return exports;
  }

  function normaliseGraphEdges(nodes, edges) {
    const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
    return (edges || [])
      .map((edge) => {
        const source = edge.source ?? edge.from;
        const target = edge.target ?? edge.to;
        if (!nodeIndex.has(source) || !nodeIndex.has(target)) return null;
        return [nodeIndex.get(source), nodeIndex.get(target)];
      })
      .filter(Boolean)
      .flat();
  }

  async function layoutAdventureGraph(stageState, manifest) {
    const graph = resolveAdventureGraph(manifest);
    const nodes = graph?.nodes || [];
    if (!graph || nodes.length === 0) return null;

    if (!stageState.graphLayoutPromise) {
      stageState.graphLayoutPromise = (async () => {
        const solver = await loadNornSolver(manifest, graph);
        const weights = new Float32Array(
          nodes.map((node) => Number(node.weight || 1)),
        );
        const edgePairs = new Uint32Array(
          normaliseGraphEdges(nodes, graph.edges || []),
        );
        const nodeCount = weights.length;
        const edgeCount = edgePairs.length / 2;
        const nodeWeightsPtr = solver.norn_graph_alloc_f32(nodeCount);
        const edgePairsPtr = solver.norn_graph_alloc_u32(edgePairs.length);
        const outputPtr = solver.norn_graph_alloc_f32(nodeCount * 4);

        try {
          new Float32Array(solver.memory.buffer, nodeWeightsPtr, nodeCount).set(
            weights,
          );
          new Uint32Array(
            solver.memory.buffer,
            edgePairsPtr,
            edgePairs.length,
          ).set(edgePairs);

          const status = solver.norn_graph_layout_2d(
            nodeWeightsPtr,
            nodeCount,
            edgePairsPtr,
            edgeCount,
            outputPtr,
            Number(graph.iterations || 180),
            Number(graph.rank_gap || graph.rankGap || 150),
            Number(graph.node_gap || graph.nodeGap || 80),
            Number(graph.edge_length || graph.edgeLength || 120),
          );
          if (status !== 0) {
            throw new Error(`Norn solver failed with status ${status}.`);
          }

          const raw = new Float32Array(
            solver.memory.buffer,
            outputPtr,
            nodeCount * 4,
          );
          return nodes.map((node, index) => ({
            ...node,
            x: raw[index * 4],
            y: raw[index * 4 + 1],
            rank: raw[index * 4 + 2],
            order: raw[index * 4 + 3],
          }));
        } finally {
          solver.norn_graph_dealloc_f32(nodeWeightsPtr, nodeCount);
          solver.norn_graph_dealloc_u32(edgePairsPtr, edgePairs.length);
          solver.norn_graph_dealloc_f32(outputPtr, nodeCount * 4);
        }
      })();
    }

    stageState.graphLayout = await stageState.graphLayoutPromise;
    return stageState.graphLayout;
  }

  function graphViewport(graph) {
    return {
      width: Number(graph?.viewport_width || graph?.viewportWidth || 760),
      height: Number(graph?.viewport_height || graph?.viewportHeight || 420),
      pad: Number(graph?.viewport_padding || graph?.viewportPadding || 68),
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function projectGraphNodes(nodes, graph) {
    if (!nodes || nodes.length === 0) return [];
    if (
      nodes.some(
        (node) => typeof node.x !== "number" || typeof node.y !== "number",
      )
    ) {
      return [];
    }
    const minX = Math.min(...nodes.map((node) => node.x));
    const maxX = Math.max(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxY = Math.max(...nodes.map((node) => node.y));
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const { width, height, pad } = graphViewport(graph);

    return nodes.map((node) => ({
      ...node,
      viewX: pad + ((node.x - minX) / spanX) * (width - pad * 2),
      viewY: pad + ((node.y - minY) / spanY) * (height - pad * 2),
    }));
  }

  function graphNodeRadius(node) {
    if (node.radius) return Number(node.radius);
    if (node.core) return 26;
    return Number(node.weight || 1) <= 0.7 ? 12 : 18;
  }

  function graphNodeFontSize(node) {
    if (node.label_size || node.labelSize) {
      return Number(node.label_size || node.labelSize);
    }
    if (node.core) return 15;
    return Number(node.weight || 1) <= 0.7 ? 10.5 : 12.5;
  }

  function graphDistortionSettings(graph, viewport) {
    const defaultRadius = Math.min(viewport.width, viewport.height) * 0.52;
    return {
      radius: Number(
        graph?.focus_distortion_radius || graph?.focusDistortionRadius || defaultRadius,
      ),
      strength: Number(
        graph?.focus_distortion_strength || graph?.focusDistortionStrength || 0.24,
      ),
      padding: Number(
        graph?.focus_distortion_padding || graph?.focusDistortionPadding || 26,
      ),
      cursorRadius: Number(
        graph?.focus_distortion_cursor_radius ||
          graph?.focusDistortionCursorRadius ||
          Math.min(viewport.width, viewport.height) * 0.17,
      ),
      cursorDeadZone: Number(
        graph?.focus_distortion_cursor_dead_zone ||
          graph?.focusDistortionCursorDeadZone ||
          Math.min(viewport.width, viewport.height) * 0.06,
      ),
    };
  }

  function explorationCentroid(activePoint, cursorPoint) {
    if (!activePoint) return cursorPoint;
    return {
      x: (activePoint.x + cursorPoint.x) / 2,
      y: (activePoint.y + cursorPoint.y) / 2,
    };
  }

  function distortGraphPoint(point, centroid, cursorPoint, viewport, graph) {
    const { radius, strength, padding, cursorRadius, cursorDeadZone } =
      graphDistortionSettings(graph, viewport);
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.0001) return { ...point };

    const falloff = 1 - smoothstep(radius * 0.12, radius, distance);
    const cursorDistance = Math.hypot(point.x - cursorPoint.x, point.y - cursorPoint.y);
    const cursorTaper = smoothstep(cursorDeadZone, cursorRadius, cursorDistance);
    const push =
      radius *
      strength *
      falloff *
      cursorTaper *
      (1 - Math.min(distance / radius, 1) * 0.32);
    const x = point.x + (dx / distance) * push;
    const y = point.y + (dy / distance) * push;
    return {
      x: clamp(x, padding, viewport.width - padding),
      y: clamp(y, padding, viewport.height - padding),
    };
  }

  function applyGraphAttention(nodeElements, edgeElements, viewport, graph, cursorPoint, activePoint) {
    const focus = explorationCentroid(activePoint, cursorPoint);
    const radius = Math.min(viewport.width, viewport.height);
    for (const item of nodeElements) {
      const distorted = distortGraphPoint(
        { x: item.node.viewX, y: item.node.viewY },
        focus,
        cursorPoint,
        viewport,
        graph,
      );
      item.distortedX = distorted.x;
      item.distortedY = distorted.y;
      const distance = Math.hypot(item.node.viewX - focus.x, item.node.viewY - focus.y);
      const proximity = 1 - smoothstep(radius * 0.1, radius * 0.48, distance);
      const routeBoost =
        item.group.classList.contains("is-current") ||
        item.group.classList.contains("is-available")
          ? 0.28
          : 0;
      const attention = clamp(proximity + routeBoost, 0, 1);
      const maxScale = item.node.core ? 1.56 : 1.92;
      const minScale = Number(item.node.weight || 1) <= 0.7 ? 0.64 : 0.78;
      const scale = lerp(minScale, maxScale, attention);
      item.group.setAttribute(
        "transform",
        `translate(${distorted.x} ${distorted.y}) scale(${scale})`,
      );
      item.group.style.opacity = String(lerp(0.54, 1, attention));
      item.text.style.opacity = String(smoothstep(0.22, 0.62, attention));
    }

    for (const edge of edgeElements) {
      edge.line.setAttribute("x1", String(edge.source.distortedX));
      edge.line.setAttribute("y1", String(edge.source.distortedY));
      edge.line.setAttribute("x2", String(edge.target.distortedX));
      edge.line.setAttribute("y2", String(edge.target.distortedY));
    }
  }

  function graphFocusFromEvent(svg, viewport, event, nodeElementById) {
    const targetNode = event.target?.closest?.(".sai-graph-node");
    const targetItem = targetNode?.dataset?.saiGraphNode
      ? nodeElementById.get(targetNode.dataset.saiGraphNode)
      : null;
    if (targetItem) {
      return {
        x: targetItem.node.viewX,
        y: targetItem.node.viewY,
      };
    }

    const bounds = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * viewport.width,
      y: ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * viewport.height,
    };
  }

  function chooseStoryPath(story, target) {
    if (!target) return false;

    const lowerTarget = target.toLowerCase();
    const choiceIndex = story.currentChoices.findIndex((choice) => {
      const path = choiceTargetPath(choice);
      return typeof path === "string" && path.toLowerCase() === lowerTarget;
    });
    if (choiceIndex !== -1) {
      story.ChooseChoiceIndex(choiceIndex);
      return true;
    }

    if (typeof story.ChoosePathString === "function") {
      story.ChoosePathString(target);
      return true;
    }

    return false;
  }

  function initialStoryPath(container) {
    return (
      container.dataset.inkStartPath ||
      container.dataset.inkInitialPath ||
      container.dataset.inkStart ||
      ""
    ).trim();
  }

  function renderAdventureGraph(stageState, manifest, story, metadata, render) {
    const graph = resolveAdventureGraph(manifest);
    if (!stageState.graphLayer || !graph) return;

    const viewport = graphViewport(graph);
    const nodes = projectGraphNodes(stageState.graphLayout || graph.nodes || [], graph);
    if (nodes.length === 0) return;

    const current = currentStoryKnot(metadata);
    const available = availableTargets(story);
    const activeNode = nodes.find((node) => graphNodeKey(node) === current);
    const activePoint = activeNode ? { x: activeNode.viewX, y: activeNode.viewY } : null;
    const centerPoint = activePoint || {
      x: viewport.width / 2,
      y: viewport.height / 2,
    };
    const visited = new Set(
      nodes
        .filter((node) => {
          try {
            return story.VisitCountAtPathString(node.target || node.knot) > 0;
          } catch {
            return false;
          }
        })
        .map(graphNodeKey),
    );

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${viewport.width} ${viewport.height}`);
    svg.setAttribute("aria-label", graph.label || "Ink knot graph");
    svg.setAttribute("role", "img");

    const edgeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    edgeGroup.setAttribute("class", "sai-graph-edges");
    svg.append(edgeGroup);

    const nodeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    nodeGroup.setAttribute("class", "sai-graph-nodes");
    const nodeElements = [];
    const edgeElements = [];
    for (const node of nodes) {
      const target = node.target || node.knot || node.id;
      const key = graphNodeKey(node);
      const canChoose = available.has(String(target).toLowerCase());
      const isCurrent = key && key === current;
      const isVisited = visited.has(key);
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "sai-graph-node");
      group.dataset.saiGraphNode = node.id;
      group.dataset.saiGraphTarget = target;
      if (isCurrent) group.classList.add("is-current");
      if (isVisited) group.classList.add("is-visited");
      if (canChoose) group.classList.add("is-available");
      group.setAttribute("transform", `translate(${node.viewX} ${node.viewY})`);
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      group.setAttribute("aria-label", node.label || node.id);

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", String(graphNodeRadius(node)));
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.textContent = node.label || node.id;
      text.setAttribute("y", "5");
      text.style.fontSize = `${graphNodeFontSize(node)}px`;
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = node.label || node.id;
      group.append(title, circle, text);
      nodeElements.push({
        group,
        node,
        text,
        distortedX: node.viewX,
        distortedY: node.viewY,
      });

      const activate = () => {
        if (!chooseStoryPath(story, target)) return;
        render();
      };
      group.addEventListener("click", activate);
      group.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate();
      });
      group.addEventListener("pointerenter", () => {
        applyGraphAttention(
          nodeElements,
          edgeElements,
          viewport,
          graph,
          {
            x: node.viewX,
            y: node.viewY,
          },
          activePoint,
        );
      });
      group.addEventListener("focus", () => {
        applyGraphAttention(
          nodeElements,
          edgeElements,
          viewport,
          graph,
          {
            x: node.viewX,
            y: node.viewY,
          },
          activePoint,
        );
      });
      nodeGroup.append(group);
    }
    svg.append(nodeGroup);

    const nodeElementById = new Map(nodeElements.map((item) => [item.node.id, item]));
    for (const edge of graph.edges || []) {
      const source = nodeElementById.get(edge.source ?? edge.from);
      const target = nodeElementById.get(edge.target ?? edge.to);
      if (!source || !target) continue;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(source.distortedX));
      line.setAttribute("y1", String(source.distortedY));
      line.setAttribute("x2", String(target.distortedX));
      line.setAttribute("y2", String(target.distortedY));
      edgeGroup.append(line);
      edgeElements.push({ line, source, target });
    }

    applyGraphAttention(
      nodeElements,
      edgeElements,
      viewport,
      graph,
      centerPoint,
      activePoint,
    );
    svg.addEventListener("pointermove", (event) => {
      applyGraphAttention(
        nodeElements,
        edgeElements,
        viewport,
        graph,
        graphFocusFromEvent(svg, viewport, event, nodeElementById),
        activePoint,
      );
    });
    svg.addEventListener("pointerleave", () => {
      applyGraphAttention(
        nodeElements,
        edgeElements,
        viewport,
        graph,
        centerPoint,
        activePoint,
      );
    });

    stageState.graphLayer.replaceChildren(svg);
    stageState.graphLayer.hidden = false;
    stageState.stage.classList.add("has-adventure-graph");
  }

  function renderSpeakerLine(stageState, manifest, text, metadata) {
    const speaker = metadata.speaker || "Void";
    const avatar = resolveSpeakerAvatar(manifest, speaker, metadata.avatar);

    stageState.name.textContent = speaker;
    stageState.line.textContent = text;
    stageState.avatar.hidden = avatar.length === 0;
    if (avatar) {
      stageState.avatar.src = avatar;
      stageState.avatar.alt = `${speaker} avatar`;
    }

    stageState.card.classList.remove("is-entering");
    void stageState.card.offsetWidth;
    stageState.card.classList.add("is-entering");
  }

  function appendParagraphs(story, transcript) {
    let advanced = false;
    let safety = 0;

    while (story.canContinue && safety < 1000) {
      const text = story.Continue().trim();
      safety += 1;
      if (text.length > 0) {
        transcript.append(createElement("p", "sai-line", text));
        advanced = true;
      }
    }

    if (safety >= 1000) {
      transcript.append(
        createElement(
          "p",
          "sai-error",
          "The story did not settle before the safety limit. Something in the Ink is looping.",
        ),
      );
    }

    if (advanced) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }

  function renderChoices(story, choices, variables) {
    choices.replaceChildren();

    if (story.currentChoices.length === 0) {
      choices.append(
        createElement(
          "p",
          "sai-end",
          "End of branch. The feed stops blinking.",
        ),
      );
      return;
    }

    story.currentChoices.forEach((choice, index) => {
      const button = createElement("button", "sai-choice", choice.text);
      button.type = "button";
      button.addEventListener("click", () => {
        story.ChooseChoiceIndex(index);
        appendParagraphs(
          story,
          choices.closest(".sai-player").querySelector(".sai-transcript"),
        );
        renderVariables(story, variables);
        renderChoices(story, choices, variables);
      });
      choices.append(button);
    });
  }

  function renderCinematicStep(story, state) {
    const { choices, variables, stageState, manifest, continueButton } = state;

    choices.replaceChildren();
    continueButton.hidden = true;

    if (story.canContinue) {
      const text = story.Continue().trim();
      if (text.length > 0) {
        setCinematicSlide(stageState, manifest, stageState.slideIndex + 1);
        renderCinematicText(stageState, text);
        stageState.stage.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      renderVariables(story, variables);

      if (story.canContinue) {
        continueButton.hidden = false;
        continueButton.textContent = "Continue";
        return;
      }
    }

    renderVariables(story, variables);

    if (story.currentChoices.length === 0) {
      choices.append(
        createElement(
          "p",
          "sai-end",
          "End of branch. The cage pretends it was always empty.",
        ),
      );
      return;
    }

    story.currentChoices.forEach((choice, index) => {
      const button = createElement("button", "sai-choice", choice.text);
      button.type = "button";
      button.addEventListener("click", () => {
        stageState.sectionText.classList.add("is-exiting");
        window.setTimeout(() => {
          story.ChooseChoiceIndex(index);
          stageState.sectionText.classList.remove("is-exiting");
          renderCinematicStep(story, state);
        }, 180);
      });
      choices.append(button);
    });
  }

  function renderSpeakerStep(story, state) {
    const {
      choices,
      variables,
      stageState,
      manifest,
      continueButton,
      container,
    } = state;

    choices.replaceChildren();
    continueButton.hidden = true;

    let text = "";
    let metadata = {};
    let safety = 0;

    while (story.canContinue && text.length === 0 && safety < 100) {
      text = story.Continue().trim();
      metadata = parseTags(story.currentTags);
      safety += 1;
    }

    if (safety >= 100) {
      text =
        "The story did not settle before the safety limit. Something in the Ink is looping.";
      metadata = { speaker: "System" };
    }

    if (text.length > 0) {
      stageState.lastMetadata = metadata;
      setSpeakerBackground(stageState, manifest, container, metadata);
      renderSpeakerSprites(stageState, manifest, metadata);
      renderDomCards(stageState, manifest, metadata);
      renderAdventureGraph(stageState, manifest, story, metadata, () =>
        renderSpeakerStep(story, state),
      );
      renderSpeakerLine(stageState, manifest, text, metadata);
      renderVariables(story, variables);

      if (story.canContinue) {
        continueButton.hidden = false;
        continueButton.textContent = "Continue";
        return;
      }
    }

    renderVariables(story, variables);

    if (story.currentChoices.length === 0) {
      choices.append(
        createElement("p", "sai-end", "End of branch. The circle goes quiet."),
      );
      return;
    }

    story.currentChoices.forEach((choice, index) => {
      const button = createElement("button", "sai-choice", choice.text);
      button.type = "button";
      button.addEventListener("click", () => {
        stageState.card.classList.add("is-exiting");
        window.setTimeout(() => {
          story.ChooseChoiceIndex(index);
          stageState.card.classList.remove("is-exiting");
          renderSpeakerStep(story, state);
        }, 140);
      });
      choices.append(button);
    });
  }

  async function initialisePlayer(container) {
    if (container.dataset.inkInitialised === "true") return;
    container.dataset.inkInitialised = "true";
    container.classList.add("sai-player");

    const storySrc = container.dataset.inkStory;
    if (!storySrc) {
      container.textContent = "Ink player is missing data-ink-story.";
      return;
    }

    const status = createElement("p", "sai-status", "Loading story...");
    const inkMode = resolveInkMode(container);
    const isCinematic = inkMode === "cinematic";
    const isSpeakerPanel = inkMode === "speaker-panel";
    const showVariables =
      (!isCinematic && !isSpeakerPanel) ||
      container.dataset.showVariables === "true";
    const transcript =
      isCinematic || isSpeakerPanel
        ? null
        : createElement("div", "sai-transcript");
    const stageState = isCinematic
      ? createCinematicStage()
      : isSpeakerPanel
        ? createSpeakerStage()
        : null;
    const choices = createElement("div", "sai-choices");
    const variables = createElement("div", "sai-variables");
    const continueButton = createElement("button", "sai-continue", "Continue");
    const restart = createElement("button", "sai-restart", "Restart");
    continueButton.type = "button";
    continueButton.hidden = true;
    restart.type = "button";

    if (isCinematic) {
      container.classList.add("sai-player-cinematic");
      variables.hidden = !showVariables;
      container.replaceChildren(
        status,
        stageState.stage,
        choices,
        variables,
        continueButton,
        restart,
      );
    } else if (isSpeakerPanel) {
      container.classList.add("sai-player-speaker");
      variables.hidden = !showVariables;
      stageState.controls.append(choices, continueButton);
      container.replaceChildren(status, stageState.stage, variables);
    } else {
      container.replaceChildren(
        status,
        transcript,
        choices,
        variables,
        restart,
      );
    }

    try {
      await ensureInkRuntime(container);
      const visualManifest = await loadVisualManifest(container);

      const response = await fetch(storySrc);
      if (!response.ok) {
        throw new Error(`could not fetch ${storySrc}: ${response.status}`);
      }

      const storyJson = await response.json();

      function reset() {
        const story = new window.inkjs.Story(JSON.stringify(storyJson));
        const startPath = initialStoryPath(container);
        if (startPath) {
          chooseStoryPath(story, startPath);
        }
        status.textContent = container.dataset.inkTitle || "Interactive story";
        choices.replaceChildren();
        variables.replaceChildren();
        if (isCinematic) {
          stageState.slideIndex = -1;
          stageState.caption.textContent = "";
          stageState.references.replaceChildren();
          stageState.references.hidden = true;
          stageState.sectionText.replaceChildren();
          continueButton.onclick = () => {
            stageState.sectionText.classList.add("is-exiting");
            window.setTimeout(() => {
              stageState.sectionText.classList.remove("is-exiting");
              renderCinematicStep(story, {
                choices,
                variables,
                stageState,
                manifest: visualManifest,
                continueButton,
              });
            }, 180);
          };
          renderCinematicStep(story, {
            choices,
            variables,
            stageState,
            manifest: visualManifest,
            continueButton,
          });
        } else if (isSpeakerPanel) {
          stageState.backgroundSet = false;
          stageState.background.style.backgroundImage = "";
          stageState.sceneLabel.textContent = "";
          stageState.spriteLayer.replaceChildren();
          stageState.spriteLayer.hidden = true;
          stageState.graphLayer.replaceChildren();
          stageState.graphLayer.hidden = true;
          stageState.domLayer.replaceChildren();
          stageState.domLayer.hidden = true;
          stageState.stage.classList.remove(
            "has-adventure-graph",
            "has-dom-cards",
            "has-sprites",
          );
          layoutAdventureGraph(stageState, visualManifest).catch((error) => {
            stageState.graphLayer.replaceChildren(
              createElement(
                "p",
                "sai-graph-error",
                error.message || String(error),
              ),
            );
            stageState.graphLayer.hidden = false;
            stageState.stage.classList.add("has-adventure-graph");
          });
          stageState.graphLayoutPromise?.then(() => {
            renderAdventureGraph(
              stageState,
              visualManifest,
              story,
              stageState.lastMetadata,
              () => renderSpeakerStep(story, {
                choices,
                variables,
                stageState,
                manifest: visualManifest,
                continueButton,
                container,
              }),
            );
          });
          stageState.card.classList.remove("is-entering", "is-exiting");
          stageState.avatar.removeAttribute("src");
          stageState.avatar.hidden = true;
          stageState.name.textContent = "";
          stageState.line.textContent = "";
          continueButton.onclick = () => {
            stageState.card.classList.add("is-exiting");
            window.setTimeout(() => {
              stageState.card.classList.remove("is-exiting");
              renderSpeakerStep(story, {
                choices,
                variables,
                stageState,
                manifest: visualManifest,
                continueButton,
                container,
              });
            }, 140);
          };
          renderSpeakerStep(story, {
            choices,
            variables,
            stageState,
            manifest: visualManifest,
            continueButton,
            container,
          });
        } else {
          transcript.replaceChildren();
          appendParagraphs(story, transcript);
          renderVariables(story, variables);
          renderChoices(story, choices, variables);
        }
      }

      restart.addEventListener("click", reset);
      reset();
    } catch (error) {
      status.textContent = "Ink player failed to load.";
      if (isSpeakerPanel && stageState) {
        renderSpeakerLine(
          stageState,
          visualManifest,
          error.message || String(error),
          { speaker: "System" },
        );
      } else {
        const errorTarget =
          transcript || (stageState && stageState.sectionText);
        errorTarget.append(
          createElement("p", "sai-error", error.message || String(error)),
        );
      }
    }
  }

  function initialiseAllPlayers() {
    document
      .querySelectorAll(".sai-player, .aetheria-ink-player")
      .forEach(initialisePlayer);
  }

  window.Sai = {
    ...(window.Sai || {}),
    init: initialisePlayer,
    initAll: initialiseAllPlayers,
    version,
  };

  document.addEventListener("nav", initialiseAllPlayers);
  if (document.readyState !== "loading") initialiseAllPlayers();
})();
