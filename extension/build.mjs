import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const extensionDirectory = new URL("./", import.meta.url);
const outputDirectory = new URL("./dist/", extensionDirectory);

rmSync(outputDirectory, { force: true, recursive: true });
execFileSync(
  process.execPath,
  ["../node_modules/typescript/bin/tsc", "--project", "tsconfig.json"],
  { cwd: extensionDirectory, stdio: "inherit" },
);

for (const file of ["checkout-parser.js", "domain.js", "popup.js"]) {
  if (!existsSync(new URL(file, outputDirectory))) {
    throw new Error(`Extension build did not emit ${file}.`);
  }
}

mkdirSync(outputDirectory, { recursive: true });
cpSync(new URL("./manifest.json", extensionDirectory), new URL("manifest.json", outputDirectory));
cpSync(new URL("./static/", extensionDirectory), outputDirectory, { recursive: true });
