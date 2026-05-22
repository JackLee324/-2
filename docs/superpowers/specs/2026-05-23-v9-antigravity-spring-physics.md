# Splash Screen V9.0: Antigravity Spring Physics Engine

## Context

V8.0 "Singularity Force" used convergence-driven particle assembly with a golden glow logo overlay. User demands a complete refactor to 1:1 replicate the classic "Antigravity" interactive effect: a pure spring-physics particle system where the emblem is formed by particles themselves, with mouse-driven fluid repulsion.

## Architecture

### Layer Stack
```
z-index: 9999 — canvas#splash-canvas (all particles rendered here)
[off-screen]   — hidden div with logo-src img + logo-canvas for pixel extraction
```

### Removed from V8.0
- `img#splash-logo` — no overlay image
- `div#splash-white` — no white mask
- `div#click-hint` — no hint text
- `@keyframes logo-reveal-glow` — no golden glow
- All phase-based animation (explosion/float/magnetic/reveal)

### HTML
```html
<canvas id="splash-canvas"></canvas>
<!-- Hidden pixel extraction (unchanged) -->
<div style="position:absolute;left:-9999px;top:-9999px;width:528px;height:280px;overflow:hidden;pointer-events:none;">
  <img id="logo-src" src="logo.png" style="width:528px;height:280px;opacity:0;" crossorigin="anonymous">
  <canvas id="logo-canvas" width="528" height="280" style="width:528px;height:280px;"></canvas>
</div>
```

### CSS (~8 lines)
```css
#splash-canvas {
  position:fixed; top:0; left:0; width:100vw; height:100vh;
  z-index:9999; cursor:pointer;
  transition: opacity 0.8s ease;
}
#splash-canvas.fade-out {
  opacity:0; pointer-events:none;
}
```

## Physics Engine

### Particle Class

```
Properties:
  baseX, baseY  — target anchor position (never deviates)
  x, y          — current real-time position
  vx, vy        — velocity
  color          — 'rgb(r,g,b)' from source pixel
  radius         — 1.5–2.0px flat 2D dot

Constructor:
  - Set baseX/baseY from anchor pixel + canvas transform
  - Assign color from sampled pixel
  - Random radius 1.5–2.0px
  - Initial position: random screen edge (4 edges equally)
  - vx=0, vy=0 (spring pulls them in)
```

### Per-Frame Physics (update method)

Four steps, executed for every particle every frame:

1. **Mouse Repulsion**: if distance < MOUSE_RADIUS (100px), push particle away
   - Force proportional to (MOUSE_RADIUS - distance) / MOUSE_RADIUS
   - Direction: unit vector from mouse to particle
   - Scale by MOUSE_FORCE (8)

2. **Spring Return**: Hooke's law toward baseX/baseY
   - `vx += (baseX - x) * SPRING * dt`
   - SPRING = 0.05

3. **Air Damping**: `vx *= FRICTION; vy *= FRICTION`
   - FRICTION = 0.92

4. **Position Update**: `x += vx; y += vy`

### Rendering Loop

```
Each frame:
  1. Normalize dt (cap at 3x to avoid spiral of death)
  2. Fill canvas with pure white (#ffffff)
  3. For each particle:
     a. update(dt, mouseX, mouseY)
     b. ctx.arc(x, y, radius, 0, 2*PI) with particle.color
  4. requestAnimationFrame(loop) if not dismissed
```

No `globalCompositeOperation` changes — always default `source-over`.

## Pixel Sampling

### Logo Source
- File: `public/logo.png`
- Dimensions: 528 × 280 pixels
- Format: 8-bit RGBA, non-interlaced
- Non-transparent pixels: ~25,755

### Sampling Algorithm
- Step size: 2 (sample every 2nd pixel in both x and y)
- Skip pixels with alpha <= 80
- Skip near-black pixels (RGB average < 15)
- Expected particle count: ~6,400
- Record: pixel (x, y) mapped to sprite coordinate, and (r, g, b) color

### Coordinate Mapping
- Compute scale: `min(canvasW/LOGO_W, canvasH/LOGO_H) * 0.85`
- Center the emblem on canvas
- Each sampled pixel → canvas-space (baseX, baseY)

### Fallback
If logo sampling yields < 500 anchors, generate synthetic green ellipse anchors (same as V8.0).

## Entry Animation

Particles start at random positions along the 4 screen edges. Spring physics automatically pulls them to anchor positions. No separate "explosion phase" — the spring IS the animation.

