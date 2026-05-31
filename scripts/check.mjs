import fs from "node:fs/promises";

const root = new URL("..", import.meta.url);
const required = [
  "dist/sai.js",
  "dist/sai.css",
  "dist/ink.js",
  "dist/eve.js",
  "examples/static-site/index.html",
  "docs/manifest.md",
];

for (const file of required) {
  await fs.access(new URL(file, root));
}

const script = await fs.readFile(new URL("dist/sai.js", root), "utf8");
const css = await fs.readFile(new URL("dist/sai.css", root), "utf8");
const eve = await fs.readFile(new URL("dist/eve.js", root), "utf8");

if (!script.includes("window.Sai")) {
  throw new Error("dist/sai.js must expose window.Sai");
}

if (!script.includes(".sai-player, .aetheria-ink-player")) {
  throw new Error("dist/sai.js must preserve legacy player discovery");
}

if (!css.includes(".sai-player")) {
  throw new Error("dist/sai.css must style .sai-player");
}

if (!eve.includes("gamecult.eve.surface.v1")) {
  throw new Error("dist/eve.js must publish the Eve surface schema id");
}

console.log("Sai package checks passed.");
