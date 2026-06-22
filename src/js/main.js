// main.js — wiggle stereoscopy WebGL2 renderer
// Architecture:
//   1. Render scene from LEFT camera into FBO A
//   2. Render scene from RIGHT camera into FBO B
//   3. Composite A+B with wiggle mix uniform → screen

import { StereoCamera } from './camera.js';
import { WiggleController } from './wiggle.js';

const canvas  = document.getElementById('gl');
const gl      = canvas.getContext('webgl2');
if (!gl) { document.body.innerHTML = '<p style="color:#fff;padding:2rem">WebGL2 required</p>'; }

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// ─── Params ──────────────────────────────────────────────────────────────────
const P = {
  baseline:       0.065,
  focal:          1.0,
  frequency:      8.0,
  crossfade_mix:  0.0,
  depth_layers:   5,
  particle_count: 800,
  scene_drift:    0.2,
  wiggleOn:       true,
  freezeL:        false,
  freezeR:        false,
};

const REGIMES = {
  natural_stereo:  { baseline:6.5,  frequency:8,   crossfade_mix:0,    focal:1.0, depth_layers:5  },
  hyperstereo:     { baseline:30.0, frequency:8,   crossfade_mix:0,    focal:1.0, depth_layers:7  },
  hypostereo:      { baseline:2.0,  frequency:8,   crossfade_mix:0,    focal:1.0, depth_layers:5  },
  slow_wiggle:     { baseline:6.5,  frequency:2,   crossfade_mix:0,    focal:1.0, depth_layers:5  },
  fast_wiggle:     { baseline:6.5,  frequency:15,  crossfade_mix:0,    focal:1.0, depth_layers:5  },
  crossfade:       { baseline:6.5,  frequency:5,   crossfade_mix:1.0,  focal:1.0, depth_layers:5  },
};

const camera  = new StereoCamera();
const wiggle  = new WiggleController();

// ─── Shaders ─────────────────────────────────────────────────────────────────

// Scene vertex shader — renders particles/points with per-layer depth and camera shift
const SCENE_VS = `#version 300 es
precision highp float;

uniform float u_cam_shift;    // left=-baseline/2, right=+baseline/2
uniform float u_focal;
uniform float u_aspect;
uniform float u_time;
uniform float u_layer;        // 0..1 depth of this layer
uniform float u_layer_count;
uniform float u_drift;

out float v_depth;
out float v_brightness;

const float PI = 3.14159265;
const float PHI = 1.61803398;

// Pseudo-random from seed
float rnd(float s) { return fract(sin(s * 127.1 + 311.7) * 43758.5453); }
float rnd2(vec2 s) { return fract(sin(dot(s, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  float idx = float(gl_VertexID);

  // Assign each point a stable position in 3D based on instance ID
  float seed = idx * 0.017 + u_layer * 100.0;
  float x_base = rnd(seed) * 2.0 - 1.0;
  float y_base = rnd(seed + 0.5) * 2.0 - 1.0;
  float z      = u_layer;   // depth 0=near, 1=far

  // Slow drift animation
  float drift_x = sin(u_time * 0.2 + idx * 0.01) * u_drift * 0.05;
  float drift_y = cos(u_time * 0.17 + idx * 0.013) * u_drift * 0.04;
  float x = x_base + drift_x;
  float y = y_base + drift_y;

  // Perspective projection with camera horizontal shift
  // Off-axis model: shift X in image space by baseline/(2*z) for parallax
  float depth_z = mix(0.5, 4.0, z);   // map 0..1 to 0.5..4.0 metres
  float proj_x  = (x + u_cam_shift) * u_focal / depth_z;
  float proj_y  = y * u_focal / depth_z;

  // Correct for aspect
  proj_x /= u_aspect;

  // Size inversely proportional to depth (near = big, far = small)
  float sz = mix(8.0, 1.5, z);

  v_depth = z;
  v_brightness = rnd2(vec2(idx, u_layer));

  gl_Position  = vec4(proj_x, proj_y, 0.0, 1.0);
  gl_PointSize = sz;
}`;

