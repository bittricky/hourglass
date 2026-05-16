import * as PIXI from "pixi.js";

// ─── The Vessel ─────────────────────────────────────────────────────────────
// Geometry constants describing the hourglass shape.

const CANVAS_W = 300;
const CANVAS_H = 460;
const AXIS = CANVAS_W / 2; // horizontal centre

const HORIZON_TOP = 42; // top rim y
const HORIZON_BOT = CANVAS_H - 42; // bottom rim y
const EQUINOX = CANVAS_H / 2; // waist (narrowest point) y
const RIM_RADIUS = 96; // half-width at top/bottom
const THROAT_WIDTH = 7; // half-width at waist

// Bezier control points — govern the bulge of each chamber
const CURVE_UPPER_CP = HORIZON_TOP + (EQUINOX - HORIZON_TOP) * 0.6;
const CURVE_LOWER_CP = HORIZON_BOT - (HORIZON_BOT - EQUINOX) * 0.6;

// ─── The Pigments ───────────────────────────────────────────────────────────
// Colour palette drawn from dune and desert light.

const PIGMENT = {
  DUNE_MID: 0xc8941e, // mid-tone sand
  DUNE_CREST: 0xe0aa30, // sunlit sand crest
  DUNE_SHADOW: 0xa07010, // shadowed sand depth
  GLASS_FILL: 0xb8dff0, // glass body fill
  GLASS_EDGE: 0x5a8aaa, // glass outline shadow
  SPEC_BRIGHT: 0xceeaf8, // specular highlight bright
  CAP_BASE: 0x6b5c4e, // wooden cap base
  CAP_LIGHT: 0x7d6e60, // wooden cap highlight
  CAP_SEAM: 0x4a3c30, // cap seam line
};

// ─── The Dunes ──────────────────────────────────────────────────────────────
// Lookup table: for each y pixel, store the half-width of the glass interior.
// Built by sampling the bezier curves at high resolution.

function buildDuneLUT() {
  const lut = new Float32Array(CANVAS_H + 2);

  function sampleBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, steps) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        u = 1 - t;
      const x =
        u * u * u * p0x +
        3 * u * u * t * p1x +
        3 * u * t * t * p2x +
        t * t * t * p3x;
      const y =
        u * u * u * p0y +
        3 * u * u * t * p1y +
        3 * u * t * t * p2y +
        t * t * t * p3y;
      const yi = Math.round(y);
      if (yi >= 0 && yi < lut.length) {
        const half = Math.abs(x - AXIS);
        if (half > lut[yi]) lut[yi] = half;
      }
    }
  }

  // Upper chamber curve (rim → waist)
  sampleBezier(
    AXIS - RIM_RADIUS,
    HORIZON_TOP,
    AXIS - RIM_RADIUS,
    CURVE_UPPER_CP,
    AXIS - THROAT_WIDTH,
    CURVE_UPPER_CP,
    AXIS - THROAT_WIDTH,
    EQUINOX,
    4000,
  );

  // Lower chamber curve (waist → rim)
  sampleBezier(
    AXIS - THROAT_WIDTH,
    EQUINOX,
    AXIS - THROAT_WIDTH,
    CURVE_LOWER_CP,
    AXIS - RIM_RADIUS,
    CURVE_LOWER_CP,
    AXIS - RIM_RADIUS,
    HORIZON_BOT,
    4000,
  );

  // Fill any gaps in the LUT via linear interpolation
  for (let y = 1; y < lut.length - 1; y++) {
    if (lut[y] === 0) {
      let lo = y - 1,
        hi = y + 1;
      while (hi < lut.length && lut[hi] === 0) hi++;
      if (lut[lo] > 0 && hi < lut.length && lut[hi] > 0) {
        lut[y] = lut[lo] + (lut[hi] - lut[lo]) * ((y - lo) / (hi - lo));
      }
    }
  }

  // Caps are flat — full rim width above top and below bottom
  for (let y = 0; y <= HORIZON_TOP; y++) lut[y] = RIM_RADIUS;
  for (let y = HORIZON_BOT; y < lut.length; y++) lut[y] = RIM_RADIUS;

  return lut;
}

