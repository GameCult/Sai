(function () {
  const version = "0.1.0";
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
    const scriptSrc = document.currentScript && document.currentScript.src;
    if (!scriptSrc) return "ink.js";
    return new URL("ink.js", scriptSrc).href;
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
    body.append(name, line, controls);
    card.append(avatarShell, body);
    stage.append(background, scrim, sceneLabel, card);

    return {
      stage,
      background,
      sceneLabel,
      card,
      avatar,
      name,
      line,
      controls,
      backgroundSet: false,
      backgroundKey: "",
    };
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
      setSpeakerBackground(stageState, manifest, container, metadata);
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
      stageState.controls.append(choices, continueButton, restart);
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
      const errorTarget = transcript || (stageState && stageState.sectionText);
      errorTarget.append(
        createElement("p", "sai-error", error.message || String(error)),
      );
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