// Scene fragment shader — colour particles by depth layer
const SCENE_FS = `#version 300 es
precision highp float;

in float v_depth;
in float v_brightness;

uniform float u_time;

out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c,c)*4.0;
  if (d > 1.0) discard;
  float edge = 1.0 - smoothstep(0.5, 1.0, d);

  // Near = warm-white, far = cool-blue, mid = cyan
  vec3 near  = vec3(1.0,  0.95, 0.85);
  vec3 far   = vec3(0.35, 0.55, 1.0);
  vec3 col   = mix(near, far, v_depth);
  col *= (0.6 + 0.4 * v_brightness);

  // Subtle twinkle
  col *= 0.85 + 0.15 * sin(u_time * 3.0 + v_brightness * 17.0);

  float alpha = edge * mix(0.9, 0.4, v_depth);
  fragColor = vec4(col, alpha);
}`;

// Full-screen quad VS
const QUAD_VS = `#version 300 es
in vec2 a_pos;
out vec2 vUv;
void main() { vUv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0,1); }`;

// Wiggle composite FS — blends left/right FBO textures by mix value
const WIGGLE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D u_left;
uniform sampler2D u_right;
uniform float u_mix;         // 0=left, 1=right
uniform float u_baseline_norm; // for chromatic shift hint
out vec4 fragColor;

void main() {
  vec4 L = texture(u_left,  vUv);
  vec4 R = texture(u_right, vUv);
  // Crossfade between views
  vec4 col = mix(L, R, u_mix);
  fragColor = col;
}`;

// Crossfade post-process FS — adds subtle edge sharpening and vignette
const CROSSFADE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D u_tex;
uniform float u_time;
out vec4 fragColor;

void main() {
  vec3 col = texture(u_tex, vUv).rgb;
  // Vignette
  float d = length(vUv - 0.5);
  col *= 1.0 - d*d*0.7;
  // Film-grain micro texture
  float grain = fract(sin(dot(vUv, vec2(127.1 + u_time, 311.7 + u_time * 0.7))) * 43758.5) * 0.03 - 0.015;
  col += grain;
  fragColor = vec4(max(col,vec3(0)), 1.0);
}`;

// ─── GL helpers ──────────────────────────────────────────────────────────────
function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(s));
  }
  return s;
}
function linkProgram(vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl.VERTEX_SHADER,   vsSrc));
  gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
  return p;
}
function makeFBO(w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}
function u(prog, name) { return gl.getUniformLocation(prog, name); }

// ─── Programs ────────────────────────────────────────────────────────────────
const sceneProg    = linkProgram(SCENE_VS,   SCENE_FS);
const wiggleProg   = linkProgram(QUAD_VS,    WIGGLE_FS);
const crossProg    = linkProgram(QUAD_VS,    CROSSFADE_FS);

const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

// Empty VAO for instanced particle draw
const emptyVAO = gl.createVertexArray();

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', () => { resize(); rebuildFBOs(); });

let W = canvas.width, H = canvas.height;
let fboL = makeFBO(W, H);
let fboR = makeFBO(W, H);
let fboComp = makeFBO(W, H);

function rebuildFBOs() {
  W = canvas.width; H = canvas.height;
  fboL = makeFBO(W, H); fboR = makeFBO(W, H); fboComp = makeFBO(W, H);
}

