/* ==========================================================================
   fire.js - the paper fire, and the burn-away transition.  v3.

   THE PAPER FIRE is not a simulation of fire.  It is a paper theatre set of
   one: five to seven SHEETS of cut paper, stacked in depth, each one a single
   continuous piece running the full width of the box.  Deep lacquer red at
   the back through vermilion, orange and saffron to a pale cream at the
   front, each sheet standing lower than the one behind it so the stack reads
   as bands of graded colour.  The top edge of each is a long undulating run
   of licks - tall tongues, low dips, the odd curl - finished with a torn
   deckle.  Each sheet drifts sideways at its own speed and breathes in
   height, and each drops a soft dark shadow on to the sheet behind it.  That
   shadow is what makes the paper read as thick.  The sheets slide by
   different amounts with the pointer and the scroll: that is the 2.5D.
   It is never a row of separate cones.

   THE BURN-AWAY is the same paper, being eaten by a charred, glowing edge
   travelling out from a point (the lock).  What is behind shows through.

   Both are GLSL fragment shaders on a flat quad, drawn by the one stage in
   gl.js.  The paper fibre is a Canvas 2D texture.

   Public API
   ----------
     mountFire(stage, el, opts)       -> { setNight, setIntensity, remove }
         opts: sheets 5..7, height 0..1 (how tall the back sheet stands),
               base 0..1 (where the foot sits), licks (how many licks run
               across the width), taper 0 a wide band / 1 a torch,
               intensity, embers 0..1, night 0..1
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
uniform float uSheets;     /* 5 to 7 stacked sheets */
uniform float uHeight;     /* 0..1, how tall the back sheet stands */
uniform float uBase;       /* 0..1, where the foot of the sheets sits */
uniform float uLicks;      /* how many licks run across the width */
uniform float uTaper;      /* 0 a wide band, 1 a torch that tapers to the sides */
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

/* THE LICK FIELD.  Every sheet is cut from the SAME run of licks - tall
   tongues, low dips, the odd leaning curl - so the stack nests: a deep red
   tongue with a vermilion one inside it and a pale cream heart inside that.
   Each sheet then sits lower by a fixed amount, which is what turns the
   nesting into visible bands of graded colour.  It is one continuous piece of
   paper running the whole width, never a row of separate cones. */
float profileAt(float x, float speed, float t, float licks, float taper){
  float d = t * speed;
  float u = x * licks;

  float w1 = fbm(vec2(u * 0.85 + d * 0.28, 1.70));
  float w3 = fbm(vec2(u * 4.40 + d * 1.15, 9.10));
  /* warping the sampling makes the licks lean instead of standing as a row
     of symmetrical hills */
  float warp = 0.24 * (w1 - 0.5);
  float w2 = fbm(vec2((u + warp) * 1.90 - d * 0.70, 5.40));

  float base   = 0.30 + 0.22 * w1;
  float tongue = 1.18 * pow(smoothstep(0.38, 1.00, w2), 2.00) * (0.55 + 0.60 * w1);
  float flick  = 0.26 * pow(smoothstep(0.62, 1.00, w3), 2.00);
  float prof = base + tongue + flick;

  prof *= 1.0 + 0.06 * sin(t * (0.50 + speed) + 3.1);          /* breathing */

  /* a torch tapers away at the sides; a fire pit runs edge to edge */
  float env = smoothstep(0.0, 0.30, x) * smoothstep(1.0, 0.70, x);
  prof *= mix(1.0, pow(env, 0.55) * 1.34, clamp(taper, 0.0, 1.0));

  /* a fine torn fray along the cut, and nothing coarser: these licks are cut
     by hand, they are not a saw blade */
  float deckle = (vnoise(vec2(u * 22.0 + d * 1.8, 7.0)) - 0.5) * 0.032
               + (vnoise(vec2(u * 58.0 - d * 2.6, 11.0)) - 0.5) * 0.013;

  return max(0.0, prof + deckle);
}