const DUNE_LUT = buildDuneLUT();

// Returns the glass interior half-width at a given y pixel.
function interiorHalfWidth(y) {
  return DUNE_LUT[Math.max(0, Math.min(DUNE_LUT.length - 1, Math.round(y)))];
}

// ─── The Vessel Geometry ────────────────────────────────────────────────────
// Traces the full hourglass outline into a PIXI.Graphics object.

function traceVesselOutline(g) {
  g.moveTo(AXIS - RIM_RADIUS, HORIZON_TOP);
  g.bezierCurveTo(
    AXIS - RIM_RADIUS,
    CURVE_UPPER_CP,
    AXIS - THROAT_WIDTH,
    CURVE_UPPER_CP,
    AXIS - THROAT_WIDTH,
    EQUINOX,
  );
  g.bezierCurveTo(
    AXIS - THROAT_WIDTH,
    CURVE_LOWER_CP,
    AXIS - RIM_RADIUS,
    CURVE_LOWER_CP,
    AXIS - RIM_RADIUS,
    HORIZON_BOT,
  );
  g.lineTo(AXIS + RIM_RADIUS, HORIZON_BOT);
  g.bezierCurveTo(
    AXIS + RIM_RADIUS,
    CURVE_LOWER_CP,
    AXIS + THROAT_WIDTH,
    CURVE_LOWER_CP,
    AXIS + THROAT_WIDTH,
    EQUINOX,
  );
  g.bezierCurveTo(
    AXIS + THROAT_WIDTH,
    CURVE_UPPER_CP,
    AXIS + RIM_RADIUS,
    CURVE_UPPER_CP,
    AXIS + RIM_RADIUS,
    HORIZON_TOP,
  );
  g.closePath();
}

// Builds a polygon hugging the glass interior between two y positions.
// Used to render sand fill regions.
function buildSandStratum(fromY, toY) {
  fromY = Math.ceil(fromY);
  toY = Math.floor(toY);
  if (toY - fromY < 1) return null;

  const pts = [];
  for (let y = fromY; y <= toY; y++) pts.push(AXIS - interiorHalfWidth(y), y);
  for (let y = toY; y >= fromY; y--) pts.push(AXIS + interiorHalfWidth(y), y);
  return pts;
}

// ─── The Canopy (Glass Layers) ───────────────────────────────────────────────
// Builds all static glass layers: body fill, shadow, specular highlights, caps.

