#version 300 es
// wiggle.frag — composite left and right eye FBO textures
// u_mix = 0.0 → pure left view
// u_mix = 1.0 → pure right view
// u_mix = 0..1 → crossfade between views (crossfade mode)
//
// Hard cut: u_mix is stepped 0 or 1 by the JS WiggleController
// Soft crossfade: u_mix follows 0.5 + 0.5*sin(2π t freq) in JS
//
// The parallax cue works even with mix=0.5 (simultaneous blend) but
// depth perception is strongest with mix=0 or 1 (hard alternation).
precision highp float;

in vec2 vUv;

uniform sampler2D u_left;
uniform sampler2D u_right;
uniform float     u_mix;            // 0=left, 1=right
uniform float     u_baseline_norm;  // baseline / IPD, for optional effects

out vec4 fragColor;

void main() {
    vec4 L = texture(u_left,  vUv);
    vec4 R = texture(u_right, vUv);
    fragColor = mix(L, R, u_mix);
}