Timeline:
- t=0ms: particles scattered at screen edges
- t=~800ms: emblem outline emerges
- t=~1500ms: all particles settled, perfect emblem formed

## Interaction & Exit

### Mouse Interaction (always active after entry)
- Mouse move over canvas: particles repel fluidly
- Mouse leave: mouseX/Y set to -9999, repulsion disabled
- No mouse: all particles sit exactly at baseX/baseY forming perfect emblem

### Exit (click to dismiss)
- Click canvas → `dismissed = true` → `canvas.classList.add('fade-out')`
- 800ms CSS transition: canvas opacity 1 → 0
- After 800ms: `canvas.remove()`, hidden extraction div removed, particles array cleared

### Touch Support
- touchstart/touchmove: update mouseX/Y from first touch
- Same repulsion physics as mouse
- Click to dismiss via touch

### Resize Handling
- Recompute all baseX/baseY from anchors on window resize
- Particles spring to new positions

## Parameters

| Parameter | Value | Description |
|---|---|---|
| SAMPLE_STEP | 2 | Pixel sampling step (~6,400 particles) |
| PARTICLE_RADIUS | 1.5–2.0 | Random range, flat 2D dots |
| MOUSE_RADIUS | 100px | Mouse repulsion zone radius |
| MOUSE_FORCE | 8 | Repulsion strength multiplier |
| SPRING | 0.05 | Spring stiffness (Hooke's law coefficient) |
| FRICTION | 0.92 | Air damping per frame |
| LOGO_W / LOGO_H | 528 / 280 | Logo source dimensions |
| LOGO_SCALE | 0.85 | Emblem size relative to viewport |

## What Stays from V8.0

- IIFE wrapper: `!function(){'use strict'}()`
- `hash()`, `lerp()` utilities
- `sampleLogoPixels()` — modified to accept step parameter
- `computeTargets()` — unchanged coordinate mapping
- `assignTargets()` — unchanged anchor-to-particle assignment
- `createFallbackAnchors()` — unchanged synthetic fallback
- Hidden pixel extraction HTML (logo-src + logo-canvas)

## What Is Removed (vs V8.0)

- `noise2()`, `noiseOffset`, `easeOutBack()` — no random drift, no easing curves
- `updateExplosion()`, `updateFloat()`, `updateMagnetic()` — no phase-split physics
- `triggerPageReveal()` + multi-phase setTimeout orchestration — no reveal pipeline
- All phase state: `phase`, `explosionStart`, `magneticStart`, `currentConvergence`, `revealPhase`
- All phase constants: `PARTICLE_COUNT`, `EXPLOSION_MS`, `EXPLOSION_SPEED_MIN/MAX`, `EXPLOSION_FRICTION`, `FRICTION_FLOAT`, `NOISE_SCALE`, `NOISE_STRENGTH`, `AUTO_TRIGGER_MS`, `REVEAL_THRESHOLD`, `SNAP_THRESHOLD`, `REVEAL_FADE_MS`, `LOGO_GLOW_MS`, `MOUSE_RADIUS`(V8.0=180), `MOUSE_FORCE`(V8.0=2.5), `FRICTION_FLOAT`
- `settled`, `_hasInitialDist`, `_initialDist` properties
- `distToTarget()`, `initialDist()` methods
- `img#splash-logo`, `div#splash-white`, `div#click-hint`
- CSS: `.logo-reveal-glow`, `@keyframes logo-reveal-glow`, `@keyframes pulse-hint`, `#splash-logo`, `#splash-white`, `#click-hint`
- Console log tags: all `[V8.0]` → `[V9.0]`

## Verification

1. Start server, open `http://localhost:3000`
2. **Entry**: 6,400 colored dots burst from screen edges, spring into center within ~1.5s
3. **Rest state**: Zero mouse → all particles sit exactly at anchors, forming a razor-sharp emblem with readable text
4. **Background**: Pure #ffffff white, zero color cast, ellipses, or glows
5. **Mouse interaction**: Moving mouse over emblem → particles ripple outward like water. Leave mouse → spring back cleanly
6. **Click dismiss**: Click canvas → 0.8s fade → all splash DOM removed
7. **Resize**: Particles automatically re-anchor to new center position
8. **Console**: `[V9.0] Sampled ~6400 anchor pixels` → particles form emblem
9. **Touch**: Same fluid repulsion on touch devices
10. **Edge cases**: No logo load (fallback anchors), rapid resize, double click guard