function buildCanopy(stage) {
  const behindSand = new PIXI.Container();
  const aboveSand = new PIXI.Container();
  const capLayer = new PIXI.Container();
  stage.addChild(behindSand, aboveSand, capLayer);

  // Glass body fill
  const glassBody = new PIXI.Graphics();
  glassBody.beginFill(PIGMENT.GLASS_FILL, 1.0);
  traceVesselOutline(glassBody);
  glassBody.endFill();
  behindSand.addChild(glassBody);

  // Glass edge shadow
  const glassEdge = new PIXI.Graphics();
  glassEdge.lineStyle(6, PIGMENT.GLASS_EDGE, 0.6);
  traceVesselOutline(glassEdge);
  aboveSand.addChild(glassEdge);

  // Specular highlights (left bright panel + right soft panel)
  const specular = new PIXI.Graphics();
  const SPEC_W = 18,
    SPEC_R = 12;

  specular.beginFill(PIGMENT.SPEC_BRIGHT, 0.7);
  specular.moveTo(AXIS - RIM_RADIUS + 2, HORIZON_TOP + 2);
  specular.bezierCurveTo(
    AXIS - RIM_RADIUS + 2,
    CURVE_UPPER_CP,
    AXIS - THROAT_WIDTH + 2,
    CURVE_UPPER_CP,
    AXIS - THROAT_WIDTH + 2,
    EQUINOX,
  );
  specular.bezierCurveTo(
    AXIS - THROAT_WIDTH + 2,
    CURVE_LOWER_CP,
    AXIS - RIM_RADIUS + 2,
    CURVE_LOWER_CP,
    AXIS - RIM_RADIUS + 2,
    HORIZON_BOT - 2,
  );
  specular.lineTo(AXIS - RIM_RADIUS + SPEC_W, HORIZON_BOT - 2);
  specular.bezierCurveTo(
    AXIS - RIM_RADIUS + SPEC_W,
    CURVE_LOWER_CP,
    AXIS - THROAT_WIDTH + SPEC_W,
    CURVE_LOWER_CP,
    AXIS - THROAT_WIDTH + SPEC_W,
    EQUINOX,
  );
  specular.bezierCurveTo(
    AXIS - THROAT_WIDTH + SPEC_W,
    CURVE_UPPER_CP,
    AXIS - RIM_RADIUS + SPEC_W,
    CURVE_UPPER_CP,
    AXIS - RIM_RADIUS + SPEC_W,
    HORIZON_TOP + 2,
  );
  specular.closePath();
  specular.endFill();

  specular.beginFill(PIGMENT.SPEC_BRIGHT, 0.35);
  specular.moveTo(AXIS + RIM_RADIUS - 2, HORIZON_TOP + 2);
  specular.bezierCurveTo(
    AXIS + RIM_RADIUS - 2,
    CURVE_UPPER_CP,
    AXIS + THROAT_WIDTH - 2,
    CURVE_UPPER_CP,
    AXIS + THROAT_WIDTH - 2,
    EQUINOX,
  );
  specular.bezierCurveTo(
    AXIS + THROAT_WIDTH - 2,
    CURVE_LOWER_CP,
    AXIS + RIM_RADIUS - 2,
    CURVE_LOWER_CP,
    AXIS + RIM_RADIUS - 2,
    HORIZON_BOT - 2,
  );
  specular.lineTo(AXIS + RIM_RADIUS - SPEC_R, HORIZON_BOT - 2);
  specular.bezierCurveTo(
    AXIS + RIM_RADIUS - SPEC_R,
    CURVE_LOWER_CP,
    AXIS + THROAT_WIDTH - SPEC_R,
    CURVE_LOWER_CP,
    AXIS + THROAT_WIDTH - SPEC_R,
    EQUINOX,
  );
  specular.bezierCurveTo(
    AXIS + THROAT_WIDTH - SPEC_R,
    CURVE_UPPER_CP,
    AXIS + RIM_RADIUS - SPEC_R,
    CURVE_UPPER_CP,
    AXIS + RIM_RADIUS - SPEC_R,
    HORIZON_TOP + 2,
  );
  specular.closePath();
  specular.endFill();

  specular.lineStyle(2.5, 0xffffff, 0.85);
  specular.moveTo(AXIS - RIM_RADIUS + 2, HORIZON_TOP + 4);
  specular.bezierCurveTo(
    AXIS - RIM_RADIUS + 2,
    CURVE_UPPER_CP,
    AXIS - THROAT_WIDTH + 2,
    CURVE_UPPER_CP,
    AXIS - THROAT_WIDTH + 2,
    EQUINOX,
  );
  specular.bezierCurveTo(
    AXIS - THROAT_WIDTH + 2,
    CURVE_LOWER_CP,
    AXIS - RIM_RADIUS + 2,
    CURVE_LOWER_CP,
    AXIS - RIM_RADIUS + 2,
    HORIZON_BOT - 4,
  );
  aboveSand.addChild(specular);

  // Wooden caps (top and bottom)
  const caps = new PIXI.Graphics();
  const CAP_H = 22,
    CAP_W = RIM_RADIUS * 2 + 10;

  caps.beginFill(PIGMENT.CAP_BASE);
  caps.drawRoundedRect(AXIS - CAP_W / 2, HORIZON_TOP - CAP_H, CAP_W, CAP_H, 5);
  caps.endFill();
  caps.beginFill(PIGMENT.CAP_LIGHT, 0.6);
  caps.drawRoundedRect(
    AXIS - CAP_W / 2,
    HORIZON_TOP - CAP_H,
    CAP_W,
    CAP_H / 2,
    5,
  );
  caps.endFill();

  caps.beginFill(PIGMENT.CAP_BASE);
  caps.drawRoundedRect(AXIS - CAP_W / 2, HORIZON_BOT, CAP_W, CAP_H, 5);
  caps.endFill();
  caps.beginFill(PIGMENT.CAP_LIGHT, 0.5);
  caps.drawRoundedRect(AXIS - CAP_W / 2, HORIZON_BOT, CAP_W, CAP_H / 2, 5);
  caps.endFill();

  caps.lineStyle(2, PIGMENT.CAP_SEAM, 0.5);
  caps.moveTo(AXIS - CAP_W / 2 + 4, HORIZON_TOP);
  caps.lineTo(AXIS + CAP_W / 2 - 4, HORIZON_TOP);
  caps.moveTo(AXIS - CAP_W / 2 + 4, HORIZON_BOT);
  caps.lineTo(AXIS + CAP_W / 2 - 4, HORIZON_BOT);
  capLayer.addChild(caps);

  return { behindSand, aboveSand };
}