// ─── UI wiring ───────────────────────────────────────────────────────────────
const SLIDER_PREC = { baseline:2, focal:2, frequency:2, crossfade_mix:2, depth_layers:0, particle_count:0, scene_drift:2 };
['baseline','focal','frequency','crossfade_mix','depth_layers','particle_count','scene_drift'].forEach(id => {
  const el  = document.getElementById(id);
  const val = document.getElementById('v-'+id);
  if (!el) return;
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    P[id] = id === 'depth_layers' || id === 'particle_count' ? Math.round(v) : v;
    val.textContent = v.toFixed(SLIDER_PREC[id]||2);
    if (id === 'baseline')      camera.baseline = v / 100;
    if (id === 'focal')         camera.focalLen = v;
    if (id === 'frequency')     wiggle.frequency = v;
    if (id === 'crossfade_mix') wiggle.crossfade = v;
  });
});

document.querySelectorAll('.rbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyRegime(btn.dataset.regime);
  });
});

function applyRegime(name) {
  const r = REGIMES[name];
  if (!r) return;
  Object.assign(P, r);
  camera.baseline = r.baseline / 100;
  camera.focalLen = r.focal;
  wiggle.frequency  = r.frequency;
  wiggle.crossfade  = r.crossfade_mix;
  // Update sliders
  const map = { baseline: r.baseline, focal: r.focal, frequency: r.frequency, crossfade_mix: r.crossfade_mix, depth_layers: r.depth_layers };
  for (const [id, val] of Object.entries(map)) {
    const el  = document.getElementById(id);
    const ve  = document.getElementById('v-' + id);
    if (!el || !ve) continue;
    el.value = val;
    ve.textContent = parseFloat(val).toFixed(SLIDER_PREC[id]||2);
  }
}

const btnWiggle  = document.getElementById('btn-wiggle');
const btnFreezeL = document.getElementById('btn-freeze-l');
const btnFreezeR = document.getElementById('btn-freeze-r');

function updateBtns() {
  btnWiggle.classList.toggle('active',  P.wiggleOn);
  btnWiggle.textContent = P.wiggleOn ? 'wiggle ON' : 'wiggle OFF';
  btnFreezeL.classList.toggle('active', P.freezeL);
  btnFreezeR.classList.toggle('active', P.freezeR);
}
btnWiggle.addEventListener('click', () => { P.wiggleOn = !P.wiggleOn; wiggle.running = P.wiggleOn; updateBtns(); });
btnFreezeL.addEventListener('click', () => { P.freezeL = !P.freezeL; P.freezeR = false; wiggle.freezeLeft = P.freezeL; wiggle.freezeRight = false; updateBtns(); });
btnFreezeR.addEventListener('click', () => { P.freezeR = !P.freezeR; P.freezeL = false; wiggle.freezeRight = P.freezeR; wiggle.freezeLeft = false; updateBtns(); });

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  switch (e.code) {
    case 'Space':    P.wiggleOn = !P.wiggleOn; wiggle.running = P.wiggleOn; break;
    case 'KeyC':     P.crossfade_mix = P.crossfade_mix > 0.5 ? 0 : 1; wiggle.crossfade = P.crossfade_mix;
                     document.getElementById('crossfade_mix').value = P.crossfade_mix;
                     document.getElementById('v-crossfade_mix').textContent = P.crossfade_mix.toFixed(2); break;
    case 'KeyF':     P.freezeL = !P.freezeL; P.freezeR = false; wiggle.freezeLeft = P.freezeL; wiggle.freezeRight = false; break;
    case 'KeyG':     P.freezeR = !P.freezeR; P.freezeL = false; wiggle.freezeRight = P.freezeR; wiggle.freezeLeft = false; break;
    case 'ArrowUp':  P.frequency = Math.min(20, P.frequency + 1); wiggle.frequency = P.frequency;
                     document.getElementById('frequency').value = P.frequency;
                     document.getElementById('v-frequency').textContent = P.frequency.toFixed(2); break;
    case 'ArrowDown':P.frequency = Math.max(1, P.frequency - 1);  wiggle.frequency = P.frequency;
                     document.getElementById('frequency').value = P.frequency;
                     document.getElementById('v-frequency').textContent = P.frequency.toFixed(2); break;
    case 'ArrowLeft':P.baseline = Math.max(0, P.baseline - 1); camera.baseline = P.baseline/100;
                     document.getElementById('baseline').value = P.baseline;
                     document.getElementById('v-baseline').textContent = P.baseline.toFixed(2); break;
    case 'ArrowRight':P.baseline = Math.min(60, P.baseline + 1); camera.baseline = P.baseline/100;
                      document.getElementById('baseline').value = P.baseline;
                      document.getElementById('v-baseline').textContent = P.baseline.toFixed(2); break;
  }
  updateBtns();
});