void main(){
  vec2 uv = vUv;

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  int N = int(uSheets + 0.5);

  /* back to front: the sheet behind is the tallest and the deepest red, the
     sheet in front the lowest and the palest, so the stack reads as bands */
  for (int i = 0; i < 7; i++){
    if (i >= N) break;
    float fi = float(i);
    float k = fi / max(1.0, float(N - 1));

    /* 2.5D: the sheets in front slide further with the pointer and the page */
    float amt = 0.018 + 0.060 * k;
    float x  = uv.x - uPointer.x * amt * 0.75;
    float yy = (uv.y - uBase) - uPointer.y * amt * 0.10 - uScroll * amt * 0.22;

    /* the sheets share the licks and differ by how far down they sit */
    float speed = mix(0.16, 0.34, k);
    float off   = k * 0.62;

    /* the soft shadow this sheet throws on to the taller one behind it.
       That band, just above this sheet's edge, is what sells thick paper. */
    float drop = 0.050 + 0.028 * (1.0 - k);
    float eSh  = uHeight * max(0.0, profileAt(x - drop * 0.42, speed, uTime, uLicks, uTaper) - off);
    float above = yy - eSh;
    float sh = (1.0 - smoothstep(0.0, drop, above)) * step(0.0, above);
    col = mix(col, col * 0.40 + palette(0.0) * 0.20, sh * 0.96);

    float p = profileAt(x, speed, uTime, uLicks, uTaper);
    float e = uHeight * max(0.0, p - off);
    if (e <= 0.0005) continue;

    float aa = fwidth(yy) * 1.2 + 0.0012;
    float m = smoothstep(aa, -aa, yy - e);            /* 1 inside the sheet */

    /* flat graded colour, foot to tip */
    vec3 cA = palette(k * 0.94);
    vec3 cB = palette(min(1.0, k * 0.94 + 0.18));
    float g = clamp(yy / max(0.03, e), 0.0, 1.0);
    vec3 c = mix(cA, cB, smoothstep(0.0, 1.0, g));

    /* paper fibre, each sheet reading a different part of the stock */
    float grain = texture2D(uPaper,
      (vec2(x, yy) + vec2(fi * 0.23, -uTime * speed * 0.010)) * vec2(uAspect, 1.0) * 2.8).r;
    c *= 0.90 + 0.21 * grain;

    /* the deckle catching the light just inside the cut */
    float band = 1.0 - smoothstep(0.0, 0.024, e - yy);
    c = mix(c, min(vec3(1.0), c * 1.32 + 0.16), clamp(band, 0.0, 1.0) * 0.55);

    col = mix(col, c, m);
    alpha = max(alpha, m);
  }

  /* The sheets are mounted at different depths and all of them run down past
     the foot, so without this the very bottom is a blocky mosaic of whichever
     sheet happens to reach that far.  A dark lacquer foot hides the joins,
     the way a trough hides the bottom of a real paper set. */
  if (alpha > 0.0) {
    float footG = texture2D(uPaper, uv * vec2(uAspect, 1.0) * 3.4).r;
    float foot = smoothstep(uBase + 0.16, uBase - 0.01, uv.y);
    col = mix(col, palette(0.04) * (0.72 + 0.26 * footG), foot * 0.94);
  }

  /* paper embers: a few tiny cut flecks lifting off, turning as they go */
  for (int e2 = 0; e2 < 5; e2++){
    float fe = float(e2);
    float sp = 0.12 + 0.09 * hash21(vec2(fe, 3.0));
    float ph = fract(uTime * sp + hash21(vec2(fe, 7.0)));
    vec2 ep;
    ep.x = 0.10 + 0.80 * hash21(vec2(fe, 11.0)) + 0.05 * sin(ph * 6.2832 + fe) * ph;
    ep.y = uBase + uHeight * (0.55 + ph * 0.80);
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
      uBase: { value: opts.base != null ? opts.base : 0.02 },
      uHeight: { value: opts.height != null ? opts.height : 0.80 },
      uLicks: { value: opts.licks != null ? opts.licks : 4.0 },
      uTaper: { value: opts.taper != null ? opts.taper : 0 },
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
