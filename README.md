# The Hourglass

A CSS hourglass animation rooted in desert stillness, grains drifting down like dunes in a slow collapse. Built with [LiquidJS](https://liquidjs.com/) templating and a PostCSS pipeline.

## Overview

This project renders a falling-sand hourglass using thousands of pixelated sand particles constrained by CSS `shape-outside` polygons. The animation, markup, and styling are all driven by a local Liquid template build system.

## Tech Stack

- **LiquidJS** — template rendering
- **PostCSS** — CSS processing with `postcss-preset-env` and `autoprefixer`
- **BrowserSync** — local dev server with live reload
- **Node.js** — build tooling

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm or pnpm

### Installation

```bash
pnpm install
```

### Build

Generate the static site to `dist/`:

```bash
pnpm run build
```

### Development

Start the dev server with auto-rebuild and live reload:

```bash
pnpm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

The dev pipeline runs three watchers in parallel:
- `nodemon` watches `templates/`, `sections/`, and `scripts/build.js` and rebuilds HTML on change
- `postcss-cli` watches `style.css` and rebuilds `dist/style.css` on change
- `browser-sync` serves `dist/` with live reload

## Project Structure

```
.
├── dist/                          # Build output (ignored in git)
├── sections/
│   └── hourglass.liquid           # Section template with sand particles + SVG
├── scripts/
│   ├── build.js                   # LiquidJS renderer
│   └── data/
│       └── sections/
│           └── hourglass.json     # Local default settings
├── style.css                      # Source CSS with CSS custom properties
├── templates/
│   └── page.hourglass.liquid      # Page wrapper template
├── postcss.config.cjs             # PostCSS configuration
└── package.json
```

## Customization

Section settings are defined in `scripts/data/sections/hourglass.json` and injected as CSS custom properties at build time:

| Setting | Description | Default |
|---|---|---|
| `bg_color` | Background color | `#6ca2ba` |
| `text_color` | Sand/text color | `#ffc12f` |
| `anim_duration` | Animation duration (seconds) | `10` |
| `font_size` | Font size for fallback text (px) | `9` |

The `sections/hourglass.liquid` file also contains a `{% schema %}` block with the same settings for Shopify compatibility.

## How It Works

- **Sand particles**: 2,020 square `span` elements (`4px × 4px`) in `#EDD0AA` fill the upper chamber.
- **Shape constraint**: Two CSS `shape-outside` polygons (`.dusk` and `.dawn`) force the sand to conform to the hourglass silhouette.
- **Animation**: The `.dunes-of-sand` container slides downward over the configured duration, letting sand appear to drain
- **Overlay**: An inline SVG hourglass graphic sits above the sand at `z-index: 100`.

## Scripts

| Script | Description |
|---|---|
| `pnpm run build` | Build HTML and CSS to `dist/` |
| `pnpm run build:html` | Build HTML only |
| `pnpm run css` | Build CSS only |
| `pnpm run dev` | Start dev server with watchers |
| `pnpm run clean` | Remove `dist/` |

