# wiggle_stereoscopy

> two frames. wiggle. depth.

Wiggle stereoscopy — two frames from slightly different camera positions toggle rapidly to create depth from **motion parallax**. No glasses required. The brain extracts 3D from the oscillating displacement. Surprisingly robust.

**Distinct from:**
- `anaglyph_stereo` — uses coloured filters; requires red/cyan glasses
- `autostereogram` — single image, convergence-based (Magic Eye)

## Running

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080`. The depth effect should be immediately visible.

## How It Works

Each frame, the scene is rendered **twice**: once from a camera shifted +baseline/2 to the right, once shifted -baseline/2 to the left. The two renders are stored in separate FBOs. The wiggle controller alternates which one is displayed (hard cut) or dissolves between them (crossfade).

Objects at depth `z` appear displaced by `Δx = baseline × focal / z` between the two frames. The brain interprets this displacement as depth.

## Controls

| Key | Action |
|-----|--------|
| `Space` | Toggle wiggle on/off |
| `↑ / ↓` | Increase / decrease toggle speed |
| `← / →` | Decrease / increase camera baseline |
| `C` | Toggle crossfade vs hard cut |
| `F` | Freeze on left view |
| `G` | Freeze on right view |

## Regimes

| Regime | Baseline | Freq | Crossfade | Notes |
|--------|----------|------|-----------|-------|
| natural_stereo | 6.5 cm | 8 Hz | off | Human IPD reference |
| hyperstereo | 30 cm | 8 Hz | off | Dramatic depth exaggeration |
| hypostereo | 2 cm | 8 Hz | off | Subtle, gentle depth |
| slow_wiggle | 6.5 cm | 2 Hz | off | Mechanics are legible |
| fast_wiggle | 6.5 cm | 15 Hz | off | Near-fusion, smooth feel |
| crossfade | 6.5 cm | 5 Hz | full | Sinusoidal dissolve |

## The Math

Parallax displacement: `Δx = baseline × f / z`

Camera model: off-axis horizontal shift (not toe-in) — avoids vertical disparity.

Optimal wiggle: **5–10 Hz**. Below 3 Hz = visible flicker. Above 15 Hz = frames start fusing.

See [`docs/math-reference.md`](docs/math-reference.md) for full equations and references.

## Project Structure

```
src/
  js/
    main.js       — render loop, 4-pass pipeline, UI wiring
    camera.js     — StereoCamera class, off-axis shift model
    wiggle.js     — WiggleController: toggle timing + crossfade curve
  shaders/
    scene.vert    — particle positions from gl_VertexID + depth layers
    scene.frag    — depth-coloured particles (warm near, cool far)
    wiggle.frag   — composite left/right FBOs by mix uniform
    crossfade.frag — vignette + film grain post-process
docs/
  math-reference.md  — parallax equations, frequency table, camera model
  visual-targets.md  — per-regime look descriptions, output checklist
```

## Ecosystem

- **Cousin:** `anaglyph_stereo`, `slitscan`
- **Pairs with:** any 3D scene generator as input