// ─── The Drift (Sand Rendering) ──────────────────────────────────────────────
// Renders the sand fill and falling stream each frame given elapsed progress t ∈ [0,1].

function renderDrift(sandGfx, detailGfx, streamGfx, t) {
  const upperFill = 1 - t; // fraction of upper chamber remaining
  const lowerFill = t; // fraction of lower chamber filled

  const upperSurface = HORIZON_TOP + (1 - upperFill) * (EQUINOX - HORIZON_TOP);
  const lowerSurface = HORIZON_BOT - lowerFill * (HORIZON_BOT - EQUINOX);
  const isFlowing = upperFill > 0.006;

  sandGfx.clear();
  detailGfx.clear();
  streamGfx.clear();

  // Upper chamber sand body
  if (upperFill > 0.004) {
    const strata = buildSandStratum(upperSurface, EQUINOX);
    if (strata) {
      sandGfx.beginFill(PIGMENT.DUNE_MID);
      sandGfx.drawPolygon(strata);
      sandGfx.endFill();

      // Surface crest highlight
      const crestW = interiorHalfWidth(upperSurface);
      detailGfx.lineStyle(2.5, PIGMENT.DUNE_CREST, 0.9);
      detailGfx.moveTo(AXIS - crestW, upperSurface);
      detailGfx.lineTo(AXIS + crestW, upperSurface);
      detailGfx.lineStyle(0);

      // Depth shadow near waist
      const shadowStrata = buildSandStratum(
        EQUINOX - (EQUINOX - upperSurface) * 0.3,
        EQUINOX,
      );
      if (shadowStrata) {
        detailGfx.beginFill(PIGMENT.DUNE_SHADOW, 0.25);
        detailGfx.drawPolygon(shadowStrata);
        detailGfx.endFill();
      }
    }
  }

  // Lower chamber sand body
  if (lowerFill > 0.004) {
    const strata = buildSandStratum(lowerSurface, HORIZON_BOT);
    if (strata) {
      sandGfx.beginFill(PIGMENT.DUNE_MID);
      sandGfx.drawPolygon(strata);
      sandGfx.endFill();

      // Surface crest highlight
      const crestW = interiorHalfWidth(lowerSurface);
      detailGfx.lineStyle(2.5, PIGMENT.DUNE_CREST, 0.85);
      detailGfx.moveTo(AXIS - crestW, lowerSurface);
      detailGfx.lineTo(AXIS + crestW, lowerSurface);
      detailGfx.lineStyle(0);

      // Base depth shadow
      const shadowStrata = buildSandStratum(
        HORIZON_BOT - (HORIZON_BOT - lowerSurface) * 0.28,
        HORIZON_BOT,
      );
      if (shadowStrata) {
        detailGfx.beginFill(PIGMENT.DUNE_SHADOW, 0.22);
        detailGfx.drawPolygon(shadowStrata);
        detailGfx.endFill();
      }

      // Specular glint on lower dune surface
      if (crestW > 8) {
        detailGfx.beginFill(PIGMENT.DUNE_CREST, 0.3);
        detailGfx.drawEllipse(
          AXIS - crestW * 0.45,
          lowerSurface + 6,
          crestW * 0.28,
          crestW * 0.22,
        );
        detailGfx.endFill();
      }
    }
  }

  // Falling stream (the grain cascade through the throat)
  if (isFlowing) {
    const cascadeStrength = Math.min(1, upperFill / 0.05);
    const streamTop = EQUINOX - 4;
    const streamBot = Math.max(lowerSurface, streamTop + 10);
    const streamLen = streamBot - streamTop;

    streamGfx.beginFill(PIGMENT.DUNE_MID, cascadeStrength * 0.95);

    const steps = Math.max(6, Math.round(streamLen / 3));
    const leftEdge = [],
      rightEdge = [];

    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const y = streamTop + f * streamLen;
      const halfW = f < 0.15 ? THROAT_WIDTH * (f / 0.15) : 1.5 + f * 3.5;
      leftEdge.push(AXIS - halfW, y);
      rightEdge.unshift(AXIS + halfW, y);
    }

    streamGfx.drawPolygon([...leftEdge, ...rightEdge]);
    streamGfx.endFill();

    // Centre thread highlight
    streamGfx.lineStyle(1.5, PIGMENT.DUNE_CREST, cascadeStrength * 0.7);
    streamGfx.moveTo(AXIS, streamTop);
    streamGfx.lineTo(AXIS, streamBot);
    streamGfx.lineStyle(0);
  }
}

