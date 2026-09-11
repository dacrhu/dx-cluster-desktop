#!/usr/bin/env node
// Pulls the section for one version out of CHANGELOG.md and prints it as a
// multiline GITHUB_OUTPUT entry (`notes`), for release.yml to drop into the
// GitHub release body. Usage: node extract-changelog.mjs <tag>  (e.g. v1.1.0)

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const tag = process.argv[2] || "";
const version = tag.replace(/^v/, "");

const changelogPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "CHANGELOG.md",
);
const lines = readFileSync(changelogPath, "utf8").split("\n");

let capturing = false;
const body = [];
for (const line of lines) {
  const heading = line.match(/^## \[(.+?)\]/);
  if (heading) {
    if (capturing) break; // reached the next version's heading
    if (heading[1] === version) capturing = true;
    continue;
  }
  if (capturing) body.push(line);
}

const notes = body.join("\n").trim() || "See the commit history for details.";

const delimiter = "CHANGELOG_EOF";
process.stdout.write(`notes<<${delimiter}\n${notes}\n${delimiter}\n`);
