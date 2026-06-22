#version 300 es
// scene.frag — colour particles by depth
// Near = warm white, far = cool blue, mid = cyan-teal.
// Depth-based alpha keeps near particles opaque, far ones translucent.
precision highp float;

in float v_depth;
in float v_brightness;

uniform float u_time;

out vec4 fragColor;

void main() {
    // Soft disc shape
    vec2  c = gl_PointCoord - 0.5;
    float d = dot(c, c) * 4.0;
    if (d > 1.0) discard;
    float edge = 1.0 - smoothstep(0.45, 1.0, d);

    // Depth colour gradient:
    // near (0) → warm white  |  mid → cyan  |  far (1) → cool blue
    vec3 c_near = vec3(1.00, 0.95, 0.80);
    vec3 c_mid  = vec3(0.40, 0.90, 0.95);
    vec3 c_far  = vec3(0.30, 0.45, 1.00);
    vec3 col;
    if (v_depth < 0.5) col = mix(c_near, c_mid, v_depth * 2.0);
    else               col = mix(c_mid,  c_far, (v_depth - 0.5) * 2.0);

    // Per-particle brightness variation + twinkle
    col *= 0.55 + 0.45 * v_brightness;
    col *= 0.88 + 0.12 * sin(u_time * 3.1 + v_brightness * 19.7);

    // Alpha: near=bright/opaque, far=dim/translucent
    float alpha = edge * mix(0.92, 0.35, v_depth);
    fragColor   = vec4(col, alpha);
}
