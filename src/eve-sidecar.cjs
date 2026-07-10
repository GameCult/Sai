#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { Story } = require("inkjs");
const SaiEve = require("./eve.js");

const sessions = new Map();
const pluginId = "sai.vn";
const operations = ["describe", "validate", "open", "apply", "project", "jump"];

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line.replace(/^\uFEFF/, ""));
    respond(request, dispatch(request));
  } catch (error) {
    respond(request, {}, "rejected", error.message);
  }
});

function dispatch(request) {
  if (request?.schema !== "gamecult.eve.plugin_abi.request.v1") throw new Error("Unsupported request schema.");
  if (request.pluginId !== pluginId) throw new Error(`Expected plugin ${pluginId}.`);
  if (!operations.includes(request.operation)) throw new Error(`Unsupported operation ${request.operation}.`);
  if (request.operation === "describe") return describe();
  if (request.operation === "validate") return validate(request.input);
  if (request.operation === "open") return openSession(request.input);
  if (request.operation === "apply") return applyCommand(request.input);
  if (request.operation === "jump") return applyCommand({ ...request.input, command: "story.jump" });
  return projectSession(request.input);
}

function validate(input) {
  const owned = new Set(describe().componentKinds);
  const requested = Array.isArray(input.componentKinds) ? input.componentKinds : [];
  return {
    acceptedComponentKinds: requested.filter((kind) => owned.has(kind)),
    rejectedComponentKinds: requested.filter((kind) => !owned.has(kind)),
    requiredCapabilities: describe().capabilities,
  };
}

function describe() {
  return {
    pluginId,
    componentKinds: ["vn.stage", "panel.dialogue", "text.dialogue", "rail.actions"],
    commands: ["story.continue", "story.choose", "story.jump"],
    capabilities: ["vn.stage", "story.choose", "story.continue", "story.jump"],
    operations,
    optionalPlugins: ["norn.graph", "tex.math"],
    sessionAuthority: "sai-sidecar",
  };
}

function openSession(input) {
  const sessionId = requiredString(input.sessionId, "sessionId");
  const storyPath = path.resolve(process.cwd(), requiredString(input.storyPath, "storyPath"));
  const story = new Story(parseJson(fs.readFileSync(storyPath, "utf8")));
  const session = { sessionId, storyId: input.storyId || path.basename(storyPath, ".ink.json"), story, revision: 0, line: "", tags: [] };
  sessions.set(sessionId, session);
  advance(session);
  return snapshot(session);
}

function applyCommand(input) {
  const session = getSession(input.sessionId);
  const command = requiredString(input.command, "command");
  if (command === "story.continue") {
    advance(session);
  } else if (command === "story.choose") {
    const index = Number(input.index);
    if (!Number.isInteger(index) || index < 0 || index >= session.story.currentChoices.length) throw new Error("Choice index is unavailable.");
    session.story.ChooseChoiceIndex(index);
    advance(session);
  } else if (command === "story.jump") {
    session.story.ChoosePathString(requiredString(input.targetPath, "targetPath"));
    advance(session);
  } else {
    throw new Error(`Unsupported Sai command ${command}.`);
  }
  session.revision += 1;
  return {
    ...snapshot(session),
    command,
    commandEffects: {
      "story.continue": "advance-story",
      "story.choose": "choose-branch",
      "story.jump": "jump-to-knot",
    },
    receiptSchema: "gamecult.eve.command_receipt.v1",
  };
}

function projectSession(input) {
  const session = getSession(input.sessionId);
  return {
    projectionKind: "semantic-surface",
    ownedComponentKinds: ["vn.stage", "panel.dialogue", "text.dialogue", "rail.actions"],
    delegatedPlugins: ["norn.graph", "tex.math"],
    surface: SaiEve.createVisualNovelSurface({
      providerId: input.providerId || pluginId,
      storyId: session.storyId,
      version: session.revision + 1,
      metadata: tagMap(session.tags),
      speaker: tagMap(session.tags).speaker,
      line: session.line,
      choices: choices(session.story),
    }),
    ...snapshot(session),
  };
}

function advance(session) {
  session.line = "";
  session.tags = [];
  while (session.story.canContinue && !session.line) {
    session.line = session.story.Continue().trim();
    session.tags = [...session.story.currentTags];
  }
}

function snapshot(session) {
  return {
    sessionId: session.sessionId,
    storyId: session.storyId,
    revision: session.revision,
    line: session.line,
    choices: choices(session.story),
    canContinue: session.story.canContinue,
    currentTags: session.tags,
  };
}

function choices(story) {
  return story.currentChoices.map((choice, index) => ({ index, text: choice.text.trim(), targetPath: choice.targetPath }));
}

function tagMap(tags) {
  return Object.fromEntries(tags.map((tag) => tag.split(/:\s*/, 2)).filter((parts) => parts.length === 2));
}

function getSession(sessionId) {
  const session = sessions.get(requiredString(sessionId, "sessionId"));
  if (!session) throw new Error(`Unknown Sai session ${sessionId}.`);
  return session;
}

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  return value;
}

function parseJson(value) { return JSON.parse(value.replace(/^\uFEFF/, "")); }

function respond(request, output, status = "accepted", message) {
  process.stdout.write(`${JSON.stringify({
    schema: "gamecult.eve.plugin_abi.response.v1",
    pluginId,
    operation: request?.operation || "unknown",
    requestId: request?.requestId || "unknown",
    status,
    output,
    ...(message ? { diagnostics: [{ message }] } : {}),
  })}\n`);
}
