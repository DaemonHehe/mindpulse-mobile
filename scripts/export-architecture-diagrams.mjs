import { mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const docsRoot = join(repoRoot, "docs", "architecture");
const svgRoot = join(docsRoot, "svg");
const pngRoot = join(docsRoot, "png");
const mermaidRootRelative = join("docs", "architecture", "mermaid");
const svgRootRelative = join("docs", "architecture", "svg");
const pngRootRelative = join("docs", "architecture", "png");

const diagrams = [
  {
    name: "high-level-architecture",
    width: 1800,
    height: 1400,
  },
  {
    name: "mindpulse-erd",
    width: 1800,
    height: 1600,
  },
  {
    name: "application-sequence",
    width: 2200,
    height: 1800,
  },
  {
    name: "application-class-diagram",
    width: 2200,
    height: 1800,
  },
];

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const quote = (value) => `"${value}"`;

const run = (args) => {
  const command = [npxCommand, ...args.map(quote)].join(" ");
  execSync(command, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });
};

mkdirSync(svgRoot, { recursive: true });
mkdirSync(pngRoot, { recursive: true });

for (const diagram of diagrams) {
  const input = join(mermaidRootRelative, `${diagram.name}.mmd`);
  const svgOutput = join(svgRootRelative, `${diagram.name}.svg`);
  const pngOutput = join(pngRootRelative, `${diagram.name}.png`);

  run([
    "-y",
    "@mermaid-js/mermaid-cli",
    "-i",
    input,
    "-o",
    svgOutput,
    "-t",
    "neutral",
    "-w",
    String(diagram.width),
    "-H",
    String(diagram.height),
    "-b",
    "white",
  ]);

  run([
    "-y",
    "@mermaid-js/mermaid-cli",
    "-i",
    input,
    "-o",
    pngOutput,
    "-t",
    "neutral",
    "-w",
    String(diagram.width),
    "-H",
    String(diagram.height),
    "-b",
    "white",
    "-s",
    "2",
  ]);
}

console.log("Architecture diagrams exported.");
