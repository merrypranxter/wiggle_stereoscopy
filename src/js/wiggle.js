// wiggle.js — toggle timing and crossfade curve controller

export class WiggleController {
  constructor() {
    this.frequency   = 8.0;    // Hz
    this.crossfade   = 0.0;    // 0 = hard cut, 1 = full sinusoidal crossfade
    this.running     = true;
    this.freezeLeft  = false;
    this.freezeRight = false;
    this._phase      = 0;      // 0..1 within current period
    this._lastTime   = 0;
  }

  /** Call each frame with current time in seconds.
   *  Returns { mix: 0..1, activeView: 'left'|'right' }
   *  mix=0 → pure left,  mix=1 → pure right
   */
  tick(t) {
    if (this.freezeLeft)  return { mix: 0.0, activeView: 'left' };
    if (this.freezeRight) return { mix: 1.0, activeView: 'right' };
    if (!this.running)    return { mix: 0.0, activeView: 'left' };

    const period = 1.0 / this.frequency;
    this._phase  = (t % period) / period;  // 0..1 sawtooth

    let mix;
    if (this.crossfade < 0.01) {
      // Hard cut: step at phase 0.5
      mix = this._phase >= 0.5 ? 1.0 : 0.0;
    } else {
      // Sinusoidal crossfade: 0..1..0 per period
      const raw = 0.5 + 0.5 * Math.sin(this._phase * Math.PI * 2);
      // Blend between hard cut (crossfade=0) and full sine (crossfade=1)
      const hard = this._phase >= 0.5 ? 1.0 : 0.0;
      mix = hard * (1 - this.crossfade) + raw * this.crossfade;
    }

    return { mix, activeView: mix > 0.5 ? 'right' : 'left' };
  }
}
