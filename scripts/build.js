#!/usr/bin/env node
import { Liquid } from "liquidjs";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const rootDir = path.resolve(process.cwd());
const templatesDir = path.join(rootDir, "templates");
const sectionsDir = path.join(rootDir, "sections");
const distDir = path.join(rootDir, "dist");

// Ensure dist directory exists
await fsp.mkdir(distDir, { recursive: true });

// Load section settings (local defaults)
const sectionDataPath = path.join(
  rootDir,
  "scripts",
  "data",
  "sections",
  "hourglass.json",
);
let sectionSettings = {};
try {
  const raw = await fsp.readFile(sectionDataPath, "utf8");
  sectionSettings = JSON.parse(raw);
} catch (e) {
  // Fallback defaults if data file not found
  sectionSettings = {
    bg_color: "#f5f3ef",
  };
}

// Initialize Liquid engine
const engine = new Liquid({
  root: [templatesDir, sectionsDir, rootDir],
  extname: ".liquid",
  cache: false,
});

engine.registerFilter("asset_url", (input) => {
  // In dist, assets are copied at the root.
  return input;
});

engine.registerFilter("stylesheet_tag", (href) => {
  return `<link rel="stylesheet" href="${href}">`;
});

engine.registerTag("schema", {
  parse(token, remainTokens) {
    let tok;
    while ((tok = remainTokens.shift())) {
      if (tok.name === "endschema") break;
    }
  },
  render() {
    return "";
  },
});

engine.registerTag("endschema", {
  render: async function () {
    return "";
  },
});

// Custom 'section' tag to include and render a section file
engine.registerTag("section", {
  parse: function (token) {
    // token.args contains the string after the tag name
    this.sectionName = token.args
      .replace(/^\s*'|"|\s*$/g, "")
      .replace(/['"]/g, "");
  },
  render: async function (scope, emitter) {
    const name = this.sectionName;
    const sectionFile = path.join(sectionsDir, `${name}.liquid`);
    const exists = fs.existsSync(sectionFile);
    if (!exists) {
      return `<!-- section '${name}' not found -->`;
    }

    // Build a section object
    const sectionObj = {
      id: name,
      type: name,
      settings: sectionSettings,
    };

    // Render the section template with the current scope + section
    const html = await engine.renderFile(`${name}.liquid`, {
      section: sectionObj,
    });
    return html;
  },
});

const scriptsDir = path.join(rootDir, "scripts");
const jsToCopy = ["sand.js"];

// Copy JavaScript files to dist
for (const file of jsToCopy) {
  const src = path.join(scriptsDir, file);
  const dest = path.join(distDir, file);
  await fsp.copyFile(src, dest);
  console.log(`Copied ${file} to dist/`);
}

// Render the main page template to dist/index.html
const outFile = path.join(distDir, "index.html");
const html = await engine.renderFile("desert.liquid");
await fsp.writeFile(outFile, html, "utf8");

console.log(`Built ${path.relative(rootDir, outFile)}`);
