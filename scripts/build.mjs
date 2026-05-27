import fs from "node:fs/promises";
import path from "node:path";

const root = new URL("..", import.meta.url);
const files = ["sai.js", "sai.css", "ink.js"];

await fs.mkdir(new URL("dist/", root), { recursive: true });

for (const file of files) {
  await fs.copyFile(
    new URL(`src/${file}`, root),
    new URL(`dist/${file}`, root),
  );
}

console.log(`Built ${files.map((file) => path.join("dist", file)).join(", ")}`);
