# The Hourglass

A quiet hourglass animation rendered in [Pixi.js](https://pixijs.com/), where sand drifts through a glass vessel in a slow collapse. Built with [LiquidJS](https://liquidjs.com/) templating and a Vite-powered dev pipeline.

## Overview

The hourglass is drawn entirely on a Pixi.js canvas, with a glass vessel, wooden caps, and drifting sand. The canvas has a transparent background so the configurable CSS backdrop shows through. The Liquid template build system generates the static page and injects settings as CSS custom properties.

## Tech Stack

- **LiquidJS** — template rendering
- **Pixi.js** — 2D canvas rendering for the hourglass vessel, sand, and falling stream
- **Vite** — dev server with live reload and asset bundling
- **PostCSS** — CSS processing with `postcss-preset-env` and `autoprefixer`
- **Node.js** — build tooling

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- pnpm (or npm)

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

## Project Structure

```
.
├── dist/                          # Build output (ignored in git)
├── sections/
│   └── hourglass.liquid           # Section template: vessel container + Pixi.js script tag
├── scripts/
│   ├── build.js                   # LiquidJS renderer + asset copier
│   ├── sand.js                    # Pixi.js hourglass rendering module
│   └── data/
│       └── sections/
│           └── hourglass.json     # Local default settings
├── style.css                      # Source CSS: background, font, vessel canvas styling
├── templates/
│   └── page.desert.liquid        # Page wrapper template
├── postcss.config.cjs             # PostCSS configuration
└── package.json
```

## Customization

Section settings are defined in `scripts/data/sections/hourglass.json` and injected as CSS custom properties at build time:

| Setting | Description | Default |
|---|---|---|
| `bg_color` | Background color | `#f5f3ef` |

The `sections/hourglass.liquid` file also contains a `{% schema %}` block with the same setting for Shopify compatibility.

## How It Works

- **Dunes-of-Sand**: The hourglass shape is defined by cubic Bézier curves sampled into a lookup table (LUT) that gives the glass interior half-width at every y pixel.
- **Glass layers**: Pixi.js draws a translucent glass body fill, edge shadow, specular highlights, and wooden caps on top and bottom.
- **Sand mask**: A `PIXI.Graphics` mask clips all sand rendering to the glass interior, so sand never spills outside the vessel.
- **Sand fill**: Each frame, the upper and lower sand bodies are drawn as polygons that conform to the LUT boundary. Highlights and depth shadows give the dunes dimension.
- **Falling stream**: A tapered polygon between the waist and lower dune surface represents the grain cascade, with a centre thread highlight.
- **Animation**: A Pixi.js ticker advances time `t` from `0 → 1` over 12 seconds. The upper sand surface drops and the lower dune rises accordingly.
- **Background**: The canvas uses `backgroundAlpha: 0` so the CSS `var(--bg)` color shows through, making the backdrop configurable via Liquid settings.

## Scripts

| Script | Description |
|---|---|
| `pnpm run build` | Build HTML, copy assets, and bundle with Vite to `dist/` |
| `pnpm run build:html` | Build HTML only |
| `pnpm run dev` | Build HTML and start Vite dev server with live reload |
| `pnpm run preview` | Preview the production build locally |
| `pnpm run clean` | Remove `dist/` |

