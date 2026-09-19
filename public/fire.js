/* ==========================================================================
   fire.js - the paper fire, and the burn-away transition.  v3.

   THE PAPER FIRE is not a simulation of fire.  It is a little sculpture made
   of cut paper: five to seven flat sheets of graded colour, deep lacquer red
   at the back through vermilion, orange and saffron to a pale cream core,
   each one cut into a flame silhouette with a torn edge, each drifting at its
   own speed, each dropping a soft shadow on the sheet behind it.  That shadow
   is what makes the paper read as thick.  The sheets slide by different
   amounts with the pointer and the scroll, which is the 2.5D, and they part a
   little where the pointer is.  A few tiny paper flecks lift off it.

   THE BURN-AWAY is the same paper, being eaten by a charred, glowing edge
   travelling out from a point (the lock).  What is behind shows through.

   Both are GLSL fragment shaders on a flat quad, drawn by the one stage in
   gl.js.  The paper fibre is a Canvas 2D texture.

   Public API
   ----------
     mountFire(stage, el, opts)       -> { setNight, setIntensity, remove }
         opts: sheets 5..7, spread 0..1 (how wide), base 0..1 (how far up the
               foot of the flame sits), intensity, embers 0..1, night 0..1
     makeFireMaterial(THREE, opts)    -> ShaderMaterial, for a plane inside
                                          somebody else's 3D scene (sconces)
     burnAway(stage, opts)            -> Promise
         opts: el (default: the whole viewport), origin {x,y} in CSS pixels,
               duration ms, freeze 0..1 (hold at that progress, for ?burn=),
               paper '#hex'
     paperTexture(THREE)              -> the shared fibre texture
     setPointer(x, y)                 -> -1..1, normalised; called for you

   Nothing here touches the DOM beyond reading rectangles.
   ========================================================================== */

let _paperTex = null;
let _pointer = { x: 0, y: 0, tx: 0, ty: 0 };
let _pointerBound = false;

/* --- the paper fibre, drawn on a 2D canvas ------------------------------- */

export function paperTexture(THREE) {
  if (_paperTex) return _paperTex;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');

  g.fillStyle = '#7f7f7f';
  g.fillRect(0, 0, S, S);

  // Fibres: short strokes at every angle, faintly lighter and darker.
  g.lineCap = 'round';
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const a = Math.random() * Math.PI;
    const len = 4 + Math.random() * 26;
    const light = Math.random() > 0.5;
    g.strokeStyle = light ? 'rgba(255,255,255,.055)' : 'rgba(0,0,0,.05)';
    g.lineWidth = 0.6 + Math.random() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // A few heavier flecks, the way handmade paper has bits in it.
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.09)';
    g.beginPath();
    g.ellipse(Math.random() * S, Math.random() * S, 0.6 + Math.random() * 2.4,
      0.5 + Math.random() * 1.2, Math.random() * 3.14, 0, 6.2832);
    g.fill();
  }
  // Fine tooth.
  const img = g.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  _paperTex = new THREE.CanvasTexture(c);
  _paperTex.wrapS = _paperTex.wrapT = THREE.RepeatWrapping;
  _paperTex.minFilter = THREE.LinearMipmapLinearFilter;
  _paperTex.generateMipmaps = true;
  return _paperTex;
}

/* --- the pointer, shared by every fire on the page ----------------------- */

export function setPointer(x, y) { _pointer.tx = x; _pointer.ty = y; }