// ─── The Chamber (Main Entry) ────────────────────────────────────────────────
// Mounts the Pixi app, wires up layers, and starts the drift animation.

(async () => {
  const chamber = document.getElementById("vessel");
  if (!chamber) return;

  const app = new PIXI.Application({
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  chamber.appendChild(app.view);

  // Layer stack: glass body → sand → glass overlay → caps
  const { behindSand, aboveSand } = buildCanopy(app.stage);

  const sandLayer = new PIXI.Container();
  app.stage.addChildAt(sandLayer, app.stage.getChildIndex(behindSand) + 1);

  // Sand mask clips all sand rendering to the glass interior
  const vesselMask = new PIXI.Graphics();
  vesselMask.beginFill(0xffffff);
  traceVesselOutline(vesselMask);
  vesselMask.endFill();
  app.stage.addChild(vesselMask);
  sandLayer.mask = vesselMask;

  const sandGfx = new PIXI.Graphics();
  const detailGfx = new PIXI.Graphics();
  const streamGfx = new PIXI.Graphics();
  sandLayer.addChild(sandGfx, detailGfx, streamGfx);

  // ── The Descent ─────────────────────────────────────────────────────────
  // Animation loop: advances t from 0 → 1 over DURATION milliseconds.

  const DURATION = 12000;
  let epochStart = null;
  let settled = false;

  app.ticker.add(() => {
    if (settled) return;

    const now = performance.now();
    if (!epochStart) epochStart = now;

    const t = Math.min((now - epochStart) / DURATION, 1);
    if (t >= 1) settled = true;

    renderDrift(sandGfx, detailGfx, streamGfx, t);
  });
})();
