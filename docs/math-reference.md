# Math Reference: wiggle_stereoscopy

## Motion Parallax Depth Cue

The brain perceives depth from the *relative displacement* of objects between two views:

```
Δx = baseline × f / z
```

- `Δx` = horizontal pixel displacement of an object between left and right frames
- `baseline` = separation between the two camera positions
- `f` = focal length (perspective scale factor)
- `z` = depth of the object (distance from camera)

**Key insight:** objects at large `z` (far away) shift very little between frames. Objects at small `z` (close) shift a lot. This differential shift is the parallax depth cue.

## Camera Model: Off-Axis Shift

This implementation uses the **off-axis horizontal shift** model rather than toe-in cameras.

```
left  camera: project (x + baseline/2,  y) / z
right camera: project (x - baseline/2,  y) / z
```

Toe-in (rotating cameras inward) causes vertical parallax (keystone distortion) which is uncomfortable and breaks the depth cue. Off-axis shift preserves zero vertical disparity.

## Optimal Toggle Frequency

| Frequency | Effect |
|-----------|--------|
| < 3 Hz    | Visible flicker, but parallax cue very clear |
| 5–10 Hz   | **Optimal zone**: depth from wiggle, acceptable flicker |
| > 12 Hz   | Approaches fusion; depth weakens, motion blur |
| > 20 Hz   | Fused into single image; stereoscopic depth lost |

The brain's depth-from-motion mechanism operates best in the 5–10 Hz range where frames alternate fast enough to feel like motion but slow enough to compare.

## Crossfade Curve

**Hard cut:**
```
mix(t) = t ≥ T/2 ? 1.0 : 0.0      (T = 1/frequency)
```

**Sinusoidal crossfade:**
```
mix(t) = 0.5 + 0.5 × sin(2π t f)
```

The crossfade variant produces a smoother dissolve but weaker parallax because the brain never sees a pure single-eye view; it always blends both. Hard cut is stronger for depth perception; crossfade is more aesthetically pleasant.

## Baseline Values

| Regime | Baseline | Use |
|--------|----------|-----|
| Hypostereo | 1–4 cm | Subtle depth, natural feel |
| Natural stereo | 6.5 cm | Human IPD — reference |
| Hyperstereo | 10–60 cm | Exaggerated, dramatic depth |
| Landscape scale | > 1 m | Miniaturization effect (objects look tiny) |

## References

- Julesz, B. (1971). *Foundations of Cyclopean Perception*. U of Chicago Press.
- Gasperini, J. (1998). Wiggle 3D — the original digital wiggle stereoscopy technique.
- Wheatstone, C. (1838). On some remarkable and hitherto unobserved phenomena of binocular vision. *Phil. Trans. R. Soc.* 128.
