#version 300 es
// crossfade.frag — post-process pass: vignette + film grain
// Applied after the wiggle composite to add atmosphere.
// Film grain is subtle (< 2%) so it doesn’t overwhelm the depth cue.
precision highp float;

in vec2 vUv;

uniform sampler2D u_tex;
uniform float     u_time;

out vec4 fragColor;

void main() {
    vec3 col = texture(u_tex, vUv).rgb;

    // Vignette — soft circular falloff from centre
    float dist = length(vUv - 0.5);
    float vign = 1.0 - smoothstep(0.45, 0.9, dist) * 0.65;
    col       *= vign;

    // Film grain — hash from UV + time
    float grain = fract(sin(dot(vUv + u_time * 0.031, vec2(127.1, 311.7))) * 43758.5)
                  * 0.028 - 0.014;
    col        += grain;

    // Mild gamma lift — keeps blacks from crushing
    col = pow(max(col, vec3(0.0)), vec3(0.92));

    fragColor = vec4(col, 1.0);
}
