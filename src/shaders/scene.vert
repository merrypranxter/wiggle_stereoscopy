#version 300 es
// scene.vert — particle scene rendered from one camera eye
// Position computed from gl_VertexID (no buffer needed).
// Each particle gets a stable pseudo-random XY position and a depth layer.
// Camera horizontal shift (off-axis model) creates the parallax displacement.
precision highp float;

uniform float u_cam_shift;    // +/- baseline/2, in scene units
uniform float u_focal;        // perspective focal length
uniform float u_aspect;       // W/H
uniform float u_time;
uniform float u_layer;        // normalised depth 0=near..1=far
uniform float u_layer_count;
uniform float u_drift;        // animation strength 0..1

out float v_depth;
out float v_brightness;

float rnd(float s)  { return fract(sin(s * 127.1 + 311.7) * 43758.5453); }
float rnd2(vec2 s)  { return fract(sin(dot(s, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
    float idx = float(gl_VertexID);
    float seed = idx * 0.017 + u_layer * 100.0;

    // Stable base position
    float x0 = rnd(seed)       * 2.0 - 1.0;
    float y0 = rnd(seed + 0.5) * 2.0 - 1.0;

    // Slow animated drift
    float dx = sin(u_time * 0.20 + idx * 0.010) * u_drift * 0.06;
    float dy = cos(u_time * 0.17 + idx * 0.013) * u_drift * 0.05;
    float x  = x0 + dx;
    float y  = y0 + dy;

    // Perspective: map layer 0..1 to depth 0.4..5.0
    // Off-axis parallax shift: proj_x = (scene_x + cam_shift) * focal / depth
    float depth_z = mix(0.4, 5.0, u_layer);
    float proj_x  = (x + u_cam_shift) * u_focal / depth_z;
    float proj_y  =  y                 * u_focal / depth_z;
    proj_x       /= u_aspect;

    // Point size: large near, small far
    float sz = mix(10.0, 1.5, u_layer);

    v_depth      = u_layer;
    v_brightness = rnd2(vec2(idx, u_layer + 0.1));

    gl_Position  = vec4(proj_x, proj_y, 0.0, 1.0);
    gl_PointSize = clamp(sz, 1.0, 32.0);
}
