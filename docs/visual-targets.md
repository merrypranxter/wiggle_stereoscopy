# Visual Targets: wiggle_stereoscopy

## What the Depth Effect Should Feel Like

When working correctly the viewer should experience an unmistakable sense of 3D space: near particles float in front of the screen, far particles recede behind it. The effect is immediate and requires no special glasses, training, or convergence adjustment.

A viewer who has never seen wiggle stereoscopy should say **"whoa, that’s 3D"** within the first 2 seconds.

## Aesthetic Regimes

### natural_stereo
- **Baseline:** 6.5 cm (human IPD)
- **Look:** Comfortable, believable depth. Foreground particles clearly in front, background clearly behind.
- **Feel:** Like looking through a window into a 3D space.
- **Test:** Cover one eye — flat. Open both — immediate depth. That’s the cue.

### hyperstereo
- **Baseline:** 30 cm — about the width of a head
- **Look:** Dramatic, almost uncomfortable depth exaggeration. Near particles seem to burst out of the screen.
- **Feel:** Like a 1950s 3D movie poster.
- **Gotcha:** Too much baseline causes diplopia (ghosting) at slow wiggle speeds.

### hypostereo
- **Baseline:** 2 cm — less than a finger-width
- **Look:** Very subtle. Depth is there but gentle, almost imperceptible.
- **Feel:** Hint of volume rather than dramatic pop-out.
- **Use:** For content where overt 3D would be distracting.

### slow_wiggle
- **Frequency:** 2 Hz — clearly visible alternation
- **Look:** You can see the frames flipping. Parallax is very obvious.
- **Feel:** Classic animated GIF wiggle stereoscopy. Nostalgic.
- **Best for:** Educational — the mechanics are legible.

### fast_wiggle
- **Frequency:** 15 Hz — near the fusion threshold
- **Look:** Smooth motion, depth feels ambient rather than flickery.
- **Feel:** Almost like a subtle hologram.
- **Gotcha:** Above ~18 Hz depth starts to fade as frames fuse.

### crossfade
- **Mix:** Sinusoidal dissolve between views
- **Look:** Smooth, ghostly oscillation between the two perspectives.
- **Feel:** Painterly, impressionistic depth. Less pop-out, more atmosphere.
- **Best for:** Artistic/ambient use; pure depth perception is weaker.

## Output Checklist

- [x] Left and right views render to separate FBOs with correct camera shift
- [x] Hard-cut wiggle produces clear parallax depth cue
- [x] Crossfade mode dissolves smoothly between views
- [x] Baseline slider changes depth exaggeration in real-time
- [x] Frequency slider changes toggle speed 1–20 Hz
- [x] Freeze L/R holds a single eye view for comparison
- [x] All 6 regimes load and apply their parameters
- [x] Keyboard shortcuts work (SPC, C, F, G, arrows)
