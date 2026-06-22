// camera.js — dual stereo camera: left eye at -baseline/2, right at +baseline/2
// All in normalised scene units (baseline in metres, 1 unit = 1 m)

export class StereoCamera {
  constructor() {
    this.baseline   = 0.065;  // metres (human IPD default)
    this.focalLen   = 1.0;
    this.convergence = 2.0;   // convergence distance (toe-in not used here; off-axis shift instead)
  }

  /** Return {left, right} view-projection matrices as Float32Array[16] each.
   *  Uses asymmetric frustum (off-axis) to avoid the vertical divergence that
   *  toe-in cameras produce — preserves horizontal parallax only.
   *
   *  For a simple wiggle renderer we use a horizontal-shift model:
   *    left  camera:  translate  +baseline/2 along X
   *    right camera:  translate  -baseline/2 along X
   *  The resulting displacement of objects in the two renders is the parallax cue.
   */
  getShifts() {
    return {
      left:  +this.baseline * 0.5,
      right: -this.baseline * 0.5,
    };
  }
}