function bindPointer() {
  if (_pointerBound) return;
  _pointerBound = true;
  window.addEventListener('pointermove', (e) => {
    setPointer((e.clientX / window.innerWidth) * 2 - 1,
      (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
}

function easePointer(dt) {
  const k = 1 - Math.pow(0.001, Math.max(0.001, dt));
  _pointer.x += (_pointer.tx - _pointer.x) * k;
  _pointer.y += (_pointer.ty - _pointer.y) * k;
}

/* --- shared GLSL --------------------------------------------------------- */

const NOISE = `
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}`;

const VERT = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FIRE_FRAG = `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uAspect;     /* width / height of the rectangle we fill */
uniform vec2  uPointer;    /* -1..1 across the viewport, smoothed */
uniform float uScroll;     /* -1..1, where this fire sits in the viewport */
uniform float uSheets;     /* 5 to 7 */
uniform float uSpread;     /* 0..1, how wide each flame stands in its cell */
uniform float uBase;       /* 0..1, where the foot of the flame sits */
uniform float uHeight;     /* 0..1, how far up the rectangle the tips reach */
uniform float uCount;      /* how many flames across: 1 for a torch, 5 for a pit */
uniform float uFloor;      /* 0, or the height of the paper band along the foot */
uniform float uNight;      /* 0 afternoon, 1 night */
uniform float uIntensity;
uniform float uEmbers;
uniform float uOpacity;
uniform sampler2D uPaper;

${NOISE}

/* deep lacquer red -> vermilion -> orange -> saffron -> pale cream */
vec3 palette(float t){
  vec3 c0 = vec3(0.325, 0.051, 0.067);
  vec3 c1 = vec3(0.561, 0.106, 0.078);
  vec3 c2 = vec3(0.765, 0.227, 0.071);
  vec3 c3 = vec3(0.886, 0.400, 0.102);
  vec3 c4 = vec3(0.945, 0.612, 0.169);
  vec3 c5 = vec3(0.969, 0.808, 0.478);
  vec3 c6 = vec3(0.988, 0.949, 0.855);
  float s = clamp(t, 0.0, 1.0) * 6.0;
  if (s < 1.0) return mix(c0, c1, s);
  if (s < 2.0) return mix(c1, c2, s - 1.0);
  if (s < 3.0) return mix(c2, c3, s - 2.0);
  if (s < 4.0) return mix(c3, c4, s - 3.0);
  if (s < 5.0) return mix(c4, c5, s - 4.0);
  return mix(c5, c6, s - 5.0);
}

/* One cut sheet.  Positive inside the paper, negative outside.
   p.x runs -1 to 1 across the flame's own cell; p.y is 0 at the foot and 1
   where the tips reach.  The shapes are deliberately BOLD: paper cut by hand
   into a few broad licks, not shredded.  Nearly all the difference between
   one sheet and the next comes from scale, lean and seed, so they read as a
   stack rather than as concentric outlines. */
float sheet(vec2 p, float seed, float scale, float speed, float t,
            float spread, float lean){
  float y = clamp(p.y, -0.3, 1.8);
  float rise = t * speed;

  float n1 = fbm(vec2(p.x * 1.10 + seed * 11.0, y * 0.95 - rise));
  float n2 = fbm(vec2(p.x * 2.60 - seed * 7.00, y * 2.10 - rise * 1.45));
  float n3 = vnoise(vec2(p.x * 21.0 + seed * 31.0, y * 27.0 - rise * 1.7));

  /* the body: wide at the foot, tapering to a rounded point */
  float top = 1.00 + 0.10 * n1;
  float w = pow(max(0.0, 1.0 - y / top), 0.44);
  w *= scale * spread * (0.74 + 0.24 * n1);

  /* a gentle lean and curl, and the sheet's own fixed cant so the stack fans */
  float curl = (0.15 * sin(y * 2.2 + rise * 1.00 + seed * 5.3)
              + 0.07 * sin(y * 4.4 - rise * 0.70 + seed * 2.1)) * y * 1.35 * scale * spread
              + lean * y * y;

  float d = w - abs(p.x - curl);
  /* a few bold dents, easing off near the tip so it does not shred */
  d += (n2 - 0.5) * 0.070 * scale * spread * (0.30 + 0.55 * y)
       * (1.0 - 0.65 * smoothstep(0.55, 1.0, y));
  d += (n3 - 0.5) * 0.017 * scale * spread;                /* the torn cut */

  /* one broad lick splitting off to the side, low enough to read as paper */
  float side = sin(seed * 17.0) > 0.0 ? 1.0 : -1.0;
  float tx = curl + side * (0.44 + 0.13 * sin(rise * 0.6 + seed)) * scale * spread;
  float ty = 0.38 + 0.16 * sin(rise * 0.8 + seed * 3.0);
  float tw = 0.34 * scale * spread * max(0.0, 1.0 - abs(y - ty) / 0.52) * (0.62 + 0.45 * n2);
  float tongue = tw - abs(p.x - tx) + (n3 - 0.5) * 0.016 * scale * spread;

  d = max(d, tongue);
  /* Cut it off cleanly above the tip.  Without this the dent noise leaves a
     hair of paper running on up the middle. */
  d -= smoothstep(top, top + 0.22, y) * 0.6;
  return d;
}

/* The low band of paper along the foot of a fire pit, tying the row together.
   A torn top edge, nothing else. */
float floorBand(vec2 uv, float aspect, float h, float t){
  float n = fbm(vec2(uv.x * aspect * 3.4, t * 0.25));
  float n2 = vnoise(vec2(uv.x * aspect * 26.0, t * 0.4));
  float edge = h * (0.72 + 0.34 * n) + (n2 - 0.5) * h * 0.16;
  return edge - uv.y;
}

void main(){
  vec2 uv = vUv;
  float spread = clamp(uSpread, 0.15, 1.0);
  float count = max(1.0, floor(uCount + 0.5));

  /* Split the rectangle into uCount cells side by side.  A torch is one
     cell; a fire pit is a row of them at different heights and phases. */
  float cellW = uAspect / count;
  float cx = uv.x * uAspect;
  float idx = clamp(floor(cx / cellW), 0.0, count - 1.0);
  float lx = (cx - (idx + 0.5) * cellW) / (cellW * 0.5);     /* -1 .. 1 */

  float cellSeed = hash21(vec2(idx + 1.0, 7.31));
  float cellH = mix(0.74, 1.12, hash21(vec2(idx + 3.0, 2.17)));
  if (count < 1.5) cellH = 1.0;
  float cellT = cellSeed * 40.0;

  vec2 p;
  p.x = lx;
  p.y = (uv.y - uBase) / max(0.10, uHeight * cellH);

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  int N = int(uSheets + 0.5);

  for (int i = 0; i < 7; i++){
    if (i >= N) break;
    float fi = float(i);
    float k = fi / max(1.0, float(N - 1));          /* 0 back, 1 core */

    /* 2.5D: the sheets in front travel further with the pointer and the page */
    float amt = 0.055 + 0.110 * k;
    vec2 q = p;
    q.x -= uPointer.x * amt * 1.5;
    q.y -= uPointer.y * amt * 0.35;
    q.y -= uScroll * amt * 0.55;

    /* and they part a little where the pointer is.  Smooth across the
       middle: a sign() here puts a seam straight down the flame. */
    vec2 pp = vec2(uPointer.x * 1.1, uPointer.y * -0.35 + 0.45);
    vec2 dv = (q - pp) * vec2(1.0, 0.70);
    float dd = dot(dv, dv);
    q.x += clamp((q.x - pp.x) * 4.0, -1.0, 1.0) * 0.16 * exp(-dd * 1.8) * (0.30 + k);

    /* inner sheets are narrower AND shorter: that is the stack */
    float scale = mix(1.00, 0.44, k);
    q.y /= mix(1.00, 0.66, k);

    float speed = mix(0.26, 0.66, k);
    float seed  = fi * 3.77 + 1.3 + cellSeed * 9.0;
    float t     = uTime + cellT;
    /* each sheet has its own cant, so the stack fans instead of nesting */
    float lean  = (hash21(vec2(fi + 2.0, 5.5)) - 0.5) * 0.40 * spread;

    float d = sheet(q, seed, scale, speed, t, spread, lean);

    /* the shadow this sheet drops on the one behind it: thick paper */
    vec2 so = vec2(0.042 + 0.022 * k, -0.046 - 0.022 * k);
    float ds = sheet(q - so, seed, scale, speed, t, spread, lean);
    float sh = smoothstep(-0.090, 0.030, ds);
    /* a warm shadow, not a black one: paper in shadow is still paper */
    col = mix(col, col * 0.50 + palette(0.0) * 0.20, sh * 0.92);

    /* flat graded colour, foot to tip */
    vec3 cA = palette(k * 0.92);
    vec3 cB = palette(min(1.0, k * 0.92 + 0.19));
    float g = clamp(q.y * 0.85 + 0.16, 0.0, 1.0);
    vec3 c = mix(cA, cB, smoothstep(0.0, 1.0, g));

    /* paper fibre, each sheet reading a different part of the sheet stock */
    float grain = texture2D(uPaper, (uv + vec2(fi * 0.19, -uTime * speed * 0.010))
                                    * vec2(uAspect, 1.0) * 2.6).r;
    c *= 0.90 + 0.21 * grain;

    /* the deckle: a pale line just inside the cut, catching the light */
    float edge = 1.0 - smoothstep(0.0, 0.034 * scale * spread, d);
    c = mix(c, min(vec3(1.0), c * 1.30 + 0.16), edge * 0.55);

    float aa = fwidth(d) * 1.1 + 0.0009;
    float m = smoothstep(-aa, aa, d);

    col = mix(col, c, m);
    alpha = max(alpha, m);
  }

  /* the low band of paper along the foot, when there is one */
  if (uFloor > 0.001) {
    float fb = floorBand(uv, uAspect, uFloor, uTime);
    float fg = texture2D(uPaper, uv * vec2(uAspect, 1.0) * 3.2).r;
    float fbAA = fwidth(fb) * 1.1 + 0.0009;
    float fm = smoothstep(-fbAA, fbAA, fb);
    vec3 fc = mix(palette(0.02), palette(0.30),
                  smoothstep(0.0, 1.0, uv.y / max(0.0001, uFloor)));
    fc *= 0.90 + 0.20 * fg;
    float fe = 1.0 - smoothstep(0.0, 0.012, fb);
    fc = mix(fc, min(vec3(1.0), fc * 1.35 + 0.14), fe * 0.5);
    col = mix(col, fc, fm);
    alpha = max(alpha, fm);
  }

  /* paper embers: tiny cut flecks lifting off, turning as they go */
  for (int e = 0; e < 8; e++){
    float fe = float(e);
    float sp = 0.13 + 0.10 * hash21(vec2(fe, 3.0));
    float ph = fract(uTime * sp + hash21(vec2(fe, 7.0)));
    vec2 ep;
    ep.x = (floor(hash21(vec2(fe, 11.0)) * count) + 0.5) / count
         + (hash21(vec2(fe, 17.0)) - 0.5) * 0.45 / count
         + 0.10 * sin(ph * 6.2832 + fe) * ph / count;
    ep.y = uBase + uHeight * (0.45 + ph * 0.85);
    float ang = ph * 8.0 + fe;
    vec2 q2 = (uv - ep) * vec2(uAspect, 1.0) * 24.0;
    vec2 r2 = vec2(q2.x * cos(ang) - q2.y * sin(ang),
                   q2.x * sin(ang) + q2.y * cos(ang));
    float fl = (1.0 - step(0.20, abs(r2.x))) * (1.0 - step(0.30, abs(r2.y)));
    float fade = smoothstep(1.0, 0.45, ph) * smoothstep(0.0, 0.12, ph) * uEmbers;
    vec3 ec = mix(vec3(0.99, 0.88, 0.68), vec3(0.86, 0.34, 0.11), ph);
    col = mix(col, ec, fl * fade);
    alpha = max(alpha, fl * fade);
  }

  /* at night the paper is the light in the room: a touch richer and warmer */
  col = mix(col, col * vec3(1.10, 1.01, 0.90), uNight);
  col *= uIntensity;

  if (alpha < 0.002) discard;
  gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(2.2)), alpha * uOpacity);
}`;

const BURN_FRAG = `
precision highp float;
varying vec2 vUv;

uniform float uProgress;
uniform vec2  uOrigin;
uniform float uAspect;
uniform float uOpacity;
uniform vec3  uPaperCol;
uniform sampler2D uPaper;

${NOISE}

void main(){
  vec2 uv = vUv;
  vec2 a = vec2(uAspect, 1.0);
  float d = length((uv - uOrigin) * a);

  /* progress 1 always clears the furthest corner */
  float far = max(max(length((vec2(0.0, 0.0) - uOrigin) * a),
                      length((vec2(1.0, 0.0) - uOrigin) * a)),
                  max(length((vec2(0.0, 1.0) - uOrigin) * a),
                      length((vec2(1.0, 1.0) - uOrigin) * a)));

  float n1 = fbm(uv * a * 5.5);
  float n2 = fbm(uv * a * 17.0 + 4.7);
  float front = uProgress * (far + 0.34);
  float e = d - front + (n1 - 0.5) * 0.30 + (n2 - 0.5) * 0.055;

  /* small holes opening just ahead of the front, the way paper goes */
  float holes = smoothstep(0.60, 0.80, fbm(uv * a * 9.0 + 13.0));
  e -= holes * 0.11 * smoothstep(0.10, 0.0, e);

  float aa = fwidth(e) + 0.0016;
  float paper = smoothstep(-aa, aa, e);

  float grain = texture2D(uPaper, uv * a * 8.0).r;
  float grain2 = texture2D(uPaper, uv * a * 2.2 + 0.37).r;
  vec3 col = uPaperCol * (0.90 + 0.15 * grain + 0.06 * grain2);

  float lit = step(0.0008, uProgress);

  /* char: black at the cut, warming to brown, then back to paper */
  vec3 charCol = mix(vec3(0.05, 0.035, 0.030), vec3(0.24, 0.15, 0.105),
                     smoothstep(0.0, 0.038, e));
  col = mix(charCol, col, smoothstep(0.0, 0.075, e) * lit + (1.0 - lit));

  /* the line of fire in the char, and the last embers hanging past the cut */
  float glow  = exp(-pow(max(e, 0.0) / 0.017, 2.0));
  float core  = exp(-pow(max(e, 0.0) / 0.0055, 2.0));
  /* Keep green well under red or the clamp turns the hot edge lime. */
  col += (vec3(1.00, 0.29, 0.04) * glow * 1.15 + vec3(1.00, 0.56, 0.18) * core * 0.55) * lit;

  float ember = exp(-pow(max(-e, 0.0) / 0.011, 2.0)) * 0.85 * lit;
  float alpha = max(paper, ember);

  if (alpha < 0.003) discard;
  gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(2.2)), alpha * uOpacity);
}`;

/* --- a fire material you can put on any plane ---------------------------- */

export function makeFireMaterial(THREE, opts) {
  opts = opts || {};
  bindPointer();
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FIRE_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: Math.random() * 60 },
      uAspect: { value: opts.aspect || 1 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uScroll: { value: 0 },
      uSheets: { value: Math.max(5, Math.min(7, opts.sheets || 6)) },
      uSpread: { value: opts.spread != null ? opts.spread : 0.80 },
      uBase: { value: opts.base != null ? opts.base : 0.02 },
      uHeight: { value: opts.height != null ? opts.height : 0.94 },
      uCount: { value: opts.count != null ? opts.count : 1 },
      uFloor: { value: opts.floor != null ? opts.floor : 0 },
      uNight: { value: opts.night != null ? opts.night : 0 },
      uIntensity: { value: opts.intensity != null ? opts.intensity : 1 },
      uEmbers: { value: opts.embers != null ? opts.embers : 1 },
      uOpacity: { value: opts.opacity != null ? opts.opacity : 1 },
      uPaper: { value: paperTexture(THREE) }
    }
  });
  return m;
}

/* --- a fire that fills one element --------------------------------------- */

export async function mountFire(stage, el, opts) {
  if (!stage || !el) return null;
  opts = opts || {};
  const THREE = (await import('./vendor/three.module.min.js'));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  camera.position.z = 1;

  const mat = makeFireMaterial(THREE, opts);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(mesh);

  const speed = opts.speed != null ? opts.speed : 1;

  const view = stage.addView({
    el,
    scene,
    camera,
    resize(w, h) { mat.uniforms.uAspect.value = w / Math.max(1, h); },
    onFrame(dt) {
      easePointer(dt);
      mat.uniforms.uTime.value += dt * speed;
      mat.uniforms.uPointer.value.set(_pointer.x, _pointer.y);
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      mat.uniforms.uScroll.value =
        Math.max(-1, Math.min(1, (mid - window.innerHeight / 2) / window.innerHeight * 2));
    }
  });

  return {
    view,
    material: mat,
    setNight(v) { mat.uniforms.uNight.value = v; },
    setIntensity(v) { mat.uniforms.uIntensity.value = v; },
    setTime(t) { mat.uniforms.uTime.value = t; },
    remove() {
      view.remove();
      mesh.geometry.dispose();
      mat.dispose();
    }
  };
}

/* --- the burn-away -------------------------------------------------------- */

/**
 * Burn a sheet of paper off an element (or the whole viewport) from a point.
 * Returns a promise that resolves when the paper has gone.
 *
 *   burnAway(stage, { el, origin: {x, y}, duration: 1150 })
 *   burnAway(stage, { freeze: 0.5 })      // hold still, for ?burn=0.5
 */
export async function burnAway(stage, opts) {
  opts = opts || {};
  if (!stage) return Promise.resolve();
  const THREE = (await import('./vendor/three.module.min.js'));

  const el = opts.el || null;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  camera.position.z = 1;

  /* Parse the hex ourselves: THREE.Color would convert it to linear-sRGB and
     the shader linearises again, which darkens the paper twice over. */
  const hex = (opts.paper || '#EFE6D2').replace('#', '');
  const paperCol = {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: BURN_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uProgress: { value: 0 },
      uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
      uAspect: { value: 1 },
      uOpacity: { value: 1 },
      uPaperCol: { value: new THREE.Vector3(paperCol.r, paperCol.g, paperCol.b) },
      uPaper: { value: paperTexture(THREE) }
    }
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(mesh);

  function setOrigin() {
    const r = el ? el.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const ox = opts.origin ? (opts.origin.x - r.left) / Math.max(1, r.width) : 0.5;
    const oy = opts.origin ? (opts.origin.y - r.top) / Math.max(1, r.height) : 0.5;
    mat.uniforms.uOrigin.value.set(Math.max(0, Math.min(1, ox)),
      1 - Math.max(0, Math.min(1, oy)));       // GL's y runs up
  }
  setOrigin();

  const view = stage.addView({
    el, full: !el, layer: 'over', scene, camera,
    resize(w, h) { mat.uniforms.uAspect.value = w / Math.max(1, h); setOrigin(); }
  });

  const dur = opts.duration || 1150;

  if (typeof opts.freeze === 'number') {
    mat.uniforms.uProgress.value = opts.freeze;
    stage.renderOnce();
    return { hold: true, view, material: mat, remove: () => { view.remove(); mesh.geometry.dispose(); mat.dispose(); } };
  }

  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      // slow start, then it runs away with itself
      const p = k < 0.35 ? (k / 0.35) * 0.18 : 0.18 + Math.pow((k - 0.35) / 0.65, 1.35) * 0.82;
      mat.uniforms.uProgress.value = p;
      if (opts.onProgress) opts.onProgress(p);
      if (!stage.running) stage.renderOnce();
      if (k < 1) requestAnimationFrame(step);
      else {
        view.remove();
        mesh.geometry.dispose();
        mat.dispose();
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}