// FPS counter
let frameCount = 0, lastFPS = performance.now();
const fpsEl = document.getElementById('fps');

// ─── Render ──────────────────────────────────────────────────────────────────
function drawScene(camShift, t) {
  gl.viewport(0, 0, W, H);
  gl.clearColor(0.02, 0.02, 0.04, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const aspect = W / H;
  gl.useProgram(sceneProg);
  gl.bindVertexArray(emptyVAO);

  gl.uniform1f(u(sceneProg,'u_cam_shift'), camShift);
  gl.uniform1f(u(sceneProg,'u_focal'), camera.focalLen);
  gl.uniform1f(u(sceneProg,'u_aspect'), aspect);
  gl.uniform1f(u(sceneProg,'u_time'), t);
  gl.uniform1f(u(sceneProg,'u_drift'), P.scene_drift);
  gl.uniform1f(u(sceneProg,'u_layer_count'), P.depth_layers);

  // Draw each depth layer
  for (let l = 0; l < P.depth_layers; l++) {
    const layerT = P.depth_layers === 1 ? 0.5 : l / (P.depth_layers - 1);
    gl.uniform1f(u(sceneProg,'u_layer'), layerT);
    gl.drawArrays(gl.POINTS, 0, P.particle_count);
  }
}

function drawQuad(prog) {
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function render(now) {
  requestAnimationFrame(render);
  const t = now * 0.001;

  frameCount++;
  if (now - lastFPS > 1000) { fpsEl.textContent = frameCount + ' fps'; frameCount = 0; lastFPS = now; }

  const { left: shiftL, right: shiftR } = camera.getShifts();
  const { mix, activeView }             = wiggle.tick(t);

  // Update state label
  const stateEl = document.getElementById('wiggle-state');
  if (P.freezeL) stateEl.textContent = '— frozen: left view —';
  else if (P.freezeR) stateEl.textContent = '— frozen: right view —';
  else if (!P.wiggleOn) stateEl.textContent = '— wiggle paused —';
  else stateEl.textContent = `— ${activeView} — ${P.frequency.toFixed(1)} Hz —`;

  gl.enable(gl.BLEND);

  // Pass 1: render left view → fboL
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboL.fbo);
  drawScene(shiftL, t);

  // Pass 2: render right view → fboR
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboR.fbo);
  drawScene(shiftR, t);

  // Pass 3: composite left + right → fboComp via wiggle mix
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboComp.fbo);
  gl.viewport(0, 0, W, H);
  gl.disable(gl.BLEND);
  gl.useProgram(wiggleProg);

  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fboL.tex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fboR.tex);
  gl.uniform1i(u(wiggleProg,'u_left'),  0);
  gl.uniform1i(u(wiggleProg,'u_right'), 1);
  gl.uniform1f(u(wiggleProg,'u_mix'),   mix);
  gl.uniform1f(u(wiggleProg,'u_baseline_norm'), camera.baseline / 0.065);
  drawQuad(wiggleProg);

  // Pass 4: post-process (vignette + grain) → screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  gl.useProgram(crossProg);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fboComp.tex);
  gl.uniform1i(u(crossProg,'u_tex'), 0);
  gl.uniform1f(u(crossProg,'u_time'), t);
  drawQuad(crossProg);
}

requestAnimationFrame(render);
